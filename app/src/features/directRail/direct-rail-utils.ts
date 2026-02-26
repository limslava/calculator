import type { DirectRailRate } from '../complex/types';
import { normalizeName } from '../sea/sea-utils';

export { normalizeName };

export type DirectRailContainerType = 'fob40hc' | 'exwFca40hc';

function parseAddonValues(text: string) {
  const normalized = text.replace(/\s+/g, ' ');
  const fcaMatch = normalized.match(/fca[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i);
  const exwMatch = normalized.match(/exw[^0-9]*([0-9]+(?:[.,][0-9]+)?)/i);
  const numberMatch = normalized.match(/([0-9]+(?:[.,][0-9]+)?)/);
  const fca = fcaMatch ? parseFloat(fcaMatch[1].replace(',', '.')) : null;
  const exw = exwMatch ? parseFloat(exwMatch[1].replace(',', '.')) : null;
  const fallback = numberMatch ? parseFloat(numberMatch[1].replace(',', '.')) : null;
  return { fca, exw, fallback };
}

export function getDirectRailAddonInfo(item: DirectRailRate) {
  const base = Number(item.fob40hc) || 0;
  const raw = item.exwFca40hc;
  if (typeof raw === 'number') {
    return { base, direct: raw };
  }
  if (typeof raw === 'string') {
    const { fca, exw, fallback } = parseAddonValues(raw);
    return {
      base,
      fca: fca ?? undefined,
      exw: exw ?? undefined,
      direct: fca === null && exw === null ? fallback ?? undefined : undefined
    };
  }
  return { base };
}

export function getDirectRailRate(item: DirectRailRate, containerType: DirectRailContainerType = 'fob40hc') {
  if (containerType === 'exwFca40hc') {
    const info = getDirectRailAddonInfo(item);
    if (typeof info.direct === 'number') {
      return info.direct || 0;
    }
    if (typeof info.fca === 'number') {
      return info.base > 0 ? info.base + info.fca : info.fca;
    }
    if (typeof info.exw === 'number') {
      return info.base > 0 ? info.base + info.exw : info.exw;
    }
    return 0;
  }
  return Number(item.fob40hc) || 0;
}

export function getConversionPercent(value?: string | number | null) {
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

export function getDirectRailRateWithConversion(
  item: DirectRailRate,
  containerType: DirectRailContainerType = 'fob40hc'
) {
  const base = getDirectRailRate(item, containerType);
  if (!base || base <= 0) return 0;
  const percent = getConversionPercent(item.conversion);
  if (!percent || percent <= 0) return base;
  return Math.ceil(base + (base * percent) / 100);
}

export function getDirectRailContainerLabel(containerType: DirectRailContainerType = 'fob40hc') {
  return containerType === 'exwFca40hc' ? "EXW/FCA 40'HC" : "FOB 40'HC";
}
