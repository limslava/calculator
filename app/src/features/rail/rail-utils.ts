import type { RailRate } from '../complex/types';
import { normalizeName } from '../sea/sea-utils';

export { normalizeName };

export function getRailRateByContainerType(item: RailRate, containerType: string) {
  switch (containerType) {
    case 'container20Under24':
      return Number(item.container20Under24) || 0;
    case 'container20Over24':
      return Number(item.container20Over24) || 0;
    case 'container40':
      return Number(item.container40) || 0;
    default:
      return 0;
  }
}

export function getRailContainerLabel(containerType: string) {
  switch (containerType) {
    case 'container20Under24':
      return '20фут ктк (до 24 тонн)';
    case 'container20Over24':
      return '20фут ктк (24–28 тонн)';
    case 'container40':
      return '40фут ктк';
    default:
      return containerType;
  }
}
