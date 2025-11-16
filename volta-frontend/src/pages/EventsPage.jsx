import React, { useState, useEffect } from 'react';
import { eventsService } from '../services/api';
import '../styles/modern-enhancements.css';

const EventsPage = () => {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState('list'); // 'calendar' or 'list' - default 'list'

	useEffect(() => {
		fetchEvents();
	}, []);

	const fetchEvents = async () => {
		try {
			setLoading(true);
			const data = await eventsService.getAll();
			// Map events to match admin format (start_date, end_date instead of startDate, endDate)
			const mappedEvents = data.map(event => ({
				...event,
				start_date: event.startDate || event.start_date,
				end_date: event.endDate || event.end_date,
			}));
			setEvents(mappedEvents);
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

	// Calendar functions
	const getDaysInMonth = (date) => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		// Adjust for Monday = 0 (in Romania, week starts on Monday)
		let startingDayOfWeek = firstDay.getDay() - 1;
		if (startingDayOfWeek < 0) startingDayOfWeek = 6; // Sunday becomes 6

		const days = [];
		// Add empty cells for days before the first day of the month
		for (let i = 0; i < startingDayOfWeek; i++) {
			days.push(null);
		}
		// Add days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(new Date(year, month, day));
		}
		return days;
	};

	const getMonthName = (date) => {
		return date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
	};

	const getEventsForDate = (date) => {
		if (!date) return [];
		// Compare dates without timezone conversion
		const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		return events.filter(event => {
			// Parse event.start_date directly (format: YYYY-MM-DD HH:mm:ss)
			const eventDateMatch = event.start_date?.match(/(\d{4})-(\d{2})-(\d{2})/);
			if (!eventDateMatch) return false;
			const eventDateStr = `${eventDateMatch[1]}-${eventDateMatch[2]}-${eventDateMatch[3]}`;
			return eventDateStr === dateStr;
		});
	};

	const navigateMonth = (direction) => {
		setCurrentDate(prev => {
			const newDate = new Date(prev);
			newDate.setMonth(prev.getMonth() + direction);
			return newDate;
		});
	};

	const goToToday = () => {
		setCurrentDate(new Date());
	};

	const getEventTypeLabel = (type) => {
		const labels = {
			curs: 'Curs',
			workshop: 'Workshop',
			examen: 'Examen',
			webinar: 'Webinar',
			eveniment: 'Eveniment',
		};
		return labels[type] || 'Eveniment';
	};

	if (loading) {
		return (
			<div className="va-main fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
				<div className="skeleton-card">
					<div className="skeleton skeleton-text" style={{ height: '2rem', marginBottom: '1rem' }}></div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
						{[...Array(35)].map((_, i) => (
							<div key={i} className="skeleton skeleton-text" style={{ aspectRatio: '1', minHeight: '80px' }}></div>
						))}
					</div>
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

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1.5rem' }}>
					{error}
				</div>
			)}

			<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--va-surface-2)', padding: '0.25rem', borderRadius: '8px', width: 'fit-content' }}>
				<button
					className={`va-btn va-btn-sm ${viewMode === 'list' ? 'va-btn-primary' : ''}`}
					onClick={() => setViewMode('list')}
				>
					📋 Listă
				</button>
				<button
					className={`va-btn va-btn-sm ${viewMode === 'calendar' ? 'va-btn-primary' : ''}`}
					onClick={() => setViewMode('calendar')}
				>
					📅 Calendar
				</button>
			</div>

			{viewMode === 'calendar' ? (
				<div className="va-card fade-in-up" style={{ marginBottom: '1.5rem' }}>
					<div className="va-card-body">
						<div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
							<button className="va-btn" onClick={() => navigateMonth(-1)}>
								← Anterior
							</button>
							<h2 style={{ margin: 0, textTransform: 'capitalize' }}>{getMonthName(currentDate)}</h2>
							<div style={{ display: 'flex', gap: '0.5rem' }}>
								<button className="va-btn" onClick={goToToday}>
									Astăzi
								</button>
								<button className="va-btn" onClick={() => navigateMonth(1)}>
									Următor →
								</button>
							</div>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
							{['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(day => (
								<div key={day} style={{ 
									padding: '0.75rem', 
									textAlign: 'center', 
									fontWeight: 'bold',
									color: 'var(--va-muted)',
									fontSize: '0.875rem'
								}}>
									{day}
								</div>
							))}

							{getDaysInMonth(currentDate).map((date, index) => {
								if (!date) {
									return <div key={`empty-${index}`} style={{ aspectRatio: '1', minHeight: '80px' }} />;
								}

								const dayEvents = getEventsForDate(date);
								const isToday = date.toDateString() === new Date().toDateString();
								const isCurrentMonth = date.getMonth() === currentDate.getMonth();

								return (
									<div
										key={date.toISOString()}
										style={{
											aspectRatio: '1',
											minHeight: '80px',
											border: `1px solid var(--va-border)`,
											borderRadius: '8px',
											padding: '0.5rem',
											cursor: dayEvents.length > 0 ? 'pointer' : 'default',
											background: isToday ? 'var(--va-primary)' : 'var(--va-surface)',
											color: isToday ? 'white' : isCurrentMonth ? 'var(--va-text)' : 'var(--va-muted)',
											transition: 'all 0.2s',
											position: 'relative',
											display: 'flex',
											flexDirection: 'column',
											gap: '0.25rem',
										}}
										onMouseEnter={(e) => {
											if (dayEvents.length > 0) {
												e.currentTarget.style.background = isToday ? 'var(--va-primary)' : 'var(--va-surface-2)';
												e.currentTarget.style.transform = 'scale(1.02)';
											}
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = isToday ? 'var(--va-primary)' : 'var(--va-surface)';
											e.currentTarget.style.transform = 'scale(1)';
										}}
									>
										<div style={{ 
											fontWeight: 'bold', 
											fontSize: '1.1rem',
											marginBottom: '0.25rem'
										}}>
											{date.getDate()}
										</div>
										<div style={{ 
											flex: 1, 
											display: 'flex', 
											flexDirection: 'column', 
											gap: '0.125rem',
											overflow: 'hidden'
										}}>
											{dayEvents.slice(0, 2).map(event => (
												<div
													key={event.id}
													style={{
														background: isToday ? 'rgba(255,255,255,0.3)' : 'var(--va-primary)',
														color: isToday ? 'white' : 'white',
														padding: '0.125rem 0.25rem',
														borderRadius: '4px',
														fontSize: '0.7rem',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
													}}
													title={event.title}
												>
													{event.title}
												</div>
											))}
											{dayEvents.length > 2 && (
												<div style={{
													fontSize: '0.7rem',
													color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--va-muted)',
												}}>
													+{dayEvents.length - 2} mai multe
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			) : null}

			{viewMode === 'list' && (
				<>
					{events.length > 0 ? (
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
							{events.map((event) => (
								<div
									key={event.id}
									className="va-card-enhanced stagger-item"
								>
									<div className="va-card-body">
										<h3 className="va-card-title" style={{ marginBottom: '0.75rem' }}>
											📅 {event.title}
										</h3>
										<p style={{ color: 'var(--va-muted)', marginBottom: '1rem', lineHeight: '1.6' }}>
											{event.description?.substring(0, 150)}{event.description?.length > 150 ? '...' : ''}
										</p>
										<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', lineHeight: '1.8' }}>
											<div style={{ marginBottom: '0.5rem' }}>
												🏷️ <strong style={{ color: 'var(--va-text)' }}>{getEventTypeLabel(event.type)}</strong>
											</div>
											{event.location && (
												<div style={{ marginBottom: '0.5rem' }}>
													📍 <strong style={{ color: 'var(--va-text)' }}>{event.location}</strong>
												</div>
											)}
											<div style={{ fontSize: '0.8rem' }}>
												🕐 <strong style={{ color: 'var(--va-text)' }}>{formatDate(event.start_date)}</strong>
												{event.end_date && (
													<span style={{ marginLeft: '0.5rem' }}>
														- {formatTime(event.end_date)}
													</span>
												)}
											</div>
										</div>
									</div>
								</div>
							))}
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
				</>
			)}
		</div>
	);
};

export default EventsPage;

