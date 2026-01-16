import React from 'react';

/**
 * Undo/Redo Controls Component - Conform defacut.md secțiunea 11
 * "Undo everywhere" - Reusable controls for undo/redo functionality
 */
const UndoRedoControls = ({ onUndo, onRedo, canUndo, canRedo, className = '' }) => {
	return (
		<div className={`undo-redo-controls ${className}`}>
			<button
				type="button"
				className="undo-redo-btn"
				onClick={onUndo}
				disabled={!canUndo}
				title="Undo (Ctrl+Z)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<path d="M3 7v6h6" />
					<path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
				</svg>
				<span>Undo</span>
			</button>
			<button
				type="button"
				className="undo-redo-btn"
				onClick={onRedo}
				disabled={!canRedo}
				title="Redo (Ctrl+Shift+Z)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<path d="M21 7v6h-6" />
					<path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" />
				</svg>
				<span>Redo</span>
			</button>
		</div>
	);
};

export default UndoRedoControls;
