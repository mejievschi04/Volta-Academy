import React, { useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { LESSON_CALLOUT_TYPES } from './lessonCallout.js';

const CALLOUT_COLORS = [
	'#ffee00', '#111111', '#ffffff', '#dc2626', '#16a34a', '#2563eb', '#7c3aed', '#db2777',
];

export default function LessonCalloutPanel({
	type,
	accent,
	x,
	y,
	placeBelow,
	onType,
	onAccent,
	onClose,
}) {
	useEffect(() => {
		const onKey = (event) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	return createPortal(
		<div
			className={`lesson-callout-panel${placeBelow ? ' is-below' : ''}`}
			style={{ left: x, top: y }}
			role="dialog"
			aria-label="Chenar"
			onMouseDown={(event) => event.preventDefault()}
		>
			<div className="lesson-callout-panel-head">
				<span>Chenar</span>
				<button type="button" className="lesson-callout-close va-close-btn" aria-label="Închide" onClick={onClose}>
					<X size={18} weight="bold" aria-hidden="true" />
				</button>
			</div>
			<div className="lesson-callout-types">
				{LESSON_CALLOUT_TYPES.map((item) => (
					<button
						key={item.id}
						type="button"
						className={`lesson-callout-type${type === item.id ? ' is-selected' : ''}`}
						onClick={() => onType(item.id)}
					>
						{item.label}
					</button>
				))}
			</div>
			<div className="lesson-callout-colors">
				{CALLOUT_COLORS.map((color) => (
					<button
						key={color}
						type="button"
						className={`lesson-callout-swatch${accent === color ? ' is-selected' : ''}`}
						style={{ background: color }}
						aria-label={`Culoare ${color}`}
						onClick={() => onAccent(color)}
					/>
				))}
			</div>
			<blockquote
				className="lesson-callout-preview"
				data-callout-box="true"
				data-callout-type={type}
				style={{ '--rte-callout-accent': accent }}
			>
				<div className="rte-callout-content">
					<p>Așa arată chenarul.</p>
				</div>
			</blockquote>
		</div>,
		document.body,
	);
}
