import { useEffect, useMemo, useState } from 'react';
import { makeAuthRequest } from '../shared/api';

type PageProps = {
  onUnauthorized?: () => void;
};

type UploadUser = {
  email?: string;
  role?: string;
};

type UploadRecord = {
  id: string;
  dataType: string;
  userId?: number;
  userEmail?: string;
  recordCount?: number;
  uploadedAt?: string;
  previewData?: unknown;
  user?: UploadUser;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const DATA_TYPES = [
  { value: 'all', label: 'Все' },
  { value: 'sea', label: 'Море' },
  { value: 'direct_sea', label: 'Прямое море' },
  { value: 'rail', label: 'ЖД' },
  { value: 'direct_rail', label: 'Прямое ЖД' },
  { value: 'tariff', label: 'Тарифы' }
];

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
};

export default function UploadHistoryPage({ onUnauthorized }: PageProps) {
  const [dataType, setDataType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UploadRecord | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (dataType && dataType !== 'all') params.set('dataType', dataType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [dataType, dateFrom, dateTo, page, limit]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeAuthRequest(`/api/upload-history?${query}`);
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось загрузить историю');
      }
      setRecords(Array.isArray(data.data) ? data.data : []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки истории');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [query]);

  const downloadFullData = async (record: UploadRecord) => {
    setError(null);
    try {
      const response = await makeAuthRequest(`/api/upload-history/${record.id}/full-data`);
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Не удалось получить данные');
      }
      const fileName = `upload_${record.dataType}_${record.id}.json`;
      const blob = new Blob([JSON.stringify(data.data?.fullData ?? {}, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    }
  };

  const nextPage = () => {
    if (!pagination) return;
    if (pagination.page >= pagination.totalPages) return;
    setPage(pagination.page + 1);
  };

  const prevPage = () => {
    if (!pagination) return;
    if (pagination.page <= 1) return;
    setPage(pagination.page - 1);
  };

  return (
    <section className="section admin-section">
      <div className="section-header">
        <h2>История загрузок</h2>
        <button type="button" className="btn-secondary" onClick={loadHistory} disabled={loading}>
          {loading ? 'Обновляем…' : 'Обновить'}
        </button>
      </div>

      <div className="admin-grid">
        <div className="admin-form">
          <div className="admin-form-title">Фильтры</div>
          <div className="admin-filters">
            <div className="form-group">
              <label htmlFor="history-type">Тип данных</label>
              <select
                id="history-type"
                className="form-input"
                value={dataType}
                onChange={event => {
                  setPage(1);
                  setDataType(event.target.value);
                }}
              >
                {DATA_TYPES.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="history-date-from">Дата с</label>
              <input
                id="history-date-from"
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={event => {
                  setPage(1);
                  setDateFrom(event.target.value);
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="history-date-to">Дата по</label>
              <input
                id="history-date-to"
                type="date"
                className="form-input"
                value={dateTo}
                onChange={event => {
                  setPage(1);
                  setDateTo(event.target.value);
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="history-limit">Показать</label>
              <select
                id="history-limit"
                className="form-input"
                value={limit}
                onChange={event => {
                  setPage(1);
                  setLimit(Number(event.target.value));
                }}
              >
                {[10, 20, 30, 50].map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Пользователь</th>
                <th>Записей</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Нет данных по выбранным фильтрам.
                  </td>
                </tr>
              )}
              {records.map(record => (
                <tr key={record.id}>
                  <td>{formatDate(record.uploadedAt)}</td>
                  <td>{record.dataType}</td>
                  <td>{record.user?.email || record.userEmail || '—'}</td>
                  <td>{record.recordCount ?? '—'}</td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" className="btn-secondary" onClick={() => setSelected(record)}>
                        Детали
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => downloadFullData(record)}>
                        Скачать JSON
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && (
            <div className="admin-pagination">
              <button type="button" className="btn-secondary" onClick={prevPage} disabled={pagination.page <= 1}>
                Назад
              </button>
              <div className="muted">
                Страница {pagination.page} из {pagination.totalPages}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={nextPage}
                disabled={pagination.page >= pagination.totalPages}
              >
                Вперед
              </button>
            </div>
          )}
        </div>

        {selected && (
          <div className="admin-form">
            <div className="admin-form-title">Детали загрузки</div>
            <div className="admin-details">
              <div>
                <strong>Тип:</strong> {selected.dataType}
              </div>
              <div>
                <strong>Пользователь:</strong> {selected.user?.email || selected.userEmail || '—'}
              </div>
              <div>
                <strong>Записей:</strong> {selected.recordCount ?? '—'}
              </div>
              <div>
                <strong>Дата:</strong> {formatDate(selected.uploadedAt)}
              </div>
            </div>
            {selected.previewData && (
              <pre className="admin-preview">{JSON.stringify(selected.previewData, null, 2)}</pre>
            )}
          </div>
        )}

        {error && <div className="status warning">{error}</div>}
      </div>
    </section>
  );
}
