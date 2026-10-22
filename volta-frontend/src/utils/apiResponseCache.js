// --- Cache pentru GET-uri de citire -------------------------------------------------------------
// Listele și paginile de citire se servesc din memorie: sub FRESH_MS fără nicio cerere, până la
// STALE_MS instant + reîmprospătare în fundal. Cererile identice în zbor se unesc într-una.
// Orice POST/PUT/PATCH/DELETE golește cache-ul, ca modificările proprii să apară imediat
// (în afară de scrierile de fundal marcate cu keepCache).
// Editoarele (builder, lecție, test), examenele, mesajele și contoarele nu intră aici.
const FRESH_MS = 30_000;
const STALE_MS = 5 * 60_000;
const CACHEABLE_GET = [
  /^\/admin\/(activity-logs|course-maps|courses|events|exams|media|question-banks|question-catalog\/maps|questions|settings|statistics\/course-test-detail|teams|tests|users|dashboard)$/,
  /^\/admin\/(course-maps|users)\/\d+$/,
  /^\/admin\/(tests|exams)\/\d+\/(statistics|results|question-analytics)$/,
  /^\/(courses|courses\/standalone|course-maps|course-maps\/\d+|courses\/\d+\/progress|lessons\/\d+|dashboard|student\/dashboard|student\/activity|achievements|events|events\/\d+|library\/items|library\/items\/\d+|guides\/items|profile|exam-results)$/,
];
const responseCache = new Map(); // key -> { at, raw }
const inFlightGets = new Map(); // key -> Promise<raw>
let cacheGeneration = 0;

/** Golește cache-ul GET (după modificări, la logout). */
export function clearApiCache() {
  responseCache.clear();
  inFlightGets.clear();
  cacheGeneration += 1;
}

function cacheKeyFor(config) {
  if ((config.method || "get").toLowerCase() !== "get" || config.cache === false) return null;
  if (config.responseType && config.responseType !== "json") return null;
  const path = String(config.url || "").split("?")[0];
  if (!CACHEABLE_GET.some((pattern) => pattern.test(path))) return null;
  return `${config.url}|${JSON.stringify(config.params || {})}`;
}

// Răspunsul brut (data = text) e păstrat; axios îl parsează din nou pentru fiecare apelant,
// deci componentele nu primesc niciodată același obiect.
function responseFromRaw(raw, config) {
  return { ...raw, config, request: null };
}

function fetchRaw(adapter, config, key) {
  const generation = cacheGeneration;
  const promise = adapter(config).then((response) => {
    const raw = { data: response.data, status: response.status, statusText: response.statusText, headers: response.headers };
    if (generation === cacheGeneration && response.status >= 200 && response.status < 300) {
      responseCache.set(key, { at: Date.now(), raw });
    }
    return raw;
  }).finally(() => {
    if (inFlightGets.get(key) === promise) inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise);
  return promise;
}

export function withResponseCache(adapter) {
  return (config) => {
    if ((config.method || "get").toLowerCase() !== "get") {
      // scrierile de fundal (timp pe lecție, telemetrie, autosave examen) trimit keepCache: true
      return config.keepCache ? adapter(config) : adapter(config).finally(clearApiCache);
    }
    const key = cacheKeyFor(config);
    if (!key) return adapter(config);

    const cached = responseCache.get(key);
    const age = cached ? Date.now() - cached.at : Infinity;
    if (cached && age < STALE_MS) {
      if (age >= FRESH_MS && !inFlightGets.has(key)) {
        fetchRaw(adapter, config, key).catch(() => {});
      }
      return Promise.resolve(responseFromRaw(cached.raw, config));
    }
    const pending = inFlightGets.get(key) || fetchRaw(adapter, config, key);
    return pending.then((raw) => responseFromRaw(raw, config));
  };
}
