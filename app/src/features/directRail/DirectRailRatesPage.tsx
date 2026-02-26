import { Fragment, useEffect, useMemo, useState } from 'react';
import MultiSelect from '../../components/MultiSelect';
import type { DirectRailRate } from '../complex/types';
import { loadDbType, loadExchangeRate } from '../shared/api';
import {
  getDirectRailAddonInfo,
  getDirectRailContainerLabel,
  getConversionPercent,
  getDirectRailRateWithConversion,
  normalizeName,
  type DirectRailContainerType
} from './direct-rail-utils';

type FiltersState = {
  fob: string;
  arrivalCity: string;
  borderCrossing: string;
  agentFilters: string[];
  stationFilters: string[];
  containerType: DirectRailContainerType;
};

const containerTypes: DirectRailContainerType[] = ['fob40hc', 'exwFca40hc'];

type DirectRailResultRow = {
  item: DirectRailRate;
  containerType: DirectRailContainerType;
  rate: number;
};

const defaultFilters: FiltersState = {
  fob: '',
  arrivalCity: '',
  borderCrossing: '',
  agentFilters: [],
  stationFilters: [],
  containerType: ''
};

type DirectRailRatesPageProps = {
  onUnauthorized?: () => void;
};

export default function DirectRailRatesPage({ onUnauthorized }: DirectRailRatesPageProps) {
  const [directRailData, setDirectRailData] = useState<DirectRailRate[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.fob ||
          filters.arrivalCity ||
          filters.borderCrossing ||
          filters.containerType ||
          filters.agentFilters.length ||
          filters.stationFilters.length
      ),
    [filters]
  );
  const normalizedFob = normalizeName(filters.fob);
  const normalizedArrival = normalizeName(filters.arrivalCity);
  const normalizedBorder = normalizeName(filters.borderCrossing);
  const normalizedAgentFilters = filters.agentFilters.map(value => normalizeName(value));
  const normalizedStationFilters = filters.stationFilters.map(value => normalizeName(value));

  const hasAnyRate = (item: DirectRailRate) =>
    containerTypes.some(containerType => getDirectRailRateWithConversion(item, containerType) > 0);

  const matchesFilters = (
    item: DirectRailRate,
    exclude: Partial<Record<keyof FiltersState, boolean>> = {}
  ) => {
    if (!exclude.fob && filters.fob && normalizeName(item.fob) !== normalizedFob) return false;
    if (!exclude.arrivalCity && filters.arrivalCity && normalizeName(item.arrivalCity) !== normalizedArrival) {
      return false;
    }
    if (!exclude.borderCrossing && filters.borderCrossing && normalizeName(item.borderCrossing) !== normalizedBorder) {
      return false;
    }

    if (!exclude.containerType) {
      if (filters.containerType) {
        const rate = getDirectRailRateWithConversion(item, filters.containerType);
        if (!rate || rate <= 0) return false;
      } else if (!hasAnyRate(item)) {
        return false;
      }
    }

    if (!exclude.agentFilters && normalizedAgentFilters.length) {
      const agent = normalizeName(item.agent || '');
      if (!normalizedAgentFilters.includes(agent)) return false;
    }
    if (!exclude.stationFilters && normalizedStationFilters.length) {
      const station = normalizeName(item.departureStation || '');
      if (!normalizedStationFilters.includes(station)) return false;
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
        const [rate, data] = await Promise.all([loadExchangeRate(), loadDbType('direct_rail', onUnauthorized)]);
        if (!mounted) return;
        setExchangeRate(rate);
        setDirectRailData(data as DirectRailRate[]);
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
    (field: 'fob' | 'arrivalCity' | 'borderCrossing') => (event: React.MouseEvent<HTMLInputElement>) => {
      if (event.currentTarget.value.trim() !== '') {
        event.currentTarget.value = '';
        setFilters(prev => ({ ...prev, [field]: '' }));
      }
    };

  const fobOptions = useMemo(
    () =>
      buildOptions(
        directRailData
          .filter(item => matchesFilters(item, { fob: true }))
          .map(item => item.fob)
      ),
    [directRailData, filters]
  );
  const arrivalOptions = useMemo(
    () =>
      buildOptions(
        directRailData
          .filter(item => matchesFilters(item, { arrivalCity: true }))
          .map(item => item.arrivalCity)
      ),
    [directRailData, filters]
  );
  const borderOptions = useMemo(
    () =>
      buildOptions(
        directRailData
          .filter(item => matchesFilters(item, { borderCrossing: true }))
          .map(item => item.borderCrossing)
      ),
    [directRailData, filters]
  );
  const agentOptions = useMemo(
    () =>
      buildOptions(
        directRailData
          .filter(item => matchesFilters(item, { agentFilters: true }))
          .map(item => item.agent)
      ),
    [directRailData, filters]
  );
  const stationOptions = useMemo(
    () =>
      buildOptions(
        directRailData
          .filter(item => matchesFilters(item, { stationFilters: true }))
          .map(item => item.departureStation)
      ),
    [directRailData, filters]
  );

  const results = useMemo<DirectRailResultRow[]>(() => {
    if (!hasActiveFilters) return [];

    const matches = directRailData.filter(item => matchesFilters(item));
    const activeContainerTypes = filters.containerType ? [filters.containerType] : containerTypes;
    const expanded: DirectRailResultRow[] = [];

    matches.forEach(item => {
      activeContainerTypes.forEach(containerType => {
        const rate = getDirectRailRateWithConversion(item, containerType);
        if (rate && rate > 0) {
          expanded.push({ item, containerType, rate });
        }
      });
    });

    return expanded.sort((a, b) => a.rate - b.rate);
  }, [directRailData, filters, hasActiveFilters]);

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

    const header = [
      'Станция отправления',
      'Погран переход',
      'FOB',
      'Город прибытия',
      'Агент',
      'Тип контейнера',
      'Ставка ($)',
      'Дата котировки'
    ];
    const lines = [
      header.join(';'),
      ...results.map(row => {
        const item = row.item;
        const addonInfo = getDirectRailAddonInfo(item);
        const conversionPercent = getConversionPercent(item.conversion);
        const applyConversion = (value: number | null) => {
          if (value === null) return null;
          if (!conversionPercent || conversionPercent <= 0) return value;
          return Math.ceil(value + (value * conversionPercent) / 100);
        };
        const fcaTotal =
          typeof addonInfo.fca === 'number'
            ? (addonInfo.base > 0 ? addonInfo.base + addonInfo.fca : addonInfo.fca)
            : null;
        const exwTotal =
          typeof addonInfo.exw === 'number'
            ? (addonInfo.base > 0 ? addonInfo.base + addonInfo.exw : addonInfo.exw)
            : null;
        const fcaWithConversion = applyConversion(fcaTotal);
        const exwWithConversion = applyConversion(exwTotal);
        const hasSplitRates = fcaTotal !== null || exwTotal !== null;
        const formatUsd = (value: number | null) => (value === null ? '—' : `$${value.toLocaleString('ru-RU')}`);
        const rateLabel =
          row.containerType === 'exwFca40hc' && hasSplitRates
            ? `FCA: ${formatUsd(fcaWithConversion)} / EXW: ${formatUsd(exwWithConversion)}`
            : row.rate
            ? `$${row.rate}`
            : '—';
        return [
          item.departureStation || '-',
          item.borderCrossing || '-',
          item.fob || '-',
          item.arrivalCity || '-',
          item.agent || '-',
          getDirectRailContainerLabel(row.containerType),
          rateLabel,
          item.quoteDate || item.dateOfValidity || '-'
        ].join(';');
      })
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `direct_rail_rates_${Date.now()}.csv`;
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
            <h2>Прямое ЖД</h2>
            <div className="trd-meta">
              <div className="exchange-rate-display">
                <label>
                  Курс ЦБ РФ: <span>{exchangeRate ?? '-'}</span> руб/$
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="trd-filters" id="direct-rail-fields">
          <div className="trd-field">
            <label htmlFor="direct-rail-fob">FOB</label>
            <div className="custom-select-wrapper">
              <input
                id="direct-rail-fob"
                className="form-input custom-select-input"
                list="direct-rail-fob-list"
                placeholder="FOB"
                autoComplete="off"
                value={filters.fob}
                onChange={event => setFilters(prev => ({ ...prev, fob: event.target.value }))}
                onMouseDown={clearOnMouseDown('fob')}
              />
              <datalist id="direct-rail-fob-list">
                {fobOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="direct-rail-arrival">Город прибытия</label>
            <div className="custom-select-wrapper">
              <input
                id="direct-rail-arrival"
                className="form-input custom-select-input"
                list="direct-rail-arrival-list"
                placeholder="Город прибытия"
                autoComplete="off"
                value={filters.arrivalCity}
                onChange={event => setFilters(prev => ({ ...prev, arrivalCity: event.target.value }))}
                onMouseDown={clearOnMouseDown('arrivalCity')}
              />
              <datalist id="direct-rail-arrival-list">
                {arrivalOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="direct-rail-border">Погран переход</label>
            <div className="custom-select-wrapper">
              <input
                id="direct-rail-border"
                className="form-input custom-select-input"
                list="direct-rail-border-list"
                placeholder="Погран переход"
                autoComplete="off"
                value={filters.borderCrossing}
                onChange={event => setFilters(prev => ({ ...prev, borderCrossing: event.target.value }))}
                onMouseDown={clearOnMouseDown('borderCrossing')}
              />
              <datalist id="direct-rail-border-list">
                {borderOptions.slice(0, 200).map(value => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="trd-field">
            <label htmlFor="direct-rail-container">Тип контейнера</label>
            <select
              id="direct-rail-container"
              className="form-select"
              value={filters.containerType}
              onChange={event =>
                setFilters(prev => ({ ...prev, containerType: event.target.value as DirectRailContainerType }))
              }
            >
              <option value="">Выберите тип</option>
              <option value="fob40hc">FOB 40'HC</option>
              <option value="exwFca40hc">EXW/FCA 40'HC</option>
            </select>
          </div>
          <div className="trd-field">
            <label htmlFor="direct-rail-agent">Агент</label>
            <MultiSelect
              id="direct-rail-agent"
              label="Агент"
              options={agentOptions}
              selected={filters.agentFilters}
              onChange={values => setFilters(prev => ({ ...prev, agentFilters: values }))}
            />
          </div>
          <div className="trd-field">
            <label htmlFor="direct-rail-station">Станция отправления</label>
            <MultiSelect
              id="direct-rail-station"
              label="Станция отправления"
              options={stationOptions}
              selected={filters.stationFilters}
              onChange={values => setFilters(prev => ({ ...prev, stationFilters: values }))}
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
                      <th>Станция отправления</th>
                      <th>Погран переход</th>
                      <th>FOB</th>
                      <th>Город прибытия</th>
                      <th>Агент</th>
                      <th>Тип контейнера</th>
                      <th>Ставка ($)</th>
                      <th>Дата котировки</th>
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
                      const addonInfo = getDirectRailAddonInfo(row.item);
                      const conversionPercent = getConversionPercent(row.item.conversion);
                      const applyConversion = (value: number | null) => {
                        if (value === null) return null;
                        if (!conversionPercent || conversionPercent <= 0) return value;
                        return Math.ceil(value + (value * conversionPercent) / 100);
                      };
                      const conversionText = row.item.conversion ? String(row.item.conversion).trim() : '';
                      const conversionLine = conversionText
                        ? `Ставка дана включая конвертацию - ${conversionText}`
                        : 'Конвертации нет';
                      const fcaTotal =
                        typeof addonInfo.fca === 'number'
                          ? (addonInfo.base > 0 ? addonInfo.base + addonInfo.fca : addonInfo.fca)
                          : null;
                      const exwTotal =
                        typeof addonInfo.exw === 'number'
                          ? (addonInfo.base > 0 ? addonInfo.base + addonInfo.exw : addonInfo.exw)
                          : null;
                      const fcaWithConversion = applyConversion(fcaTotal);
                      const exwWithConversion = applyConversion(exwTotal);
                      const formatUsd = (value: number | null) =>
                        value === null ? '—' : `$${value.toLocaleString('ru-RU')}`;
                      const hasSplitRates = fcaTotal !== null || exwTotal !== null;
                      return (
                        <Fragment key={`${row.item.fob}-${row.item.arrivalCity}-${row.containerType}-${index}`}>
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
                            <td>{row.item.departureStation || '-'}</td>
                            <td>{row.item.borderCrossing || '-'}</td>
                            <td>{row.item.fob || '-'}</td>
                            <td>{row.item.arrivalCity || '-'}</td>
                            <td>{row.item.agent || '-'}</td>
                            <td>{getDirectRailContainerLabel(row.containerType)}</td>
                            <td className="rate">
                              {row.containerType === 'exwFca40hc' ? (
                                hasSplitRates ? (
                                  <>
                                    <div>FCA: {formatUsd(fcaWithConversion)}</div>
                                    <div>EXW: {formatUsd(exwWithConversion)}</div>
                                  </>
                                ) : (
                                  row.rate ? `$${row.rate}` : '—'
                                )
                              ) : (
                                row.rate ? `$${row.rate}` : '—'
                              )}
                            </td>
                            <td>{row.item.quoteDate || row.item.dateOfValidity || '-'}</td>
                          </tr>
                          <tr className="row-details" style={{ display: isExpanded ? 'table-row' : 'none' }}>
                            <td colSpan={8}>
                              Станция прибытия: {row.item.arrivalStation || '—'} · ETD: {row.item.etd || '—'} · {conversionLine} · Remark:{' '}
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
              <div className="trd-summary-muted">Прямое ЖД</div>
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
