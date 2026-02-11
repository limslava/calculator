import { useState } from 'react';
import { makeAuthRequest } from '../shared/api';

type PageProps = {
  userId: number;
  isAdmin?: boolean;
  onUnauthorized?: () => void;
};

export default function AccountSettingsPage({ userId, isAdmin, onUnauthorized }: PageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!isAdmin && !currentPassword) {
      setError('Введите текущий пароль');
      return;
    }

    setSaving(true);
    try {
      const response = await makeAuthRequest(`/api/users/${userId}/change-password`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword
        })
      });

      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось изменить пароль');
      }

      setStatus('Пароль обновлен');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section admin-section">
      <div className="section-header">
        <h2>Смена пароля</h2>
      </div>
      <div className="admin-grid">
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-form-row">
            {!isAdmin && (
              <div className="form-group">
                <label htmlFor="current-password">Текущий пароль</label>
                <input
                  id="current-password"
                  className="form-input"
                  type="password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="new-password">Новый пароль</label>
              <input
                id="new-password"
                className="form-input"
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Повторите пароль</label>
              <input
                id="confirm-password"
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                required
              />
            </div>
            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </div>
          {status && <div className="status success">{status}</div>}
          {error && <div className="status warning">{error}</div>}
          <p className="muted">
            Если пароль забыт, администратор может сбросить его через управление пользователями.
          </p>
        </form>
      </div>
    </section>
  );
}
