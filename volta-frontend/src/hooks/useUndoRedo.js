import { useState, useCallback } from 'react';

/** Undo/redo keeps history and the current position in one React state update. */
export const useUndoRedo = (initialState, maxHistory = 50) => {
	const [history, setHistory] = useState(() => ({ entries: [initialState], index: 0 }));
	const setState = useCallback((value) => {
		setHistory((previous) => {
			const next = typeof value === 'function' ? value(previous.entries[previous.index]) : value;
			const entries = [...previous.entries.slice(0, previous.index + 1), next]
				.slice(-Math.max(1, maxHistory));
			return { entries, index: entries.length - 1 };
		});
	}, [maxHistory]);
	const undo = useCallback(() => {
		setHistory((previous) => previous.index === 0 ? previous : { ...previous, index: previous.index - 1 });
	}, []);
	const redo = useCallback(() => {
		setHistory((previous) => previous.index === previous.entries.length - 1
			? previous : { ...previous, index: previous.index + 1 });
	}, []);
	const reset = useCallback((value) => {
		setHistory({ entries: [value === undefined ? initialState : value], index: 0 });
	}, [initialState]);
	return {
		state: history.entries[history.index], setState, undo, redo, reset,
		canUndo: history.index > 0,
		canRedo: history.index < history.entries.length - 1,
		historyLength: history.entries.length,
		currentIndex: history.index,
	};
};

export default useUndoRedo;
