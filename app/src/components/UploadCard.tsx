import { useMemo, useState } from 'react';
import { makeAuthRequest } from '../features/shared/api';

type UploadCardProps<T> = {
  title: string;
  dbType: string;
  parse: (rows: any[][]) => T[];
  onUploaded?: (data: T[]) => void;
  onUnauthorized?: () => void;
  variant?: 'panel' | 'inline';
};

export default function UploadCard<T>({
  title,
  dbType,
  parse,
  onUploaded,
  onUnauthorized,
  variant = 'panel'
}: UploadCardProps<T>) {
  const [fileName, setFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewColumns = useMemo(() => {
    if (!parsedData.length) return [];
    return Object.keys(parsedData[0] as Record<string, unknown>).slice(0, 8);
  }, [parsedData]);

  const previewRows = useMemo(() => parsedData.slice(0, 5), [parsedData]);

  const handleFileChange = async (file: File | null) => {
    setError(null);
    setStatus(null);
    setParsedData([]);
    if (!file) {
      setFileName('');
      return;
    }
    setFileName(file.name);
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        throw new Error('Библиотека XLSX не загружена');
      }
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Не найден лист в файле');
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      const parsed = parse(rows);
      setParsedData(parsed);
      setStatus(`Файл обработан: ${parsed.length} записей`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка парсинга файла';
      setError(message);
    }
  };

  const handleUpload = async () => {
    if (!parsedData.length) {
      setError('Нет данных для загрузки');
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await makeAuthRequest(`/api/data/${dbType}`, {
        method: 'POST',
        body: JSON.stringify({ data: parsedData })
      });
      if (response.status === 401) {
        onUnauthorized?.();
        throw new Error('unauthorized');
      }
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Ошибка загрузки данных');
      }
      setStatus(`Загружено ${result.count ?? parsedData.length} записей`);
      localStorage.setItem(`logistics_db_${dbType}`, JSON.stringify(parsedData));
      onUploaded?.(parsedData);
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Ошибка загрузки данных';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass =
    variant === 'panel' ? 'trd-panel trd-upload-panel' : 'trd-upload-inline';

  return (
    <div className={wrapperClass}>
      {title && <div className="trd-panel-caption">{title}</div>}
      <div className="trd-upload-grid">
        <div className="trd-upload-inputs">
          <div className="form-group">
            <label htmlFor={`upload-${dbType}`}>Excel файл</label>
            <input
              id={`upload-${dbType}`}
              type="file"
              className="form-input"
              accept=".xlsx,.xls"
              onChange={event => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="trd-upload-actions">
            <button
              className="trd-btn trd-upload-btn"
              type="button"
              onClick={handleUpload}
              disabled={loading || !parsedData.length}
            >
              {loading ? 'Загрузка…' : 'Загрузить в базу'}
            </button>
          </div>
        </div>
        <div className="trd-upload-meta">
          {fileName && <div className="muted">Файл: {fileName}</div>}
          {status && <div className="status success">{status}</div>}
          {error && <div className="status warning">{error}</div>}
        </div>
      </div>
      {previewRows.length > 0 && (
        <div className="trd-preview">
          <div className="muted">
            Предпросмотр (первые {previewRows.length} строк)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="trd-rates-table trd-variant-a">
              <thead>
                <tr>
                  {previewColumns.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={idx}>
                    {previewColumns.map(col => (
                      <td key={col}>{(row as any)[col] ?? '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
