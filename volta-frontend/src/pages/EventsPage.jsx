import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsService } from '../services/api';
import { formatCurrency, getDefaultCurrency } from '../utils/currency';

const EventsPage = () => {
	const navigate = useNavigate();
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [filters, setFilters] = useState({
		type: 'all',
		access_type: 'all',
		date_filter: 'all', // all, upcoming, past, live
	});
	const [currency, setCurrency] = useState(getDefaultCurrency());

	useEffect(() => {
		fetchEvents();
		
		// Listen for currency changes
		const handleCurrencyChange = () => {
			setCurrency(getDefaultCurrency());
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, [filters]);

	const fetchEvents = async () => {
		try {
			setLoading(true);
			const data = await eventsService.getAll(filters);
			// Handle pagination if present
			const eventsList = Array.isArray(data) ? data : (data?.data || []);
			setEvents(eventsList);
		} catch (err) {
			console.error('Error fetching events:', err);
			setError('Nu s-au putut încărca evenimentele');
		} finally {
			setLoading(false);
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		// Parse datetime string directly without timezone conversion
		// Format: YYYY-MM-DD HH:mm:ss
		const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
		if (!parts) return dateString;
		
		const [, year, month, day, hour, minute] = parts;
		// Format as DD.MM.YYYY, HH:mm (no timezone conversion)
		return `${day}.${month}.${year}, ${hour}:${minute}`;
	};

	const formatTime = (dateString) => {
		if (!dateString) return '';
		// Parse datetime string directly without timezone conversion
		// Format: YYYY-MM-DD HH:mm:ss
		const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
		if (!parts) return dateString;
		
		const [, , , , hour, minute] = parts;
		// Return time as HH:mm (no timezone conversion)
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
			paid: 'Plătit',
			course_included: 'Inclus în curs',
		};
		return labels[accessType] || accessType;
	};

	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#10b981' },
			upcoming: { label: 'Viitor', color: '#3b82f6' },
			live: { label: 'Live', color: '#ef4444' },
			completed: { label: 'Finalizat', color: '#8b5cf6' },
		};
		return badges[status] || null;
	};

	const handleRegister = async (eventId, e) => {
		e.stopPropagation();
		try {
			await eventsService.register(eventId);
			await fetchEvents(); // Refresh to update registration status
			alert('Te-ai înscris cu succes la eveniment!');
		} catch (err) {
			console.error('Error registering:', err);
			alert(err.response?.data?.message || 'Eroare la înscriere');
		}
	};

	if (loading) {
		return (
			<div className="va-main fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
				<div className="skeleton-card">
					<div className="skeleton skeleton-text" style={{ height: '200px' }}></div>
				</div>
			</div>
		);
	}

	return (
		<div className="va-main fade-in">
			<div style={{ marginBottom: '2rem' }}>
				<h1 className="va-page-title fade-in-up">Evenimente</h1>
				<p className="va-muted" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
					Vezi toate evenimentele planificate: cursuri, workshop-uri, examene și webinar-uri.
				</p>
			</div>

			{/* Filters */}
			<div style={{ 
				display: 'flex', 
				gap: '1rem', 
				marginBottom: '1.5rem', 
				flexWrap: 'wrap',
				alignItems: 'center',
			}}>
				<select
					value={filters.type}
					onChange={(e) => setFilters({ ...filters, type: e.target.value })}
					style={{
						padding: '0.75rem 1rem',
						background: 'var(--va-surface-2)',
						border: '1px solid var(--va-border)',
						borderRadius: '8px',
						color: 'var(--va-text)',
						fontSize: '0.9rem',
					}}
				>
					<option value="all">Toate tipurile</option>
					<option value="live_online">Live Online</option>
					<option value="physical">Fizic</option>
					<option value="webinar">Webinar</option>
					<option value="workshop">Workshop</option>
				</select>
				<select
					value={filters.access_type}
					onChange={(e) => setFilters({ ...filters, access_type: e.target.value })}
					style={{
						padding: '0.75rem 1rem',
						background: 'var(--va-surface-2)',
						border: '1px solid var(--va-border)',
						borderRadius: '8px',
						color: 'var(--va-text)',
						fontSize: '0.9rem',
					}}
				>
					<option value="all">Toate accesurile</option>
					<option value="free">Gratuit</option>
					<option value="paid">Plătit</option>
					<option value="course_included">Inclus în curs</option>
				</select>
				<select
					value={filters.date_filter}
					onChange={(e) => setFilters({ ...filters, date_filter: e.target.value })}
					style={{
						padding: '0.75rem 1rem',
						background: 'var(--va-surface-2)',
						border: '1px solid var(--va-border)',
						borderRadius: '8px',
						color: 'var(--va-text)',
						fontSize: '0.9rem',
					}}
				>
					<option value="all">Toate</option>
					<option value="upcoming">Viitoare</option>
					<option value="live">Live</option>
					<option value="past">Trecute</option>
				</select>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1.5rem' }}>
					{error}
				</div>
			)}

			{events.length > 0 ? (
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
							{events.map((event) => {
								const statusBadge = getStatusBadge(event.status);
								const isFull = event.max_capacity && event.registrations_count >= event.max_capacity;
								
								return (
									<div
										key={event.id}
										className="va-card-enhanced stagger-item"
										style={{ cursor: 'pointer' }}
										onClick={() => navigate(`/events/${event.id}`)}
									>
										{event.thumbnail && (
											<div style={{
												width: '100%',
												height: '200px',
												backgroundImage: `url(${event.thumbnail})`,
												backgroundSize: 'cover',
												backgroundPosition: 'center',
												borderRadius: '8px 8px 0 0',
											}} />
										)}
										<div className="va-card-body">
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
												<h3 className="va-card-title" style={{ marginBottom: 0, flex: 1 }}>
													📅 {event.title}
												</h3>
												{statusBadge && (
													<span style={{
														padding: '0.25rem 0.75rem',
														borderRadius: '12px',
														fontSize: '0.75rem',
														fontWeight: 'bold',
														background: statusBadge.color,
														color: '#fff',
													}}>
														{statusBadge.label}
													</span>
												)}
											</div>
											{event.short_description && (
												<p style={{ color: 'var(--va-muted)', marginBottom: '0.75rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
													{event.short_description}
												</p>
											)}
											<p style={{ color: 'var(--va-muted)', marginBottom: '1rem', lineHeight: '1.6' }}>
												{event.description?.substring(0, 120)}{event.description?.length > 120 ? '...' : ''}
											</p>
											<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', lineHeight: '1.8', marginBottom: '1rem' }}>
												<div style={{ marginBottom: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
													<span>🏷️ <strong style={{ color: 'var(--va-text)' }}>{getEventTypeLabel(event.type)}</strong></span>
													{event.access_type && (
														<span>💰 <strong style={{ color: 'var(--va-text)' }}>
															{getAccessTypeLabel(event.access_type)}
															{event.access_type === 'paid' && event.price && (
																<span> - {formatCurrency(event.price, event.currency || currency)}</span>
															)}
														</strong></span>
													)}
												</div>
												{event.instructor && (
													<div style={{ marginBottom: '0.5rem' }}>
														👤 <strong style={{ color: 'var(--va-text)' }}>{event.instructor.name}</strong>
													</div>
												)}
												<div style={{ marginBottom: '0.5rem' }}>
													📍 <strong style={{ color: 'var(--va-text)' }}>
														{event.location || event.live_link || 'N/A'}
													</strong>
												</div>
												<div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
													🕐 <strong style={{ color: 'var(--va-text)' }}>{formatDate(event.start_date)}</strong>
													{event.end_date && (
														<span style={{ marginLeft: '0.5rem' }}>
															- {formatTime(event.end_date)}
														</span>
													)}
												</div>
												{event.max_capacity && (
													<div style={{ marginBottom: '0.5rem' }}>
														👥 <strong style={{ color: 'var(--va-text)' }}>
															{event.registrations_count || 0} / {event.max_capacity} înscriși
															{isFull && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>• PLIN</span>}
														</strong>
													</div>
												)}
											</div>
											<div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
												<button
													className="va-btn va-btn-primary"
													onClick={(e) => {
														e.stopPropagation();
														navigate(`/events/${event.id}`);
													}}
													style={{ flex: 1 }}
												>
													Vezi Detalii
												</button>
												{!event.user_registered && !isFull && event.status !== 'completed' && event.status !== 'cancelled' && (
													<button
														className="va-btn"
														onClick={(e) => handleRegister(event.id, e)}
														style={{ 
															background: event.access_type === 'paid' ? '#f59e0b' : '#10b981',
															color: '#fff',
														}}
													>
														{event.access_type === 'paid' ? '💳 Plătește' : '✓ Înscrie-te'}
													</button>
												)}
												{event.user_registered && (
													<button
														className="va-btn"
														disabled
														style={{ 
															background: '#10b981',
															color: '#fff',
															cursor: 'not-allowed',
														}}
													>
														✓ Înscris
													</button>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="va-card">
							<div className="va-card-body">
								<div className="empty-state">
									<div className="empty-state-icon">📅</div>
									<div className="empty-state-title">Nu există evenimente</div>
									<div className="empty-state-description">Nu sunt programate evenimente momentan.</div>
								</div>
							</div>
						</div>
					)}
		</div>
	);
};

export default EventsPage;

