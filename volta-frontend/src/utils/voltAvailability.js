/** Volt AI — activat când backend-ul are un provider AI configurat. */
export let VOLT_ENABLED = false;

export function setVoltCapabilities(capabilities) {
	VOLT_ENABLED = capabilities?.volt === true;
}

export const VOLT_COMING_SOON_MESSAGE = 'Volt va fi disponibil în curând.';

export function isVoltEnabled() {
	return VOLT_ENABLED;
}

export function notifyVoltComingSoon(showToast) {
	if (typeof showToast === 'function') {
		showToast(VOLT_COMING_SOON_MESSAGE, 'info');
	}
}

export class VoltUnavailableError extends Error {
	constructor() {
		super(VOLT_COMING_SOON_MESSAGE);
		this.name = 'VoltUnavailableError';
	}
}

export function assertVoltEnabled() {
	if (!VOLT_ENABLED) {
		throw new VoltUnavailableError();
	}
}

/** Rulează acțiunea Volt sau afișează mesajul „în curând”. */
export function runVoltAction(showToast, action) {
	if (!isVoltEnabled()) {
		notifyVoltComingSoon(showToast);
		return undefined;
	}
	return action();
}
