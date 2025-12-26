import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/api';
import { formatCurrency, getDefaultCurrency } from '../../utils/currency';

const AdminEventsPage = () => {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingEvent, setEditingEvent] = useState(null);
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState('list'); // 'calendar' or 'list' - default 'list'
	
	// Filters and search
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		status: 'all',
		type: 'all',
		access_type: 'all',
		instructor: 'all',
		date_from: '',
		date_to: '',
	});
	const [sortBy, setSortBy] = useState('start_date');
	const [sortDirection, setSortDirection] = useState('asc');
	
	// Bulk actions
	const [selectedEvents, setSelectedEvents] = useState(new Set());
	const [actionLoading, setActionLoading] = useState(null);
	
	// Insights
	const [insights, setInsights] = useState(null);
	const [instructors, setInstructors] = useState([]);
	
	// Currency
	const [currency, setCurrency] = useState(getDefaultCurrency());
	
	// Form data - extended with all new fields
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		short_description: '',
		type: 'live_online',
		status: 'draft',
		start_date: '',
		end_date: '',
		timezone: 'Europe/Bucharest',
		location: '',
		live_link: '',
		max_capacity: null,
		instructor_id: null,
		access_type: 'free',
		price: null,
		currency: 'RON',
		course_id: null,
		replay_url: '',
		thumbnail: '',
	});
	const [errors, setErrors] = useState({});
	const [touched, setTouched] = useState({});
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
	
	// Courses list for course_included access type
	const [courses, setCourses] = useState([]);

	useEffect(() => {
		fetchEvents();
		fetchInsights();
		fetchInstructors();
		fetchCourses();
		
		// Listen for currency changes
		const handleCurrencyChange = () => {
			setCurrency(getDefaultCurrency());
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, []);

	// Fetch courses for course_included access type
	const fetchCourses = async () => {
		try {
			const data = await adminService.getCourses({ per_page: 1000 });
			setCourses(Array.isArray(data) ? data : (data?.data || []));
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	// Fetch instructors
	const fetchInstructors = async () => {
		try {
			const data = await adminService.getEventInstructors();
			setInstructors(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching instructors:', err);
		}
	};

	// Fetch insights
	const fetchInsights = async () => {
		try {
			const data = await adminService.getEventInsights();
			setInsights(data);
		} catch (err) {
			console.error('Error fetching insights:', err);
		}
	};

	// Fetch events with filters
	const fetchEvents = useCallback(async () => {
		try {
			setLoading(true);
			const params = {
				search: searchQuery,
				status: filters.status !== 'all' ? filters.status : null,
				type: filters.type !== 'all' ? filters.type : null,
				access_type: filters.access_type !== 'all' ? filters.access_type : null,
				instructor: filters.instructor !== 'all' ? filters.instructor : null,
				date_from: filters.date_from || null,
				date_to: filters.date_to || null,
				sort_by: sortBy,
				sort_direction: sortDirection,
			};
			const data = await adminService.getEvents(params);
			setEvents(Array.isArray(data) ? data : (data?.data || []));
		} catch (err) {
			console.error('Error fetching events:', err);
			setError('Nu s-au putut încărca evenimentele');
		} finally {
			setLoading(false);
		}
	}, [searchQuery, filters, sortBy, sortDirection]);

	// Update events when filters change
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			fetchEvents();
		}, 300); // Debounce search

		return () => clearTimeout(timeoutId);
	}, [fetchEvents]);

	// Quick actions
	const handleQuickAction = async (eventId, action) => {
		setActionLoading(eventId);
		try {
			await adminService.eventQuickAction(eventId, action);
			await fetchEvents();
			await fetchInsights();
		} catch (err) {
			console.error(`Error ${action} event:`, err);
			alert(`Eroare la ${action}: ${err.response?.data?.message || err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	// Bulk actions
	const handleBulkAction = async (action) => {
		if (selectedEvents.size === 0) return;
		
		if (!confirm(`Sigur dorești să ${action} ${selectedEvents.size} eveniment(e)?`)) {
			return;
		}

		setActionLoading('bulk');
		try {
			await adminService.eventBulkAction(action, Array.from(selectedEvents));
			setSelectedEvents(new Set());
			await fetchEvents();
			await fetchInsights();
		} catch (err) {
			console.error(`Error bulk ${action}:`, err);
			alert(`Eroare la ${action} în masă: ${err.response?.data?.message || err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	// Select events
	const handleSelectEvent = (eventId, checked) => {
		setSelectedEvents(prev => {
			const newSet = new Set(prev);
			if (checked) {
				newSet.add(eventId);
			} else {
				newSet.delete(eventId);
			}
			return newSet;
		});
	};

	const handleSelectAll = (checked) => {
		if (checked) {
			setSelectedEvents(new Set(events.map(e => e.id)));
		} else {
			setSelectedEvents(new Set());
		}
	};

	// Validate form
	const validate = () => {
		const newErrors = {};
		if (!formData.title || formData.title.trim().length < 3) {
			newErrors.title = 'Titlul trebuie să aibă minim 3 caractere';
		}
		if (!formData.description || formData.description.trim().length < 10) {
			newErrors.description = 'Descrierea trebuie să aibă minim 10 caractere';
		}
		if (!formData.start_date) {
			newErrors.start_date = 'Data și ora de început este obligatorie';
		}
		if (!formData.end_date) {
			newErrors.end_date = 'Data și ora de sfârșit este obligatorie';
		}
		if (formData.start_date && formData.end_date) {
			const start = new Date(formData.start_date);
			const end = new Date(formData.end_date);
			if (end <= start) {
				newErrors.end_date = 'Data de sfârșit trebuie să fie după data de început';
			}
		}
		if (formData.access_type === 'paid' && (!formData.price || formData.price <= 0)) {
			newErrors.price = 'Prețul este obligatoriu pentru evenimente plătite';
		}
		if (formData.access_type === 'course_included' && !formData.course_id) {
			newErrors.course_id = 'Cursul este obligatoriu pentru evenimente incluse în curs';
		}
		if (formData.max_capacity && formData.max_capacity < 1) {
			newErrors.max_capacity = 'Capacitatea maximă trebuie să fie cel puțin 1';
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Calculate form completion percentage
	const completionPercentage = () => {
		let completed = 0;
		const total = 8; // Updated total
		if (formData.title && formData.title.trim().length >= 3) completed++;
		if (formData.description && formData.description.trim().length >= 10) completed++;
		if (formData.type) completed++;
		if (formData.start_date) completed++;
		if (formData.end_date) completed++;
		if (formData.status) completed++;
		if (formData.access_type) completed++;
		if (formData.access_type !== 'paid' || (formData.price && formData.price > 0)) completed++;
		if (formData.access_type !== 'course_included' || formData.course_id) completed++;
		return Math.round((completed / total) * 100);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		
		// Validate before submit
		if (!validate()) {
			return;
		}

		try {
			// Format dates for backend (YYYY-MM-DDTHH:mm format - datetime-local format)
			// Backend expects this format and will convert it to YYYY-MM-DD HH:mm:ss
			const formatDateForBackend = (dateString) => {
				if (!dateString) return null;
				// If already in YYYY-MM-DDTHH:mm format, return as is
				if (dateString.includes('T')) {
					return dateString;
				}
				// Otherwise parse and format
				const date = new Date(dateString);
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, '0');
				const day = String(date.getDate()).padStart(2, '0');
				const hours = String(date.getHours()).padStart(2, '0');
				const minutes = String(date.getMinutes()).padStart(2, '0');
				return `${year}-${month}-${day}T${hours}:${minutes}`;
			};
			
			// Prepare data to send - include all new fields
			const dataToSend = {
				title: formData.title.trim(),
				description: formData.description.trim(),
				short_description: formData.short_description?.trim() || null,
				type: formData.type,
				status: formData.status,
				start_date: formatDateForBackend(formData.start_date),
				end_date: formatDateForBackend(formData.end_date),
				timezone: formData.timezone,
				location: formData.location?.trim() || null,
				live_link: formData.live_link?.trim() || null,
				max_capacity: formData.max_capacity ? parseInt(formData.max_capacity) : null,
				instructor_id: formData.instructor_id || null,
				access_type: formData.access_type,
				price: formData.access_type === 'paid' && formData.price ? parseFloat(formData.price) : null,
				currency: formData.currency,
				course_id: formData.access_type === 'course_included' && formData.course_id ? parseInt(formData.course_id) : null,
				replay_url: formData.replay_url?.trim() || null,
				thumbnail: formData.thumbnail?.trim() || null,
			};

			if (editingEvent) {
				await adminService.updateEvent(editingEvent.id, dataToSend);
			} else {
				await adminService.createEvent(dataToSend);
			}

			setShowModal(false);
			setEditingEvent(null);
			setFormData({
				title: '',
				description: '',
				short_description: '',
				type: 'live_online',
				status: 'draft',
				start_date: '',
				end_date: '',
				timezone: 'Europe/Bucharest',
				location: '',
				live_link: '',
				max_capacity: null,
				instructor_id: null,
				access_type: 'free',
				price: null,
				currency: 'RON',
				course_id: null,
				replay_url: '',
				thumbnail: '',
			});
			setErrors({});
			setTouched({});
			fetchEvents();
			fetchInsights();
		} catch (err) {
			console.error('Error saving event:', err);
			const errorMessage = err.response?.data?.message || 
				(err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : null) ||
				err.message || 
				'Eroare necunoscută';
			alert('Eroare la salvarea evenimentului: ' + errorMessage);
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
			const match = event.end_date.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
			if (match) {
				const [, year, month, day, hour, minute] = match;
				endDate = `${year}-${month}-${day}T${hour}:${minute}`;
			} else {
				endDate = event.end_date.replace(' ', 'T').slice(0, 16);
			}
		}
		
		setFormData({
			title: event.title || '',
			description: event.description || '',
			short_description: event.short_description || '',
			type: event.type || 'live_online',
			status: event.status || 'draft',
			start_date: startDate,
			end_date: endDate,
			timezone: event.timezone || 'Europe/Bucharest',
			location: event.location || '',
			live_link: event.live_link || '',
			max_capacity: event.max_capacity || null,
			instructor_id: event.instructor_id || null,
			access_type: event.access_type || 'free',
			price: event.price || null,
			currency: event.currency || 'RON',
			course_id: event.course_id || null,
			replay_url: event.replay_url || '',
			thumbnail: event.thumbnail || '',
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		setShowDeleteConfirm(id);
	};

	const confirmDelete = async () => {
		if (!showDeleteConfirm) return;

		try {
			await adminService.deleteEvent(showDeleteConfirm);
			setShowDeleteConfirm(null);
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

	const calculateDuration = (startDateString, endDateString) => {
		if (!startDateString || !endDateString) return '';
		
		try {
			// Parse dates directly without timezone conversion
			const startMatch = startDateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
			const endMatch = endDateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
			
			if (!startMatch || !endMatch) return '';
			
			const start = new Date(
				parseInt(startMatch[1]), parseInt(startMatch[2]) - 1, parseInt(startMatch[3]),
				parseInt(startMatch[4]), parseInt(startMatch[5])
			);
			const end = new Date(
				parseInt(endMatch[1]), parseInt(endMatch[2]) - 1, parseInt(endMatch[3]),
				parseInt(endMatch[4]), parseInt(endMatch[5])
			);
			
			const durationMinutes = Math.round((end - start) / 60000);
			const hours = Math.floor(durationMinutes / 60);
			const minutes = durationMinutes % 60;
			
			if (hours > 0 && minutes > 0) {
				return `${hours}h ${minutes}m`;
			} else if (hours > 0) {
				return `${hours}h`;
			} else {
				return `${minutes}m`;
			}
		} catch (err) {
			return '';
		}
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
			duration: 60,
			is_online: true,
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
		<div className="admin-container admin-events-page">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Evenimente</h1>
					<p className="va-muted admin-page-subtitle">Gestionează toate evenimentele din platformă</p>
				</div>
				<div className="admin-events-header-actions">
					{/* Search */}
					<input
						type="text"
						className="admin-events-search"
						placeholder="Caută evenimente..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					{/* Filters */}
					<select
						className="admin-events-filter"
						value={filters.status}
						onChange={(e) => setFilters({ ...filters, status: e.target.value })}
					>
						<option value="all">Toate statusurile</option>
						<option value="draft">Draft</option>
						<option value="published">Publicat</option>
						<option value="upcoming">Viitor</option>
						<option value="live">Live</option>
						<option value="completed">Finalizat</option>
						<option value="cancelled">Anulat</option>
					</select>
					<select
						className="admin-events-filter"
						value={filters.type}
						onChange={(e) => setFilters({ ...filters, type: e.target.value })}
					>
						<option value="all">Toate tipurile</option>
						<option value="live_online">Live Online</option>
						<option value="physical">Fizic</option>
						<option value="webinar">Webinar</option>
						<option value="workshop">Workshop</option>
					</select>
					<div className="admin-events-view-toggle">
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
							setFormData({
								title: '',
								description: '',
								short_description: '',
								type: 'live_online',
								status: 'draft',
								start_date: '',
								end_date: '',
								timezone: 'Europe/Bucharest',
								location: '',
								live_link: '',
								max_capacity: null,
								instructor_id: null,
								access_type: 'free',
								price: null,
								currency: 'RON',
								course_id: null,
								replay_url: '',
								thumbnail: '',
							});
							setErrors({});
							setTouched({});
							setShowModal(true);
						}}
					>
						<span>➕</span>
						<span>Adaugă Eveniment Nou</span>
					</button>
				</div>
			</div>

			{error && (
				<div className="va-auth-error" style={{ marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{/* Insights Section */}
			{insights && (
				<div className="admin-events-insights">
					<h3 className="admin-events-insights-title">📊 Statistici Evenimente</h3>
					<div className="admin-events-insights-grid">
						<div className="admin-events-insight-item">
							<div className="admin-events-insight-label">Total Evenimente</div>
							<div className="admin-events-insight-value">{insights.total_events || 0}</div>
						</div>
						<div className="admin-events-insight-item">
							<div className="admin-events-insight-label">Publicate</div>
							<div className="admin-events-insight-value" style={{ color: 'var(--color-light)' }}>{insights.published_events || 0}</div>
						</div>
						<div className="admin-events-insight-item">
							<div className="admin-events-insight-label">Viitoare</div>
							<div className="admin-events-insight-value" style={{ color: 'var(--color-light)' }}>{insights.upcoming_events || 0}</div>
						</div>
						<div className="admin-events-insight-item">
							<div className="admin-events-insight-label">Total Înscrieri</div>
							<div className="admin-events-insight-value" style={{ color: 'var(--color-light)' }}>{insights.total_registrations || 0}</div>
						</div>
						<div className="admin-events-insight-item">
							<div className="admin-events-insight-label">Prezență Medie</div>
							<div className="admin-events-insight-value" style={{ color: 'var(--color-light)' }}>{insights.average_attendance_rate || 0}%</div>
						</div>
					</div>
				</div>
			)}

			{/* Bulk Actions Toolbar */}
			{selectedEvents.size > 0 && (
				<div className="admin-events-bulk-toolbar">
					<div className="admin-events-bulk-count">
						{selectedEvents.size} eveniment(e) selectat(e)
					</div>
					<div className="admin-events-bulk-actions">
						<button
							className="va-btn va-btn-sm"
							onClick={() => handleBulkAction('publish')}
							disabled={actionLoading === 'bulk'}
						>
							Publică
						</button>
						<button
							className="va-btn va-btn-sm"
							onClick={() => handleBulkAction('unpublish')}
							disabled={actionLoading === 'bulk'}
						>
							Retrage
						</button>
						<button
							className="va-btn va-btn-sm"
							onClick={() => handleBulkAction('cancel')}
							disabled={actionLoading === 'bulk'}
						>
							Anulează
						</button>
						<button
							className="va-btn va-btn-sm admin-btn-danger"
							onClick={() => handleBulkAction('delete')}
							disabled={actionLoading === 'bulk'}
						>
							Șterge
						</button>
						<button
							className="va-btn va-btn-sm"
							onClick={() => setSelectedEvents(new Set())}
						>
							Anulează
						</button>
					</div>
				</div>
			)}

			{viewMode === 'calendar' ? (() => {
				const days = getDaysInMonth(currentDate);
				const weeks = Math.ceil(days.length / 7);
				return (
				<div className="admin-events-calendar">
					<div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
						<div className="admin-events-calendar-header">
							<button className="va-btn va-btn-sm" onClick={() => navigateMonth(-1)}>
								← Anterior
							</button>
							<h2 className="admin-events-calendar-month">{getMonthName(currentDate)}</h2>
							<div style={{ display: 'flex', gap: '0.375rem' }}>
								<button className="va-btn va-btn-sm" onClick={goToToday}>
									Astăzi
								</button>
								<button className="va-btn va-btn-sm" onClick={() => navigateMonth(1)}>
									Următor →
								</button>
							</div>
						</div>

						{/* Weekday header */}
						<div className="admin-events-calendar-weekdays">
							{['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map(day => (
								<div key={day} className="admin-events-calendar-weekday">{day}</div>
							))}
						</div>

						{/* Days grid fills remaining height exactly */}
						<div className="admin-events-calendar-days" style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}>
							{days.map((date, index) => {
								if (!date) {
									return <div key={`empty-${index}`} />;
								}

								const dayEvents = getEventsForDate(date);
								const isToday = date.toDateString() === new Date().toDateString();
								const isCurrentMonth = date.getMonth() === currentDate.getMonth();

								return (
									<div
										key={date.toISOString()}
										className={`admin-events-calendar-day ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
										onClick={() => handleDayClick(date)}
									>
										<div className="admin-events-calendar-day-number">
											{date.getDate()}
										</div>
										<div className="admin-events-calendar-day-events">
											{dayEvents.slice(0, 2).map(event => (
												<div
													key={event.id}
													className="admin-events-calendar-day-event"
													onClick={(e) => {
														e.stopPropagation();
														handleEdit(event);
													}}
													title={event.title}
												>
													{event.title}
												</div>
											))}
											{dayEvents.length > 2 && (
												<div className="admin-events-calendar-day-more">
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
							{events.map((event) => {
								const getStatusColor = (status) => {
									const colors = {
									draft: 'var(--color-dark)',
									published: 'var(--color-dark)',
									upcoming: 'var(--color-dark)',
									live: 'var(--color-dark)',
									completed: 'var(--color-dark)',
									cancelled: 'var(--color-dark)',
								};
								return colors[status] || 'var(--color-dark)';
								};

								const getStatusLabel = (status) => {
									const labels = {
										draft: 'Draft',
										published: 'Publicat',
										upcoming: 'Viitor',
										live: 'Live',
										completed: 'Finalizat',
										cancelled: 'Anulat',
									};
									return labels[status] || status;
								};

								const getTypeLabel = (type) => {
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

								return (
									<div
										key={event.id}
										className="admin-event-card"
									>
										{/* Checkbox for bulk selection */}
										<input
											type="checkbox"
											className="admin-event-card-checkbox"
											checked={selectedEvents.has(event.id)}
											onChange={(e) => handleSelectEvent(event.id, e.target.checked)}
										/>
										<div className="admin-card-body">
											<div className="admin-event-header">
												<h3 className="admin-event-title">📅 {event.title}</h3>
												{event.status && (
													<span className={`admin-event-status ${event.status}`}>
														{getStatusLabel(event.status)}
													</span>
												)}
											</div>
											{event.short_description && (
												<p className="admin-event-description" style={{ marginBottom: '0.5rem' }}>
													{event.short_description}
												</p>
											)}
											<p className="admin-event-description">
												{event.description?.substring(0, 120)}{event.description?.length > 120 ? '...' : ''}
											</p>
											<div className="admin-event-info">
												<div className="admin-event-meta" style={{ marginBottom: '0.5rem' }}>
													<span>🏷️ <strong>{getTypeLabel(event.type)}</strong></span>
													{event.access_type && (
														<span>💰 <strong>{getAccessTypeLabel(event.access_type)}</strong>
															{event.access_type === 'paid' && event.price && (
																<span> - {formatCurrency(event.price, event.currency || currency)}</span>
															)}
														</span>
													)}
												</div>
												{event.instructor && (
													<div className="admin-event-meta" style={{ marginBottom: '0.5rem' }}>👤 <strong>{event.instructor.name}</strong></div>
												)}
												<div className="admin-event-meta" style={{ marginBottom: '0.5rem' }}>📍 <strong>{event.location || event.live_link || 'N/A'}</strong></div>
												<div className="admin-event-meta" style={{ marginBottom: '0.5rem' }}>
													🕐 <strong>{formatDate(event.start_date)}</strong>
													{event.end_date && (
														<span style={{ marginLeft: '0.5rem' }}>
															⏱️ {calculateDuration(event.start_date, event.end_date)}
														</span>
													)}
												</div>
												{/* KPI Metrics */}
												<div className="admin-event-kpis">
													<div className="admin-event-kpi">
														<div className="admin-event-kpi-label">Înscrieri</div>
														<div className="admin-event-kpi-value" style={{ color: 'var(--color-dark)' }}>
															{event.registrations_count || 0}
															{event.max_capacity && ` / ${event.max_capacity}`}
														</div>
													</div>
													<div className="admin-event-kpi">
														<div className="admin-event-kpi-label">Prezență</div>
														<div className="admin-event-kpi-value" style={{ color: 'var(--color-dark)' }}>
															{event.attendance_count || 0}
														</div>
													</div>
													{event.replay_views_count > 0 && (
														<div className="admin-event-kpi">
															<div className="admin-event-kpi-label">Replay</div>
															<div className="admin-event-kpi-value" style={{ color: 'var(--color-dark)' }}>
																{event.replay_views_count}
															</div>
														</div>
													)}
												</div>
											</div>
											<div className="admin-card-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
												{/* Quick Actions */}
												{event.status === 'draft' && (
													<button
														className="va-btn va-btn-sm"
														onClick={() => handleQuickAction(event.id, 'publish')}
														disabled={actionLoading === event.id}
														style={{ background: 'var(--color-dark)', color: 'var(--color-light)' }}
													>
														Publică
													</button>
												)}
												{(event.status === 'published' || event.status === 'upcoming') && (
													<button
														className="va-btn va-btn-sm"
														onClick={() => handleQuickAction(event.id, 'unpublish')}
														disabled={actionLoading === event.id}
														style={{ background: 'var(--color-dark)', color: 'var(--color-light)' }}
													>
														Retrage
													</button>
												)}
												{!['completed', 'cancelled'].includes(event.status) && (
													<button
														className="va-btn va-btn-sm"
														onClick={() => handleQuickAction(event.id, 'cancel')}
														disabled={actionLoading === event.id}
														style={{ background: 'var(--color-dark)', color: 'var(--color-light)' }}
													>
														Anulează
													</button>
												)}
												{['published', 'upcoming', 'live'].includes(event.status) && (
													<button
														className="va-btn va-btn-sm"
														onClick={() => handleQuickAction(event.id, 'complete')}
														disabled={actionLoading === event.id}
														style={{ background: '#8b5cf6', color: '#fff' }}
													>
														Finalizează
													</button>
												)}
												<button
													className="va-btn va-btn-sm"
													onClick={() => handleEdit(event)}
												>
													Editează
												</button>
												<button
													className="va-btn va-btn-sm va-btn-danger"
													onClick={(e) => {
														e.stopPropagation();
														handleDelete(event.id);
													}}
												>
													Șterge
												</button>
											</div>
										</div>
									</div>
								);
							})}
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
					className="admin-event-modal-overlay"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowModal(false);
							setErrors({});
							setTouched({});
							setCurrentStep(1);
						}
					}}
				>
					<div className="admin-event-modal">
						<div className="admin-event-modal-header">
							<h2 className="admin-event-modal-title">
								{editingEvent ? '✏️ Editează Eveniment' : '➕ Adaugă Eveniment Nou'}
							</h2>
							<button
								type="button"
								className="admin-event-modal-close"
								onClick={() => {
									setShowModal(false);
									setErrors({});
									setTouched({});
								}}
								title="Închide"
							>
								×
							</button>
						</div>
						<div className="admin-event-modal-body">
							<form onSubmit={handleSubmit} className="admin-event-form">
								<div className="va-form-group">
									<label className="va-form-label">
										<span>📝</span>
										<span>Titlu</span>
									</label>
									<input
										type="text"
										className="va-form-input admin-event-input"
										value={formData.title}
										onChange={(e) => {
											setFormData({ ...formData, title: e.target.value });
											if (touched.title) validate();
										}}
										onBlur={() => {
											setTouched({ ...touched, title: true });
											validate();
										}}
										placeholder="Ex: Workshop React Advanced"
										required
									/>
									{errors.title && touched.title && (
										<div className="admin-event-error">{errors.title}</div>
									)}
								</div>

								<div className="va-form-group">
									<label className="va-form-label">
										<span>📄</span>
										<span>Descriere</span>
									</label>
									<textarea
										className="va-form-input admin-event-input"
										value={formData.description}
										onChange={(e) => {
											setFormData({ ...formData, description: e.target.value });
											if (touched.description) validate();
										}}
										onBlur={() => {
											setTouched({ ...touched, description: true });
											validate();
										}}
										placeholder="Descrie evenimentul în detaliu..."
										required
										rows={4}
									/>
									{errors.description && touched.description && (
										<div className="admin-event-error">{errors.description}</div>
									)}
								</div>

								<div className="va-form-group">
									<label className="va-form-label">
										<span>🏷️</span>
										<span>Tip</span>
									</label>
									<select
										className="va-form-input admin-event-input"
										value={formData.type}
										onChange={(e) => setFormData({ ...formData, type: e.target.value })}
										required
									>
										<option value="live_online">💻 Live Online</option>
										<option value="physical">🏢 Fizic</option>
										<option value="webinar">📹 Webinar</option>
										<option value="workshop">🔧 Workshop</option>
									</select>
								</div>

								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
									<div className="va-form-group">
										<label className="va-form-label">
											<span>🕐</span>
											<span>Data Început</span>
										</label>
										<input
											type="datetime-local"
											className="va-form-input admin-event-input"
											value={formData.start_date}
											onChange={(e) => {
												setFormData({ ...formData, start_date: e.target.value });
												if (touched.start_date) validate();
											}}
											onBlur={() => {
												setTouched({ ...touched, start_date: true });
												validate();
											}}
											required
										/>
										{errors.start_date && touched.start_date && (
											<div className="admin-event-error">{errors.start_date}</div>
										)}
									</div>

									<div className="va-form-group">
										<label className="va-form-label">
											<span>🕐</span>
											<span>Data Sfârșit</span>
										</label>
										<input
											type="datetime-local"
											className="va-form-input admin-event-input"
											value={formData.end_date}
											onChange={(e) => {
												setFormData({ ...formData, end_date: e.target.value });
												if (touched.end_date) validate();
											}}
											onBlur={() => {
												setTouched({ ...touched, end_date: true });
												validate();
											}}
											required
										/>
										{errors.end_date && touched.end_date && (
											<div className="admin-event-error">{errors.end_date}</div>
										)}
									</div>
								</div>

								<div className="va-form-group">
									<label className="va-form-label">
										<span>💰</span>
										<span>Tip Acces</span>
									</label>
									<select
										className="va-form-input admin-event-input"
										value={formData.access_type}
										onChange={(e) => {
											setFormData({ 
												...formData, 
												access_type: e.target.value,
												price: e.target.value !== 'paid' ? null : formData.price,
												course_id: e.target.value !== 'course_included' ? null : formData.course_id,
											});
											if (touched.access_type) validate();
										}}
										onBlur={() => {
											setTouched({ ...touched, access_type: true });
											validate();
										}}
									>
										<option value="free">Gratuit</option>
										<option value="paid">Plătit</option>
										<option value="course_included">Inclus în curs</option>
									</select>
								</div>

								{formData.access_type === 'paid' && (
									<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
										<div className="va-form-group">
											<label className="va-form-label">
												<span>💵</span>
												<span>Preț</span>
											</label>
											<input
												type="number"
												className="va-form-input admin-event-input"
												value={formData.price || ''}
												onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : null })}
												placeholder="0.00"
												min="0"
												step="0.01"
												required={formData.access_type === 'paid'}
											/>
											{errors.price && (
												<div className="admin-event-error">{errors.price}</div>
											)}
										</div>
										<div className="va-form-group">
											<label className="va-form-label">
												<span>💱</span>
												<span>Valută</span>
											</label>
											<select
												className="va-form-input admin-event-input"
												value={formData.currency}
												onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
											>
												<option value="MDL">MDL</option>
												<option value="RON">RON</option>
												<option value="USD">USD</option>
												<option value="EUR">EUR</option>
											</select>
										</div>
									</div>
								)}

								{formData.access_type === 'course_included' && (
									<div className="va-form-group">
										<label className="va-form-label">
											<span>📚</span>
											<span>Curs Asociat</span>
										</label>
										<select
											className="va-form-input admin-event-input"
											value={formData.course_id || ''}
											onChange={(e) => {
												setFormData({ ...formData, course_id: e.target.value ? parseInt(e.target.value) : null });
												if (touched.course_id) validate();
											}}
											onBlur={() => {
												setTouched({ ...touched, course_id: true });
												validate();
											}}
											required={formData.access_type === 'course_included'}
										>
											<option value="">Selectează curs</option>
											{courses.map(course => (
												<option key={course.id} value={course.id}>
													{course.title}
												</option>
											))}
										</select>
										{errors.course_id && (
											<div className="admin-event-error">{errors.course_id}</div>
										)}
									</div>
								)}

								<div className="admin-event-form-actions">
									<button
										type="button"
										className="admin-event-btn-secondary"
										onClick={() => {
											setShowModal(false);
											setErrors({});
											setTouched({});
										}}
									>
										Anulează
									</button>
									<button 
										type="submit" 
										className="admin-event-btn-primary"
										disabled={completionPercentage() < 100}
									>
										{editingEvent ? 'Actualizează' : 'Creează'}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.7)',
						backdropFilter: 'blur(8px)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 10001,
						padding: '1rem',
					}}
					onClick={() => setShowDeleteConfirm(null)}
				>
					<div
						style={{
							background: 'var(--bg-elevated)',
							border: '1px solid var(--border-primary)',
							borderRadius: 'var(--radius-xl)',
							boxShadow: 'var(--shadow-lg)',
							padding: 'var(--space-6)',
							maxWidth: '400px',
							width: '100%',
						}}
					>
						<h3 style={{ margin: '0 0 var(--space-4) 0', color: 'var(--text-primary)' }}>
							Confirmă ștergerea
						</h3>
						<p style={{ margin: '0 0 var(--space-4) 0', color: 'var(--text-secondary)' }}>
							Ești sigur că vrei să ștergi acest eveniment? Această acțiune nu poate fi anulată.
						</p>
						<div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
							<button
								type="button"
								className="admin-event-btn-secondary"
								onClick={() => setShowDeleteConfirm(null)}
							>
								Anulează
							</button>
							<button
								type="button"
								className="admin-event-btn-primary"
								onClick={() => {
									if (showDeleteConfirm) {
										handleDelete(showDeleteConfirm);
										setShowDeleteConfirm(null);
									}
								}}
							>
								Șterge
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminEventsPage;

