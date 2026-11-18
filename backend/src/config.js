import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name} (check your .env file)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  resendApiKey: required('RESEND_API_KEY'),
  mailFrom: required('MAIL_FROM'),
  // Webhook optional rakha hai: bina secret ke webhook endpoint band rahega
  resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
};
