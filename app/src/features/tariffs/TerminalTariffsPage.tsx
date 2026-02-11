import { useEffect, useState, type FormEvent } from 'react';
import type { StorageRange, TariffRate } from '../complex/types';
import { loadDbType, makeAuthRequest } from '../shared/api';

type TerminalTariffsPageProps = {
  onUnauthorized?: () => void;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ensureStorageRanges = (ranges: StorageRange[] | undefined): StorageRange[] => {
  if (Array.isArray(ranges) && ranges.length > 0) {
    return ranges.map(range => ({
      from: toNumber(range.from),
      to: toNumber(range.to),
      rate20: toNumber(range.rate20),
      rate40: toNumber(range.rate40)
    }));
  }
  return [{ from: 0, to: 0, rate20: 0, rate40: 0 }];
};

const normalizeTariff = (tariff: TariffRate): TariffRate => {
  const storageRanges =
    Array.isArray(tariff.storageRanges) && tariff.storageRanges.length
      ? tariff.storageRanges
      : Array.isArray(tariff.storage)
        ? tariff.storage.map(item => ({
            from: toNumber(item.from_days ?? item.from),
            to: toNumber(item.to_days ?? item.to),
            rate20: toNumber(item.rate20),
            rate40: toNumber(item.rate40)
          }))
        : [];

  return {
    terminal: tariff.terminal ?? '',
    vtt: toNumber(tariff.vtt),
    prr20: toNumber(tariff.prr20),
    prr40: toNumber(tariff.prr40),
    auto20: toNumber(tariff.auto20),
    auto40: toNumber(tariff.auto40),
    weighing20: toNumber(tariff.weighing20),
    weighing40: toNumber(tariff.weighing40),
    midk20: toNumber(tariff.midk20),
    midk40: toNumber(tariff.midk40),
    railDeparture: Boolean(tariff.railDeparture),
    railPrr20: toNumber(tariff.railPrr20),
    railPrr40: toNumber(tariff.railPrr40),
    railWeighing20: toNumber(tariff.railWeighing20),
    railWeighing40: toNumber(tariff.railWeighing40),
    railMidk20: toNumber(tariff.railMidk20),
    railMidk40: toNumber(tariff.railMidk40),
    storageRanges
  };
};

const emptyRow = (): TariffRate =>
  normalizeTariff({
    terminal: '',
    vtt: 0,
    prr20: 0,
    prr40: 0,
    auto20: 0,
    auto40: 0,
    weighing20: 0,
    weighing40: 0,
    midk20: 0,
    midk40: 0,
    railDeparture: false,
    railPrr20: 0,
    railPrr40: 0,
    railWeighing20: 0,
    railWeighing40: 0,
    railMidk20: 0,
    railMidk40: 0,
    storageRanges: [{ from: 0, to: 0, rate20: 0, rate40: 0 }]
  });

export default function TerminalTariffsPage({ onUnauthorized }: TerminalTariffsPageProps) {
  const [tariffs, setTariffs] = useState<TariffRate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [modalTariff, setModalTariff] = useState<TariffRate>(emptyRow());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await loadDbType('tariff', onUnauthorized);
        if (!mounted) return;
        const normalized = Array.isArray(data) && data.length ? data.map(normalizeTariff) : [emptyRow()];
        setTariffs(normalized);
      } catch (err) {
        if (!mounted) return;
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [onUnauthorized]);

  const updateRow = (index: number, patch: Partial<TariffRate>) => {
    setTariffs(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setTariffs(prev => [...prev, emptyRow()]);
  };

  const removeRow = (index: number) => {
    setTariffs(prev => prev.filter((_, i) => i !== index));
  };

  const openModal = (index: number) => {
    const current = tariffs[index] ? normalizeTariff(tariffs[index]) : emptyRow();
    setModalIndex(index);
    setModalTariff({
      ...current,
      storageRanges: ensureStorageRanges(current.storageRanges)
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalIndex(null);
  };

  const updateModalField = (patch: Partial<TariffRate>) => {
    setModalTariff(prev => ({ ...prev, ...patch }));
  };

  const updateStorageRange = (index: number, patch: Partial<StorageRange>) => {
    setModalTariff(prev => {
      const ranges = ensureStorageRanges(prev.storageRanges);
      const next = ranges.map((range, idx) =>
        idx === index
          ? {
              ...range,
              ...patch,
              from: patch.from !== undefined ? toNumber(patch.from) : range.from,
              to: patch.to !== undefined ? toNumber(patch.to) : range.to,
              rate20: patch.rate20 !== undefined ? toNumber(patch.rate20) : range.rate20,
              rate40: patch.rate40 !== undefined ? toNumber(patch.rate40) : range.rate40
            }
          : range
      );
      return { ...prev, storageRanges: next };
    });
  };

  const addStorageRange = () => {
    setModalTariff(prev => ({
      ...prev,
      storageRanges: [...ensureStorageRanges(prev.storageRanges), { from: 0, to: 0, rate20: 0, rate40: 0 }]
    }));
  };

  const removeStorageRange = (index: number) => {
    setModalTariff(prev => {
      const ranges = ensureStorageRanges(prev.storageRanges).filter((_, idx) => idx !== index);
      return { ...prev, storageRanges: ranges.length ? ranges : [{ from: 0, to: 0, rate20: 0, rate40: 0 }] };
    });
  };

  const applyModal = (event?: FormEvent) => {
    event?.preventDefault();
    if (modalIndex === null) return;
    const normalized = normalizeTariff(modalTariff);
    setTariffs(prev => prev.map((row, index) => (index === modalIndex ? { ...row, ...normalized } : row)));
    closeModal();
  };

  const handleSave = async () => {
    setError(null);
    setStatus(null);

    const cleaned = tariffs
      .map(row => {
        const terminal = row.terminal?.trim() || '';
        const vtt = toNumber(row.vtt);
        const prr20 = toNumber(row.prr20);
        const prr40 = toNumber(row.prr40);
        const auto20 = toNumber(row.auto20);
        const auto40 = toNumber(row.auto40);
        const weighing20 = toNumber(row.weighing20);
        const weighing40 = toNumber(row.weighing40);
        const midk20 = toNumber(row.midk20);
        const midk40 = toNumber(row.midk40);
        const railDeparture = Boolean(row.railDeparture);
        const railPrr20 = toNumber(row.railPrr20);
        const railPrr40 = toNumber(row.railPrr40);
        const railWeighing20 = toNumber(row.railWeighing20);
        const railWeighing40 = toNumber(row.railWeighing40);
        const railMidk20 = toNumber(row.railMidk20);
        const railMidk40 = toNumber(row.railMidk40);

        const storageRanges = (row.storageRanges ?? [])
          .map(range => ({
            from: toNumber(range.from),
            to: toNumber(range.to),
            rate20: toNumber(range.rate20),
            rate40: toNumber(range.rate40)
          }))
          .filter(range => range.rate20 > 0 || range.rate40 > 0);

        const hasBase =
          terminal ||
          vtt > 0 ||
          prr20 > 0 ||
          prr40 > 0 ||
          auto20 > 0 ||
          auto40 > 0;

        const hasExtras =
          weighing20 > 0 ||
          weighing40 > 0 ||
          midk20 > 0 ||
          midk40 > 0 ||
          railPrr20 > 0 ||
          railPrr40 > 0 ||
          railWeighing20 > 0 ||
          railWeighing40 > 0 ||
          railMidk20 > 0 ||
          railMidk40 > 0 ||
          storageRanges.length > 0;

        if (!hasBase && !hasExtras) {
          return null;
        }

        const normalizedTerminal = terminal || 'Общий';
        const storage = storageRanges.map(range => ({
          from_days: range.from,
          to_days: range.to,
          rate20: range.rate20,
          rate40: range.rate40
        }));

        return {
          terminal: normalizedTerminal,
          vtt,
          prr20,
          prr40,
          auto20,
          auto40,
          weighing20,
          weighing40,
          midk20,
          midk40,
          railDeparture,
          railPrr20,
          railPrr40,
          railWeighing20,
          railWeighing40,
          railMidk20,
          railMidk40,
          storageRanges,
          storage,
          timestamp: new Date().toISOString()
        } satisfies TariffRate;
      })
      .filter((row): row is TariffRate => Boolean(row));

    if (!cleaned.length) {
      setError('Добавьте хотя бы один тариф');
      return;
    }

    setSaving(true);
    try {
      const response = await makeAuthRequest('/api/data/tariff', {
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
      localStorage.setItem('logistics_db_tariff', JSON.stringify(cleaned));
      setTariffs(cleaned.length ? cleaned : [emptyRow()]);
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
            <div className="trd-subtitle">Тарифы терминалов</div>
            <h2>Ввод тарифов</h2>
          </div>
        </div>

        <div className="trd-panel">
          <div className="trd-panel-caption">Тарифы терминалов</div>
          {status && <div className="status success">{status}</div>}
          {error && <div className="status warning">{error}</div>}
          <div style={{ overflowX: 'auto' }}>
            <table className="trd-rates-table trd-variant-a">
              <thead>
                <tr>
                  <th>Терминал</th>
                  <th>ВТТ</th>
                  <th>ПРР 20</th>
                  <th>ПРР 40</th>
                  <th>Автовывоз 20</th>
                  <th>Автовывоз 40</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tariffs.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        className="form-input"
                        value={row.terminal || ''}
                        onChange={event => updateRow(index, { terminal: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        value={row.vtt ?? 0}
                        onChange={event => updateRow(index, { vtt: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        value={row.prr20 ?? 0}
                        onChange={event => updateRow(index, { prr20: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        value={row.prr40 ?? 0}
                        onChange={event => updateRow(index, { prr40: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        value={row.auto20 ?? 0}
                        onChange={event => updateRow(index, { auto20: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        value={row.auto40 ?? 0}
                        onChange={event => updateRow(index, { auto40: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button className="trd-btn" type="button" onClick={() => openModal(index)}>
                          Редактировать
                        </button>
                        <button className="trd-btn" type="button" onClick={() => removeRow(index)}>
                          Удалить
                        </button>
                      </div>
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

      {modalOpen && (
        <div className="modal app-modal">
          <div className="modal-content app-modal-content">
            <div className="modal-header">
              <h2>Редактирование терминала</h2>
              <button className="modal-close" type="button" onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <form className="trd-modal-form" onSubmit={applyModal}>
                <div className="trd-form-section">
                  <h3>Основные данные</h3>
                  <div className="trd-form-row">
                    <div className="form-group">
                      <label htmlFor="modal-terminal">Название терминала *</label>
                      <input
                        id="modal-terminal"
                        className="form-input"
                        value={modalTariff.terminal ?? ''}
                        onChange={event => updateModalField({ terminal: event.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="modal-vtt">ВТТ (руб)</label>
                      <input
                        id="modal-vtt"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.vtt ?? 0}
                        onChange={event => updateModalField({ vtt: toNumber(event.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="trd-form-row">
                    <div className="form-group">
                      <label htmlFor="modal-prr20">ПРР 20 (руб)</label>
                      <input
                        id="modal-prr20"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.prr20 ?? 0}
                        onChange={event => updateModalField({ prr20: toNumber(event.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="modal-prr40">ПРР 40 (руб)</label>
                      <input
                        id="modal-prr40"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.prr40 ?? 0}
                        onChange={event => updateModalField({ prr40: toNumber(event.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="trd-form-row">
                    <div className="form-group">
                      <label htmlFor="modal-auto20">Автовывоз 20 (руб)</label>
                      <input
                        id="modal-auto20"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.auto20 ?? 0}
                        onChange={event => updateModalField({ auto20: toNumber(event.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="modal-auto40">Автовывоз 40 (руб)</label>
                      <input
                        id="modal-auto40"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.auto40 ?? 0}
                        onChange={event => updateModalField({ auto40: toNumber(event.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="trd-form-section">
                  <h3>Дополнительные услуги</h3>
                  <div className="trd-form-row">
                    <div className="form-group">
                      <label htmlFor="modal-weighing20">Взвешивание 20 (руб)</label>
                      <input
                        id="modal-weighing20"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.weighing20 ?? 0}
                        onChange={event => updateModalField({ weighing20: toNumber(event.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="modal-weighing40">Взвешивание 40 (руб)</label>
                      <input
                        id="modal-weighing40"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.weighing40 ?? 0}
                        onChange={event => updateModalField({ weighing40: toNumber(event.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="trd-form-row">
                    <div className="form-group">
                      <label htmlFor="modal-midk20">МИДК 20 (руб)</label>
                      <input
                        id="modal-midk20"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.midk20 ?? 0}
                        onChange={event => updateModalField({ midk20: toNumber(event.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="modal-midk40">МИДК 40 (руб)</label>
                      <input
                        id="modal-midk40"
                        className="form-input"
                        type="number"
                        min={0}
                        value={modalTariff.midk40 ?? 0}
                        onChange={event => updateModalField({ midk40: toNumber(event.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="trd-form-section">
                  <h3>Разделение по отправке ЖД</h3>
                  <label className="trd-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(modalTariff.railDeparture)}
                      onChange={event => updateModalField({ railDeparture: event.target.checked })}
                    />
                    Учитывать отправку по ЖД (разные ставки)
                  </label>
                  {modalTariff.railDeparture && (
                    <div className="trd-rail-section">
                      <h4>Ставки для отправки по ЖД</h4>
                      <div className="trd-form-row">
                        <div className="form-group">
                          <label htmlFor="modal-rail-prr20">ПРР 20 (руб)</label>
                          <input
                            id="modal-rail-prr20"
                            className="form-input"
                            type="number"
                            min={0}
                            value={modalTariff.railPrr20 ?? 0}
                            onChange={event => updateModalField({ railPrr20: toNumber(event.target.value) })}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="modal-rail-prr40">ПРР 40 (руб)</label>
                          <input
                            id="modal-rail-prr40"
                            className="form-input"
                            type="number"
                            min={0}
                            value={modalTariff.railPrr40 ?? 0}
                            onChange={event => updateModalField({ railPrr40: toNumber(event.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="trd-form-row">
                        <div className="form-group">
                          <label htmlFor="modal-rail-weighing20">Взвешивание 20 (руб)</label>
                          <input
                            id="modal-rail-weighing20"
                            className="form-input"
                            type="number"
                            min={0}
                            value={modalTariff.railWeighing20 ?? 0}
                            onChange={event =>
                              updateModalField({ railWeighing20: toNumber(event.target.value) })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="modal-rail-weighing40">Взвешивание 40 (руб)</label>
                          <input
                            id="modal-rail-weighing40"
                            className="form-input"
                            type="number"
                            min={0}
                            value={modalTariff.railWeighing40 ?? 0}
                            onChange={event =>
                              updateModalField({ railWeighing40: toNumber(event.target.value) })
                            }
                          />
                        </div>
                      </div>
                      <div className="trd-form-row">
                        <div className="form-group">
                          <label htmlFor="modal-rail-midk20">МИДК 20 (руб)</label>
                          <input
                            id="modal-rail-midk20"
                            className="form-input"
                            type="number"
                            min={0}
                            value={modalTariff.railMidk20 ?? 0}
                            onChange={event => updateModalField({ railMidk20: toNumber(event.target.value) })}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="modal-rail-midk40">МИДК 40 (руб)</label>
                          <input
                            id="modal-rail-midk40"
                            className="form-input"
                            type="number"
                            min={0}
                            value={modalTariff.railMidk40 ?? 0}
                            onChange={event => updateModalField({ railMidk40: toNumber(event.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="trd-form-section">
                  <h3>Хранение</h3>
                  <div className="trd-storage-container">
                    <div className="trd-storage-header">
                      <span>От суток</span>
                      <span>До суток</span>
                      <span>Ставка 20 фут (руб)</span>
                      <span>Ставка 40 фут (руб)</span>
                      <span>Действия</span>
                    </div>
                    {ensureStorageRanges(modalTariff.storageRanges).map((range, index) => (
                      <div key={index} className="trd-storage-row">
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          value={range.from}
                          onChange={event => updateStorageRange(index, { from: toNumber(event.target.value) })}
                        />
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          value={range.to}
                          onChange={event => updateStorageRange(index, { to: toNumber(event.target.value) })}
                        />
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          value={range.rate20}
                          onChange={event => updateStorageRange(index, { rate20: toNumber(event.target.value) })}
                        />
                        <input
                          className="form-input"
                          type="number"
                          min={0}
                          value={range.rate40}
                          onChange={event => updateStorageRange(index, { rate40: toNumber(event.target.value) })}
                        />
                        <button className="trd-btn trd-btn-danger" type="button" onClick={() => removeStorageRange(index)}>
                          Удалить
                        </button>
                      </div>
                    ))}
                    <button className="btn-secondary trd-add-storage" type="button" onClick={addStorageRange}>
                      Добавить диапазон хранения
                    </button>
                  </div>
                </div>

                <div className="trd-modal-actions">
                  <button className="btn-secondary" type="button" onClick={closeModal}>
                    Отмена
                  </button>
                  <button className="btn-success" type="submit">
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
