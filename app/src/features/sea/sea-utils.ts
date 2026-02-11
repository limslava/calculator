import type { SeaRate } from '../complex/types';

export function normalizeName(name?: string | null) {
  if (!name) return '';
  return name
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

export function hasContainerRate(item: SeaRate, containerType: string) {
  switch (containerType) {
    case 'soc_20':
      return item.soc20 && Number(item.soc20) > 0;
    case 'soc_40':
      return item.soc40 && Number(item.soc40) > 0;
    case 'dc_20':
      return item.dc20 && Number(item.dc20) > 0;
    case 'hc_40':
      return item.hc40 && Number(item.hc40) > 0;
    default:
      return false;
  }
}

export function getSeaRateByContainerType(item: SeaRate, containerType: string) {
  switch (containerType) {
    case 'soc_20':
      return Number(item.soc20) || 0;
    case 'soc_40':
      return Number(item.soc40) || 0;
    case 'dc_20':
      return Number(item.dc20) || 0;
    case 'hc_40':
      return Number(item.hc40) || 0;
    default:
      return 0;
  }
}

export function getSeaContainerLabel(containerType: string) {
  switch (containerType) {
    case 'soc_20':
      return "SOC 20'";
    case 'soc_40':
      return "SOC 40'";
    case 'dc_20':
      return "20'DC FILO";
    case 'hc_40':
      return "40'HC FILO";
    default:
      return containerType;
  }
}

export function getPOLWithRates(data: SeaRate[]) {
  return [...new Set(
    data
      .filter(item =>
        (item.soc20 && Number(item.soc20) > 0) ||
        (item.soc40 && Number(item.soc40) > 0) ||
        (item.dc20 && Number(item.dc20) > 0) ||
        (item.hc40 && Number(item.hc40) > 0)
      )
      .map(item => item.pol)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

export function getCityWithRatesForPOL(data: SeaRate[], selectedPOL: string) {
  if (!selectedPOL) return [];
  const normalizedPOL = normalizeName(selectedPOL);

  return [...new Set(
    data
      .filter(item => {
        const itemPOL = normalizeName(item.pol);
        const matchesPOL = itemPOL.includes(normalizedPOL) || normalizedPOL.includes(itemPOL);
        return matchesPOL && (
          (item.soc20 && Number(item.soc20) > 0) ||
          (item.soc40 && Number(item.soc40) > 0) ||
          (item.dc20 && Number(item.dc20) > 0) ||
          (item.hc40 && Number(item.hc40) > 0)
        );
      })
      .map(item => item.city)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

export function getPODWithRatesForPOLAndCity(data: SeaRate[], selectedPOL: string, selectedCity?: string) {
  if (!selectedPOL) return [];
  const normalizedPOL = normalizeName(selectedPOL);
  const normalizedCity = selectedCity ? normalizeName(selectedCity) : null;

  return [...new Set(
    data
      .filter(item => {
        const itemPOL = normalizeName(item.pol);
        const matchesPOL = itemPOL.includes(normalizedPOL) || normalizedPOL.includes(itemPOL);
        const matchesCity = !normalizedCity || (item.city && normalizeName(item.city) === normalizedCity);
        return matchesPOL && matchesCity && (
          (item.soc20 && Number(item.soc20) > 0) ||
          (item.soc40 && Number(item.soc40) > 0) ||
          (item.dc20 && Number(item.dc20) > 0) ||
          (item.hc40 && Number(item.hc40) > 0)
        );
      })
      .map(item => item.pod)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

export function getDropOffAreasWithRates(
  data: SeaRate[],
  selectedPOL: string,
  selectedCity: string,
  selectedPOD: string
) {
  if (!selectedPOL || !selectedPOD) return [];
  const normalizedPOL = normalizeName(selectedPOL);
  const normalizedCity = selectedCity ? normalizeName(selectedCity) : null;
  const normalizedPOD = normalizeName(selectedPOD);

  return [...new Set(
    data
      .filter(item => {
        const itemPOL = normalizeName(item.pol);
        const itemPOD = normalizeName(item.pod);
        const matchesPOL = itemPOL.includes(normalizedPOL) || normalizedPOL.includes(itemPOL);
        const matchesPOD = itemPOD.includes(normalizedPOD) || normalizedPOD.includes(itemPOD);
        const matchesCity = !normalizedCity || (item.city && normalizeName(item.city) === normalizedCity);
        return matchesPOL && matchesPOD && matchesCity && (
          (item.soc20 && Number(item.soc20) > 0) ||
          (item.soc40 && Number(item.soc40) > 0) ||
          (item.dc20 && Number(item.dc20) > 0) ||
          (item.hc40 && Number(item.hc40) > 0)
        );
      })
      .map(item => item.dropOffArea)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

export function getAvailableContainersWithRates(
  data: SeaRate[],
  selectedPOL: string,
  selectedCity: string,
  selectedPOD: string,
  selectedDropOffArea: string
) {
  if (!selectedPOL || !selectedPOD || !selectedDropOffArea) return {};
  const normalizedPOL = normalizeName(selectedPOL);
  const normalizedCity = selectedCity ? normalizeName(selectedCity) : null;
  const normalizedPOD = normalizeName(selectedPOD);
  const normalizedDropOff = normalizeName(selectedDropOffArea);

  const matchingItems = data.filter(item =>
    normalizeName(item.pol) === normalizedPOL &&
    (!normalizedCity || (item.city && normalizeName(item.city) === normalizedCity)) &&
    (normalizeName(item.pod) === normalizedPOD ||
      normalizeName(item.pod).includes(normalizedPOD) ||
      normalizedPOD.includes(normalizeName(item.pod))) &&
    normalizeName(item.dropOffArea) === normalizedDropOff &&
    (
      (item.soc20 && Number(item.soc20) > 0) ||
      (item.soc40 && Number(item.soc40) > 0) ||
      (item.dc20 && Number(item.dc20) > 0) ||
      (item.hc40 && Number(item.hc40) > 0)
    )
  );

  return {
    soc_20: matchingItems.some(item => item.soc20 && Number(item.soc20) > 0),
    soc_40: matchingItems.some(item => item.soc40 && Number(item.soc40) > 0),
    dc_20: matchingItems.some(item => item.dc20 && Number(item.dc20) > 0),
    hc_40: matchingItems.some(item => item.hc40 && Number(item.hc40) > 0)
  };
}

export function getRatesForRoute(
  data: SeaRate[],
  selectedPOL: string,
  selectedCity: string,
  selectedPOD: string,
  selectedDropOffArea: string,
  containerType: string
) {
  if (!selectedPOL || !selectedPOD || !selectedDropOffArea || !containerType) return [];

  const normalizedPOL = normalizeName(selectedPOL);
  const normalizedCity = selectedCity ? normalizeName(selectedCity) : null;
  const normalizedPOD = normalizeName(selectedPOD);
  const normalizedDropOff = normalizeName(selectedDropOffArea);

  return data.filter(item => {
    const matchesPOL = normalizeName(item.pol) === normalizedPOL;
    const matchesCity = !normalizedCity || (item.city && normalizeName(item.city) === normalizedCity);
    const matchesPOD =
      normalizeName(item.pod) === normalizedPOD ||
      normalizeName(item.pod).includes(normalizedPOD) ||
      normalizedPOD.includes(normalizeName(item.pod));
    const matchesDropOff = normalizeName(item.dropOffArea) === normalizedDropOff;
    const hasRate = hasContainerRate(item, containerType);

    return matchesPOL && matchesCity && matchesPOD && matchesDropOff && hasRate;
  });
}
