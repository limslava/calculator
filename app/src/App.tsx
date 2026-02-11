import { useEffect, useMemo, useState } from 'react';
import Sidebar, { type PageId } from './components/Sidebar';
import ComplexRatesPage from './features/complex/ComplexRatesPage';
import DirectRailRatesPage from './features/directRail/DirectRailRatesPage';
import DirectSeaRatesPage from './features/directSea/DirectSeaRatesPage';
import RailRatesPage from './features/rail/RailRatesPage';
import SeaRatesPage from './features/sea/SeaRatesPage';
import UploadDirectRailPage from './features/upload/UploadDirectRailPage';
import UploadDirectSeaPage from './features/upload/UploadDirectSeaPage';
import UploadRailPage from './features/upload/UploadRailPage';
import UploadSeaPage from './features/upload/UploadSeaPage';
import AgentTariffsPage from './features/tariffs/AgentTariffsPage';
import TerminalTariffsPage from './features/tariffs/TerminalTariffsPage';
import UserManagementPage from './features/admin/UserManagementPage';
import EmailSettingsPage from './features/admin/EmailSettingsPage';
import UploadHistoryPage from './features/admin/UploadHistoryPage';
import AccountSettingsPage from './features/account/AccountSettingsPage';

type User = {
  id?: number;
  email: string;
  fullName?: string;
  role?: string;
};

export default function App() {
  const [status, setStatus] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking');
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<PageId>('complex');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarVariant = 'sidebar-variant-c';
  const [email, setEmail] = useState('admin@logistics.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const allowedPages = useMemo(() => {
    const salesPages: PageId[] = ['complex', 'sea', 'directSea', 'rail', 'directRail'];
    const purchaserPages: PageId[] = [
      'uploadSea',
      'uploadDirectSea',
      'uploadRail',
      'uploadDirectRail',
      'tariffTerminal',
      'tariffAgent'
    ];
    const adminPages: PageId[] = [
      ...salesPages,
      ...purchaserPages,
      'adminUsers',
      'adminEmail',
      'adminHistory',
      'account'
    ];
    if (!user?.role) return salesPages;
    if (user.role === 'admin') return adminPages;
    if (user.role === 'purchaser') return [...purchaserPages, 'account'];
    return [...salesPages, 'account'];
  }, [user?.role]);

  const defaultPage = useMemo<PageId>(() => {
    if (!user?.role) return 'complex';
    if (user.role === 'purchaser') return 'uploadSea';
    return 'complex';
  }, [user?.role]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('auth_token');
    setUser(null);
    setStatus('unauthenticated');
  };

  const checkSession = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('unauthorized');
      }

      const userData = (await response.json()) as User;
      setUser(userData);
      setStatus('authenticated');
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
      setStatus('unauthenticated');
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!user?.role) return;
    if (!allowedPages.includes(activePage)) {
      setActivePage(defaultPage);
    }
  }, [user?.role, activePage, allowedPages, defaultPage]);


  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || 'Не удалось войти');
        setSubmitting(false);
        return;
      }

      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      setStatus('authenticated');
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="app-shell">
        <main className="app-content container">
          <div className="section auth-card">
            <div className="section-header">
              <h2>Загрузка</h2>
            </div>
            <p className="muted">Проверяем сессию…</p>
          </div>
        </main>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="app-shell">
        <main className="app-content container">
          <div className="auth-shell">
            <div className="section auth-card">
              <div className="section-header">
                <h2>Вход</h2>
              </div>
              <form className="auth-form" onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-password">Пароль</label>
                  <input
                    id="login-password"
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error && <div className="status warning">{error}</div>}
                <div className="auth-actions">
                  <button className="btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Входим…' : 'Войти'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`app-shell app-layout ${sidebarVariant} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {!sidebarCollapsed && user && (
        <Sidebar
          user={user}
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={handleLogout}
          onCollapse={() => setSidebarCollapsed(true)}
        />
      )}
      <div className="app-main">
        {sidebarCollapsed && (
          <button
            type="button"
            className="sidebar-show-btn"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Показать меню"
          >
            ☰
          </button>
        )}
        <main className="app-content container">
          {activePage === 'complex' && <ComplexRatesPage onUnauthorized={handleLogout} />}
          {activePage === 'sea' && <SeaRatesPage onUnauthorized={handleLogout} />}
          {activePage === 'directSea' && <DirectSeaRatesPage onUnauthorized={handleLogout} />}
          {activePage === 'rail' && <RailRatesPage onUnauthorized={handleLogout} />}
          {activePage === 'directRail' && <DirectRailRatesPage onUnauthorized={handleLogout} />}
          {activePage === 'uploadSea' && <UploadSeaPage onUnauthorized={handleLogout} />}
          {activePage === 'uploadDirectSea' && <UploadDirectSeaPage onUnauthorized={handleLogout} />}
          {activePage === 'uploadRail' && <UploadRailPage onUnauthorized={handleLogout} />}
          {activePage === 'uploadDirectRail' && <UploadDirectRailPage onUnauthorized={handleLogout} />}
          {activePage === 'tariffTerminal' && <TerminalTariffsPage onUnauthorized={handleLogout} />}
          {activePage === 'tariffAgent' && <AgentTariffsPage onUnauthorized={handleLogout} />}
          {activePage === 'adminUsers' && <UserManagementPage onUnauthorized={handleLogout} />}
          {activePage === 'adminEmail' && <EmailSettingsPage onUnauthorized={handleLogout} />}
          {activePage === 'adminHistory' && <UploadHistoryPage onUnauthorized={handleLogout} />}
          {activePage === 'account' && user && (
            <AccountSettingsPage
              userId={user.id ?? 0}
              isAdmin={user.role === 'admin'}
              onUnauthorized={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}
