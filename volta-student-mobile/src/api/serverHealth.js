import { getServerOrigin } from '../config';

/**
 * Verifică dacă răspunde Laravel (ruta /up din bootstrap).
 * Nu folosește apiFetch — fără token, timeout scurt.
 */
export async function pingLaravelServer(timeoutMs = 15000) {
  const origin = getServerOrigin();
  const url = `${origin.replace(/\/$/, '')}/up`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return { ok: res.ok, status: res.status, url };
  } catch (e) {
    const aborted = e?.name === 'AbortError';
    return {
      ok: false,
      url,
      aborted,
      message: aborted ? 'Timeout' : e?.message || 'Eroare rețea',
    };
  } finally {
    clearTimeout(t);
  }
}
