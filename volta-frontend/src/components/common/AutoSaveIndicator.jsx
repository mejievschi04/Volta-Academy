import React from 'react';

const AutoSaveIndicator = ({ status, onRetry, liveHint = false }) => {
	const getStatusConfig = () => {
		switch (status) {
			case 'saving':
				return { text: 'Se salvează...', icon: '⏳', color: '#9FE22F' };
			case 'saved':
				return {
					text: liveHint ? 'Salvat · nepublicat' : 'Salvat',
					icon: '✓',
					color: '#09A86B',
				};
			case 'error':
				return { text: 'Modificările nu au fost salvate', icon: '⚠️', color: '#ef4444' };
			default:
				return { text: '', icon: '', color: '' };
		}
	};

	const config = getStatusConfig();

	if (!config.text) return null;

	return (
		<div
			className="admin-auto-save-indicator"
			style={{ color: config.color }}
			role={status === 'error' ? 'alert' : 'status'}
		>
			<span>{config.icon}</span>
			<span>{config.text}</span>
			{status === 'error' && typeof onRetry === 'function' ? (
				<button type="button" className="admin-auto-save-retry" onClick={onRetry}>
					Reîncearcă
				</button>
			) : null}
		</div>
	);
};

export default AutoSaveIndicator;
