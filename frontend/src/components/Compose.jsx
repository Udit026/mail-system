import { useRef, useState } from 'react';
import { api } from '../api.js';
import RecipientInput from './RecipientInput.jsx';

const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Plain text ko simple HTML me badlo (paragraphs + line breaks)
const textToHtml = (text) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('');

const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const formatSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default function Compose({ onSent }) {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [replyTo, setReplyTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Har naye mail ke liye ek unique key. Double-click / retry par duplicate mail nahi jaayegi.
  const idemKey = useRef(crypto.randomUUID());
  const fileInput = useRef(null);

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  const addFiles = (list) => {
    const next = [...files, ...Array.from(list)];
    if (next.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_BYTES) {
      setError('Attachments too large (max 10 MB total)');
      return;
    }
    setError('');
    setFiles(next);
  };

  const reset = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setReplyTo('');
    setSubject('');
    setBody('');
    setFiles([]);
    if (fileInput.current) fileInput.current.value = '';
    idemKey.current = crypto.randomUUID();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!to.length) return setError('Add at least one recipient');
    if (!subject.trim()) return setError('Subject is required');
    if (!body.trim()) return setError('Write something in the mail body');

    setSending(true);
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({ filename: f.name, content: await readAsBase64(f) }))
      );

      await api.sendEmail({
        to,
        cc,
        bcc,
        replyTo: replyTo.trim() || undefined,
        subject: subject.trim(),
        text: body,
        html: textToHtml(body),
        attachments,
        idempotencyKey: idemKey.current,
      });

      setSuccess('Mail sent successfully!');
      reset();
      setTimeout(() => onSent?.(), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="card compose" onSubmit={submit}>
      <h2>New mail</h2>

      <RecipientInput label="To" values={to} onChange={setTo} placeholder="name@example.com" required />

      {!showCcBcc ? (
        <button type="button" className="link" onClick={() => setShowCcBcc(true)}>
          + Add Cc / Bcc / Reply-to
        </button>
      ) : (
        <>
          <RecipientInput label="Cc" values={cc} onChange={setCc} />
          <RecipientInput label="Bcc" values={bcc} onChange={setBcc} />
          <label className="field">
            <span className="label">Reply-to</span>
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="Replies will go to this address"
            />
          </label>
        </>
      )}

      <label className="field">
        <span className="label">
          Subject<span className="req"> *</span>
        </span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
      </label>

      <label className="field">
        <span className="label">
          Message<span className="req"> *</span>
        </span>
        <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>

      <div className="field">
        <span className="label">Attachments</span>
        <input ref={fileInput} type="file" multiple onChange={(e) => addFiles(e.target.files)} />
        {files.length > 0 && (
          <ul className="files">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                {f.name} <span className="muted">({formatSize(f.size)})</span>
                <button type="button" className="link" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  remove
                </button>
              </li>
            ))}
            <li className="muted">Total: {formatSize(totalBytes)} / 10 MB</li>
          </ul>
        )}
      </div>

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      <div className="actions">
        <button className="btn primary" disabled={sending}>
          {sending ? 'Sending…' : 'Send mail'}
        </button>
      </div>
    </form>
  );
}
