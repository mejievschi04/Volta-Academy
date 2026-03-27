import { API_TIMEOUT_MS, API_URL } from '../config';
import { getApiToken } from '../auth/tokenStorage';

function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return `${b}/${p}`;
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = API_TIMEOUT_MS, ...fetchOptions } = options;
  const url = joinUrl(API_URL, path);
  const token = await getApiToken();
  const headers = {
    Accept: 'application/json',
    'X-Volta-Client': 'mobile',
    ...(fetchOptions.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  let res;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      e?.name === 'AbortError' ||
      (typeof e?.message === 'string' && e.message.toLowerCase().includes('abort'));
    const emulatorHint =
      API_URL.includes('10.0.2.2') && __DEV__
        ? ' Pe telefon fizic, 10.0.2.2 nu merge: setează EXPO_PUBLIC_API_URL=http://IP_PC:8000/api (ipconfig, același Wi‑Fi).'
        : '';
    const fwHint =
      __DEV__ && !emulatorHint
        ? ' Verifică firewall Windows (port 8000) și că telefonul e pe aceeași rețea ca PC-ul.'
        : '';
    if (aborted) {
      const err = new Error(
        `Serverul nu răspunde la timp (${Math.round(timeoutMs / 1000)}s). URL API: ${API_URL}.${emulatorHint}${fwHint}`
      );
      err.code = 'TIMEOUT';
      throw err;
    }
    const msg = typeof e?.message === 'string' ? e.message : '';
    if (msg.includes('Network request failed') || msg.includes('Failed to connect')) {
      const err = new Error(
        `Nu există conexiune la server. URL API: ${API_URL}. Pornește backend-ul (php artisan serve) și verifică firewall-ul.`
      );
      err.code = 'NETWORK';
      throw err;
    }
    throw e;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    let message =
      (body && typeof body === 'object' && (body.message || body.error)) ||
      `Request failed (${res.status})`;
    if (res.status === 422 && body && typeof body === 'object' && body.errors) {
      const lines = [];
      for (const v of Object.values(body.errors)) {
        if (Array.isArray(v)) lines.push(...v);
        else if (typeof v === 'string') lines.push(v);
      }
      if (lines.length) message = lines.join(' ');
    }
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}
