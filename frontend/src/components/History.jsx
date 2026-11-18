import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// const STATUSES = ['queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed'];
const STATUSES = ['queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed'];

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export default function History() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 15 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.listEmails({ page, status, search });
        setData(res);
        setError('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [page, status, search]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Webhook se status badalta rehta hai, isliye har 15 sec me chupchap refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  const openDetail = async (id) => {
    try {
      const res = await api.getEmail(id);
      setSelected(res);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div className="toolbar">
        <h2>Sent mails</h2>
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <input
            placeholder="Search subject or recipient"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn">Search</button>
          <button type="button" className="btn ghost" onClick={() => load()}>
            Refresh
          </button>
        </form>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>To</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Sent by</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="muted center-text">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="muted center-text">
                  No mails found
                </td>
              </tr>
            )}
            {!loading &&
              data.items.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => openDetail(m.id)}>
                  <td className="nowrap">{fmt(m.created_at)}</td>
                  <td>
                    {m.to_emails[0]}
                    {m.to_emails.length > 1 && <span className="muted"> +{m.to_emails.length - 1}</span>}
                  </td>
                  <td className="subject">{m.subject}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td>{m.sent_by_name || '-'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="muted">
          {data.total} mail{data.total === 1 ? '' : 's'}
        </span>
        <div>
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
          <span className="page-num">
            {page} / {totalPages}
          </span>
          <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>

      {selected && <Detail data={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Detail({ data, onClose }) {
  const { email, events } = data;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{email.subject}</h3>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="meta">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={email.status} />
          </dd>
          <dt>From</dt>
          <dd>{email.from_email}</dd>
          <dt>To</dt>
          <dd>{email.to_emails.join(', ')}</dd>
          {email.cc_emails.length > 0 && (
            <>
              <dt>Cc</dt>
              <dd>{email.cc_emails.join(', ')}</dd>
            </>
          )}
          {email.bcc_emails.length > 0 && (
            <>
              <dt>Bcc</dt>
              <dd>{email.bcc_emails.join(', ')}</dd>
            </>
          )}
          <dt>Sent</dt>
          <dd>{fmt(email.created_at)}</dd>
          {email.attachment_names.length > 0 && (
            <>
              <dt>Files</dt>
              <dd>{email.attachment_names.join(', ')}</dd>
            </>
          )}
          {email.error_message && (
            <>
              <dt>Error</dt>
              <dd className="error-text">{email.error_message}</dd>
            </>
          )}
        </dl>

        <h4>Message</h4>
        <pre className="body">{email.text_body || '(HTML only)'}</pre>

        <h4>Delivery timeline</h4>
        {events.length === 0 ? (
          <p className="muted">No delivery events yet (coming from Webhook).</p>
        ) : (
          <ul className="timeline">
            {events.map((ev, i) => (
              <li key={i}>
                <StatusBadge status={ev.event_type.replace('email.', '')} />
                <span className="muted">{fmt(ev.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
