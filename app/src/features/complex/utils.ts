import type { ComplexResult, ComplexRow, Database, TransportType } from './types';
import { isThroughServiceRail, isThroughServiceSea, normalizeAgentName } from '../shared/service-utils';

export const emptyDatabase: Database = {
  sea: [],
  rail: [],
  direct_rail: [],
  direct_sea: [],
  tariff: []
};

export function normalizeCityName(city?: string | null) {
  if (!city) return '';
  const normalized = city.trim().toUpperCase();

  if (
    normalized === 'STP' ||
    normalized === 'SPB' ||
    normalized === 'ST.PETERSBURG' ||
    normalized === 'SAINT PETERSBURG' ||
    normalized === 'ST. PETERSBURG'
  ) {
    return 'St. Petersburg';
  }

  if (normalized === 'MOW' || normalized === 'MSK') {
    return 'Moscow';
  }

  if (normalized === 'ТОЛЬЯТТИ' || normalized === 'TOLYATTI') {
    return 'Tolyatti';
  }

  return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
}

export function formatRateValue(rate?: number | null, currency?: string | null) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return '—';
  const numeric = Math.round(Number(rate));
  if (currency === 'RUB' || currency === '₽') {
    return `${numeric.toLocaleString('ru-RU')} ₽`;
  }
  return `$${numeric.toLocaleString('ru-RU')}`;
}

export function formatSummaryRate(rate?: number | null, currency?: string | null) {
  if (!rate || Number.isNaN(Number(rate))) return '—';
  const rounded = Math.round(Number(rate));
  if (currency === 'RUB') return `${rounded.toLocaleString('ru-RU')} ₽`;
  return `$${rounded.toLocaleString('ru-RU')}`;
}

export function getVttRateForTerminal(db: Database, terminalName?: string) {
  if (!db.tariff || db.tariff.length === 0) return 0;
  const normalizedTerminal = terminalName ? terminalName.trim().toLowerCase() : '';
  const tariff = db.tariff.find(
    t => t.terminal && t.terminal.trim().toLowerCase() === normalizedTerminal
  );
  if (tariff && tariff.vtt !== undefined && tariff.vtt !== null) return tariff.vtt;

  const generalTariff = db.tariff.find(
    t => t.terminal && t.terminal.trim().toLowerCase() === 'общий'
  );
  if (generalTariff && generalTariff.vtt !== undefined && generalTariff.vtt !== null) {
    return generalTariff.vtt;
  }

  if (db.tariff[0] && db.tariff[0].vtt !== undefined && db.tariff[0].vtt !== null) {
    return db.tariff[0].vtt as number;
  }

  return 0;
}

export function getComplexContainerLabel(containerType?: string) {
  if (!containerType) return '';
  if (containerType === 'dc_20') return "20'DC";
  if (containerType === 'hc_40') return "40'HC";
  return containerType;
}

function parseConversionPercent(value?: string | number | null) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === 'нет' || lowered === 'no') return null;
  const match = lowered.match(/[\d.,]+/);
  if (!match) return null;
  const parsed = Number(match[0].replace(',', '.'));
  if (Number.isNaN(parsed)) return null;
  if (parsed > 0 && parsed < 1) return parsed * 100;
  return parsed;
}

function applyConversionUp(base: number, percent: number | null) {
  if (!percent || percent <= 0) return base;
  return Math.ceil(base + (base * percent) / 100);
}

export function calculateAllRates(params: {
  db: Database;
  departure?: string;
  destination?: string;
  containerType?: string;
  usdToRubRate: number | null;
  is20ftOver24Tons: boolean;
  isVttTrigger: boolean;
}): ComplexResult[] {
  const { db, departure, destination, containerType, usdToRubRate, is20ftOver24Tons, isVttTrigger } = params;
  const allResults: ComplexResult[] = [];
  const normalizedDeparture = departure ? normalizeCityName(departure) : '';
  const normalizedDestination = destination ? normalizeCityName(destination) : '';
  const activeContainerTypes = containerType ? [containerType] : ['dc_20', 'hc_40'];

  if (db.direct_rail && db.direct_rail.length > 0) {
    const directRailResults = db.direct_rail.filter(item =>
      (!normalizedDeparture || (item.fob && normalizeCityName(item.fob) === normalizedDeparture)) &&
      (!normalizedDestination || (item.arrivalCity && normalizeCityName(item.arrivalCity) === normalizedDestination)) &&
      (item.fob40hc || 0) > 0
    );

    directRailResults.forEach(item => {
      if (!activeContainerTypes.includes('hc_40')) return;
      const rate = item.fob40hc || 0;
      if (rate <= 0) return;
      const conversionPercent = parseConversionPercent(item.conversion);
      const rateWithConversion = applyConversionUp(rate, conversionPercent);
      allResults.push({
        transportType: 'direct_rail',
        transportName: 'Прямое ЖД',
        containerType: 'hc_40',
        rate: rateWithConversion,
        currency: '$',
        data: {
          ...item,
          rateWithConversion,
          conversionPercent
        }
      });
    });
  }

  if (db.direct_sea && db.direct_sea.length > 0) {
    const directSeaResults = db.direct_sea.filter(item =>
      (!normalizedDeparture || (item.pol && normalizeCityName(item.pol) === normalizedDeparture)) &&
      (!normalizedDestination || (item.pod && normalizeCityName(item.pod) === normalizedDestination)) &&
      ((item.dc20 || 0) > 0 || (item.hc40 || 0) > 0)
    );

    directSeaResults.forEach(item => {
      const conversionPercent = parseConversionPercent(item.conversionNotIncluded || item.conversion);
      activeContainerTypes.forEach(activeType => {
        let rate = 0;
        if (activeType === 'dc_20') {
          rate = item.dc20 || 0;
        } else if (activeType === 'hc_40') {
          rate = item.hc40 || 0;
        }

        if (rate > 0) {
          const rateWithConversion = applyConversionUp(rate, conversionPercent);
          allResults.push({
            transportType: 'direct_sea',
            transportName: 'Прямое море',
            containerType: activeType,
            rate: rateWithConversion,
            currency: '$',
            data: {
              ...item,
              rateWithConversion,
              conversionPercent
            }
          });
        }
      });
    });
  }

  if (db.sea && db.sea.length > 0) {
    const seaResults = db.sea.filter(item =>
      (!normalizedDeparture || (item.pol && normalizeCityName(item.pol) === normalizedDeparture)) &&
      (!normalizedDestination ||
        ((item.dropOffArea || item.pod) &&
          normalizeCityName(item.dropOffArea || item.pod) === normalizedDestination)) &&
      ((item.soc20 || 0) > 0 || (item.soc40 || 0) > 0 || (item.dc20 || 0) > 0 || (item.hc40 || 0) > 0)
    );

    seaResults.forEach(item => {
      const conversionPercent = parseConversionPercent(item.conversion);
      activeContainerTypes.forEach(activeType => {
        let rate = 0;
        if (activeType === 'dc_20') {
          rate = item.dc20 || 0;
        } else if (activeType === 'hc_40') {
          rate = item.hc40 || 0;
        }

        if (rate > 0) {
          const rateWithConversion = applyConversionUp(rate, conversionPercent);
          allResults.push({
            transportType: 'sea',
            transportName: 'Море',
            containerType: activeType,
            rate: rateWithConversion,
            currency: '$',
            data: {
              ...item,
              rateWithConversion,
              conversionPercent
            }
          });
        }
      });
    });
  }

  if (db.sea && db.sea.length > 0 && db.rail && db.rail.length > 0) {
    const seaRates = db.sea.filter(item =>
      (!normalizedDeparture || (item.pol && normalizeCityName(item.pol) === normalizedDeparture)) &&
      ((item.soc20 || 0) > 0 || (item.soc40 || 0) > 0 || (item.dc20 || 0) > 0 || (item.hc40 || 0) > 0)
    );

    seaRates.forEach(seaItem => {
      const seaThroughService = isThroughServiceSea(seaItem.service);
      const railRates = db.rail.filter(railItem => {
        const destinationMatch = !normalizedDestination
          ? true
          : railItem.destination && normalizeCityName(railItem.destination) === normalizedDestination;
        const baseRules =
          railItem.city &&
          seaItem.city &&
          normalizeCityName(railItem.city) === normalizeCityName(seaItem.city) &&
          railItem.destination &&
          seaItem.dropOffArea &&
          normalizeCityName(railItem.destination) === normalizeCityName(seaItem.dropOffArea) &&
          destinationMatch &&
          ((railItem.container20Under24 || 0) > 0 ||
            (railItem.container20Over24 || 0) > 0 ||
            (railItem.container40 || 0) > 0);

        if (!baseRules) return false;

        const railThroughService = isThroughServiceRail(railItem.service);
        const hasThroughFlag = seaThroughService || railThroughService;

        if (hasThroughFlag) {
          if (!(seaThroughService && railThroughService)) {
            return false;
          }
          const seaAgent = normalizeAgentName(seaItem.agent);
          const railAgent = normalizeAgentName(railItem.agent);
          if (!seaAgent || !railAgent || seaAgent !== railAgent) {
            return false;
          }
        }

        if (isVttTrigger && !hasThroughFlag) {
          const matchesVtt =
            seaItem.pod &&
            railItem.agent &&
            normalizeCityName(seaItem.pod) === normalizeCityName(railItem.agent) &&
            railItem.тыловойТерминал &&
            railItem.тыловойТерминал.toString().toLowerCase().trim() === 'нет';
          if (!matchesVtt) return false;
        }

        return true;
      });

      railRates.forEach(railItem => {
        const railThroughService = isThroughServiceRail(railItem.service);

        activeContainerTypes.forEach(activeType => {
          let seaRate = 0;
          let railRate = 0;

          switch (activeType) {
            case 'dc_20':
              seaRate = seaItem.dc20 || 0;
              break;
            case 'hc_40':
              seaRate = seaItem.hc40 || 0;
              break;
            default:
              seaRate = 0;
          }

          switch (activeType) {
            case 'dc_20':
              railRate = is20ftOver24Tons ? railItem.container20Over24 || 0 : railItem.container20Under24 || 0;
              break;
            case 'hc_40':
              railRate = railItem.container40 || 0;
              break;
            default:
              railRate = 0;
          }

          if (seaRate > 0 && railRate > 0) {
            const terminal = railItem.agent || railItem.city || '';
            const vttRate = getVttRateForTerminal(db, terminal);
            const throughService = seaThroughService && railThroughService;
            const conversionPercent = parseConversionPercent(seaItem.conversion);
            const seaRateWithConversion = applyConversionUp(seaRate, conversionPercent);

            let totalRateForSorting = 0;
            let currencyForSorting: '$' | 'RUB' = '$';

            if (usdToRubRate) {
              totalRateForSorting = Math.ceil(seaRateWithConversion * usdToRubRate) + railRate;
              currencyForSorting = 'RUB';
            } else {
              totalRateForSorting = seaRateWithConversion;
              currencyForSorting = '$';
            }

            if (isVttTrigger && vttRate > 0) {
              totalRateForSorting += vttRate;
            }

            allResults.push({
              transportType: 'sea_rail',
              transportName: throughService ? 'Сквозной сервис' : 'Море + ЖД',
              containerType: activeType,
              rate: totalRateForSorting,
              currency: currencyForSorting,
              data: {
                sea: seaItem,
                rail: railItem,
                seaRate,
                seaRateWithConversion,
                railRate,
                connection: `Море: ${normalizeCityName(seaItem.pol)} → ${normalizeCityName(seaItem.pod)} (${normalizeCityName(seaItem.city)}) → ЖД: ${normalizeCityName(railItem.city)} → ${normalizeCityName(railItem.destination)}`,
                vttIncluded: isVttTrigger && vttRate > 0,
                vttRate,
                throughService,
                conversionPercent
              }
            });
          }
        });
      });
    });
  }

  allResults.sort((a, b) => {
    const rateA = a.rate || 0;
    const rateB = b.rate || 0;
    return rateA - rateB;
  });

  return allResults;
}

export function getDisplayAgent(result: ComplexResult) {
  const data = result?.data || {};
  return (data.sea?.agent || data.agent || data.rail?.agent || '').toString().trim();
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : value ? String(value) : '';
}

export function buildComplexRow(result: ComplexResult, fallbackFrom: string, fallbackTo: string, usdToRubRate: number | null): ComplexRow {
  const data = result?.data || {};
  const typeLabel = result.transportName || result.transportType || '—';
  const containerLabel = result.containerType ? getComplexContainerLabel(result.containerType) : undefined;

  const carrier = safeString(data.sea?.carrier || data.carrier || data.line || data.shippingLine || '—');
  const agent = safeString(data.sea?.agent || data.agent || data.rail?.agent || '—');
  const etd = safeString(data.sea?.etd || data.etd || '—');
  const dateOfValidity = safeString(data.sea?.dateOfValidity || data.dateOfValidity || '—');

  const borderCrossing = safeString(data.borderCrossing || data.rail?.borderCrossing || data.sea?.borderCrossing || '—');
  const departureLabel = safeString(fallbackFrom || data.sea?.pol || data.pol || data.fob || data.rail?.city || data.city || '—');
  let pod = '—';
  if (result.transportType === 'direct_sea' || result.transportType === 'sea') {
    pod = safeString(data.pod || '—');
  }
  if (result.transportType === 'sea_rail') {
    pod = safeString(data.sea?.pod || '—');
  }
  let departureStation = safeString(
    data.rail?.departureStation || data.departureStation || data.rail?.city || data.city || '—'
  );
  if (result.transportType === 'rail' || result.transportType === 'sea_rail') {
    departureStation = safeString(
      data.rail?.agent || data.agent || data.rail?.departureStation || data.departureStation || data.rail?.city || data.city || '—'
    );
  }
  if (result.transportType === 'direct_rail') {
    departureStation = safeString(data.rail?.departureStation || data.departureStation || data.rail?.city || data.city || '—');
  }
  if (result.transportType === 'sea_rail' && data.throughService) {
    const seaPod = safeString(data.sea?.pod || '');
    if (seaPod) {
      departureStation = seaPod;
    }
  }

  let seaRate = '—';
  let railRate = '—';
  let totalRate = '—';
  let numericTotal: number | null = null;
  const additionalInfo = '—';

  if (result.transportType === 'direct_rail') {
    seaRate = '—';
    railRate = `$${result.rate}`;
    numericTotal = usdToRubRate ? Math.ceil(result.rate * usdToRubRate) : Number(result.rate);
    totalRate = usdToRubRate ? `${numericTotal} ₽` : `$${result.rate}`;
  } else if (result.transportType === 'direct_sea') {
    seaRate = `$${result.rate}`;
    railRate = '—';
    numericTotal = usdToRubRate ? Math.ceil(result.rate * usdToRubRate) : Number(result.rate);
    totalRate = usdToRubRate ? `${numericTotal} ₽` : `$${result.rate}`;
  } else if (result.transportType === 'sea') {
    seaRate = `$${result.rate}`;
    railRate = '—';
    numericTotal = usdToRubRate ? Math.ceil(result.rate * usdToRubRate) : Number(result.rate);
    totalRate = usdToRubRate ? `${numericTotal} ₽` : `$${result.rate}`;
  } else if (result.transportType === 'rail') {
    seaRate = '—';
    railRate = `${result.rate} ₽`;
    numericTotal = Number(result.rate);
    totalRate = `${result.rate} ₽`;
  } else if (result.transportType === 'sea_rail') {
    const seaRateUSD = (data.seaRateWithConversion ?? data.seaRate) || 0;
    const railRateRUB = data.railRate || 0;
    seaRate = `$${seaRateUSD}`;
    railRate = `${railRateRUB} ₽`;
    numericTotal = Number(result.rate);
    totalRate = `${result.rate} ₽`;
  }

  return {
    typeLabel,
    containerLabel,
    seaRate,
    pod,
    departureLabel,
    agent,
    carrier,
    etd,
    dateOfValidity,
    railRate,
    departureStation,
    borderCrossing,
    totalRate,
    numericTotal,
    additionalInfo,
    conversionPercent: data.conversionPercent ?? null,
    from: fallbackFrom || data.from || data.origin || '—',
    to: fallbackTo || data.to || data.destination || data.arrivalCity || data.rail?.arrivalCity || '—',
    rate: result?.rate,
    currency: result?.currency,
    raw: result
  };
}

function normalizeValue(value: string) {
  return value.toLowerCase().trim();
}

export function getResultFilterValues(result: ComplexResult, filterType: 'line' | 'agent' | 'terminal') {
  const data = result?.data || {};
  if (filterType === 'line') {
    return [data.sea?.carrier, data.carrier, data.line, data.shippingLine].filter(Boolean).map(String);
  }
  if (filterType === 'agent') {
    return [data.sea?.agent, data.agent, data.rail?.agent].filter(Boolean).map(String);
  }
  if (result.transportType === 'direct_rail') {
    return [data.rail?.departureStation, data.departureStation].filter(Boolean).map(String);
  }
  return [data.rail?.agent, data.agent].filter(Boolean).map(String);
}

export function applyComplexUiFilters(
  results: ComplexResult[],
  params: {
    rateType: string;
    lineFilters: string[];
    agentFilters: string[];
    terminalFilters: string[];
  }
) {
  const { rateType, lineFilters, agentFilters, terminalFilters } = params;
  return results.filter(result => {
    if (rateType !== 'all') {
      if (rateType === 'through_service') {
        if (result.transportType !== 'sea_rail' || !result.data?.throughService) {
          return false;
        }
      } else if (rateType === 'sea_rail') {
        if (result.transportType !== 'sea_rail' || result.data?.throughService) {
          return false;
        }
      } else if (result.transportType !== (rateType as TransportType)) {
        return false;
      }
    }

    if (lineFilters.length) {
      const values = getResultFilterValues(result, 'line');
      const matches = lineFilters.some(value =>
        values.some(item => normalizeValue(item) === normalizeValue(value))
      );
      if (!matches) return false;
    }

    if (agentFilters.length) {
      const displayAgent = getDisplayAgent(result).toLowerCase();
      const matches = agentFilters.some(value => normalizeValue(value) === displayAgent);
      if (!matches) return false;
    }

    if (terminalFilters.length) {
      const values = getResultFilterValues(result, 'terminal');
      const matches = terminalFilters.some(value =>
        values.some(item => normalizeValue(item) === normalizeValue(value))
      );
      if (!matches) return false;
    }

    return true;
  });
}

export function uniqueSorted(values: Array<string | undefined | null>) {
  return [...new Set(values.filter(Boolean).map(value => String(value)))].sort((a, b) => a.localeCompare(b));
}

export function isMeaningfulTerminal(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return false;
  if (value === 0 || value === 1) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  if (/^(да|нет|true|false|yes|no|0|1)$/i.test(normalized)) return false;
  return true;
}

export function buildDepartureOptions(db: Database) {
  const allDepartures = new Set<string>();
  db.direct_rail.forEach(item => {
    if (item.fob && (item.fob40hc || 0) > 0) allDepartures.add(item.fob);
  });
  db.direct_sea.forEach(item => {
    if (item.pol && ((item.dc20 || 0) > 0 || (item.hc40 || 0) > 0)) allDepartures.add(item.pol);
  });
  db.sea.forEach(item => {
    if (item.pol && ((item.soc20 || 0) > 0 || (item.soc40 || 0) > 0 || (item.dc20 || 0) > 0 || (item.hc40 || 0) > 0)) {
      allDepartures.add(item.pol);
    }
  });
  const normalized = [...allDepartures].map(item => normalizeCityName(item));
  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
}

export function buildDestinationOptions(db: Database) {
  const allDestinations = new Set<string>();
  db.direct_rail.forEach(item => {
    if (item.arrivalCity) allDestinations.add(item.arrivalCity);
  });
  db.direct_sea.forEach(item => {
    if (item.pod) allDestinations.add(item.pod);
  });
  db.sea.forEach(item => {
    if (item.dropOffArea) allDestinations.add(item.dropOffArea);
  });
  db.rail.forEach(item => {
    if (item.destination) allDestinations.add(item.destination);
  });
  const normalized = [...allDestinations].map(item => normalizeCityName(item));
  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
}

export function buildLineOptions(db: Database) {
  return uniqueSorted([
    ...db.sea.map(item => item.carrier),
    ...db.direct_sea.map(item => item.carrier)
  ]);
}

export function buildAgentOptions(db: Database) {
  return uniqueSorted([
    ...db.sea.map(item => item.agent),
    ...db.direct_sea.map(item => item.agent),
    ...db.direct_rail.map(item => item.agent)
  ]);
}

export function buildTerminalOptions(db: Database) {
  return uniqueSorted([
    ...db.rail.map(item => item.agent),
    ...db.direct_rail.map(item => item.departureStation)
  ]).filter(isMeaningfulTerminal);
}
