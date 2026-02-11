import { useEffect, useState } from 'react';
import UploadCard from '../../components/UploadCard';
import type { AgentTariffRate } from '../complex/types';
import { parseAgentTariffData } from '../shared/excel-parsers';
import { loadDbType, makeAuthRequest } from '../shared/api';

type AgentTariffsPageProps = {
  onUnauthorized?: () => void;
};

const emptyRow = (): AgentTariffRate => ({
  carrier: '',
  pod: '',
  dropOffArea: '',
  snp: ''
});

export default function AgentTariffsPage({ onUnauthorized }: AgentTariffsPageProps) {
  const [agents, setAgents] = useState<AgentTariffRate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await loadDbType('agent_tariff', onUnauthorized);
        if (!mounted) return;
        setAgents(Array.isArray(data) && data.length ? data : [emptyRow()]);
      } catch (err) {
        if (!mounted) return;
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [onUnauthorized]);

  const updateRow = (index: number, patch: Partial<AgentTariffRate>) => {
    setAgents(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setAgents(prev => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setAgents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);
    setStatus(null);
    const cleaned = agents
      .map(row => ({
        carrier: row.carrier?.toString().trim() || '',
        pod: row.pod?.toString().trim() || '',
        dropOffArea: row.dropOffArea?.toString().trim() || '',
        snp: row.snp ?? ''
      }))
      .filter(row => row.carrier && row.pod && row.snp !== '');

    if (!cleaned.length) {
      setError('Добавьте хотя бы один тариф агента');
      return;
    }

    setSaving(true);
    try {
      const response = await makeAuthRequest('/api/data/agent_tariff', {
        method: 'POST',
        body: JSON.stringify({ data: cleaned })
      });
      if (response.status === 401) {
        onUnauthorized?.();
        throw new Error('unauthorized');
      }
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Ошибка сохранения данных');
      }
      localStorage.setItem('logistics_db_agent_tariff', JSON.stringify(cleaned));
      setStatus(`Сохранено ${result.count ?? cleaned.length} записей`);
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Ошибка сохранения данных');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Тарифы агентов</div>
            <h2>Ввод тарифов</h2>
          </div>
        </div>

        <div className="trd-panel">
          <UploadCard
            title="Загрузка Excel: тарифы агентов"
            dbType="agent_tariff"
            parse={parseAgentTariffData}
            onUploaded={data => setAgents(data as AgentTariffRate[])}
            onUnauthorized={onUnauthorized}
            variant="inline"
          />
          <div className="trd-divider" />
          <div className="trd-panel-caption">Ручной ввод</div>
          {status && <div className="status success">{status}</div>}
          {error && <div className="status warning">{error}</div>}
          <div style={{ overflowX: 'auto' }}>
            <table className="trd-rates-table trd-variant-a">
              <thead>
                <tr>
                  <th>Перевозчик</th>
                  <th>POD</th>
                  <th>Drop off area</th>
                  <th>СНП</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        className="form-input"
                        value={row.carrier || ''}
                        onChange={event => updateRow(index, { carrier: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={row.pod || ''}
                        onChange={event => updateRow(index, { pod: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={row.dropOffArea || ''}
                        onChange={event => updateRow(index, { dropOffArea: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        value={row.snp?.toString() || ''}
                        onChange={event => updateRow(index, { snp: event.target.value })}
                      />
                    </td>
                    <td>
                      <button className="trd-btn" type="button" onClick={() => removeRow(index)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="trd-actions-row" style={{ marginTop: '12px' }}>
            <div className="trd-actions-options" />
            <div className="trd-actions-buttons">
              <button className="trd-btn" type="button" onClick={addRow}>
                Добавить строку
              </button>
              <button className="trd-btn" type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
