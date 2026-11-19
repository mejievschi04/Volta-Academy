/**
 * Unde duce „Înapoi” de pe pagina cursului.
 *
 * Nu folosim istoricul browserului: după curs → test → „Înapoi la curs”, pasul anterior
 * din istoric e testul, iar „Înapoi” ar trimite cursantul în buclă între curs și test.
 * Paginile care deschid cursul trimit `state.backTo`; îl ținem minte pe curs, ca să
 * rămână valabil și după ce cursantul revine din test sau din lecții.
 */
const storageKey = (courseId) => `va:course-back:${courseId}`;

const isInternalPath = (value) =>
	typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');

export function resolveCourseBackTarget(courseId, locationState, fallback = '/courses') {
	const fromState = locationState?.backTo;
	if (isInternalPath(fromState)) {
		try {
			sessionStorage.setItem(storageKey(courseId), fromState);
		} catch {
			/* stocare indisponibilă: folosim doar valoarea primită */
		}
		return fromState;
	}
	try {
		const stored = sessionStorage.getItem(storageKey(courseId));
		if (isInternalPath(stored)) return stored;
	} catch {
		/* stocare indisponibilă */
	}
	return fallback;
}
