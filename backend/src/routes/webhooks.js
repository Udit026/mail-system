import { Router } from 'express';
import { Webhook } from 'svix';
import { query } from '../db.js';
import { config } from '../config.js';

const router = Router();

// Resend event -> hamare DB ka status
const STATUS_BY_EVENT = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  // email.opened / email.clicked sirf event table me jaate hain, status nahi badalta
};

// Status ki "progress" order: purana event late aaye to status peeche na jaaye
const RANK = { queued: 0, sent: 1, delayed: 2, delivered: 3, bounced: 4, complained: 5, failed: 4 };

/**
 * IMPORTANT: ye route express.raw() ke saath mount hota hai (index.js dekho),
 * kyunki signature verify ke liye original raw body chahiye.
 */
router.post('/resend', async (req, res) => {
  if (!config.resendWebhookSecret) {
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const rawBody = req.body.toString('utf8');
  let event;

  try {
    const wh = new Webhook(config.resendWebhookSecret);
    event = wh.verify(rawBody, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature'],
    });
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const resendEmailId = event?.data?.email_id;
  const type = event?.type;
  if (!resendEmailId || !type) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  // 1) Event save (svix-id unique hai, duplicate delivery ignore ho jaati hai)
  const webhookId = req.headers['svix-id'];
  const inserted = await query(
    `INSERT INTO email_events (webhook_id, resend_email_id, event_type, payload)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (webhook_id) DO NOTHING
     RETURNING id`,
    [webhookId, resendEmailId, type, event]
  );
  if (inserted.rowCount === 0) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  // 2) Email ka status update (sirf aage ki taraf)
  const newStatus = STATUS_BY_EVENT[type];
  if (newStatus) {
    const current = await query('SELECT status FROM emails WHERE resend_email_id = $1', [resendEmailId]);
    const currentStatus = current.rows[0]?.status;
    if (currentStatus && (RANK[newStatus] ?? 0) >= (RANK[currentStatus] ?? 0)) {
      await query(
        `UPDATE emails SET status = $1, updated_at = now() WHERE resend_email_id = $2`,
        [newStatus, resendEmailId]
      );
    }
  }

  // Resend ko jaldi 2xx chahiye
  res.status(200).json({ ok: true });
});

export default router;
