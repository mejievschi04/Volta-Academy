import React from 'react';
import './AdminEventListCard.css';

const TYPE_LABELS = {
	live_online: 'Online',
	physical: 'Fizic',
};

const ACCESS_LABELS = {
	free: 'Gratuit',
	course_included: 'Inclus în curs',
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
	formatDate,
	calculateDuration,
	onEdit,
	onDelete,
	readOnly = false,
}) {
	const desc = previewDescription(event);
	const place = locationLine(event);
	const typeLabel = TYPE_LABELS[event.type] || event.type;
	const accessLabel =
		event.access_type === 'course_included' ? ACCESS_LABELS.course_included || event.access_type : null;

	return (
		<article className="aev-card" aria-labelledby={`aev-title-${event.id}`}>
			<div className="aev-card__shell">
				<header className="aev-card__head aev-card__head--no-select">
					<div className="aev-card__head-main">
						<div className="aev-card__title-row">
							<h2 id={`aev-title-${event.id}`} className="aev-card__title">
								{event.title}
							</h2>
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

				{readOnly ? null : (
					<div className="aev-card__actions-bar" role="toolbar" aria-label={`Acțiuni: ${event.title}`}>
						<button
							type="button"
							className="admin-btn admin-btn-sm admin-btn-secondary"
							aria-label="Editează evenimentul"
							onClick={() => onEdit(event)}
						>
							Editează
						</button>
						<button
							type="button"
							className="admin-btn admin-btn-sm admin-btn-danger"
							aria-label="Șterge evenimentul"
							onClick={(e) => {
								e.stopPropagation();
								onDelete(event.id);
							}}
						>
							Șterge
						</button>
					</div>
				)}
			</div>
		</article>
	);
}
