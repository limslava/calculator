import { Fragment, useEffect, useMemo, useState } from 'react';
import MultiSelect from '../../components/MultiSelect';
import type { SeaRate } from '../complex/types';
import { loadDbType, loadExchangeRate } from '../shared/api';
import { isSeaServiceIncluded } from '../shared/service-utils';
import {
  getSeaContainerLabel,
  getSeaRateWithConversion,
  normalizeName
} from './sea-utils';

const containerOptions = [
  { value: 'soc_20', label: "SOC 20'" },
  { value: 'soc_40', label: "SOC 40'" },
  { value: 'dc_20', label: "20'DC FILO" },
  { value: 'hc_40', label: "40'HC FILO" }
];

const containerTypes = containerOptions.map(option => option.value);

type SeaResultRow = {
  item: SeaRate;
  containerType: string;
  rate: number;
};

type FiltersState = {
  pol: string;
  city: string;
  pod: string;
  dropOffArea: string;
  containerType: string;
  carrierFilters: string[];
  agentFilters: string[];
};

const defaultFilters: FiltersState = {
  pol: '',
  city: '',
  pod: '',
  dropOffArea: '',
  containerType: '',
  carrierFilters: [],
  agentFilters: []
};

type SeaRatesPageProps = {
  onUnauthorized?: () => void;
};

export default function SeaRatesPage({ onUnauthorized }: SeaRatesPageProps) {
  const [seaData, setSeaData] = useState<SeaRate[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.pol ||
          filters.city ||
          filters.pod ||
          filters.dropOffArea ||
          filters.containerType ||
          filters.carrierFilters.length ||
          filters.agentFilters.length
      ),
    [filters]
  );
  const normalizedPol = normalizeName(filters.pol);
  const normalizedCity = normalizeName(filters.city);
  const normalizedPod = normalizeName(filters.pod);
  const normalizedDropOff = normalizeName(filters.dropOffArea);
  const normalizedCarrierFilters = filters.carrierFilters.map(value => normalizeName(value));
  const normalizedAgentFilters = filters.agentFilters.map(value => normalizeName(value));

  const matchesFilters = (
    item: SeaRate,
    exclude: Partial<Record<keyof FiltersState, boolean>> = {}
  ) => {
    if (!exclude.pol && filters.pol && normalizeName(item.pol) !== normalizedPol) return false;
    if (!exclude.city && filters.city && normalizeName(item.city) !== normalizedCity) return false;
    if (!exclude.pod && filters.pod && normalizeName(item.pod) !== normalizedPod) return false;
    if (!exclude.dropOffArea && filters.dropOffArea && normalizeName(item.dropOffArea) !== normalizedDropOff) {
      return false;
    }

    if (!exclude.containerType && filters.containerType) {
      const rate = getSeaRateWithConversion(item, filters.containerType);
      if (!rate || rate <= 0) return false;
    }

    if (!exclude.carrierFilters && normalizedCarrierFilters.length) {
      const carrier = normalizeName(item.carrier || '');
      if (!normalizedCarrierFilters.includes(carrier)) return false;
    }
    if (!exclude.agentFilters && normalizedAgentFilters.length) {
      const agent = normalizeName(item.agent || '');
      if (!normalizedAgentFilters.includes(agent)) return false;
    }

    return true;
  };

  const buildOptions = (values: Array<string | undefined | null>) =>
    [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [rate, sea] = await Promise.all([
          loadExchangeRate(),
          loadDbType('sea', onUnauthorized)
        ]);
        if (!mounted) return;
        setExchangeRate(rate);
        setSeaData(sea as SeaRate[]);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof Error && error.message === 'unauthorized') {
          setLoading(false);
          return;
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [onUnauthorized]);

  const clearOnMouseDown =
    (field: 'pol' | 'city' | 'pod' | 'dropOffArea') => (event: React.MouseEvent<HTMLInputElement>) => {
      if (event.currentTarget.value.trim() !== '') {
        event.currentTarget.value = '';
        setFilters(prev => ({ ...prev, [field]: '' }));
      }
    };

  const availableSeaData = useMemo(
    () =>
      seaData.filter(item => {
        const service = (item.service || '').toString().toLowerCase();
        const remarks = (item.remarks || '').toString().toLowerCase();
        const conversion = (item.conversion || '').toString().toLowerCase();
        const conversionNotIncluded = (item as any).conversionNotIncluded
          ? String((item as any).conversionNotIncluded).toLowerCase()
          : '';
        const combined = `${service} ${remarks} ${conversion} ${conversionNotIncluded}`;
        if (combined.includes('сквозной сервис')) return false;
        return isSeaServiceIncluded(item.service);
      }),
    [seaData]
  );

  const polOptions = useMemo(
    () =>
      buildOptions(
        availableSeaData
          .filter(item => matchesFilters(item, { pol: true }))
          .map(item => item.pol)
      ),
    [availableSeaData, filters]
  );
  const cityOptions = useMemo(
    () =>
      buildOptions(
        availableSeaData
          .filter(item => matchesFilters(item, { city: true }))
          .map(item => item.city)
      ),
    [availableSeaData, filters]
  );
  const podOptions = useMemo(
    () =>
      buildOptions(
        availableSeaData
          .filter(item => matchesFilters(item, { pod: true }))
          .map(item => item.pod)
      ),
    [availableSeaData, filters]
  );
  const dropOffOptions = useMemo(
    () =>
      buildOptions(
        availableSeaData
          .filter(item => matchesFilters(item, { dropOffArea: true }))
          .map(item => item.dropOffArea)
      ),
    [availableSeaData, filters]
  );
  const carrierOptions = useMemo(
    () =>
      buildOptions(
        availableSeaData
          .filter(item => matchesFilters(item, { carrierFilters: true }))
          .map(item => item.carrier)
      ),
    [availableSeaData, filters]
  );
  const agentOptions = useMemo(
    () =>
      buildOptions(
        availableSeaData
          .filter(item => matchesFilters(item, { agentFilters: true }))
          .map(item => item.agent)
      ),
    [availableSeaData, filters]
  );

  const results = useMemo<SeaResultRow[]>(() => {
    if (!hasActiveFilters) return [];

    const matches = availableSeaData.filter(item => matchesFilters(item));
    const activeContainerTypes = filters.containerType ? [filters.containerType] : containerTypes;
    const expanded: SeaResultRow[] = [];

    matches.forEach(item => {
      activeContainerTypes.forEach(containerType => {
        const rateWithConversion = getSeaRateWithConversion(item, containerType);
        if (rateWithConversion && rateWithConversion > 0) {
          expanded.push({ item, containerType, rate: rateWithConversion });
        }
      });
    });

    return expanded.sort((a, b) => a.rate - b.rate);
  }, [availableSeaData, filters, hasActiveFilters]);

  const summary = useMemo(() => {
    if (!hasActiveFilters) {
      return {
        totalLabel: '—',
        bestLabel: '—',
        note: 'Выберите фильтр, чтобы увидеть ставки.'
      };
    }
    if (!results.length) {
      return {
        totalLabel: '—',
        bestLabel: '—',
        note: 'Нет ставок по выбранным фильтрам.'
      };
    }
    const bestRate = results[0]?.rate || 0;
    return {
      totalLabel: `${results.length} ставок`,
      bestLabel: bestRate ? `$${bestRate}` : '—',
      note: `Найдено ${results.length} ставок, отсортировано по цене.`
    };
  }, [results, hasActiveFilters]);

  const handleReset = () => {
    setFilters(defaultFilters);
  };

  const handleExport = () => {
    if (!results.length) {
      alert('Нет данных для экспорта');
      return;
    }

    const header = [
      'POL',
      'Город',
      'POD',
      'Drop off area',
      'Перевозчик',
      'Агент',
      'Тип контейнера',
      'Ставка ($)',
      'Дата действия'
    ];
    const lines = [
      header.join(';'),
      ...results.map(row => {
        const item = row.item;
        return [
          item.pol || '-',
          item.city || '-',
          item.pod || '-',
          item.dropOffArea || '-',
          item.carrier || '-',
          item.agent || '-',
          getSeaContainerLabel(row.containerType),
          row.rate ? `$${row.rate}` : '-',
          item.dateOfValidity || '-'
        ]
          .map(value => `"${String(value).replace(/"/g, '""')}"`)
          .join(';');
      })
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sea_rates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const showResults = hasActiveFilters;

  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Раздельные ставки</div>
            <h2>Морские ставки</h2>
            <div className="trd-meta">
              <div className="exchange-rate-display">
                <label>
                  Курс ЦБ РФ: <span>{exchangeRate ?? '-'}</span> руб/$
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="trd-filters" id="sea-fields">
          <div className="trd-field">
            <label htmlFor="sea-pol">POL</label>
            <div className="custom-select-wrapper">
              <input
                id="sea-pol"
                className="form-input custom-select-input"
                list="sea-pol-list"
                placeholder="POL"
                autoComplete="off"
                value={filters.pol}
                onChange={event =>
                  setFilters(prev => ({
                    ...prev,
                    pol: event.target.value
                  }))
                }
                onMouseDown={clearOnMouseDown('pol')}
              />
              <datalist id="sea-pol-list">
                {polOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="sea-city">City</label>
            <div className="custom-select-wrapper">
              <input
                id="sea-city"
                className="form-input custom-select-input"
                list="sea-city-list"
                placeholder="City"
                autoComplete="off"
                value={filters.city}
                onChange={event =>
                  setFilters(prev => ({
                    ...prev,
                    city: event.target.value
                  }))
                }
                onMouseDown={clearOnMouseDown('city')}
              />
              <datalist id="sea-city-list">
                {cityOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="sea-pod">POD</label>
            <div className="custom-select-wrapper">
              <input
                id="sea-pod"
                className="form-input custom-select-input"
                list="sea-pod-list"
                placeholder="POD"
                autoComplete="off"
                value={filters.pod}
                onChange={event =>
                  setFilters(prev => ({
                    ...prev,
                    pod: event.target.value
                  }))
                }
                onMouseDown={clearOnMouseDown('pod')}
              />
              <datalist id="sea-pod-list">
                {podOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="sea-drop-off">Drop off area via VVO</label>
            <div className="custom-select-wrapper">
              <input
                id="sea-drop-off"
                className="form-input custom-select-input"
                list="sea-drop-off-list"
                placeholder="Drop off area"
                autoComplete="off"
                value={filters.dropOffArea}
                onChange={event =>
                  setFilters(prev => ({
                    ...prev,
                    dropOffArea: event.target.value
                  }))
                }
                onMouseDown={clearOnMouseDown('dropOffArea')}
              />
              <datalist id="sea-drop-off-list">
                {dropOffOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="sea-container">Тип контейнера</label>
            <select
              id="sea-container"
              className="form-select"
              value={filters.containerType}
              onChange={event => setFilters(prev => ({ ...prev, containerType: event.target.value }))}
            >
              <option value="">Выберите тип</option>
              {containerOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="trd-field">
            <label htmlFor="sea-carrier">Перевозчик</label>
            <MultiSelect
              id="sea-carrier"
              label="Перевозчик"
              options={carrierOptions}
              selected={filters.carrierFilters}
              onChange={values => setFilters(prev => ({ ...prev, carrierFilters: values }))}
            />
          </div>
          <div className="trd-field">
            <label htmlFor="sea-agent">Агент</label>
            <MultiSelect
              id="sea-agent"
              label="Агент"
              options={agentOptions}
              selected={filters.agentFilters}
              onChange={values => setFilters(prev => ({ ...prev, agentFilters: values }))}
            />
          </div>
        </div>

        <div className="trd-actions-row">
          <div className="trd-actions-options" />
          <div className="trd-actions-buttons">
            <button className="trd-btn" onClick={handleReset}>
              Сброс
            </button>
            <button className="trd-btn" onClick={handleExport}>
              Экспорт
            </button>
          </div>
        </div>

        <div className="trd-content">
          <div className="trd-table">
            <div className={`results-section ${showResults ? '' : 'hidden'}`.trim()}>
              <div className="rates-table">
                <table className="trd-rates-table trd-variant-a">
                  <thead>
                    <tr>
                      <th>POL</th>
                      <th>Город</th>
                      <th>POD</th>
                      <th>Drop off area</th>
                      <th>Перевозчик</th>
                      <th>Агент</th>
                      <th>Тип контейнера</th>
                      <th>Ставка ($)</th>
                      <th>Дата действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showResults && results.length === 0 && (
                      <tr>
                        <td colSpan={9} className="muted">
                          {loading ? 'Загрузка данных...' : 'Нет данных для выбранных параметров'}
                        </td>
                      </tr>
                    )}
                    {results.map((row, index) => {
                      const isExpanded = expandedRows.has(index);
                      const etdValue = row.item.etd || '—';
                      const etdMatch =
                        typeof etdValue === 'string' ? etdValue.match(/https?:\/\/[^\s]+/i) : null;
                      const conversionText = (row.item.conversion || '').toString().trim();
                      const conversionLine = 'Ставка дана включая конвертацию';
                      return (
                        <Fragment key={`${row.item.pol}-${row.item.pod}-${row.containerType}-${index}`}>
                          <tr
                            className={`row-main ${isExpanded ? 'is-active' : ''}`.trim()}
                            onClick={() => {
                              setExpandedRows(prev => {
                                const next = new Set(prev);
                                if (next.has(index)) {
                                  next.delete(index);
                                } else {
                                  next.add(index);
                                }
                                return next;
                              });
                            }}
                          >
                            <td>{row.item.pol || '-'}</td>
                            <td>{row.item.city || '-'}</td>
                            <td>{row.item.pod || '-'}</td>
                            <td>{row.item.dropOffArea || '-'}</td>
                            <td>{row.item.carrier || '-'}</td>
                            <td>{row.item.agent || '-'}</td>
                            <td>{getSeaContainerLabel(row.containerType)}</td>
                            <td className="rate">{row.rate ? `$${row.rate}` : '—'}</td>
                            <td>{row.item.dateOfValidity || '-'}</td>
                          </tr>
                          <tr className="row-details" style={{ display: isExpanded ? 'table-row' : 'none' }}>
                            <td colSpan={9}>
                              Transit Port: {row.item.transitPort || '—'} · {conversionLine} · ETD:{' '}
                              {etdMatch ? (
                                <a href={etdMatch[0]} target="_blank" rel="noreferrer">
                                  {etdMatch[0]}
                                </a>
                              ) : (
                                etdValue
                              )}{' '}
                              · Remarks: {row.item.remarks || '—'}
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <aside className="trd-summary">
            <div className="trd-summary-block">
              <div className="trd-summary-title">Сводка</div>
              <div className="trd-summary-value">{summary.totalLabel}</div>
              <div className="trd-summary-muted">Морские ставки</div>
            </div>
            <div className="trd-summary-block">
              <div className="trd-summary-label">Лучшая ставка</div>
              <div className="trd-summary-value">{summary.bestLabel}</div>
            </div>
            <div className="trd-summary-block">
              <div className="trd-note">{summary.note}</div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
