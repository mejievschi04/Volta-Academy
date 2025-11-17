import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const AdminEventsPage = () => {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingEvent, setEditingEvent] = useState(null);
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState('list'); // 'calendar' or 'list' - default 'list'
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		type: 'eveniment',
		start_date: '',
		end_date: '',
		location: '',
	});

	useEffect(() => {
		fetchEvents();
	}, []);

	const fetchEvents = async () => {
		try {
			setLoading(true);
			const data = await adminService.getEvents();
			setEvents(data);
		} catch (err) {
			console.error('Error fetching events:', err);
			setError('Nu s-au putut încărca evenimentele');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingEvent) {
				await adminService.updateEvent(editingEvent.id, formData);
			} else {
				await adminService.createEvent(formData);
			}

			setShowModal(false);
			setEditingEvent(null);
			setFormData({ title: '', description: '', type: 'eveniment', start_date: '', end_date: '', location: '' });
			fetchEvents();
		} catch (err) {
			console.error('Error saving event:', err);
			alert('Eroare la salvarea evenimentului');
		}
	};

	const handleEdit = (event) => {
		setEditingEvent(event);
		// Convert datetime string to datetime-local format (YYYY-MM-DDTHH:mm)
		// Backend returns format: YYYY-MM-DD HH:mm:ss (raw value, no timezone)
		let startDate = '';
		let endDate = '';
		
		if (event.start_date) {
			// Parse directly from string without timezone conversion
			// Format: YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss
			const match = event.start_date.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
			if (match) {
				const [, year, month, day, hour, minute] = match;
				startDate = `${year}-${month}-${day}T${hour}:${minute}`;
			} else {
				startDate = event.start_date.replace(' ', 'T').slice(0, 16);
			}
		}
		
		if (event.end_date) {
			// Parse directly from string without timezone conversion
			const match = event.end_date.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
			if (match) {
				const [, year, month, day, hour, minute] = match;
				endDate = `${year}-${month}-${day}T${hour}:${minute}`;
			} else {
				endDate = event.end_date.replace(' ', 'T').slice(0, 16);
			}
		}
		
		setFormData({
			title: event.title,
			description: event.description,
			type: event.type,
			start_date: startDate,
			end_date: endDate,
			location: event.location || '',
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi acest eveniment?')) return;

		try {
			await adminService.deleteEvent(id);
			fetchEvents();
		} catch (err) {
			console.error('Error deleting event:', err);
			alert('Eroare la ștergerea evenimentului');
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

	const handleDayClick = (date) => {
		if (!date) return;
		
		// Set start_date to clicked date at 09:00
		const startDate = new Date(date);
		startDate.setHours(9, 0, 0, 0);
		
		// Set end_date to same date at 17:00
		const endDate = new Date(date);
		endDate.setHours(17, 0, 0, 0);

		// Format for datetime-local input (YYYY-MM-DDTHH:mm)
		const formatForInput = (date) => {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			return `${year}-${month}-${day}T${hours}:${minutes}`;
		};

		setFormData({
			title: '',
			description: '',
			type: 'eveniment',
			start_date: formatForInput(startDate),
			end_date: formatForInput(endDate),
			location: '',
		});
		setEditingEvent(null);
		setShowModal(true);
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

	if (loading) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Evenimente</h1>
					<p className="va-muted admin-page-subtitle">Gestionează toate evenimentele din platformă</p>
				</div>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					<div style={{ display: 'flex', gap: '0.5rem', background: 'var(--va-surface-2)', padding: '0.25rem', borderRadius: '8px' }}>
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
					<button
						className="va-btn va-btn-primary"
						onClick={() => {
							setEditingEvent(null);
							setFormData({ title: '', description: '', type: 'eveniment', start_date: '', end_date: '', location: '' });
							setShowModal(true);
						}}
					>
						+ Adaugă Eveniment
					</button>
				</div>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{viewMode === 'calendar' ? (() => {
				const days = getDaysInMonth(currentDate);
				const weeks = Math.ceil(days.length / 7);
				return (
				<div
					className="va-card"
					style={{
						margin: '0 auto 1rem',
						height: 'calc(100vh - 180px)',
						maxWidth: '1000px'
					}}
				>
					<div className="va-card-body" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
						<div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<button className="va-btn" onClick={() => navigateMonth(-1)}>
								← Anterior
							</button>
							<h2 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1.1rem' }}>{getMonthName(currentDate)}</h2>
							<div style={{ display: 'flex', gap: '0.375rem' }}>
								<button className="va-btn" onClick={goToToday}>
									Astăzi
								</button>
								<button className="va-btn" onClick={() => navigateMonth(1)}>
									Următor →
								</button>
							</div>
						</div>

						{/* Weekday header */}
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.375rem', marginBottom: '0.375rem' }}>
							{['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(day => (
								<div key={day} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--va-muted)', fontSize: '0.8rem' }}>{day}</div>
							))}
						</div>

						{/* Days grid fills remaining height exactly */}
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${weeks}, 1fr)`, gap: '0.375rem', flex: 1, minHeight: 0 }}>
							{days.map((date, index) => {
								if (!date) {
									return <div key={`empty-${index}`} style={{ borderRadius: '8px' }} />;
								}

								const dayEvents = getEventsForDate(date);
								const isToday = date.toDateString() === new Date().toDateString();
								const isCurrentMonth = date.getMonth() === currentDate.getMonth();

								return (
									<div
										key={date.toISOString()}
										onClick={() => handleDayClick(date)}
										style={{
											border: `1px solid var(--va-border)`,
											borderRadius: '8px',
											padding: '0.375rem',
											cursor: 'pointer',
											background: isToday ? 'var(--va-primary)' : 'var(--va-surface)',
											color: isToday ? 'white' : isCurrentMonth ? 'var(--va-text)' : 'var(--va-muted)',
											transition: 'all 0.2s',
											position: 'relative',
											display: 'flex',
											flexDirection: 'column',
											gap: '0.2rem',
											overflow: 'hidden'
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = isToday ? 'var(--va-primary)' : 'var(--va-surface-2)';
											e.currentTarget.style.transform = 'scale(1.02)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = isToday ? 'var(--va-primary)' : 'var(--va-surface)';
											e.currentTarget.style.transform = 'scale(1)';
										}}
									>
										<div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.2rem' }}>
											{date.getDate()}
										</div>
										<div style={{ 
											flex: 1, 
											display: 'flex', 
											flexDirection: 'column', 
											gap: '0.1rem',
											overflow: 'hidden'
										}}>
											{dayEvents.slice(0, 2).map(event => (
												<div
													key={event.id}
													onClick={(e) => {
														e.stopPropagation();
														handleEdit(event);
													}}
													style={{
														background: isToday ? 'rgba(255,255,255,0.3)' : 'var(--va-primary)',
														color: isToday ? 'white' : '#000000',
														padding: '0.1rem 0.2rem',
														borderRadius: '4px',
														fontSize: '0.68rem',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														cursor: 'pointer',
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
				)})() : null}

			{viewMode === 'list' && (
				<>
					{events.length > 0 ? (
						<div className="admin-grid">
							{events.map((event) => (
								<div
									key={event.id}
									className="va-card admin-card"
								>
									<div className="admin-card-body">
										<h3 className="admin-card-title">📅 {event.title}</h3>
										<p className="admin-card-description">
											{event.description?.substring(0, 120)}{event.description?.length > 120 ? '...' : ''}
										</p>
										<div className="admin-card-info">
											<div style={{ marginBottom: '0.5rem' }}>🏷️ <strong>{event.type}</strong></div>
											<div style={{ marginBottom: '0.5rem' }}>📍 <strong>{event.location || 'N/A'}</strong></div>
											<div style={{ fontSize: '0.8rem' }}>
												🕐 <strong>{formatDate(event.start_date)}</strong>
												{event.end_date && (
													<span style={{ marginLeft: '0.5rem' }}>
														- {formatTime(event.end_date)}
													</span>
												)}
											</div>
										</div>
										<div className="admin-card-actions">
											<button
												className="va-btn va-btn-sm"
												onClick={() => handleEdit(event)}
											>
												Editează
											</button>
											<button
												className="va-btn va-btn-sm va-btn-danger"
												onClick={() => handleDelete(event.id)}
											>
												Șterge
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="va-card">
							<div className="va-card-body">
								<p className="va-muted">Nu există evenimente</p>
							</div>
						</div>
					)}
				</>
			)}

			{showModal && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowModal(false)}
				>
					<div
						className="va-card"
						style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header">
							<h2>{editingEvent ? 'Editează Eveniment' : 'Adaugă Eveniment Nou'}</h2>
						</div>
						<div className="va-card-body">
							<form onSubmit={handleSubmit} className="va-stack">
								<div className="va-form-group">
									<label className="va-form-label">Titlu</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.title}
										onChange={(e) => setFormData({ ...formData, title: e.target.value })}
										required
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Descriere</label>
									<textarea
										className="va-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										required
										rows={4}
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Tip</label>
									<select
										className="va-form-input"
										value={formData.type}
										onChange={(e) => setFormData({ ...formData, type: e.target.value })}
										required
									>
										<option value="curs">Curs</option>
										<option value="workshop">Workshop</option>
										<option value="examen">Examen</option>
										<option value="webinar">Webinar</option>
										<option value="eveniment">Eveniment</option>
									</select>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Data și Ora Început</label>
									<input
										type="datetime-local"
										className="va-form-input"
										value={formData.start_date}
										onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
										required
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Data și Ora Sfârșit</label>
									<input
										type="datetime-local"
										className="va-form-input"
										value={formData.end_date}
										onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
										required
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Locație</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.location}
										onChange={(e) => setFormData({ ...formData, location: e.target.value })}
										placeholder="Online sau adresă fizică"
									/>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
									<button
										type="button"
										className="va-btn"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="va-btn va-btn-primary">
										Salvează
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminEventsPage;

