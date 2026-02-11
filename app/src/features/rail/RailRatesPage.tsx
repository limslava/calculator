import { Fragment, useEffect, useMemo, useState } from 'react';
import MultiSelect from '../../components/MultiSelect';
import type { RailRate } from '../complex/types';
import { loadDbType, loadExchangeRate } from '../shared/api';
import { isRailServiceIncluded } from '../shared/service-utils';
import { getRailContainerLabel, getRailRateByContainerType, normalizeName } from './rail-utils';

const containerOptions = [
  { value: 'container20Under24', label: '20фут ктк (до 24 тонн)' },
  { value: 'container20Over24', label: '20фут ктк (24–28 тонн)' },
  { value: 'container40', label: '40фут ктк' }
];

const containerTypes = containerOptions.map(option => option.value);

type RailResultRow = {
  item: RailRate;
  containerType: string;
  rate: number;
};

type FiltersState = {
  city: string;
  destination: string;
  containerType: string;
  agentFilters: string[];
  terminalValue: string;
};

const defaultFilters: FiltersState = {
  city: '',
  destination: '',
  containerType: '',
  agentFilters: [],
  terminalValue: ''
};

type RailRatesPageProps = {
  onUnauthorized?: () => void;
};

export default function RailRatesPage({ onUnauthorized }: RailRatesPageProps) {
  const [railData, setRailData] = useState<RailRate[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.city ||
          filters.destination ||
          filters.containerType ||
          filters.agentFilters.length ||
          filters.terminalValue
      ),
    [filters]
  );
  const normalizedCity = normalizeName(filters.city);
  const normalizedDestination = normalizeName(filters.destination);
  const normalizedAgentFilters = filters.agentFilters.map(value => normalizeName(value));
  const normalizedTerminalValue = normalizeName(filters.terminalValue);

  const getTerminalValue = (item: RailRate) => {
    const rawTerminal = item['тыловойТерминал'];
    if (rawTerminal === true) return 'да';
    if (rawTerminal === false) return 'нет';
    if (rawTerminal === null || rawTerminal === undefined) return '';
    return String(rawTerminal);
  };

  const matchesFilters = (
    item: RailRate,
    exclude: Partial<Record<keyof FiltersState, boolean>> = {}
  ) => {
    if (!exclude.city && filters.city && normalizeName(item.city) !== normalizedCity) return false;
    if (!exclude.destination && filters.destination && normalizeName(item.destination) !== normalizedDestination) {
      return false;
    }

    if (!exclude.containerType && filters.containerType) {
      const rate = getRailRateByContainerType(item, filters.containerType);
      if (!rate || rate <= 0) return false;
    }

    if (!exclude.agentFilters && normalizedAgentFilters.length) {
      const agent = normalizeName(item.agent || '');
      if (!normalizedAgentFilters.includes(agent)) return false;
    }

    if (!exclude.terminalValue && normalizedTerminalValue) {
      const terminalText = getTerminalValue(item);
      if (normalizeName(terminalText) !== normalizedTerminalValue) return false;
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
        const [rate, data] = await Promise.all([loadExchangeRate(), loadDbType('rail', onUnauthorized)]);
        if (!mounted) return;
        setExchangeRate(rate);
        setRailData(data as RailRate[]);
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
    (field: 'city' | 'destination') => (event: React.MouseEvent<HTMLInputElement>) => {
      if (event.currentTarget.value.trim() !== '') {
        event.currentTarget.value = '';
        setFilters(prev => ({ ...prev, [field]: '' }));
      }
    };

  const availableRailData = useMemo(
    () => railData.filter(item => isRailServiceIncluded(item.service)),
    [railData]
  );

  const cityOptions = useMemo(
    () =>
      buildOptions(
        availableRailData
          .filter(item => matchesFilters(item, { city: true }))
          .map(item => item.city)
      ),
    [availableRailData, filters]
  );
  const destinationOptions = useMemo(
    () =>
      buildOptions(
        availableRailData
          .filter(item => matchesFilters(item, { destination: true }))
          .map(item => item.destination)
      ),
    [availableRailData, filters]
  );
  const agentOptions = useMemo(
    () =>
      buildOptions(
        availableRailData
          .filter(item => matchesFilters(item, { agentFilters: true }))
          .map(item => item.agent)
      ),
    [availableRailData, filters]
  );

  const results = useMemo<RailResultRow[]>(() => {
    if (!hasActiveFilters) return [];

    const matches = availableRailData.filter(item => matchesFilters(item));
    const activeContainerTypes = filters.containerType ? [filters.containerType] : containerTypes;
    const expanded: RailResultRow[] = [];

    matches.forEach(item => {
      activeContainerTypes.forEach(containerType => {
        const rate = getRailRateByContainerType(item, containerType);
        if (rate && rate > 0) {
          expanded.push({ item, containerType, rate });
        }
      });
    });

    return expanded.sort((a, b) => a.rate - b.rate);
  }, [availableRailData, filters, hasActiveFilters]);

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
      bestLabel: bestRate ? `${bestRate.toLocaleString('ru-RU')} ₽` : '—',
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

    const header = [
      'Город',
      'Терминал ЖД',
      'Тыловой терминал',
      'Пункт назначения',
      'Тип контейнера',
      'Ставка (₽)',
      'Условия',
      'Дата действия'
    ];
    const lines = [
      header.join(';'),
      ...results.map(row => {
        const item = row.item;
        return [
          item.city || '-',
          item.agent || '-',
          item['тыловойТерминал'] ? String(item['тыловойТерминал']) : '-',
          item.destination || '-',
          getRailContainerLabel(row.containerType),
          row.rate ? `${row.rate.toLocaleString('ru-RU')} ₽` : '—',
          item.conditions || '-',
          item.validity || item.dateOfValidity || '-'
        ].join(';');
      })
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rail_rates_${Date.now()}.csv`;
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
            <h2>ЖД</h2>
            <div className="trd-meta">
              <div className="exchange-rate-display">
                <label>
                  Курс ЦБ РФ: <span>{exchangeRate ?? '-'}</span> руб/$
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="trd-filters" id="rail-fields">
          <div className="trd-field">
            <label htmlFor="rail-city">Город</label>
            <div className="custom-select-wrapper">
              <input
                id="rail-city"
                className="form-input custom-select-input"
                list="rail-city-list"
                placeholder="Город"
                autoComplete="off"
                value={filters.city}
                onChange={event => setFilters(prev => ({ ...prev, city: event.target.value }))}
                onMouseDown={clearOnMouseDown('city')}
              />
              <datalist id="rail-city-list">
                {cityOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="rail-destination">Пункт назначения</label>
            <div className="custom-select-wrapper">
              <input
                id="rail-destination"
                className="form-input custom-select-input"
                list="rail-destination-list"
                placeholder="Пункт назначения"
                autoComplete="off"
                value={filters.destination}
                onChange={event => setFilters(prev => ({ ...prev, destination: event.target.value }))}
                onMouseDown={clearOnMouseDown('destination')}
              />
              <datalist id="rail-destination-list">
                {destinationOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="rail-container">Тип контейнера</label>
            <select
              id="rail-container"
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
            <label htmlFor="rail-agent">Терминал ЖД</label>
            <MultiSelect
              id="rail-agent"
              label="Терминал ЖД"
              options={agentOptions}
              selected={filters.agentFilters}
              onChange={values => setFilters(prev => ({ ...prev, agentFilters: values }))}
            />
          </div>
          <div className="trd-field">
            <label htmlFor="rail-terminal">Тыловой терминал</label>
            <select
              id="rail-terminal"
              className="form-select"
              value={filters.terminalValue}
              onChange={event => setFilters(prev => ({ ...prev, terminalValue: event.target.value }))}
            >
              <option value="">Все</option>
              <option value="да">Да</option>
              <option value="нет">Нет</option>
            </select>
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
                      <th>Город</th>
                      <th>Терминал ЖД</th>
                      <th>Тыловой терминал</th>
                      <th>Пункт назначения</th>
                      <th>Тип контейнера</th>
                      <th>Ставка (₽)</th>
                      <th>Условия</th>
                      <th>Дата действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showResults && results.length === 0 && (
                      <tr>
                        <td colSpan={8} className="muted">
                          {loading ? 'Загрузка данных...' : 'Нет данных для выбранных параметров'}
                        </td>
                      </tr>
                    )}
                    {results.map((row, index) => {
                      const isExpanded = expandedRows.has(index);
                      const vochrValue =
                        row.containerType === 'container40' ? row.item.vochr40 : row.item.vochr20;
                      const formatMoney = (value: unknown) => {
                        if (value === null || value === undefined || value === '') return '—';
                        if (typeof value === 'number') return `${value.toLocaleString('ru-RU')} ₽`;
                        return String(value);
                      };
                      const formatPlain = (value: unknown) => {
                        if (value === null || value === undefined || value === '') return '—';
                        if (typeof value === 'number') return value.toLocaleString('ru-RU');
                        return String(value);
                      };
                      return (
                        <Fragment key={`${row.item.city}-${row.item.destination}-${row.containerType}-${index}`}>
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
                            <td>{row.item.city || '-'}</td>
                            <td>{row.item.agent || '-'}</td>
                            <td>{row.item['тыловойТерминал'] ? String(row.item['тыловойТерминал']) : '-'}</td>
                            <td>{row.item.destination || '-'}</td>
                            <td>{getRailContainerLabel(row.containerType)}</td>
                            <td className="rate">
                              {row.rate ? `${row.rate.toLocaleString('ru-RU')} ₽` : '—'}
                            </td>
                            <td>{row.item.conditions || '-'}</td>
                            <td>{row.item.validity || row.item.dateOfValidity || '-'}</td>
                          </tr>
                          <tr className="row-details" style={{ display: isExpanded ? 'table-row' : 'none' }}>
                            <td colSpan={8}>
                              Автовывоз: {formatMoney(row.item.autovivoz)} · ПРР: {formatMoney(row.item.prr)} · НДС:{' '}
                              {formatMoney(row.item.nds)} · ВОХР: {formatMoney(vochrValue)} · Фитинги/ПВ:{' '}
                              {formatPlain(row.item.fitting)}
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
              <div className="trd-summary-muted">ЖД ставки</div>
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
