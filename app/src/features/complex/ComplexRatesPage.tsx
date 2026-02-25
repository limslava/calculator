import { Fragment, useEffect, useMemo, useState } from 'react';
import MultiSelect from '../../components/MultiSelect';
import type { ComplexResult, ComplexRow, Database } from './types';
import { loadDbType, loadExchangeRate } from '../shared/api';
import {
  applyComplexUiFilters,
  buildAgentOptions,
  buildComplexRow,
  buildDepartureOptions,
  buildDestinationOptions,
  buildLineOptions,
  buildTerminalOptions,
  calculateAllRates,
  emptyDatabase,
  formatSummaryRate,
  formatRateValue,
  getComplexContainerLabel,
  getDisplayAgent,
  getResultFilterValues,
  uniqueSorted
} from './utils';

const rateTypeOptions = [
  { value: 'all', label: 'Все' },
  { value: 'sea_rail', label: 'Море + ЖД' },
  { value: 'through_service', label: 'Сквозной сервис' },
  { value: 'sea', label: 'Море' },
  { value: 'rail', label: 'ЖД' },
  { value: 'direct_sea', label: 'Прямое море' },
  { value: 'direct_rail', label: 'Прямое ЖД' }
];

const containerOptions = [
  { value: '', label: 'Выберите тип' },
  { value: 'dc_20', label: "20'DC" },
  { value: 'hc_40', label: "40'HC" }
];

type FiltersState = {
  departure: string;
  destination: string;
  rateType: string;
  containerType: string;
  lineFilters: string[];
  agentFilters: string[];
  terminalFilters: string[];
  weightOver24: boolean;
  vttTrigger: boolean;
};

const defaultFilters: FiltersState = {
  departure: '',
  destination: '',
  rateType: 'all',
  containerType: '',
  lineFilters: [],
  agentFilters: [],
  terminalFilters: [],
  weightOver24: false,
  vttTrigger: false
};

type ComplexRatesPageProps = {
  onUnauthorized?: () => void;
};

export default function ComplexRatesPage({ onUnauthorized }: ComplexRatesPageProps) {
  const [database, setDatabase] = useState<Database>(emptyDatabase);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.departure ||
          filters.destination ||
          filters.containerType ||
          filters.rateType !== 'all' ||
          filters.lineFilters.length ||
          filters.agentFilters.length ||
          filters.terminalFilters.length
      ),
    [filters]
  );

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [rate, sea, rail, directRail, directSea, tariff] = await Promise.all([
          loadExchangeRate(),
          loadDbType('sea', onUnauthorized),
          loadDbType('rail', onUnauthorized),
          loadDbType('direct_rail', onUnauthorized),
          loadDbType('direct_sea', onUnauthorized),
          loadDbType('tariff', onUnauthorized)
        ]);

        if (!mounted) return;

        setExchangeRate(rate);
        setDatabase({
          sea,
          rail,
          direct_rail: directRail,
          direct_sea: directSea,
          tariff
        });
      } catch (error) {
        if (!mounted) return;
        if (error instanceof Error && error.message === 'unauthorized') {
          setLoading(false);
          return;
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [onUnauthorized]);

  const allResults = useMemo<ComplexResult[]>(() => {
    if (!hasActiveFilters) return [];
    return calculateAllRates({
      db: database,
      departure: filters.departure || undefined,
      destination: filters.destination || undefined,
      containerType: filters.containerType || undefined,
      usdToRubRate: exchangeRate,
      is20ftOver24Tons: filters.weightOver24,
      isVttTrigger: filters.vttTrigger
    });
  }, [
    database,
    exchangeRate,
    filters.departure,
    filters.destination,
    filters.containerType,
    filters.weightOver24,
    filters.vttTrigger,
    hasActiveFilters
  ]);

  const filteredResults = useMemo(() => {
    return applyComplexUiFilters(allResults, {
      rateType: filters.rateType,
      lineFilters: filters.lineFilters,
      agentFilters: filters.agentFilters,
      terminalFilters: filters.terminalFilters
    });
  }, [allResults, filters.rateType, filters.lineFilters, filters.agentFilters, filters.terminalFilters]);

  const extractDeparture = (result: ComplexResult) => {
    if (result.transportType === 'direct_rail') return result.data?.fob;
    if (result.transportType === 'direct_sea') return result.data?.pol;
    if (result.transportType === 'sea') return result.data?.pol;
    if (result.transportType === 'sea_rail') return result.data?.sea?.pol;
    return undefined;
  };

  const extractDestination = (result: ComplexResult) => {
    if (result.transportType === 'direct_rail') return result.data?.arrivalCity;
    if (result.transportType === 'direct_sea') return result.data?.pod;
    if (result.transportType === 'sea') return result.data?.dropOffArea;
    if (result.transportType === 'sea_rail') return result.data?.rail?.destination || result.data?.sea?.dropOffArea;
    return undefined;
  };

  const departureOptionResults = useMemo(() => {
    if (!hasActiveFilters) return [];
    return calculateAllRates({
      db: database,
      departure: undefined,
      destination: filters.destination || undefined,
      containerType: filters.containerType || undefined,
      usdToRubRate: exchangeRate,
      is20ftOver24Tons: filters.weightOver24,
      isVttTrigger: filters.vttTrigger
    });
  }, [
    database,
    exchangeRate,
    filters.destination,
    filters.containerType,
    filters.weightOver24,
    filters.vttTrigger,
    hasActiveFilters
  ]);

  const destinationOptionResults = useMemo(() => {
    if (!hasActiveFilters) return [];
    return calculateAllRates({
      db: database,
      departure: filters.departure || undefined,
      destination: undefined,
      containerType: filters.containerType || undefined,
      usdToRubRate: exchangeRate,
      is20ftOver24Tons: filters.weightOver24,
      isVttTrigger: filters.vttTrigger
    });
  }, [
    database,
    exchangeRate,
    filters.departure,
    filters.containerType,
    filters.weightOver24,
    filters.vttTrigger,
    hasActiveFilters
  ]);

  const filteredDepartureResults = useMemo(
    () =>
      applyComplexUiFilters(departureOptionResults, {
        rateType: filters.rateType,
        lineFilters: filters.lineFilters,
        agentFilters: filters.agentFilters,
        terminalFilters: filters.terminalFilters
      }),
    [
      departureOptionResults,
      filters.rateType,
      filters.lineFilters,
      filters.agentFilters,
      filters.terminalFilters
    ]
  );

  const filteredDestinationResults = useMemo(
    () =>
      applyComplexUiFilters(destinationOptionResults, {
        rateType: filters.rateType,
        lineFilters: filters.lineFilters,
        agentFilters: filters.agentFilters,
        terminalFilters: filters.terminalFilters
      }),
    [
      destinationOptionResults,
      filters.rateType,
      filters.lineFilters,
      filters.agentFilters,
      filters.terminalFilters
    ]
  );

  const departureOptions = useMemo(() => {
    if (!hasActiveFilters) return buildDepartureOptions(database);
    return uniqueSorted(filteredDepartureResults.map(extractDeparture));
  }, [hasActiveFilters, database, filteredDepartureResults]);

  const destinationOptions = useMemo(() => {
    if (!hasActiveFilters) return buildDestinationOptions(database);
    return uniqueSorted(filteredDestinationResults.map(extractDestination));
  }, [hasActiveFilters, database, filteredDestinationResults]);

  const lineOptions = useMemo(() => {
    if (!hasActiveFilters) return buildLineOptions(database);
    const filtered = applyComplexUiFilters(allResults, {
      rateType: filters.rateType,
      lineFilters: [],
      agentFilters: filters.agentFilters,
      terminalFilters: filters.terminalFilters
    });
    return uniqueSorted(filtered.flatMap(result => getResultFilterValues(result, 'line')));
  }, [allResults, database, filters.rateType, filters.agentFilters, filters.terminalFilters, hasActiveFilters]);

  const agentOptions = useMemo(() => {
    if (!hasActiveFilters) return buildAgentOptions(database);
    const filtered = applyComplexUiFilters(allResults, {
      rateType: filters.rateType,
      lineFilters: filters.lineFilters,
      agentFilters: [],
      terminalFilters: filters.terminalFilters
    });
    return uniqueSorted(filtered.map(result => getDisplayAgent(result)));
  }, [allResults, database, filters.rateType, filters.lineFilters, filters.terminalFilters, hasActiveFilters]);

  const terminalOptions = useMemo(() => {
    if (!hasActiveFilters) return buildTerminalOptions(database);
    const filtered = applyComplexUiFilters(allResults, {
      rateType: filters.rateType,
      lineFilters: filters.lineFilters,
      agentFilters: filters.agentFilters,
      terminalFilters: []
    });
    return uniqueSorted(filtered.flatMap(result => getResultFilterValues(result, 'terminal')));
  }, [allResults, database, filters.rateType, filters.lineFilters, filters.agentFilters, hasActiveFilters]);

  const rows = useMemo<ComplexRow[]>(() => {
    const built = filteredResults.map(result =>
      buildComplexRow(result, filters.departure, filters.destination, exchangeRate)
    );
    return built.sort((a, b) => {
      const aVal = typeof a.numericTotal === 'number' ? a.numericTotal : Number.POSITIVE_INFINITY;
      const bVal = typeof b.numericTotal === 'number' ? b.numericTotal : Number.POSITIVE_INFINITY;
      return aVal - bVal;
    });
  }, [filteredResults, filters.departure, filters.destination, exchangeRate]);

  useEffect(() => {
    setSelectedRow(null);
    setExpandedRows(new Set());
  }, [filteredResults]);

  const summary = useMemo(() => {
    const total = filteredResults.length;
    if (!hasActiveFilters) {
      return {
        totalLabel: '—',
        splitLabel: '—',
        bestLabel: '—',
        bestByContainer: [],
        avgLabel: '—',
        note: 'Выберите фильтр, чтобы увидеть ставки.'
      };
    }
    if (!total) {
      return {
        totalLabel: '—',
        splitLabel: '—',
        bestLabel: '—',
        bestByContainer: [],
        avgLabel: '—',
        note: 'Нет ставок по выбранным фильтрам.'
      };
    }
    const split = filteredResults.reduce<Record<string, number>>((acc, item) => {
      const key = item.transportName || item.transportType || 'Другое';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const splitLabel = Object.entries(split)
      .map(([label, count]) => `${count} ${label.toLowerCase()}`)
      .join(' · ');

    const sortByNormalizedRate = (a: typeof filteredResults[number], b: typeof filteredResults[number]) => {
      let rateA = a.rate || 0;
      let rateB = b.rate || 0;
      if (a.currency === '$' && exchangeRate) rateA *= exchangeRate;
      if (b.currency === '$' && exchangeRate) rateB *= exchangeRate;
      return rateA - rateB;
    };

    const pickBestLabel = (items: typeof filteredResults) => {
      if (!items.length) return '—';
      const sorted = [...items].sort(sortByNormalizedRate);
      return formatSummaryRate(sorted[0]?.rate, sorted[0]?.currency);
    };

    const bestByContainer = filters.containerType
      ? [
          {
            label: getComplexContainerLabel(filters.containerType),
            value: pickBestLabel(filteredResults)
          }
        ]
      : (['dc_20', 'hc_40'] as const).map(containerType => ({
          label: getComplexContainerLabel(containerType),
          value: pickBestLabel(filteredResults.filter(item => item.containerType === containerType))
        }));

    const sorted = [...filteredResults].sort(sortByNormalizedRate);

    return {
      totalLabel: `${total} ставок`,
      splitLabel,
      bestLabel: formatSummaryRate(sorted[0]?.rate, sorted[0]?.currency),
      bestByContainer,
      avgLabel: '—',
      note: 'Выберите строку, чтобы увидеть детали выбранной ставки.'
    };
  }, [filteredResults, exchangeRate, hasActiveFilters, filters.containerType]);

  const selectedNote = useMemo(() => {
    if (selectedRow === null || !rows[selectedRow]) {
      return summary.note;
    }
    const row = rows[selectedRow];
    return `${row.typeLabel}: ${row.from || '—'} → ${row.to || '—'} · ${row.agent || 'без агента'} · ${formatRateValue(row.rate, row.currency)}`;
  }, [rows, selectedRow, summary.note]);

  const handleReset = () => {
    setFilters(defaultFilters);
    setSelectedRow(null);
    setExpandedRows(new Set());
  };

  const handleExport = () => {
    if (!filteredResults.length) {
      alert('Нет данных для экспорта');
      return;
    }

    const header = ['Тип', 'Маршрут', 'Ставка', 'Валюта', 'Линия', 'Агент', 'Доп.инфо'];
    const lines = [
      header.join(';'),
      ...filteredResults.map(result => {
        const route = result.data?.connection || `${result.data?.sea?.pol || result.data?.pol || '-'} → ${result.data?.rail?.destination || result.data?.pod || '-'}`;
        const line = result.data?.sea?.carrier || result.data?.carrier || '-';
        const agent = result.data?.rail?.agent || result.data?.agent || '-';
        const info = result.transportName || '-';
        return [
          result.transportName || '',
          route,
          result.rate || '',
          result.currency || '',
          line,
          agent,
          info
        ]
          .map(value => `"${String(value).replace(/"/g, '""')}"`)
          .join(';');
      })
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `complex_rates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const clearOnMouseDown = (field: 'departure' | 'destination') => (event: React.MouseEvent<HTMLInputElement>) => {
    if (event.currentTarget.value.trim() !== '') {
      event.currentTarget.value = '';
      setFilters(prev => ({ ...prev, [field]: '' }));
    }
  };

  const showResults = hasActiveFilters;

  return (
    <section id="sales-interface" className="section">
      <div className="trd-shell">
        <div className="trd-topbar">
          <div className="trd-title">
            <div className="trd-subtitle">Комплексные ставки</div>
            <h2>Обзор тарифов и ставок</h2>
            <div className="trd-meta">
              <div className="exchange-rate-display">
                <label>
                  Курс ЦБ РФ: <span id="exchange-rate-value">{exchangeRate ?? '-'}</span> руб/$
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="trd-filters" id="complex-fields">
          <div className="trd-field">
            <label htmlFor="complex-departure">Откуда</label>
            <div className="custom-select-wrapper">
              <input
                type="text"
                id="complex-departure"
                className="form-input custom-select-input"
                list="complex-departure-list"
                placeholder="POL / FOB / Город"
                autoComplete="off"
                value={filters.departure}
                onChange={event => setFilters(prev => ({ ...prev, departure: event.target.value }))}
                onMouseDown={clearOnMouseDown('departure')}
              />
              <datalist id="complex-departure-list">
                {departureOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="complex-destination">Куда</label>
            <div className="custom-select-wrapper">
              <input
                type="text"
                id="complex-destination"
                className="form-input custom-select-input"
                list="complex-destination-list"
                placeholder="POD / Назначение"
                autoComplete="off"
                value={filters.destination}
                onChange={event => setFilters(prev => ({ ...prev, destination: event.target.value }))}
                onMouseDown={clearOnMouseDown('destination')}
              />
              <datalist id="complex-destination-list">
                {destinationOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="complex-rate-type">Тип ставки</label>
            <select
              id="complex-rate-type"
              className="form-select"
              value={filters.rateType}
              onChange={event => setFilters(prev => ({ ...prev, rateType: event.target.value }))}
            >
              {rateTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="trd-field">
            <label htmlFor="complex-container-type">Контейнер</label>
            <select
              id="complex-container-type"
              className="form-select"
              value={filters.containerType}
              onChange={event =>
                setFilters(prev => ({
                  ...prev,
                  containerType: event.target.value,
                  weightOver24: event.target.value === 'dc_20' ? prev.weightOver24 : false
                }))
              }
            >
              {containerOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="trd-field">
            <label htmlFor="complex-line">Перевозчик</label>
            <MultiSelect
              id="complex-line"
              label="Перевозчик"
              options={lineOptions}
              selected={filters.lineFilters}
              onChange={values => setFilters(prev => ({ ...prev, lineFilters: values }))}
            />
          </div>
          <div className="trd-field">
            <label htmlFor="complex-agent">Агент</label>
            <MultiSelect
              id="complex-agent"
              label="Агент"
              options={agentOptions}
              selected={filters.agentFilters}
              onChange={values => setFilters(prev => ({ ...prev, agentFilters: values }))}
            />
          </div>
          <div className="trd-field">
            <label htmlFor="complex-terminal">Терминал ЖД</label>
            <MultiSelect
              id="complex-terminal"
              label="Терминал ЖД"
              options={terminalOptions}
              selected={filters.terminalFilters}
              onChange={values => setFilters(prev => ({ ...prev, terminalFilters: values }))}
            />
          </div>
        </div>

          <div className="trd-actions-row">
            <div className="trd-actions-options">
              <label className="trd-check">
                <input
                  type="checkbox"
                  checked={filters.weightOver24}
                  disabled={filters.containerType !== 'dc_20'}
                  onChange={event => setFilters(prev => ({ ...prev, weightOver24: event.target.checked }))}
                />
                20фут ктк (24–28 тонн)
              </label>
            <label className="trd-check">
              <input
                type="checkbox"
                checked={filters.vttTrigger}
                onChange={event => setFilters(prev => ({ ...prev, vttTrigger: event.target.checked }))}
              />
              ВТТ (море POD = жд агент)
            </label>
          </div>
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
                        <th>Тип перевозки</th>
                        <th>Тип контейнера</th>
                        <th>Ставка море</th>
                        <th>POD</th>
                        <th>Агент</th>
                        <th>Перевозчик</th>
                        <th>Ставка ЖД</th>
                        <th>Станция отправления</th>
                        <th>Общая ставка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showResults && rows.length === 0 && (
                        <tr>
                          <td colSpan={9} className="muted">
                            {loading ? 'Загрузка данных...' : 'Нет данных для выбранных параметров'}
                          </td>
                        </tr>
                      )}
                      {rows.map((row, index) => {
                        const isExpanded = expandedRows.has(index);
                        return (
                          <Fragment key={`row-${index}`}>
                            <tr
                              className={`row-main ${selectedRow === index ? 'is-active' : ''}`.trim()}
                              onClick={() => {
                                setSelectedRow(index);
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
                              <td>
                                <div className="trd-type-cell">
                                  <span className="tag">{row.typeLabel}</span>
                                </div>
                              </td>
                              <td>{row.containerLabel || '—'}</td>
                              <td>{row.seaRate || '—'}</td>
                              <td>{row.pod || '—'}</td>
                              <td>{row.agent || '—'}</td>
                              <td>{row.carrier || '—'}</td>
                              <td>{row.railRate || '—'}</td>
                              <td>{row.departureStation || '—'}</td>
                              <td className="rate">{row.totalRate || '—'}</td>
                            </tr>
                            <tr
                              className="row-details"
                              style={{ display: isExpanded ? 'table-row' : 'none' }}
                            >
                              <td colSpan={9}>
                                ETD: {row.etd || '—'} · Дата действия: {row.dateOfValidity || '—'} · Станция:{' '}
                                {row.departureStation || '—'} · Погран переход: {row.borderCrossing || '—'} · Примечание:{' '}
                                {row.additionalInfo || '—'}
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
              <div className="trd-summary-muted">{summary.splitLabel}</div>
            </div>
            <div className="trd-summary-block">
              <div className="trd-summary-label">Лучшая ставка</div>
              {summary.bestByContainer.length ? (
                <div className="trd-summary-list">
                  {summary.bestByContainer.map(item => (
                    <div key={item.label || item.value} className="trd-summary-line">
                      <span>{item.label || '—'}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="trd-summary-value">{summary.bestLabel}</div>
              )}
            </div>
            <div className="trd-summary-block">
              <div className="trd-summary-label">Средний срок</div>
              <div className="trd-summary-value">{summary.avgLabel}</div>
            </div>
            <div className="trd-summary-block">
              <div className="trd-note">{selectedNote}</div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
