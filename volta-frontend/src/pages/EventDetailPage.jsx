import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

const EventDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { success: showSuccess, error: showError } = useToast();
	const [event, setEvent] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [actionLoading, setActionLoading] = useState(false);
	useEffect(() => {
		fetchEvent();
	}, [id]);

	const fetchEvent = async () => {
		try {
			setLoading(true);
			const data = await eventsService.getById(id);
			setEvent(data);
		} catch (err) {
			handleApiError(err, 'fetchEvent');
			setError('Nu s-a putut încărca evenimentul');
		} finally {
			setLoading(false);
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
		if (!parts) return dateString;
		const [, year, month, day, hour, minute] = parts;
		return `${day}.${month}.${year}, ${hour}:${minute}`;
	};

	const formatTime = (dateString) => {
		if (!dateString) return '';
		const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
		if (!parts) return dateString;
		const [, , , , hour, minute] = parts;
		return `${hour}:${minute}`;
	};

	const getEventTypeLabel = (type) => {
		const labels = {
			live_online: 'Live Online',
			physical: 'Fizic',
			webinar: 'Webinar',
			workshop: 'Workshop',
		};
		return labels[type] || type;
	};

	const getAccessTypeLabel = (accessType) => {
		const labels = {
			free: 'Gratuit',
			course_included: 'Inclus în curs',
		};
		return labels[accessType] || accessType;
	};

	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#10b981' },
			upcoming: { label: 'Viitor', color: '#FFEE00' },
			live: { label: 'Live', color: '#ef4444' },
			completed: { label: 'Finalizat', color: '#FFEE00' },
			cancelled: { label: 'Anulat', color: '#f97316' },
		};
		return badges[status] || null;
	};

	const handleRegister = async () => {
		setActionLoading(true);
		try {
			await eventsService.register(id);
			await fetchEvent(); // Refresh to update registration status
			showSuccess('Te-ai înscris cu succes la eveniment!');
		} catch (err) {
			logger.error('Error registering:', err);
			showError(err.response?.data?.message || 'Eroare la înscriere');
		} finally {
			setActionLoading(false);
		}
	};

	const handleCancelRegistration = async () => {
		if (!confirm('Sigur dorești să anulezi înscrierea la acest eveniment?')) {
			return;
		}
		setActionLoading(true);
		try {
			await eventsService.cancelRegistration(id);
			await fetchEvent();
			showSuccess('Înscriere anulată cu succes');
		} catch (err) {
			logger.error('Error canceling registration:', err);
			showError(err.response?.data?.message || 'Eroare la anulare');
		} finally {
			setActionLoading(false);
		}
	};

	const handleMarkAttendance = async () => {
		setActionLoading(true);
		try {
			await eventsService.markAttendance(id);
			await fetchEvent();
			showSuccess('Prezență înregistrată!');
		} catch (err) {
			logger.error('Error marking attendance:', err);
			showError(err.response?.data?.message || 'Eroare la înregistrarea prezenței');
		} finally {
			setActionLoading(false);
		}
	};

	const handleWatchReplay = async () => {
		if (event.replay_url) {
			window.open(event.replay_url, '_blank');
			// Mark as watched
			try {
				await eventsService.markReplayWatched(id);
				await fetchEvent();
			} catch (err) {
				handleApiError(err, 'markReplayWatched');
			}
		}
	};

	if (loading) {
		return (
			<div className="va-main fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
			</div>
		);
	}

	if (error || !event) {
		return (
			<div className="va-main fade-in">
				<div className="va-card">
					<div className="va-card-body">
						<div className="empty-state">
							<div className="empty-state-icon">❌</div>
							<div className="empty-state-title">Eroare</div>
							<div className="empty-state-description">{error || 'Evenimentul nu a fost găsit'}</div>
							<button className="lms-btn-primary" onClick={() => navigate('/events')}>
								Înapoi la Evenimente
							</button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const statusBadge = getStatusBadge(event.status);
	const isFull = event.max_capacity && event.registrations_count >= event.max_capacity;
	const canRegister = !event.user_registered && !isFull && 
		event.status !== 'completed' && event.status !== 'cancelled';

	return (
		<div className="va-main event-detail-page fade-in">
			<button 
				className="lms-btn-secondary event-detail-back" 
				onClick={() => navigate('/events')}
				style={{ marginBottom: '1.5rem' }}
			>
				← Înapoi la Evenimente
			</button>

			<div className="va-card-enhanced event-detail-card">
				{event.thumbnail && (
					<div 
						className="event-detail-thumbnail"
						style={{
							width: '100%',
							height: '300px',
							backgroundImage: `url(${event.thumbnail})`,
							backgroundSize: 'cover',
							backgroundPosition: 'center',
							borderRadius: '8px 8px 0 0',
						}} 
					/>
				)}
				<div className="va-card-body event-detail-body">
					<div className="event-detail-header">
						<h1 className="va-page-title" style={{ flex: 1 }}>
							{event.title}
						</h1>
						{statusBadge && (
							<span 
								className="event-detail-status-badge"
								style={{
									padding: '0.5rem 1rem',
									borderRadius: '12px',
									fontSize: '0.9rem',
									fontWeight: 'bold',
									background: statusBadge.color,
									color: '#fff',
									flexShrink: 0,
								}}
							>
								{statusBadge.label}
							</span>
						)}
					</div>

					{event.short_description && (
						<p className="event-detail-short-desc">
							{event.short_description}
						</p>
					)}

					<div className="event-detail-meta-grid">
						<div>
							<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>🏷️ Tip</div>
							<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>{getEventTypeLabel(event.type)}</div>
						</div>
						<div>
							<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>💰 Acces</div>
							<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>
								{getAccessTypeLabel(event.access_type)}
							</div>
						</div>
						{event.instructor && (
							<div>
								<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>👤 Instructor</div>
								<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>{event.instructor.name}</div>
							</div>
						)}
						<div>
							<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>🕐 Data Început</div>
							<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>{formatDate(event.start_date)}</div>
						</div>
						<div>
							<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>🕐 Data Sfârșit</div>
							<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>{formatDate(event.end_date)}</div>
						</div>
						<div>
							<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>📍 Locație</div>
							<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>
								{event.location || event.live_link || 'N/A'}
							</div>
						</div>
						{event.max_capacity && (
							<div>
								<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>👥 Capacitate</div>
								<div style={{ fontWeight: 'bold', color: 'var(--va-text)' }}>
									{event.registrations_count || 0} / {event.max_capacity} înscriși
									{isFull && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>• PLIN</span>}
								</div>
							</div>
						)}
					</div>

					{event.description && (
						<div className="event-detail-description">
							<h2>Descriere</h2>
							<div className="event-detail-description-text">
								{event.description}
							</div>
						</div>
					)}

					{/* Actions */}
					<div className="event-detail-actions">
						{canRegister && (
							<button
								className="lms-btn-primary event-detail-action-btn"
								onClick={handleRegister}
								disabled={actionLoading}
								style={{ 
									flex: 1,
									minWidth: '200px',
									background: '#10b981',
								}}
							>
								{actionLoading ? 'Se procesează...' : '✓ Înscrie-te'}
							</button>
						)}
						{event.user_registered && (
							<>
								<button
									className="lms-btn-secondary"
									disabled
									style={{ 
										background: '#10b981',
										color: '#fff',
										cursor: 'not-allowed',
									}}
								>
									✓ Înscris
								</button>
								{event.status === 'live' && !event.user_attended && (
									<button
										className="lms-btn-primary"
										onClick={handleMarkAttendance}
										disabled={actionLoading}
									>
										{actionLoading ? 'Se procesează...' : '✓ Confirmă Prezența'}
									</button>
								)}
								{event.user_attended && (
									<button
										className="lms-btn-secondary"
										disabled
										style={{ 
											background: '#10b981',
											color: '#fff',
											cursor: 'not-allowed',
										}}
									>
										✓ Prezență Confirmată
									</button>
								)}
								{event.status === 'completed' && event.replay_url && (
									<button
										className="lms-btn-primary"
										onClick={handleWatchReplay}
										style={{ background: '#FFEE00' }}
									>
										🎬 Vezi Replay
									</button>
								)}
								{event.status !== 'completed' && event.status !== 'cancelled' && (
									<button
										className="lms-btn-secondary"
										onClick={handleCancelRegistration}
										disabled={actionLoading}
										style={{ background: '#ef4444', color: '#fff' }}
									>
										{actionLoading ? 'Se procesează...' : 'Anulează Înscrierea'}
									</button>
								)}
							</>
						)}
						{event.live_link && (event.status === 'live' || event.status === 'upcoming') && (
							<button
								className="lms-btn-primary"
								onClick={() => window.open(event.live_link, '_blank')}
								style={{ background: '#ef4444' }}
							>
								🔴 Accesează Live
							</button>
						)}
					</div>

					{/* KPI Metrics */}
					{event.registrations_count > 0 && (
						<div className="event-detail-stats">
							<h3 style={{ marginBottom: '1rem', color: 'var(--va-text)' }}>Statistici</h3>
							<div className="event-detail-stats-grid">
								<div>
									<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>Înscrieri</div>
									<div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFEE00' }}>
										{event.registrations_count || 0}
									</div>
								</div>
								<div>
									<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>Prezență</div>
									<div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
										{event.attendance_count || 0}
									</div>
								</div>
								{event.replay_views_count > 0 && (
									<div>
										<div style={{ fontSize: '0.85rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>Replay Views</div>
										<div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFEE00' }}>
											{event.replay_views_count}
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default EventDetailPage;

