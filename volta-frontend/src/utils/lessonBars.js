const EDGE_PX = 48;
const DELTA_PX = 6;

/** Decide dacă barele lecției stau ascunse: dispar la citit în jos, revin la urcare, sus și la final. */
export function nextLessonBarsHidden(hidden, { top, previousTop, remaining }) {
	if (top < EDGE_PX || remaining < EDGE_PX) return false;
	const delta = top - previousTop;
	if (delta > DELTA_PX) return true;
	if (delta < -DELTA_PX) return false;
	return hidden;
}

export const LESSON_BARS_DELTA_PX = DELTA_PX;
