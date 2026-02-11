import { useEffect, useState } from 'react';
import { makeAuthRequest } from '../shared/api';

type PageProps = {
  onUnauthorized?: () => void;
};

type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

const PROVIDERS = [
  { value: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587 },
  { value: 'yandex', label: 'Yandex', host: 'smtp.yandex.ru', port: 587 },
  { value: 'mailru', label: 'Mail.ru', host: 'smtp.mail.ru', port: 587 },
  { value: 'custom', label: 'Другое', host: '', port: 587 }
];

const buildConfig = (host: string, port: number, user: string, pass: string): EmailConfig => ({
  host,
  port,
  secure: Number(port) === 465,
  auth: {
    user,
    pass
  }
});

export default function EmailSettingsPage({ onUnauthorized }: PageProps) {
  const [provider, setProvider] = useState('custom');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('email_config');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as EmailConfig;
      setHost(parsed.host || '');
      setPort(parsed.port || 587);
      setUser(parsed.auth?.user || '');
      setPass(parsed.auth?.pass || '');

      const foundProvider = PROVIDERS.find(p => parsed.host?.includes(p.host))?.value;
      setProvider(foundProvider || 'custom');
    } catch {
      // ignore
    }
  }, []);

  const applyProvider = (value: string) => {
    setProvider(value);
    const preset = PROVIDERS.find(p => p.value === value);
    if (!preset) return;
    setHost(preset.host);
    setPort(preset.port);
  };

  const handleSave = () => {
    setStatus(null);
    setError(null);
    if (!host || !user || !pass) {
      setError('Заполните SMTP host, email и пароль');
      return;
    }
    const config = buildConfig(host, Number(port) || 587, user, pass);
    localStorage.setItem('email_config', JSON.stringify(config));
    setStatus('Настройки email сохранены');
  };

  const handleTest = async () => {
    setStatus(null);
    setError(null);
    if (!host || !user || !pass) {
      setError('Заполните SMTP host, email и пароль');
      return;
    }
    setTesting(true);
    const config = buildConfig(host, Number(port) || 587, user, pass);
    try {
      const response = await makeAuthRequest('/api/send-email/test', {
        method: 'POST',
        body: JSON.stringify({ config })
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось проверить SMTP');
      }
      setStatus(data.message || 'SMTP соединение успешно');
      localStorage.setItem('email_config', JSON.stringify(config));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки SMTP');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="section admin-section">
      <div className="section-header">
        <h2>Настройка email</h2>
      </div>
      <div className="admin-grid">
        <div className="admin-form">
          <div className="admin-form-title">SMTP параметры</div>
          <div className="admin-form-row">
            <div className="form-group">
              <label htmlFor="email-provider">Сервис</label>
              <select
                id="email-provider"
                className="form-input"
                value={provider}
                onChange={event => applyProvider(event.target.value)}
              >
                {PROVIDERS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="smtp-host">SMTP host</label>
              <input
                id="smtp-host"
                className="form-input"
                value={host}
                onChange={event => setHost(event.target.value)}
                type="text"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp-port">Порт</label>
              <input
                id="smtp-port"
                className="form-input"
                value={port}
                onChange={event => setPort(Number(event.target.value))}
                type="number"
                min={1}
                max={65535}
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp-user">Email (логин)</label>
              <input
                id="smtp-user"
                className="form-input"
                value={user}
                onChange={event => setUser(event.target.value)}
                type="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="smtp-pass">Пароль / токен</label>
              <input
                id="smtp-pass"
                className="form-input"
                value={pass}
                onChange={event => setPass(event.target.value)}
                type="password"
              />
            </div>
            <div className="admin-form-actions">
              <button type="button" className="btn-primary" onClick={handleSave}>
                Сохранить
              </button>
              <button type="button" className="btn-secondary" onClick={handleTest} disabled={testing}>
                {testing ? 'Проверяем…' : 'Проверить SMTP'}
              </button>
            </div>
          </div>
          {status && <div className="status success">{status}</div>}
          {error && <div className="status warning">{error}</div>}
          <p className="muted">
            Настройки сохраняются локально в браузере и используются при отправке писем.
          </p>
        </div>
      </div>
    </section>
  );
}
