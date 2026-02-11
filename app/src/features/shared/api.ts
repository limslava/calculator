import type { Database } from '../complex/types';

export async function makeAuthRequest(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers ? (options.headers as Record<string, string>) : {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? 'include'
  });
}

export async function loadDbType(type: keyof Database, onUnauthorized?: () => void): Promise<any[]> {
  try {
    const response = await makeAuthRequest(`/api/data/${type}`);
    if (response.status === 401) {
      onUnauthorized?.();
      throw new Error('unauthorized');
    }
    if (response.ok) {
      const data = await response.json();
      const payload = data?.data || [];
      localStorage.setItem(`logistics_db_${type}`, JSON.stringify(payload));
      return payload;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      throw error;
    }
    console.warn(`Ошибка загрузки ${type} из API`, error);
  }

  const saved = localStorage.getItem(`logistics_db_${type}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn(`Ошибка чтения localStorage для ${type}`, error);
    }
  }
  return [];
}

export async function loadExchangeRate(): Promise<number | null> {
  try {
    const response = await fetch('/api/exchange-rate');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.success) {
      const rate = Number(data.rate);
      if (!Number.isNaN(rate)) {
        localStorage.setItem('usd_to_rub_rate', String(rate));
        localStorage.setItem('usd_to_rub_rate_date', new Date().toISOString());
        return rate;
      }
    }
  } catch (error) {
    console.warn('Ошибка загрузки курса ЦБ РФ', error);
  }

  const saved = localStorage.getItem('usd_to_rub_rate');
  if (saved) {
    const parsed = Number(saved);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}
