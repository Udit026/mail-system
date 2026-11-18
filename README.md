# Mail Center (Single Mail System)

React + Vite (frontend) · Node.js + Express (backend) · PostgreSQL · Resend

```
React  ->  Node.js API  ->  Resend  ->  Recipient
                |                          |
           PostgreSQL  <---- Webhook ------+
```

## Features
- Login (JWT) — sirf authorized log mail bhej sakte hain
- Single mail: To / Cc / Bcc / Reply-to / Subject / Message / Attachments (max 10 MB)
- Har mail DB me save (queued -> sent -> delivered / bounced / failed)
- Resend webhook se live status (signature verified)
- Sent mails history: search, status filter, pagination, detail + delivery timeline
- Double-click safe (idempotency key), rate limiting, helmet, CORS

## 1. Pehle Resend setup
1. https://resend.com par account banao
2. **Domains** me apna domain add karo, DNS records (SPF, DKIM) apne domain provider me daalo, **Verify** karo
3. **API Keys** me key banao (Sending access kaafi hai)
4. Testing ke liye domain verify hone se pehle `onboarding@resend.dev` se sirf **apne account ke email** par bheja ja sakta hai

## 2. Database
PostgreSQL me ek database banao:
```sql
CREATE DATABASE mailsystem;
```

## 3. Backend chalao
```bash
cd backend
npm install
cp .env.example .env      # .env me apni values bharo
npm run migrate           # tables ban jaayengi
npm run create-user -- "Your Name" you@yourcompany.com StrongPass123 admin
npm run dev               # http://localhost:4000
```

## 4. Frontend chalao
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```
Browser me kholo, jo user banaya usse login karo, aur mail bhejo.

## 5. Webhook (delivery status ke liye)
Webhook ke bina mail jaayegi, par status sirf `sent` rahega (delivered/bounced nahi dikhega).

1. Backend ko public URL do. Local testing ke liye: `ngrok http 4000`
2. Resend dashboard -> **Webhooks** -> Add endpoint:
   `https://<your-public-url>/api/webhooks/resend`
3. Events chuno: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` (opened/clicked optional)
4. Dashboard jo **Signing secret** (`whsec_...`) deta hai, use `.env` me `RESEND_WEBHOOK_SECRET` me daalo, backend restart karo

## API endpoints
| Method | Path | Kaam |
|---|---|---|
| POST | /api/auth/login | Login, token milta hai |
| GET | /api/auth/me | Current user |
| POST | /api/emails/send | Single mail bhejo |
| GET | /api/emails | History (page, limit, status, search) |
| GET | /api/emails/:id | Mail detail + events |
| POST | /api/webhooks/resend | Resend webhook (public, signature verified) |
| GET | /api/health | Server + DB check |

`POST /api/emails/send` body:
```json
{
  "to": ["a@example.com"],
  "cc": [],
  "bcc": [],
  "replyTo": "support@yourcompany.com",
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>HTML body</p>",
  "attachments": [{ "filename": "invoice.pdf", "content": "<base64>" }],
  "idempotencyKey": "unique-string"
}
```

## Production me daalte time
- `JWT_SECRET` lamba random rakho, `.env` kabhi git me commit mat karo
- Backend HTTPS par chalao (webhook ke liye zaruri)
- Frontend alag domain par ho to `frontend/.env` me `VITE_API_URL=https://api.yourcompany.com` aur backend `.env` me `CLIENT_ORIGIN=https://app.yourcompany.com`
- Frontend build: `npm run build`, phir `dist/` folder kisi bhi static hosting par
- Resend plan ki daily/monthly sending limit check kar lena

## Folder structure
```
backend/
  schema.sql
  src/
    index.js            # server
    config.js           # env
    db.js               # postgres pool
    middleware/auth.js  # JWT check
    routes/             # auth, emails, webhooks
    services/resend.js  # Resend call
    scripts/            # migrate, createUser
frontend/
  src/
    App.jsx, api.js
    components/         # Login, Compose, History, RecipientInput
```

## Aage kya add kar sakte ho
Templates, contacts, bulk/campaigns (queue + batch API), unsubscribe flow, scheduled mails.
