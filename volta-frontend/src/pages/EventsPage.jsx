import React, { useCallback, useEffect, useRef, useState } from 'react';
import EmptyState from '../components/ui/EmptyState';
import { eventsService } from '../services/api';

import { useToast } from '../contexts/ToastContextShared.js';
import { logger } from '../utils/logger';
import ConfirmModal from '../components/common/ConfirmModal';
import Modal from '../components/common/Modal';
import { EventListNavigation, EventListPagination } from '../components/common/EventListNavigation';
import { CalendarBlank } from '@phosphor-icons/react';
import { useRegisterPageRefresh } from '../contexts/PageRefreshContext';

const parseEventDate = (dateString) => {
	if (!dateString) return null;
	const parts = String(dateString).match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
	if (!parts) return null;
	return new Date(
		Number(parts[1]),
		Number(parts[2]) - 1,
		Number(parts[3]),
		Number(parts[4]),
		Number(parts[5]),
	);
};

const EventsPage = () => {
	const { success: showSuccess, error: showError } = useToast();
	const [events, setEvents] = useState([]);
	const [history, setHistory] = useState(false);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [refreshKey, setRefreshKey] = useState(0);
	const requestId = useRef(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [cancelTarget, setCancelTarget] = useState(null);
	const [cancelLoading, setCancelLoading] = useState(false);
	const [questionTarget, setQuestionTarget] = useState(null);
	const [questionText, setQuestionText] = useState('');
	const [questionSending, setQuestionSending] = useState(false);

	const fetchEvents = useCallback(async ({ silent = false } = {}) => {
		const id = ++requestId.current;
		try {
			if (!silent) setLoading(true);
			setError(null);
			const data = await eventsService.getAll({ date_filter: history ? 'past' : 'active', page });
			if (requestId.current !== id) return;
			const last = data.last_page || 1;
			setLastPage(last);
			if (page > last) {
				setPage(last);
				return;
			}
			setEvents(Array.isArray(data) ? data : (data.data || []));
		} catch (err) {
			console.error('Error fetching events:', err);
			if (requestId.current === id && !silent) setError('Nu s-au putut încărca evenimentele');
		} finally {
			if (requestId.current === id) setLoading(false);
		}
	}, [history, page]);

	useEffect(() => {
		fetchEvents();
		return () => {
			requestId.current += 1;
		};
	}, [fetchEvents, refreshKey]);

	useRegisterPageRefresh(() => fetchEvents({ silent: true }));

	const formatDate = (dateString) => {
		const date = parseEventDate(dateString);
		if (!date) return dateString || 'N/A';
		const pad = (value) => String(value).padStart(2, '0');
		return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
	};

	const formatTime = (dateString) => {
		const date = parseEventDate(dateString);
		if (!date) return '';
		const pad = (value) => String(value).padStart(2, '0');
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	};

	const handleRegister = async (eventId, e) => {
		e.stopPropagation();
		try {
			await eventsService.register(eventId);
			setRefreshKey((key) => key + 1);
			showSuccess('Te-ai înscris cu succes la eveniment!');
		} catch (err) {
			logger.error('Error registering:', err);
			showError(err.response?.data?.message || 'Eroare la înscriere');
		}
	};

	const handleAskQuestion = async () => {
		if (!questionTarget) return;
		const body = questionText.trim();
		if (body.length < 3) {
			showError('Scrie o întrebare de cel puțin 3 caractere.');
			return;
		}
		setQuestionSending(true);
		try {
			await eventsService.askQuestion(questionTarget.id, body);
			setQuestionTarget(null);
			setQuestionText('');
			showSuccess('Întrebarea a fost trimisă.');
		} catch (err) {
			logger.error('Error asking event question:', err);
			const validation = err.response?.data?.errors?.body?.[0];
			showError(validation || err.response?.data?.message || 'Nu am putut trimite întrebarea');
		} finally {
			setQuestionSending(false);
		}
	};

	const handleCancelRegistrationClick = (event, e) => {
		e.stopPropagation();
		setCancelTarget(event);
	};

	const handleConfirmCancelRegistration = async () => {
		if (!cancelTarget) return;
		setCancelLoading(true);
		try {
			await eventsService.cancelRegistration(cancelTarget.id);
			setCancelTarget(null);
			setRefreshKey((key) => key + 1);
			showSuccess('Înscriere anulată');
		} catch (err) {
			logger.error('Error canceling registration:', err);
			showError(err.response?.data?.message || 'Eroare la anulare');
		} finally {
			setCancelLoading(false);
		}
	};

	return (
		<div className="events-page">
			<div className="events-page-header">
				<h1 className="events-page-title">Evenimente</h1>
			</div>
			<EventListNavigation history={history} onChange={(nextHistory) => {
				if (nextHistory === history) return;
				setLoading(true);
				setPage(1);
				setHistory(nextHistory);
			}} />

			{error && (
				<div className="lms-error-message" role="alert">
					{error}
				</div>
			)}

			{loading && (
				<div className="skeleton-card" role="status" aria-label="Se încarcă evenimentele">
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
			)}
			{!loading && !error && (events.length > 0 ? (
				<div className="events-grid">
					{events.map((event) => {
						const isFull = event.max_capacity && event.registrations_count >= event.max_capacity;
						const details = String(event.description || event.short_description || '').trim();
						return (
							<article key={event.id} className="va-card-enhanced stagger-item events-card">
								{event.thumbnail && (
									<div
										className="events-card-thumbnail"
										style={{
											backgroundImage: `url(${event.thumbnail})`,
										}}
									/>
								)}
								{(() => {
									// pastilă de calendar (zi + lună), folosită pe telefon; pe desktop data rămâne în rândul cu ora
									const start = parseEventDate(event.start_date);
									return start ? (
										<div className="events-card-date" aria-hidden>
											<span className="events-card-date-day">{start.getDate()}</span>
											<span className="events-card-date-month">
												{start.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '')}
											</span>
										</div>
									) : null;
								})()}
								<div className="va-card-body events-card-body">
									<h3 className="va-card-title events-card-title">{event.title}</h3>
									{details ? (
										<p className="events-card-text">{details}</p>
									) : null}
									<div className="events-card-meta">
										{event.instructor?.name ? (
											<div className="events-card-meta-row">
												<span className="events-card-meta-icon" aria-hidden>👤</span>
												<span>{event.instructor.name}</span>
											</div>
										) : null}
										{(event.location || event.live_link) ? (
											<div className="events-card-meta-row">
												<span className="events-card-meta-icon" aria-hidden>📍</span>
												<span>{event.location || 'Online'}</span>
											</div>
										) : null}
										<div className="events-card-meta-row">
											<span className="events-card-meta-icon" aria-hidden>🕐</span>
											<span className="events-card-when-full">
												{formatDate(event.start_date)}
												{event.end_date ? ` – ${formatTime(event.end_date)}` : ''}
											</span>
											<span className="events-card-when-short">
												{formatTime(event.start_date)}
												{event.end_date ? ` – ${formatTime(event.end_date)}` : ''}
											</span>
										</div>
										{event.max_capacity ? (
											<div className="events-card-meta-row">
												<span className="events-card-meta-icon" aria-hidden>👥</span>
												<span>
													{event.registrations_count || 0} / {event.max_capacity} înscriși
													{!history && isFull ? <span className="events-card-full"> • PLIN</span> : null}
												</span>
											</div>
										) : null}
									</div>
									<div className="events-card-actions">
										{!history && !event.user_registered && !isFull && event.status !== 'cancelled' && (
											<button
												className="lms-btn-primary"
												onClick={(e) => handleRegister(event.id, e)}
											>
												Înscrie-te
											</button>
										)}
										{event.user_registered && (
											<>
												<button className="lms-btn-secondary" disabled>
													✓ Înscris
												</button>
												{!history && event.status !== 'cancelled' && event.status !== 'completed' ? (
													<button
														type="button"
														className="lms-btn-secondary events-card-cancel-btn"
														onClick={(e) => handleCancelRegistrationClick(event, e)}
													>
														Anulează înscrierea
													</button>
												) : null}
											</>
										)}
										{!history && event.status !== 'cancelled' ? (
											<button
												type="button"
												className="lms-btn-secondary"
												onClick={(e) => {
													e.stopPropagation();
													setQuestionText('');
													setQuestionTarget(event);
												}}
											>
												Întrebare
											</button>
										) : null}
									</div>
								</div>
							</article>
						);
					})}
				</div>
			) : (
				<EmptyState
					icon={<CalendarBlank size={30} weight="bold" />}
					title={history ? 'Istoricul este gol' : 'Nu există evenimente'}
					text={history ? 'Evenimentele încheiate vor apărea aici.' : 'Nu sunt programate evenimente momentan.'}
				/>
			))}
			{!error && (
				<EventListPagination page={page} lastPage={lastPage} loading={loading} onChange={(nextPage) => {
					setLoading(true);
					setPage(nextPage);
				}} />
			)}

			<ConfirmModal
				open={Boolean(cancelTarget)}
				onClose={() => !cancelLoading && setCancelTarget(null)}
				onConfirm={handleConfirmCancelRegistration}
				title="Anulare înscriere"
				message={cancelTarget ? `Sigur dorești să anulezi înscrierea la „${cancelTarget.title}”?` : ''}
				confirmLabel="Anulează înscrierea"
				cancelLabel="Rămân"
				variant="danger"
				loading={cancelLoading}
			/>

			<Modal
				isOpen={Boolean(questionTarget)}
				onClose={() => !questionSending && setQuestionTarget(null)}
				ariaLabelledby="event-question-title"
				closeOnBackdropClick
				closeOnEscape
			>
				<div className="modal-header">
					<h2 id="event-question-title" className="modal-title">Întrebare la tema evenimentului</h2>
				</div>
				<form
					className="modal-body events-question-form"
					onSubmit={(e) => {
						e.preventDefault();
						handleAskQuestion();
					}}
				>
					<p className="events-question-event">{questionTarget?.title}</p>
					<label htmlFor="event-question-body">
						Întrebarea ta
						<textarea
							id="event-question-body"
							data-modal-initial-focus
							rows={4}
							maxLength={2000}
							value={questionText}
							onChange={(e) => setQuestionText(e.target.value)}
							placeholder="Scrie întrebarea despre tema evenimentului"
						/>
					</label>
					<div className="modal-footer">
						<button
							type="button"
							className="lms-btn-secondary"
							disabled={questionSending}
							onClick={() => setQuestionTarget(null)}
						>
							Renunță
						</button>
						<button type="submit" className="lms-btn-primary" disabled={questionSending}>
							{questionSending ? 'Se trimite…' : 'Trimite'}
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
};

export default EventsPage;
