const KEYS = {
	student: 'va_notif_inbox_student',
	admin: 'va_notif_inbox_admin',
};
const LEGACY_STUDENT_DISMISSED = 'va_dismissed_student_notifications';

function parseState(raw) {
	try {
		const o = raw ? JSON.parse(raw) : {};
		const read = o.read && typeof o.read === 'object' ? o.read : {};
		const removed = Array.isArray(o.removedIds) ? o.removedIds.map(String) : [];
		return { read, removedIds: new Set(removed) };
	} catch {
		return { read: {}, removedIds: new Set() };
	}
}

function serializeState(state) {
	return JSON.stringify({
		read: state.read,
		removedIds: [...state.removedIds],
	});
}

function loadRaw(variant) {
	const key = KEYS[variant];
	const data = parseState(localStorage.getItem(key));
	return data;
}

function saveRaw(variant, state) {
	try {
		localStorage.setItem(KEYS[variant], serializeState(state));
	} catch {
		// ignore
	}
}

let legacyStudentMigrated = false;
function migrateLegacyStudentDismissed() {
	if (legacyStudentMigrated) return;
	legacyStudentMigrated = true;
	try {
		const old = localStorage.getItem(LEGACY_STUDENT_DISMISSED);
		if (!old) return;
		const arr = JSON.parse(old);
		if (!Array.isArray(arr)) return;
		const state = loadRaw('student');
		arr.forEach((id) => state.removedIds.add(String(id)));
		saveRaw('student', state);
		localStorage.removeItem(LEGACY_STUDENT_DISMISSED);
	} catch {
		// ignore
	}
}

export function snapshotForStorage(notif, variant) {
	const id = String(notif.id);
	const readAt = new Date().toISOString();
	if (variant === 'admin') {
		return {
			id,
			readAt,
			title: notif.title || '',
			subtitle: notif.description || notif.message || '',
			link:
				typeof notif.action_url === 'string' && notif.action_url.startsWith('/')
					? notif.action_url
					: null,
			type: notif.type || '',
			severity: notif.severity || 'info',
			created_at: notif.created_at || null,
		};
	}
	return {
		id,
		readAt,
		title: notif.title || '',
		subtitle: notif.message || '',
		link: notif.link && String(notif.link).startsWith('/') ? notif.link : null,
		type: notif.type || '',
		severity: notif.severity || 'info',
		created_at: notif.created_at || null,
	};
}

export function markNotificationRead(variant, notif) {
	if (variant === 'student') migrateLegacyStudentDismissed();
	const state = loadRaw(variant);
	const id = String(notif.id);
	const snap = snapshotForStorage(notif, variant);
	state.read[id] = snap;
	saveRaw(variant, state);
}

export function removeNotificationFromHistoric(variant, id) {
	if (variant === 'student') migrateLegacyStudentDismissed();
	const state = loadRaw(variant);
	const sid = String(id);
	delete state.read[sid];
	state.removedIds.add(sid);
	saveRaw(variant, state);
}

export function getPrimiteFromApi(apiList, variant) {
	if (variant === 'student') migrateLegacyStudentDismissed();
	const state = loadRaw(variant);
	const list = Array.isArray(apiList) ? apiList : [];
	return list.filter((n) => {
		const id = String(n.id);
		return !state.read[id] && !state.removedIds.has(id);
	});
}

export function getIstoricList(variant) {
	if (variant === 'student') migrateLegacyStudentDismissed();
	const state = loadRaw(variant);
	return Object.values(state.read)
		.filter((entry) => entry && entry.id)
		.sort((a, b) => new Date(b.readAt || 0) - new Date(a.readAt || 0));
}

export function countPrimite(apiList, variant) {
	return getPrimiteFromApi(apiList, variant).length;
}
