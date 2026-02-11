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
