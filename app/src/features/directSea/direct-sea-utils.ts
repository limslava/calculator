import type { DirectSeaRate } from '../complex/types';
import { normalizeName } from '../sea/sea-utils';

export { normalizeName };

export function getDirectSeaRateByContainerType(item: DirectSeaRate, containerType: string) {
  switch (containerType) {
    case 'dc_20':
      return Number(item.dc20) || 0;
    case 'hc_40':
      return Number(item.hc40) || 0;
    default:
      return 0;
  }
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

export function getDirectSeaRateWithConversion(item: DirectSeaRate, containerType: string) {
  const base = getDirectSeaRateByContainerType(item, containerType);
  if (!base || base <= 0) return 0;
  const conversionValue = item.conversionNotIncluded || item.conversion;
  const percent = parseConversionPercent(conversionValue);
  if (!percent || percent <= 0) return base;
  return Math.ceil(base + (base * percent) / 100);
}

export function hasDirectSeaRate(item: DirectSeaRate) {
  return Boolean(
    (item.dc20 && Number(item.dc20) > 0) ||
      (item.hc40 && Number(item.hc40) > 0)
  );
}

export function getDirectSeaContainerLabel(containerType: string) {
  switch (containerType) {
    case 'dc_20':
      return "20'DC";
    case 'hc_40':
      return "40'HC";
    default:
      return containerType;
  }
}
