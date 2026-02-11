import type { DirectRailRate, DirectSeaRate, RailRate, SeaRate } from '../complex/types';

function findColumnIndex(headers: any[], possibleNames: string[]) {
  for (const name of possibleNames) {
    const index = headers.findIndex(
      header => header && header.toString().toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}

function convertExcelDate(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && value > 0) {
    try {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      return date.toLocaleDateString('ru-RU');
    } catch {
      return value.toString();
    }
  }
  return String(value);
}

function normalizeAgentAndCarrier(value: unknown) {
  if (!value) return value;
  const normalizedValue = value.toString().trim();
  if (normalizedValue.toLowerCase().includes('sollers')) {
    return 'Pacific Logistic';
  }
  return normalizedValue;
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value || 0;
  if (typeof value === 'string') {
    let cleaned = value.toString().replace(/\s+/g, '').replace(',', '.');
    cleaned = cleaned.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function rowHasData(row: any[]) {
  return row && row.some(cell => cell !== null && cell !== undefined && cell !== '');
}

export function parseSeaData(excelData: any[][]): SeaRate[] {
  if (!excelData || excelData.length === 0) {
    throw new Error('Файл пустой');
  }
  const headers = excelData[0];
  const dataRows = excelData.slice(1);
  const parsed: SeaRate[] = [];

  const dc20FiloIndex = findColumnIndex(headers, ["20'DC FILO", "20DC FILO", "20'DCFILO", "20 DC FILO"]);
  const dc20Index = findColumnIndex(headers, ["20'DC", '20DC', '20 DC']);
  const hc40FiloIndex = findColumnIndex(headers, ["40'HC FILO", "40HC FILO", "40'HCFILO", "40 HC FILO"]);
  const hc40Index = findColumnIndex(headers, ["40'HC", '40HC', '40 HC']);

  const headerMap = {
    dateOfValidity: findColumnIndex(headers, ['Date of validity', 'Дата действия']),
    agent: findColumnIndex(headers, ['Agent', 'Агент']),
    carrier: findColumnIndex(headers, ['Carrier', 'Линия']),
    pol: findColumnIndex(headers, ['POL', 'Порт погрузки']),
    pod: findColumnIndex(headers, ['POD', 'Порт выгрузки']),
    city: findColumnIndex(headers, ['City', 'Город']),
    transitPort: findColumnIndex(headers, ['Transit port', 'Транзитный порт']),
    dropOffArea: findColumnIndex(headers, ['DROP OFF AREA VIA VVO', 'Зона выгрузки']),
    soc20: findColumnIndex(headers, ['SOC 20', "SOC 20'"]),
    soc40: findColumnIndex(headers, ['SOC 40', "SOC 40'"]),
    conversion: findColumnIndex(headers, ['Конвертация', 'Валюта']),
    etd: findColumnIndex(headers, ['ETD', 'Дата отгрузки']),
    remarks: findColumnIndex(headers, ['Remarks', 'Примечания']),
    service: findColumnIndex(headers, ['Сервис', 'Service'])
  };

  const criticalFields = ['pol', 'pod'];
  const missingCritical = criticalFields.filter(field => headerMap[field as keyof typeof headerMap] === -1);
  if (missingCritical.length > 0) {
    throw new Error(`Отсутствуют критические колонки: ${missingCritical.join(', ')}`);
  }

  dataRows.forEach(row => {
    if (!rowHasData(row)) return;
    const item: SeaRate = {};

    (Object.keys(headerMap) as Array<keyof typeof headerMap>).forEach(key => {
      const colIndex = headerMap[key];
      if (colIndex === -1) return;
      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === '') return;

      let value: any = rawValue;
      if (['soc20', 'soc40'].includes(key)) {
        value = parseNumber(value);
      }
      if (['dateOfValidity', 'etd'].includes(key)) {
        value = convertExcelDate(value);
      }
      if (['agent', 'carrier'].includes(key)) {
        value = normalizeAgentAndCarrier(value);
      }
      if (typeof value === 'string') {
        value = value.trim();
      }
      (item as any)[key] = value;
    });

    const dc20Raw =
      dc20FiloIndex !== -1 && row[dc20FiloIndex] !== undefined && row[dc20FiloIndex] !== null && row[dc20FiloIndex] !== ''
        ? row[dc20FiloIndex]
        : dc20Index !== -1
          ? row[dc20Index]
          : undefined;
    const hc40Raw =
      hc40FiloIndex !== -1 && row[hc40FiloIndex] !== undefined && row[hc40FiloIndex] !== null && row[hc40FiloIndex] !== ''
        ? row[hc40FiloIndex]
        : hc40Index !== -1
          ? row[hc40Index]
          : undefined;
    if (dc20Raw !== undefined && dc20Raw !== null && dc20Raw !== '') {
      item.dc20 = parseNumber(dc20Raw);
    }
    if (hc40Raw !== undefined && hc40Raw !== null && hc40Raw !== '') {
      item.hc40 = parseNumber(hc40Raw);
    }

    if (item.pol && item.pod) {
      parsed.push(item);
    }
  });

  if (parsed.length === 0) {
    throw new Error('Не найдено корректных данных для обработки. Проверьте наличие колонок POL и POD.');
  }

  return parsed;
}

export function parseDirectSeaData(excelData: any[][]): DirectSeaRate[] {
  if (!excelData || excelData.length === 0) {
    throw new Error('Файл пустой');
  }
  const headers = excelData[0];
  const dataRows = excelData.slice(1);
  const parsed: DirectSeaRate[] = [];

  const headerMap = {
    dateOfValidity: findColumnIndex(headers, ['Date of validity', 'Дата действия']),
    agent: findColumnIndex(headers, ['Agent', 'Агент']),
    carrier: findColumnIndex(headers, ['Carrier', 'Линия']),
    pol: findColumnIndex(headers, ['POL', 'Порт погрузки']),
    pod: findColumnIndex(headers, ['POD', 'Порт выгрузки']),
    dc20: findColumnIndex(headers, ["20'DC", '20DC']),
    hc40: findColumnIndex(headers, ["40'HC", '40HC']),
    ts: findColumnIndex(headers, ['T/S', 'TS', 'Transit port', 'Порт транзита', 'Транзит']),
    conversion: findColumnIndex(headers, ['Конвертация', 'Валюта']),
    conversionNotIncluded: findColumnIndex(headers, ['Конвертация не ВКЛ', 'Конвертация не вкл', 'Конвертация не включена']),
    etd: findColumnIndex(headers, ['ETD', 'Дата отгрузки']),
    remarks: findColumnIndex(headers, ['Remarks', 'Примечания', 'Remark'])
  };

  const criticalFields = ['pol', 'pod'];
  const missingCritical = criticalFields.filter(field => headerMap[field as keyof typeof headerMap] === -1);
  if (missingCritical.length > 0) {
    throw new Error(`Отсутствуют критические колонки: ${missingCritical.join(', ')}`);
  }

  dataRows.forEach(row => {
    if (!rowHasData(row)) return;
    const item: DirectSeaRate = {};

    (Object.keys(headerMap) as Array<keyof typeof headerMap>).forEach(key => {
      const colIndex = headerMap[key];
      if (colIndex === -1) return;
      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === '') return;

      let value: any = rawValue;
      if (['dc20', 'hc40'].includes(key)) {
        value = parseNumber(value);
      }
      if (['dateOfValidity', 'etd'].includes(key)) {
        value = convertExcelDate(value);
      }
      if (['agent', 'carrier'].includes(key)) {
        value = normalizeAgentAndCarrier(value);
      }
      if (typeof value === 'string') {
        value = value.trim();
      }
      (item as any)[key] = value;
    });

    if (item.pol && item.pod) {
      parsed.push(item);
    }
  });

  if (parsed.length === 0) {
    throw new Error('Не найдено корректных данных для обработки. Проверьте наличие колонок POL и POD.');
  }

  return parsed;
}

export function parseDirectRailData(excelData: any[][]): DirectRailRate[] {
  if (!excelData || excelData.length === 0) {
    throw new Error('Файл пустой');
  }
  const headers = excelData[0];
  const dataRows = excelData.slice(1);
  const parsed: DirectRailRate[] = [];

  const headerMap = {
    quoteDate: findColumnIndex(headers, ['дата котировки', 'Date of quote', 'Quote date']),
    agent: findColumnIndex(headers, ['Agent', 'Агент']),
    fob: findColumnIndex(headers, ['FOB']),
    departureStation: findColumnIndex(headers, ['станция отправления', 'Departure station', 'Station of departure']),
    borderCrossing: findColumnIndex(headers, ['погран переход', 'Border crossing', 'Border']),
    arrivalCity: findColumnIndex(headers, ['город прибытия', 'Arrival city', 'City of arrival']),
    arrivalStation: findColumnIndex(headers, ['станция прибытия', 'Arrival station', 'Station of arrival']),
    fob40hc: findColumnIndex(headers, ["FOB 40'HC", 'FOB 40HC', 'FOB 40']),
    exwFca40hc: findColumnIndex(headers, ["EXW/FCA 40'HC", 'EXW FCA 40HC', 'EXW/FCA 40']),
    etd: findColumnIndex(headers, ['ETD']),
    conversion: findColumnIndex(headers, ['Конвертация', 'Currency', 'Conversion']),
    remarks: findColumnIndex(headers, ['Remark', 'Remarks', 'Примечания'])
  };

  const requiredHeaders = ['станция отправления', 'станция прибытия'];
  const foundHeaders = requiredHeaders.filter(header =>
    headers.some(h => h && h.toString().toLowerCase().includes(header.toLowerCase()))
  );
  if (foundHeaders.length === 0) {
    throw new Error(`Отсутствуют обязательные заголовки: ${requiredHeaders.join(', ')}`);
  }

  dataRows.forEach(row => {
    if (!rowHasData(row)) return;
    const item: DirectRailRate = {};

    (Object.keys(headerMap) as Array<keyof typeof headerMap>).forEach(key => {
      const colIndex = headerMap[key];
      if (colIndex === -1) return;
      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === '') return;

      let value: any = rawValue;
      if (['fob40hc'].includes(key)) {
        value = parseNumber(value);
      }
      if (key === 'exwFca40hc') {
        if (typeof value === 'number') {
          value = value;
        } else if (typeof value === 'string') {
          const trimmed = value.trim();
          if (/^[\d\s.,]+$/.test(trimmed)) {
            value = parseNumber(trimmed);
          } else {
            value = trimmed;
          }
        }
      }
      if (['quoteDate', 'etd'].includes(key)) {
        value = convertExcelDate(value);
      }
      if (key === 'agent') {
        value = normalizeAgentAndCarrier(value);
      }
      if (typeof value === 'string') {
        value = value.trim();
      }
      (item as any)[key] = value;
    });

    if (item.fob || item.arrivalCity || item.departureStation || item.arrivalStation) {
      parsed.push(item);
    }
  });

  if (parsed.length === 0) {
    throw new Error('Не найдено корректных данных для обработки.');
  }

  return parsed;
}

export function parseRailData(excelData: any[][]): RailRate[] {
  if (!excelData || excelData.length === 0) {
    throw new Error('Файл пустой');
  }
  const headers = excelData[0];
  const dataRows = excelData.slice(1);
  const parsed: RailRate[] = [];

  const headerMap = {
    city: findColumnIndex(headers, ['City', 'Город']),
    agent: findColumnIndex(headers, ['Agent', 'Агент']),
    service: findColumnIndex(headers, ['Сервис', 'Service']),
    destination: findColumnIndex(headers, ['Пункт назначения', 'Destination']),
    autovivoz: findColumnIndex(headers, ['Автовывоз', 'Auto pickup', 'Autovivoz']),
    prr: findColumnIndex(headers, ['ПРР', 'PRR']),
    container20Under24: findColumnIndex(headers, ['20фут ктк ( до 24 тонн)', '20ft container under 24t']),
    container20Over24: findColumnIndex(headers, ['20фут ктк (от 24 тонн до 28 тонн)', '20ft container 24-28t']),
    container40: findColumnIndex(headers, ['40фут ктк', '40ft container']),
    nds: findColumnIndex(headers, ['НДС', 'VAT', 'NDS']),
    vochr20: findColumnIndex(headers, ['ВОХР 20', 'VOCHR 20']),
    vochr40: findColumnIndex(headers, ['ВОХР 40', 'VOCHR 40']),
    fitting: findColumnIndex(headers, ['Фитинг/ПВ', 'Fitting/PV']),
    conditions: findColumnIndex(headers, ['Условия', 'Conditions']),
    validity: findColumnIndex(headers, ['Валидность', 'Validity']),
    тыловойТерминал: findColumnIndex(headers, [
      'Тыловой Терминал',
      'Тыловой терминал',
      'Доп.информация',
      'Additional info',
      'Additional information'
    ])
  };

  const requiredHeaders = ['City', 'Пункт назначения'];
  const foundHeaders = requiredHeaders.filter(header =>
    headers.some(h => h && h.toString().toLowerCase().includes(header.toLowerCase()))
  );
  if (foundHeaders.length === 0) {
    throw new Error(`Отсутствуют обязательные заголовки: ${requiredHeaders.join(', ')}`);
  }

  dataRows.forEach(row => {
    if (!rowHasData(row)) return;
    const item: RailRate = {};

    (Object.keys(headerMap) as Array<keyof typeof headerMap>).forEach(key => {
      const colIndex = headerMap[key];
      if (colIndex === -1) return;
      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === '') return;

      let value: any = rawValue;
      if (['container20Under24', 'container20Over24', 'container40', 'nds', 'vochr20', 'vochr40'].includes(key)) {
        value = parseNumber(value);
      }
      if (key === 'validity') {
        value = convertExcelDate(value);
      }
      if (key === 'agent') {
        value = normalizeAgentAndCarrier(value);
      }
      if (key === 'тыловойТерминал') {
        (item as any).additionalInfo = value;
      }
      if (typeof value === 'string') {
        value = value.trim();
      }
      (item as any)[key] = value;
    });

    if (item.city && item.destination) {
      parsed.push(item);
    }
  });

  if (parsed.length === 0) {
    throw new Error('Не найдено корректных данных для обработки.');
  }

  return parsed;
}

export function parseAgentTariffData(excelData: any[][]) {
  if (!excelData || excelData.length === 0) {
    throw new Error('Файл пустой');
  }
  const headers = excelData[0];
  const dataRows = excelData.slice(1);
  const parsed: any[] = [];

  const headerMap = {
    carrier: findColumnIndex(headers, ['Carrier', 'Перевозчик']),
    pod: findColumnIndex(headers, ['POD', 'Порт выгрузки']),
    dropOffArea: findColumnIndex(headers, ['DROP OFF AREA VIA VVO', 'Зона выгрузки', 'Drop off area']),
    snp: findColumnIndex(headers, ['СНП', 'SNP', 'Сверхнормативное пользование'])
  };

  const requiredHeaders = ['Carrier', 'POD', 'СНП'];
  const missingHeaders = requiredHeaders.filter(
    header => !headers.some(h => h && h.toString().toLowerCase().includes(header.toLowerCase()))
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Отсутствуют обязательные колонки: ${missingHeaders.join(', ')}. Требуемые заголовки: Carrier, POD, СНП`
    );
  }

  dataRows.forEach(row => {
    if (!rowHasData(row)) return;
    const item: any = {};

    (Object.keys(headerMap) as Array<keyof typeof headerMap>).forEach(key => {
      const colIndex = headerMap[key];
      if (colIndex === -1) return;
      const rawValue = row[colIndex];
      if (rawValue === undefined || rawValue === null || rawValue === '') return;

      let value: any = rawValue;
      if (typeof value === 'string') {
        value = value.trim();
      }
      if (key === 'carrier') {
        value = normalizeAgentAndCarrier(value);
      }
      item[key] = value;
    });

    if (item.carrier && item.pod && item.snp) {
      item.key = `${item.carrier}_${item.pod}_${item.dropOffArea || ''}`.toLowerCase().replace(/\s+/g, '_');
      parsed.push(item);
    }
  });

  if (parsed.length === 0) {
    throw new Error('Не найдено корректных данных для обработки. Проверьте наличие колонок Carrier, POD и СНП.');
  }

  return parsed;
}
