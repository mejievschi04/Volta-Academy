import React from 'react';
import './AdminEventListCard.css';

const TYPE_LABELS = {
	live_online: 'Live online',
	physical: 'Fizic',
	webinar: 'Webinar',
	workshop: 'Workshop',
};

const ACCESS_LABELS = {
	free: 'Gratuit',
	course_included: 'Inclus în curs',
};

const STATUS_LABELS = {
	draft: 'Ciornă',
	published: 'Publicat',
	upcoming: 'Viitor',
	live: 'Live',
	completed: 'Finalizat',
	cancelled: 'Anulat',
};

const STATUS_MOD = {
	draft: 'aev-status--draft',
	published: 'aev-status--published',
	upcoming: 'aev-status--upcoming',
	live: 'aev-status--live',
	completed: 'aev-status--completed',
	cancelled: 'aev-status--cancelled',
};

function previewDescription(event) {
	const short = event.short_description && String(event.short_description).trim();
	if (short) return short;
	if (!event.description) return null;
	const d = event.description;
	return d.length > 140 ? `${d.slice(0, 140)}…` : d;
}

function locationLine(event) {
	const loc = event.location?.trim();
	const link = event.live_link?.trim();
	if (loc) return loc;
	if (link) return link;
	return 'Online';
}

/**
 * Card eveniment — listă admin (markup + stiluri proprii, prefix aev-).
 */
export default function AdminEventListCard({
	event,
	selected,
	onSelectChange,
	busy,
	formatDate,
	calculateDuration,
	onQuickAction,
	onEdit,
	onDelete,
}) {
	const desc = previewDescription(event);
	const place = locationLine(event);
	const typeLabel = TYPE_LABELS[event.type] || event.type;
	const accessLabel = event.access_type ? ACCESS_LABELS[event.access_type] || event.access_type : null;
	const statusKey = event.status || 'draft';
	const statusClass = STATUS_MOD[statusKey] || STATUS_MOD.draft;
	const statusText = STATUS_LABELS[statusKey] || statusKey;

	return (
		<article className="aev-card" aria-labelledby={`aev-title-${event.id}`}>
			<div className="aev-card__shell">
				<header className="aev-card__head">
					<div className="aev-card__pick">
						<input
							id={`aev-sel-${event.id}`}
							type="checkbox"
							className="aev-card__checkbox"
							checked={selected}
							onChange={(e) => onSelectChange(e.target.checked)}
							aria-label={`Selectează evenimentul: ${event.title}`}
						/>
					</div>
					<div className="aev-card__head-main">
						<div className="aev-card__title-row">
							<h2 id={`aev-title-${event.id}`} className="aev-card__title">
								{event.title}
							</h2>
							<span className={`aev-status ${statusClass}`}>{statusText}</span>
						</div>
						<p className="aev-card__when">
							{event.start_date ? (
								<time dateTime={event.start_date}>{formatDate(event.start_date)}</time>
							) : (
								<span>—</span>
							)}
							{event.end_date && event.start_date ? (
								<>
									<span className="aev-card__when-sep" aria-hidden="true">
										·
									</span>
									<span>{calculateDuration(event.start_date, event.end_date)}</span>
								</>
							) : null}
						</p>
						<ul className="aev-card__tags" aria-label="Detalii scurte">
							<li>{typeLabel}</li>
							{accessLabel ? <li>{accessLabel}</li> : null}
							<li title={place}>{place}</li>
							{event.instructor?.name ? (
								<li title={event.instructor.name}>{event.instructor.name}</li>
							) : null}
						</ul>
						{desc ? <p className="aev-card__blurb">{desc}</p> : null}
					</div>
				</header>

				<div
					className={`aev-metrics${event.replay_views_count > 0 ? ' aev-metrics--3' : ' aev-metrics--2'}`}
					role="group"
					aria-label={`Statistici: ${event.title}`}
				>
					<div>
						<span className="aev-metrics__label">Înscrieri</span>
						<span className="aev-metrics__value">
							{event.registrations_count ?? 0}
							{event.max_capacity != null ? ` / ${event.max_capacity}` : ''}
						</span>
					</div>
					<div>
						<span className="aev-metrics__label">Prezență</span>
						<span className="aev-metrics__value">{event.attendance_count ?? 0}</span>
					</div>
					{event.replay_views_count > 0 ? (
						<div>
							<span className="aev-metrics__label">Replay</span>
							<span className="aev-metrics__value">{event.replay_views_count}</span>
						</div>
					) : null}
				</div>

				<details className="aev-actions">
					<summary className="aev-actions__toggle">Acțiuni</summary>
					<div
						className="aev-actions__panel"
						role="toolbar"
						aria-label={`Acțiuni pentru eveniment: ${event.title}`}
					>
						{event.status === 'draft' ? (
							<button
								type="button"
								className="admin-btn admin-btn-sm admin-btn-primary"
								disabled={busy}
								aria-busy={busy}
								aria-label="Publică evenimentul"
								onClick={() => onQuickAction(event.id, 'publish')}
							>
								Publică
							</button>
						) : null}
						{event.status === 'published' || event.status === 'upcoming' ? (
							<button
								type="button"
								className="admin-btn admin-btn-sm admin-btn-secondary"
								disabled={busy}
								aria-busy={busy}
								aria-label="Retrage evenimentul din publicare"
								onClick={() => onQuickAction(event.id, 'unpublish')}
							>
								Retrage din publicare
							</button>
						) : null}
						{!['completed', 'cancelled'].includes(event.status) ? (
							<button
								type="button"
								className="admin-btn admin-btn-sm admin-btn-secondary"
								disabled={busy}
								aria-busy={busy}
								aria-label="Anulează evenimentul"
								onClick={() => onQuickAction(event.id, 'cancel')}
							>
								Anulează
							</button>
						) : null}
						{['published', 'upcoming', 'live'].includes(event.status) ? (
							<button
								type="button"
								className="admin-btn admin-btn-sm admin-btn-primary"
								disabled={busy}
								aria-busy={busy}
								aria-label="Marchează evenimentul ca finalizat"
								onClick={() => onQuickAction(event.id, 'complete')}
							>
								Finalizează
							</button>
						) : null}
						<button
							type="button"
							className="admin-btn admin-btn-sm admin-btn-secondary"
							disabled={busy}
							aria-label="Editează evenimentul"
							onClick={() => onEdit(event)}
						>
							Editează
						</button>
						<button
							type="button"
							className="admin-btn admin-btn-sm admin-btn-danger"
							disabled={busy}
							aria-label="Șterge evenimentul"
							onClick={(e) => {
								e.stopPropagation();
								onDelete(event.id);
							}}
						>
							Șterge
						</button>
					</div>
				</details>
			</div>
		</article>
	);
}
