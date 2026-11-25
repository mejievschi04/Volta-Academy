import React from 'react';
import './EventListNavigation.css';

export function EventListNavigation({ history, onChange }) {
	return (
		<div className="event-list-controls" role="group" aria-label="Afișare evenimente">
			<button type="button" className={history ? 'lms-btn-secondary' : 'lms-btn-primary'} aria-pressed={!history} onClick={() => onChange(false)}>
				Active
			</button>
			<button type="button" className={history ? 'lms-btn-primary' : 'lms-btn-secondary'} aria-pressed={history} onClick={() => onChange(true)}>
				Istoric
			</button>
		</div>
	);
}

export function EventListPagination({ page, lastPage, onChange, loading }) {
	if (lastPage <= 1 && page <= 1) return null;

	return (
		<nav className="event-list-controls event-list-pagination" aria-label="Paginare evenimente">
			<button type="button" className="lms-btn-secondary" disabled={loading || page <= 1} onClick={() => onChange(page - 1)}>
				Anterior
			</button>
			<span>Pagina {page} din {lastPage}</span>
			<button type="button" className="lms-btn-secondary" disabled={loading || page >= lastPage} onClick={() => onChange(page + 1)}>
				Următor
			</button>
		</nav>
	);
}
