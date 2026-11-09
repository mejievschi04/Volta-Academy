import React from 'react';
import './EmptyState.css';

/** Ecran fără conținut: același model peste tot (iconiță, titlu, text scurt, eventual o acțiune). */
export default function EmptyState({ icon, title, text, children, className = '' }) {
	return (
		<div className={['va-empty-state', className].filter(Boolean).join(' ')}>
			{icon ? <span className="va-empty-state-icon" aria-hidden>{icon}</span> : null}
			{title ? <h2 className="va-empty-state-title">{title}</h2> : null}
			{text ? <p className="va-empty-state-text">{text}</p> : null}
			{children ? <div className="va-empty-state-actions">{children}</div> : null}
		</div>
	);
}
