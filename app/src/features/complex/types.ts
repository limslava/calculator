export type SeaRate = {
  pol?: string;
  pod?: string;
  city?: string;
  transitPort?: string;
  dropOffArea?: string;
  carrier?: string;
  agent?: string;
  dc20?: number;
  hc40?: number;
  soc20?: number;
  soc40?: number;
  conversion?: string;
  etd?: string;
  dateOfValidity?: string;
  borderCrossing?: string;
  remarks?: string;
  service?: string;
};

export type RailRate = {
  city?: string;
  destination?: string;
  agent?: string;
  service?: string;
  conditions?: string;
  validity?: string;
  autovivoz?: string | number;
  prr?: string | number;
  nds?: number;
  vochr20?: number;
  vochr40?: number;
  fitting?: number | string;
  container20Under24?: number;
  container20Over24?: number;
  container40?: number;
  departureStation?: string;
  borderCrossing?: string;
  etd?: string;
  dateOfValidity?: string;
  'тыловойТерминал'?: string | number | boolean;
  additionalInfo?: string;
};

export type DirectRailRate = {
  fob?: string;
  arrivalCity?: string;
  fob40hc?: number;
  exwFca40hc?: number | string;
  agent?: string;
  departureStation?: string;
  arrivalStation?: string;
  city?: string;
  destination?: string;
  borderCrossing?: string;
  etd?: string;
  quoteDate?: string;
  conversion?: string;
  remarks?: string;
  dateOfValidity?: string;
};

export type DirectSeaRate = {
  pol?: string;
  pod?: string;
  dc20?: number;
  hc40?: number;
  carrier?: string;
  agent?: string;
  ts?: string;
  conversion?: string;
  conversionNotIncluded?: string;
  etd?: string;
  dateOfValidity?: string;
  remarks?: string;
  borderCrossing?: string;
};

export type StorageRange = {
  from: number;
  to: number;
  rate20: number;
  rate40: number;
};

export type TariffRate = {
  terminal?: string;
  vtt?: number;
  prr20?: number;
  prr40?: number;
  auto20?: number;
  auto40?: number;
  weighing20?: number;
  weighing40?: number;
  midk20?: number;
  midk40?: number;
  railDeparture?: boolean;
  railPrr20?: number;
  railPrr40?: number;
  railWeighing20?: number;
  railWeighing40?: number;
  railMidk20?: number;
  railMidk40?: number;
  storageRanges?: StorageRange[];
  storage?: Array<{
    from_days: number;
    to_days: number;
    rate20: number;
    rate40: number;
  }>;
  timestamp?: string;
};

export type AgentTariffRate = {
  carrier?: string;
  pod?: string;
  dropOffArea?: string;
  snp?: string | number;
  key?: string;
};

export type Database = {
  sea: SeaRate[];
  rail: RailRate[];
  direct_rail: DirectRailRate[];
  direct_sea: DirectSeaRate[];
  tariff: TariffRate[];
  agent_tariff: AgentTariffRate[];
};

export type TransportType = 'direct_rail' | 'direct_sea' | 'sea' | 'rail' | 'sea_rail';

export type ComplexResult = {
  transportType: TransportType;
  transportName: string;
  containerType?: string;
  rate: number;
  currency: '$' | 'RUB';
  data: any;
};

export type ComplexRow = {
  typeLabel: string;
  containerLabel?: string;
  serviceNote?: string;
  seaRate: string;
  agent: string;
  carrier: string;
  etd: string;
  dateOfValidity: string;
  railRate: string;
  departureStation: string;
  borderCrossing: string;
  totalRate: string;
  numericTotal: number | null;
  additionalInfo: string;
  from: string;
  to: string;
  rate: number | undefined;
  currency: string | undefined;
  raw: ComplexResult;
};
