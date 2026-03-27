import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const PROD_API_URL = 'https://academy.volta.md/api';

/** Extrage hostname din `hostUri` / debuggerHost (ex. 192.168.1.10:8081) */
function parsePackagerHost(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname || null;
    } catch {
      return null;
    }
  }
  return trimmed.split(':')[0] || null;
}

function isTunnelHost(host) {
  if (!host) return true;
  return host.includes('exp.direct') || host.endsWith('.exp.host');
}

/**
 * Colectează toate string-urile care pot conține host:port Metro (ordinea contează).
 */
function collectPackagerHostCandidates() {
  const out = [];

  try {
    const dl = NativeModules.EXDevLauncher;
    if (dl?.manifestString) {
      const m = JSON.parse(dl.manifestString);
      if (m?.hostUri) out.push(m.hostUri);
      if (m?.extra?.expoClient?.hostUri) out.push(m.extra.expoClient.hostUri);
      if (m?.extra?.expoGo?.debuggerHost) out.push(m.extra.expoGo.debuggerHost);
    }
  } catch {
    // manifest invalid / modul lipsă
  }

  const m2 = Constants.manifest2;
  if (m2?.extra?.expoClient?.hostUri) out.push(m2.extra.expoClient.hostUri);
  if (m2?.extra?.expoGo?.debuggerHost) out.push(m2.extra.expoGo.debuggerHost);

  const ex = Constants.expoConfig?.hostUri;
  if (ex) out.push(ex);
  const eg = Constants.expoGoConfig?.debuggerHost;
  if (eg) out.push(eg);

  const leg = Constants.manifest;
  if (leg && typeof leg === 'object') {
    if (leg.hostUri) out.push(leg.hostUri);
    if (leg.debuggerHost) out.push(leg.debuggerHost);
  }

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (typeof scriptURL === 'string' && scriptURL.startsWith('http')) {
    try {
      const u = new URL(scriptURL);
      if (u.hostname) out.push(u.port ? `${u.hostname}:${u.port}` : u.hostname);
    } catch {
      // ignore
    }
  }

  return out;
}

function firstReachablePackagerHost() {
  for (const raw of collectPackagerHostCandidates()) {
    const host = parsePackagerHost(raw);
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !isTunnelHost(host)) {
      return host;
    }
  }
  return null;
}

/**
 * Backend local: același PC ca Metro (`expo start`).
 * Tunnel Expo (*.exp.direct) nu pointează la PC — folosește EXPO_PUBLIC_API_URL cu IP LAN.
 * Telefon fizic: NU folosi 10.0.2.2 (e doar pentru emulator); setează EXPO_PUBLIC_API_URL=http://IP_PC:8000/api
 */
function computeDevApiUrl() {
  const host = firstReachablePackagerHost();
  if (host) {
    return `http://${host}:8000/api`;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }
  return 'http://127.0.0.1:8000/api';
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? computeDevApiUrl() : PROD_API_URL);

/** True când URL-ul e cel implicit emulator Android (nu merge pe telefon fizic). */
export function isAndroidEmulatorLoopbackApiUrl() {
  return Platform.OS === 'android' && String(API_URL).includes('10.0.2.2');
}

/** Origine Laravel (fără /api) — health `/up`, imagini */
export function getServerOrigin() {
  return String(API_URL || '').replace(/\/api\/?$/i, '');
}

const parsedTimeout = parseInt(String(process.env.EXPO_PUBLIC_API_TIMEOUT_MS || ''), 10);
export const API_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 45000;

export const STORAGE_ORIGIN =
  process.env.EXPO_PUBLIC_STORAGE_ORIGIN ||
  getServerOrigin();
