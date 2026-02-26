const normalizeServiceValue = (value?: string | null) => {
  if (!value) return '';
  return value.toString().trim().toLowerCase();
};

export function isSeaServiceIncluded(value?: string | null) {
  const normalized = normalizeServiceValue(value);
  if (!normalized) return false;
  if (normalized.includes('сквозной сервис')) return false;
  if (normalized.includes('только фрахт')) return true;
  if (normalized === 'нет') return true;
  return false;
}

export function isRailServiceIncluded(value?: string | null) {
  const normalized = normalizeServiceValue(value);
  if (!normalized) return true;
  if (normalized.includes('только жд')) return true;
  if (normalized === 'нет') return true;
  return false;
}

export function isThroughServiceSea(value?: string | null) {
  const normalized = normalizeServiceValue(value);
  if (!normalized) return false;
  if (normalized.includes('сквозной сервис')) return true;
  if (normalized === 'да') return true;
  return false;
}

export function isThroughServiceRail(value?: string | null) {
  const normalized = normalizeServiceValue(value);
  if (!normalized) return false;
  if (normalized.includes('сквозной сервис')) return true;
  if (normalized === 'да') return true;
  return false;
}

export function normalizeAgentName(value?: string | null) {
  if (!value) return '';
  return value.toString().trim().toLowerCase();
}
