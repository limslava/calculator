import { Fragment, useEffect, useMemo, useState } from 'react';
import MultiSelect from '../../components/MultiSelect';
import type { DirectSeaRate } from '../complex/types';
import { loadDbType, loadExchangeRate } from '../shared/api';
import { getDirectSeaContainerLabel, getDirectSeaRateByContainerType, normalizeName } from './direct-sea-utils';

const containerOptions = [
  { value: 'dc_20', label: "20'DC" },
  { value: 'hc_40', label: "40'HC" }
];

const containerTypes = containerOptions.map(option => option.value);

type DirectSeaResultRow = {
  item: DirectSeaRate;
  containerType: string;
  rate: number;
};

type FiltersState = {
  pol: string;
  pod: string;
  containerType: string;
  carrierFilters: string[];
  agentFilters: string[];
};

const defaultFilters: FiltersState = {
  pol: '',
  pod: '',
  containerType: '',
  carrierFilters: [],
  agentFilters: []
};

type DirectSeaRatesPageProps = {
  onUnauthorized?: () => void;
};

export default function DirectSeaRatesPage({ onUnauthorized }: DirectSeaRatesPageProps) {
  const [directSeaData, setDirectSeaData] = useState<DirectSeaRate[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.pol ||
          filters.pod ||
          filters.containerType ||
          filters.carrierFilters.length ||
          filters.agentFilters.length
      ),
    [filters]
  );
  const normalizedPol = normalizeName(filters.pol);
  const normalizedPod = normalizeName(filters.pod);
  const normalizedCarrierFilters = filters.carrierFilters.map(value => normalizeName(value));
  const normalizedAgentFilters = filters.agentFilters.map(value => normalizeName(value));

  const matchesFilters = (
    item: DirectSeaRate,
    exclude: Partial<Record<keyof FiltersState, boolean>> = {}
  ) => {
    if (!exclude.pol && filters.pol && normalizeName(item.pol) !== normalizedPol) return false;
    if (!exclude.pod && filters.pod && normalizeName(item.pod) !== normalizedPod) return false;

    if (!exclude.containerType && filters.containerType) {
      const rate = getDirectSeaRateByContainerType(item, filters.containerType);
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
        const [rate, data] = await Promise.all([loadExchangeRate(), loadDbType('direct_sea', onUnauthorized)]);
        if (!mounted) return;
        setExchangeRate(rate);
        setDirectSeaData(data as DirectSeaRate[]);
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
    (field: 'pol' | 'pod') => (event: React.MouseEvent<HTMLInputElement>) => {
      if (event.currentTarget.value.trim() !== '') {
        event.currentTarget.value = '';
        setFilters(prev => ({ ...prev, [field]: '' }));
      }
    };

  const polOptions = useMemo(
    () =>
      buildOptions(
        directSeaData
          .filter(item => matchesFilters(item, { pol: true }))
          .map(item => item.pol)
      ),
    [directSeaData, filters]
  );
  const podOptions = useMemo(
    () =>
      buildOptions(
        directSeaData
          .filter(item => matchesFilters(item, { pod: true }))
          .map(item => item.pod)
      ),
    [directSeaData, filters]
  );
  const carrierOptions = useMemo(
    () =>
      buildOptions(
        directSeaData
          .filter(item => matchesFilters(item, { carrierFilters: true }))
          .map(item => item.carrier)
      ),
    [directSeaData, filters]
  );
  const agentOptions = useMemo(
    () =>
      buildOptions(
        directSeaData
          .filter(item => matchesFilters(item, { agentFilters: true }))
          .map(item => item.agent)
      ),
    [directSeaData, filters]
  );

  const results = useMemo<DirectSeaResultRow[]>(() => {
    if (!hasActiveFilters) return [];

    const matches = directSeaData.filter(item => matchesFilters(item));
    const activeContainerTypes = filters.containerType ? [filters.containerType] : containerTypes;
    const expanded: DirectSeaResultRow[] = [];

    matches.forEach(item => {
      activeContainerTypes.forEach(containerType => {
        const rate = getDirectSeaRateByContainerType(item, containerType);
        if (rate && rate > 0) {
          expanded.push({ item, containerType, rate });
        }
      });
    });

    return expanded.sort((a, b) => a.rate - b.rate);
  }, [directSeaData, filters, hasActiveFilters]);

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
    setExpandedRows(new Set());
  };

  const handleExport = () => {
    if (!results.length) {
      alert('Нет данных для экспорта');
      return;
    }

    const header = ['POL', 'POD', 'Перевозчик', 'Агент', 'Тип контейнера', 'Ставка ($)', 'Дата действия'];
    const lines = [
      header.join(';'),
      ...results.map(row => {
        const item = row.item;
        return [
          item.pol || '-',
          item.pod || '-',
          item.carrier || '-',
          item.agent || '-',
          getDirectSeaContainerLabel(row.containerType),
          row.rate ? `$${row.rate}` : '—',
          item.dateOfValidity || '-'
        ].join(';');
      })
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `direct_sea_rates_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const showResults = hasActiveFilters;

  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Раздельные ставки</div>
            <h2>Прямое море</h2>
            <div className="trd-meta">
              <div className="exchange-rate-display">
                <label>
                  Курс ЦБ РФ: <span>{exchangeRate ?? '-'}</span> руб/$
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="trd-filters" id="direct-sea-fields">
          <div className="trd-field">
            <label htmlFor="direct-sea-pol">POL</label>
            <div className="custom-select-wrapper">
              <input
                id="direct-sea-pol"
                className="form-input custom-select-input"
                list="direct-sea-pol-list"
                placeholder="POL"
                autoComplete="off"
                value={filters.pol}
                onChange={event => setFilters(prev => ({ ...prev, pol: event.target.value }))}
                onMouseDown={clearOnMouseDown('pol')}
              />
              <datalist id="direct-sea-pol-list">
                {polOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="direct-sea-pod">POD</label>
            <div className="custom-select-wrapper">
              <input
                id="direct-sea-pod"
                className="form-input custom-select-input"
                list="direct-sea-pod-list"
                placeholder="POD"
                autoComplete="off"
                value={filters.pod}
                onChange={event => setFilters(prev => ({ ...prev, pod: event.target.value }))}
                onMouseDown={clearOnMouseDown('pod')}
              />
              <datalist id="direct-sea-pod-list">
                {podOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="direct-sea-container">Тип контейнера</label>
            <select
              id="direct-sea-container"
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
            <label htmlFor="direct-sea-carrier">Перевозчик</label>
            <MultiSelect
              id="direct-sea-carrier"
              label="Перевозчик"
              options={carrierOptions}
              selected={filters.carrierFilters}
              onChange={values => setFilters(prev => ({ ...prev, carrierFilters: values }))}
            />
          </div>
          <div className="trd-field">
            <label htmlFor="direct-sea-agent">Агент</label>
            <MultiSelect
              id="direct-sea-agent"
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
                      <th>POD</th>
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
                        <td colSpan={7} className="muted">
                          {loading ? 'Загрузка данных...' : 'Нет данных для выбранных параметров'}
                        </td>
                      </tr>
                    )}
                    {results.map((row, index) => {
                      const isExpanded = expandedRows.has(index);
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
                            <td>{row.item.pod || '-'}</td>
                            <td>{row.item.carrier || '-'}</td>
                            <td>{row.item.agent || '-'}</td>
                            <td>{getDirectSeaContainerLabel(row.containerType)}</td>
                            <td className="rate">{row.rate ? `$${row.rate}` : '—'}</td>
                            <td>{row.item.dateOfValidity || '-'}</td>
                          </tr>
                          <tr className="row-details" style={{ display: isExpanded ? 'table-row' : 'none' }}>
                            <td colSpan={7}>
                              TS: {row.item.ts || '—'} · Конвертация не ВКЛ:{' '}
                              {row.item.conversionNotIncluded || row.item.conversion || '—'} · ETD: {row.item.etd || '—'} · Remarks:{' '}
                              {row.item.remarks || '—'}
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
              <div className="trd-summary-muted">Прямое море</div>
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
