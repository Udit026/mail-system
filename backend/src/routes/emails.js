import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { sendWithResend } from '../services/resend.js';

const router = Router();
router.use(requireAuth);

// Galti se / misuse se bachne ke liye: 30 mails / minute / IP
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many emails sent. Please slow down.' },
});

const MAX_RECIPIENTS = 50; // single mail ke liye kaafi; Resend ki limit bhi 50 hai
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB total

const emailList = z.array(z.email()).max(MAX_RECIPIENTS);

const sendSchema = z
  .object({
    to: emailList.min(1, 'At least one recipient required'),
    cc: emailList.optional().default([]),
    bcc: emailList.optional().default([]),
    replyTo: z.email().optional(),
    subject: z.string().trim().min(1, 'Subject required').max(300),
    html: z.string().optional(),
    text: z.string().optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().min(1).max(200),
          content: z.string().min(1), // base64
        })
      )
      .max(10)
      .optional()
      .default([]),
    // Frontend har "Send" click par ek unique key bhejta hai (double-click safe)
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((d) => (d.html && d.html.trim()) || (d.text && d.text.trim()), {
    message: 'Mail body required',
    path: ['text'],
  });

// base64 string ka approx decoded size
const base64Bytes = (b64) => Math.floor((b64.length * 3) / 4);

// ---------- POST /api/emails/send ----------
router.post('/send', sendLimiter, async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({
      error: first?.message || 'Invalid input',
      field: first?.path?.join('.'),
    });
  }
  const d = parsed.data;

  const totalBytes = d.attachments.reduce((sum, a) => sum + base64Bytes(a.content), 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return res.status(400).json({ error: 'Attachments too large (max 10 MB total)' });
  }

  const from = config.mailFrom;

  // 1) Pehle DB me record (status: queued)
  const insert = await query(
    `INSERT INTO emails
       (from_email, to_emails, cc_emails, bcc_emails, reply_to, subject,
        html_body, text_body, attachment_names, status, sent_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued',$10)
     RETURNING id`,
    [
      from,
      d.to,
      d.cc,
      d.bcc,
      d.replyTo || null,
      d.subject,
      d.html || null,
      d.text || null,
      d.attachments.map((a) => a.filename),
      req.user.id,
    ]
  );
  const emailId = insert.rows[0].id;

  // 2) Resend ko call
  try {
    const { id: resendId } = await sendWithResend(
      {
        from,
        to: d.to,
        cc: d.cc,
        bcc: d.bcc,
        replyTo: d.replyTo,
        subject: d.subject,
        html: d.html,
        text: d.text,
        attachments: d.attachments,
      },
      d.idempotencyKey || crypto.randomUUID()
    );

    // 3) Success: status 'sent' + resend id save
    await query(
      `UPDATE emails SET status='sent', resend_email_id=$1, updated_at=now() WHERE id=$2`,
      [resendId, emailId]
    );

    return res.status(201).json({ id: emailId, resendId, status: 'sent' });
  } catch (err) {
    console.error('Resend send failed:', err.message);

    await query(
      `UPDATE emails SET status='failed', error_message=$1, updated_at=now() WHERE id=$2`,
      [err.message, emailId]
    );

    // Client ki galti (validation, domain verify nahi, etc.) = 4xx, baaki 502
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? 400 : 502;
    return res.status(status).json({ id: emailId, status: 'failed', error: err.message });
  }
});

// ---------- GET /api/emails  (history) ----------
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const where = [];
  const params = [];

  if (status) {
    params.push(status);
    where.push(`e.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(e.subject ILIKE $${params.length} OR array_to_string(e.to_emails, ',') ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(`SELECT COUNT(*)::int AS total FROM emails e ${whereSql}`, params);

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT e.id, e.resend_email_id, e.from_email, e.to_emails, e.cc_emails, e.subject,
            e.status, e.error_message, e.created_at, e.updated_at, u.name AS sent_by_name
       FROM emails e
       LEFT JOIN users u ON u.id = e.sent_by
       ${whereSql}
      ORDER BY e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ items: rows, total: countRes.rows[0].total, page, limit });
});

// ---------- GET /api/emails/:id  (detail + events) ----------
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const { rows } = await query(
    `SELECT e.*, u.name AS sent_by_name
       FROM emails e LEFT JOIN users u ON u.id = e.sent_by
      WHERE e.id = $1`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Email not found' });

  let events = [];
  if (rows[0].resend_email_id) {
    const ev = await query(
      `SELECT event_type, created_at FROM email_events
        WHERE resend_email_id = $1 ORDER BY created_at ASC`,
      [rows[0].resend_email_id]
    );
    events = ev.rows;
  }

  res.json({ email: rows[0], events });
});

export default router;
