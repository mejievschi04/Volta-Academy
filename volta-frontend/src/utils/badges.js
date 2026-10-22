import { useEffect, useSyncExternalStore } from 'react';
import api from '../api.js';

// Contoarele din bara de sus (notificări, mesaje, corectări) vin dintr-o singură cerere /badges,
// partajată de toate componentele: un singur polling per tab, oprit cât tab-ul e ascuns.
const POLL_MS = 30000;
const EMPTY = { notifications: 0, messages: 0, pending_reviews: 0 };

let state = EMPTY;
const listeners = new Set();
let subscribers = 0;
let intervalId = null;
let inFlight = null;
let failures = 0;
let cooldownUntil = 0;

function emit(next) {
	state = next;
	listeners.forEach((listener) => listener());
}

/** Reîncarcă imediat contoarele (ex. după ce o conversație a fost citită). */
export function refreshBadges() {
	if (inFlight || Date.now() < cooldownUntil) return inFlight;
	inFlight = api.get('/badges')
		.then((response) => {
			const data = response?.data || {};
			failures = 0;
			emit({
				notifications: Math.max(0, Number(data.notifications) || 0),
				messages: Math.max(0, Number(data.messages) || 0),
				pending_reviews: Math.max(0, Number(data.pending_reviews) || 0),
			});
		})
		.catch((err) => {
			const status = err?.response?.status;
			failures += 1;
			if (status === 429 || failures >= 3) {
				cooldownUntil = Date.now() + (status === 429 ? 120000 : 60000);
				failures = 0;
			}
		})
		.finally(() => {
			inFlight = null;
		});
	return inFlight;
}

/** Scade local un contor până la următorul răspuns de la server. */
export function decrementBadge(key) {
	emit({ ...state, [key]: Math.max(0, (state[key] || 0) - 1) });
}

function syncPolling() {
	if (intervalId) {
		window.clearInterval(intervalId);
		intervalId = null;
	}
	if (subscribers > 0 && !document.hidden) {
		refreshBadges();
		intervalId = window.setInterval(refreshBadges, POLL_MS);
	}
}

function subscribe(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * @param {boolean} enabled false pentru vizitatori neautentificați
 * @returns {{ notifications: number, messages: number, pending_reviews: number }}
 */
export function useBadges(enabled = true) {
	useEffect(() => {
		if (!enabled) return undefined;
		subscribers += 1;
		if (subscribers === 1) document.addEventListener('visibilitychange', syncPolling);
		syncPolling();
		return () => {
			subscribers -= 1;
			if (subscribers === 0) {
				document.removeEventListener('visibilitychange', syncPolling);
				emit(EMPTY);
			}
			syncPolling();
		};
	}, [enabled]);

	const snapshot = useSyncExternalStore(subscribe, () => state);
	return enabled ? snapshot : EMPTY;
}
