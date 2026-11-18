import { useEffect, useState } from 'react';
import { api, getToken, clearToken } from './api.js';
import Login from './components/Login.jsx';
import Compose from './components/Compose.jsx';
import History from './components/History.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [tab, setTab] = useState('compose');

  // Page reload par token se user wapas load karo
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  // Kisi bhi API se 401 aaye to login par bhejo
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const logout = () => {
    clearToken();
    setUser(null);
  };

  if (checking) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Mail Center</div>
        <nav className="tabs">
          <button className={tab === 'compose' ? 'tab active' : 'tab'} onClick={() => setTab('compose')}>
            Compose
          </button>
          <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
            Sent mails
          </button>
        </nav>
        <div className="user">
          <span className="muted">{user.name}</span>
          <button className="btn ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="content">
        {tab === 'compose' ? <Compose onSent={() => setTab('history')} /> : <History />}
      </main>
    </div>
  );
}
