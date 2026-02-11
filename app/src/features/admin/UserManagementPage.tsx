import { useEffect, useMemo, useState } from 'react';
import { makeAuthRequest } from '../shared/api';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  sales: 'Менеджер по продажам',
  purchaser: 'Менеджер по закупу'
};

const ROLE_OPTIONS = [
  { value: 'sales', label: 'Менеджер по продажам' },
  { value: 'purchaser', label: 'Менеджер по закупу' },
  { value: 'admin', label: 'Администратор' }
];

type UserRow = {
  id: number;
  email: string;
  fullName?: string;
  role?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string | null;
};

type PageProps = {
  onUnauthorized?: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
};

export default function UserManagementPage({ onUnauthorized }: PageProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{ email: string; password: string; message: string } | null>(
    null
  );
  const [createForm, setCreateForm] = useState({
    email: '',
    fullName: '',
    role: 'sales'
  });

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [users]);

  const handleUnauthorized = () => {
    onUnauthorized?.();
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeAuthRequest('/api/users');
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Не удалось загрузить список пользователей');
      }
      const data = (await response.json()) as UserRow[];
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setStatus(null);
    setPasswordNotice(null);

    try {
      const payload = {
        email: createForm.email.trim(),
        fullName: createForm.fullName.trim(),
        role: createForm.role
      };
      const response = await makeAuthRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось создать пользователя');
      }
      setUsers(prev => [data.user, ...prev]);
      setStatus('Пользователь создан');
      setPasswordNotice({
        email: data.user.email,
        password: data.generatedPassword,
        message: 'Сгенерирован пароль для входа'
      });
      setCreateForm({ email: '', fullName: '', role: 'sales' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания пользователя');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (user: UserRow) => {
    setEditingUser({ ...user });
    setStatus(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    setError(null);
    setStatus(null);
    try {
      const response = await makeAuthRequest(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          email: editingUser.email,
          fullName: editingUser.fullName,
          role: editingUser.role
        })
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось обновить пользователя');
      }
      setUsers(prev => prev.map(user => (user.id === editingUser.id ? data.user : user)));
      setStatus('Данные пользователя обновлены');
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления пользователя');
    }
  };

  const toggleStatus = async (userId: number) => {
    setError(null);
    setStatus(null);
    try {
      const response = await makeAuthRequest(`/api/users/${userId}/toggle-status`, { method: 'PUT' });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось изменить статус');
      }
      setUsers(prev => prev.map(user => (user.id === userId ? data.user : user)));
      setStatus(data.message || 'Статус пользователя обновлен');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка изменения статуса');
    }
  };

  const resetPassword = async (user: UserRow) => {
    if (!window.confirm(`Сбросить пароль для ${user.email}?`)) return;
    setError(null);
    setStatus(null);
    setPasswordNotice(null);
    try {
      const response = await makeAuthRequest(`/api/users/${user.id}/reset-password`, { method: 'POST' });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось сбросить пароль');
      }
      setPasswordNotice({
        email: user.email,
        password: data.generatedPassword,
        message: 'Пароль сброшен'
      });
      setStatus(data.message || 'Пароль сброшен');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сброса пароля');
    }
  };

  const deleteUser = async (user: UserRow) => {
    if (!window.confirm(`Удалить пользователя ${user.email}?`)) return;
    setError(null);
    setStatus(null);
    try {
      const response = await makeAuthRequest(`/api/users/${user.id}`, { method: 'DELETE' });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось удалить пользователя');
      }
      setUsers(prev => prev.filter(item => item.id !== user.id));
      setStatus(data.message || 'Пользователь удален');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления пользователя');
    }
  };

  return (
    <section className="section admin-section">
      <div className="section-header">
        <h2>Управление пользователями</h2>
        <button type="button" className="btn-secondary" onClick={loadUsers} disabled={loading}>
          {loading ? 'Обновляем…' : 'Обновить'}
        </button>
      </div>

      <div className="admin-grid">
        <form className="admin-form" onSubmit={handleCreate}>
          <div className="admin-form-title">Добавить пользователя</div>
          <div className="admin-form-row">
            <div className="form-group">
              <label htmlFor="new-user-email">Email</label>
              <input
                id="new-user-email"
                className="form-input"
                value={createForm.email}
                onChange={event => setCreateForm(prev => ({ ...prev, email: event.target.value }))}
                type="email"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-user-name">ФИО</label>
              <input
                id="new-user-name"
                className="form-input"
                value={createForm.fullName}
                onChange={event => setCreateForm(prev => ({ ...prev, fullName: event.target.value }))}
                type="text"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="new-user-role">Роль</label>
              <select
                id="new-user-role"
                className="form-input"
                value={createForm.role}
                onChange={event => setCreateForm(prev => ({ ...prev, role: event.target.value }))}
              >
                {ROLE_OPTIONS.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-form-actions">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Создаем…' : 'Создать'}
              </button>
            </div>
          </div>
          {passwordNotice && (
            <div className="status success admin-password">
              {passwordNotice.message}: {passwordNotice.email} · пароль: <strong>{passwordNotice.password}</strong>
            </div>
          )}
          {status && <div className="status success">{status}</div>}
          {error && <div className="status warning">{error}</div>}
        </form>

        {editingUser && (
          <form className="admin-form" onSubmit={saveEdit}>
            <div className="admin-form-title">Редактирование пользователя</div>
            <div className="admin-form-row">
              <div className="form-group">
                <label htmlFor="edit-user-email">Email</label>
                <input
                  id="edit-user-email"
                  className="form-input"
                  value={editingUser.email}
                  onChange={event =>
                    setEditingUser(prev => (prev ? { ...prev, email: event.target.value } : prev))
                  }
                  type="email"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-user-name">ФИО</label>
                <input
                  id="edit-user-name"
                  className="form-input"
                  value={editingUser.fullName || ''}
                  onChange={event =>
                    setEditingUser(prev => (prev ? { ...prev, fullName: event.target.value } : prev))
                  }
                  type="text"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-user-role">Роль</label>
                <select
                  id="edit-user-role"
                  className="form-input"
                  value={editingUser.role || 'sales'}
                  onChange={event =>
                    setEditingUser(prev => (prev ? { ...prev, role: event.target.value } : prev))
                  }
                >
                  {ROLE_OPTIONS.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-form-actions">
                <button type="submit" className="btn-primary">
                  Сохранить
                </button>
                <button type="button" className="btn-secondary" onClick={cancelEdit}>
                  Отмена
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>ФИО</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Последний вход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Пользователи не найдены.
                  </td>
                </tr>
              )}
              {sortedUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.fullName || '—'}</td>
                  <td>{user.role ? ROLE_LABELS[user.role] || user.role : '—'}</td>
                  <td>
                    <span className={user.isActive ? 'admin-pill is-active' : 'admin-pill is-blocked'}>
                      {user.isActive ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.lastLogin)}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="btn-secondary admin-action-btn"
                        data-label="Редактировать"
                        aria-label="Редактировать"
                        onClick={() => startEdit(user)}
                      >
                        <svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 17.25V21h3.75L18.8 8.95l-3.75-3.75L3 17.25z" />
                          <path d="M20.7 7.05a1 1 0 0 0 0-1.4l-2.35-2.35a1 1 0 0 0-1.4 0l-1.8 1.8 3.75 3.75 1.8-1.8z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary admin-action-btn"
                        data-label={user.isActive ? 'Блокировать' : 'Разблокировать'}
                        aria-label={user.isActive ? 'Блокировать' : 'Разблокировать'}
                        onClick={() => toggleStatus(user.id)}
                      >
                        {user.isActive ? (
                          <svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M6.5 6.5l11 11" />
                          </svg>
                        ) : (
                          <svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 10V7a5 5 0 0 1 9.9-1" />
                            <path d="M5 10h14v10H5z" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary admin-action-btn"
                        data-label="Сбросить пароль"
                        aria-label="Сбросить пароль"
                        onClick={() => resetPassword(user)}
                      >
                        <svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 12a8 8 0 1 0 2.3-5.6" />
                          <path d="M4 4v5h5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary admin-action-btn"
                        data-label="Удалить"
                        aria-label="Удалить"
                        onClick={() => deleteUser(user)}
                      >
                        <svg className="admin-action-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 7h12" />
                          <path d="M9 7V5h6v2" />
                          <path d="M8 7l1 12h6l1-12" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
