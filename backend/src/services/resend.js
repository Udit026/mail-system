import { Resend } from 'resend';
import { config } from '../config.js';

const resend = new Resend(config.resendApiKey);

/**
 * Resend ko ek mail bhejta hai.
 * Success par { id } return karta hai, fail par Error throw karta hai.
 *
 * idempotencyKey: same key se dobara call karne par Resend duplicate mail nahi bhejta
 * (network retry / double-click se bachne ke liye).
 */
export async function sendWithResend(mail, idempotencyKey) {
  const payload = {
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
  };

  if (mail.cc?.length) payload.cc = mail.cc;
  if (mail.bcc?.length) payload.bcc = mail.bcc;
  if (mail.replyTo) payload.replyTo = mail.replyTo;
  if (mail.html) payload.html = mail.html;
  if (mail.text) payload.text = mail.text;
  if (mail.attachments?.length) payload.attachments = mail.attachments;

  const { data, error } = await resend.emails.send(
    payload,
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    const err = new Error(error.message || 'Resend request failed');
    err.statusCode = error.statusCode;
    err.resendName = error.name;
    throw err;
  }

  return { id: data.id };
}
