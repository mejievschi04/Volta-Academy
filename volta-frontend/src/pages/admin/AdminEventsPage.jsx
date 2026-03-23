import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';
import ConfirmModal from '../../components/common/ConfirmModal';
import AdminEventListCard from '../../components/admin/events/AdminEventListCard';

const AdminEventsPage = () => {
	const { success: showSuccess, error: showError } = useToast();
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
	const [bulkConfirm, setBulkConfirm] = useState(null); // { action, count }
	
	// Insights
	const [insights, setInsights] = useState(null);
	const [instructors, setInstructors] = useState([]);
	
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
			logger.error(`Error ${action} event:`, err);
			showError(`Eroare la ${action}: ${err.response?.data?.message || err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	// Bulk actions
	const handleBulkActionClick = (action) => {
		if (selectedEvents.size === 0) return;
		setBulkConfirm({ action, count: selectedEvents.size });
	};

	const handleConfirmBulkAction = async () => {
		if (!bulkConfirm) return;
		const { action } = bulkConfirm;
		setActionLoading('bulk');
		try {
			await adminService.eventBulkAction(action, Array.from(selectedEvents));
			setBulkConfirm(null);
			setSelectedEvents(new Set());
			await fetchEvents();
			await fetchInsights();
			showSuccess(`${action} efectuat cu succes`);
		} catch (err) {
			logger.error(`Error bulk ${action}:`, err);
			showError(`Eroare la ${action} în masă: ${err.response?.data?.message || err.message}`);
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
			showError('Eroare la salvarea evenimentului: ' + errorMessage);
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
			logger.error('Error deleting event:', err);
			showError('Eroare la ștergerea evenimentului');
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

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container admin-events-page">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Gestionare Evenimente</h1>
					<p className="admin-page-subtitle">Gestionează toate evenimentele din platformă</p>
				</div>
				<button
					className="lms-btn-primary"
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
							course_id: null,
							replay_url: '',
							thumbnail: '',
						});
						setErrors({});
						setTouched({});
						setShowModal(true);
					}}
				>
					+ Adaugă Eveniment Nou
				</button>
			</div>

			{/* Search and Filters */}
			<div className="admin-courses-toolbar">
				<div className="admin-courses-search">
					<input
						type="text"
						className="admin-search-input"
						placeholder="Caută evenimente..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					{searchQuery && (
						<button
							className="admin-search-clear-btn"
							onClick={() => setSearchQuery('')}
							aria-label="Golește căutarea"
						>
							×
						</button>
					)}
				</div>
				<div className="admin-courses-actions">
					<select
						className="admin-filter-select"
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
						className="admin-filter-select"
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
							className={`lms-btn-secondary lms-btn-sm ${viewMode === 'list' ? 'active' : ''}`}
							onClick={() => setViewMode('list')}
						>
							📋 Listă
						</button>
						<button
							className={`lms-btn-secondary lms-btn-sm ${viewMode === 'calendar' ? 'active' : ''}`}
							onClick={() => setViewMode('calendar')}
						>
							📅 Calendar
						</button>
					</div>
				</div>
			</div>

			{error && (
				<div className="lms-error-message">
					{error}
				</div>
			)}


			{/* Bulk Actions Toolbar */}
			{selectedEvents.size > 0 && (
				<div className="admin-bulk-actions-bar">
					<div className="admin-bulk-actions-info">
						<strong>{selectedEvents.size}</strong> eveniment(e) selectat(e)
					</div>
					<div className="admin-bulk-actions-buttons">
						<button
							type="button"
							className="lms-btn-secondary lms-btn-sm"
							onClick={() => handleBulkActionClick('publish')}
							disabled={actionLoading === 'bulk'}
						>
							Publică
						</button>
						<button
							type="button"
							className="lms-btn-secondary lms-btn-sm"
							onClick={() => handleBulkActionClick('unpublish')}
							disabled={actionLoading === 'bulk'}
						>
							Retrage
						</button>
						<button
							type="button"
							className="lms-btn-secondary lms-btn-sm"
							onClick={() => handleBulkActionClick('cancel')}
							disabled={actionLoading === 'bulk'}
						>
							Anulează
						</button>
						<button
							type="button"
							className="lms-btn-secondary lms-btn-sm va-btn-danger"
							onClick={() => handleBulkActionClick('delete')}
							disabled={actionLoading === 'bulk'}
						>
							Șterge
						</button>
						<button
							type="button"
							className="lms-btn-secondary lms-btn-sm"
							onClick={() => setSelectedEvents(new Set())}
						>
							Anulează selecția
						</button>
					</div>
				</div>
			)}

			{viewMode === 'calendar' ? (() => {
				const days = getDaysInMonth(currentDate);
				const weeks = Math.ceil(days.length / 7);
				return (
				<div className="admin-events-calendar">
					<div>
						<div className="admin-events-calendar-header">
							<button className="lms-btn-secondary lms-btn-sm" onClick={() => navigateMonth(-1)}>
								← Anterior
							</button>
							<h2 className="admin-events-calendar-month">{getMonthName(currentDate)}</h2>
							<div className="admin-events-calendar-header-actions">
								<button className="lms-btn-secondary lms-btn-sm" onClick={goToToday}>
									Astăzi
								</button>
								<button className="lms-btn-secondary lms-btn-sm" onClick={() => navigateMonth(1)}>
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
				<div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
					{events.length > 0 ? (
						<div className="aev-list-grid">
							{events.map((event) => (
								<AdminEventListCard
									key={event.id}
									event={event}
									selected={selectedEvents.has(event.id)}
									onSelectChange={(checked) => handleSelectEvent(event.id, checked)}
									busy={actionLoading === event.id}
									formatDate={formatDate}
									calculateDuration={calculateDuration}
									onQuickAction={handleQuickAction}
									onEdit={handleEdit}
									onDelete={handleDelete}
								/>
							))}
						</div>
					) : (
						<div className="lms-empty-state">
							<div className="lms-empty-icon">📅</div>
							<h3 className="lms-empty-title">Nu există evenimente</h3>
							<p className="lms-empty-description">
								{searchQuery || filters.status !== 'all' || filters.type !== 'all'
									? 'Încearcă să modifici filtrele sau căutarea'
									: 'Creează primul eveniment pentru a începe'}
							</p>
							{!searchQuery && filters.status === 'all' && filters.type === 'all' && (
								<button
									className="lms-btn-primary"
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
											course_id: null,
											replay_url: '',
											thumbnail: '',
										});
										setErrors({});
										setTouched({});
										setShowModal(true);
									}}
								>
									<span className="admin-btn-icon">+</span>
									Adaugă Eveniment Nou
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{showModal && (
				<div
					className="admin-event-modal-overlay"
								onClick={(e) => {
									if (e.target === e.currentTarget) {
										setShowModal(false);
										setErrors({});
										setTouched({});
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
								<section className="admin-form-section">
									<h3 className="admin-form-section-title">Detalii eveniment</h3>
									<div className="admin-form-group">
										<label className="admin-form-label">
											<span>📝</span>
											<span>Titlu</span>
										</label>
										<input
											type="text"
											className="admin-form-input admin-event-input"
											value={formData.title}
											onChange={(e) => {
												setFormData({ ...formData, title: e.target.value });
												if (touched.title) validate();
											}}
											onBlur={() => {
												setTouched({ ...touched, title: true });
												validate();
											}}
											placeholder="Titlul evenimentului"
											required
										/>
										{errors.title && touched.title && (
											<div className="admin-event-error">{errors.title}</div>
										)}
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">
											<span>📄</span>
											<span>Descriere</span>
										</label>
										<textarea
											className="admin-form-input admin-event-input"
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
									<div className="admin-form-group">
										<label className="admin-form-label">
											<span>🏷️</span>
											<span>Tip</span>
										</label>
										<select
											className="admin-form-input admin-event-input"
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
								</section>

								<section className="admin-form-section">
									<h3 className="admin-form-section-title">Program</h3>
									<div className="admin-event-datetime-grid">
										<div className="va-form-group">
											<label className="va-form-label">
												<span>🕐</span>
												<span>Data și ora început</span>
											</label>
											<input
												type="datetime-local"
												className="admin-form-input admin-event-input"
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
												<span>Data și ora sfârșit</span>
											</label>
											<input
												type="datetime-local"
												className="admin-form-input admin-event-input"
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
								</section>

								<section className="admin-form-section">
									<h3 className="admin-form-section-title">Locație & acces</h3>
									<div className="admin-form-group">
										<label className="admin-form-label">
											<span>📍</span>
											<span>Locație</span>
										</label>
										<input
											type="text"
											className="admin-form-input admin-event-input"
											value={formData.location}
											onChange={(e) => setFormData({ ...formData, location: e.target.value })}
											placeholder="Adresă sau Online"
										/>
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">
											<span>💰</span>
											<span>Tip acces</span>
										</label>
										<select
											className="admin-form-input admin-event-input"
											value={formData.access_type}
											onChange={(e) => {
												setFormData({ 
													...formData, 
													access_type: e.target.value,
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
											<option value="course_included">Inclus în curs</option>
										</select>
									</div>
									{formData.access_type === 'course_included' && (
										<div className="va-form-group">
											<label className="va-form-label">
												<span>📚</span>
												<span>Curs asociat</span>
											</label>
											<select
												className="admin-form-input admin-event-input"
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
								</section>

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
						background: 'rgba(0, 0, 0, 0.3)',
						backdropFilter: 'blur(10px)',
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
						<div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
							<button
								type="button"
								className="lms-btn-secondary"
								onClick={() => setShowDeleteConfirm(null)}
							>
								Anulează
							</button>
							<button
								type="button"
								className="lms-btn-secondary va-btn-danger"
								onClick={() => {
									if (showDeleteConfirm) {
										confirmDelete();
									}
								}}
							>
								Șterge
							</button>
						</div>
					</div>
				</div>
			)}

			<ConfirmModal
				open={!!bulkConfirm}
				onClose={() => setBulkConfirm(null)}
				onConfirm={handleConfirmBulkAction}
				title="Acțiune în masă"
				message={bulkConfirm ? `Sigur dorești să ${bulkConfirm.action} ${bulkConfirm.count} eveniment(e)?` : ''}
				confirmLabel={bulkConfirm?.action === 'delete' ? 'Șterge' : 'Confirmă'}
				cancelLabel="Anulare"
				variant={bulkConfirm?.action === 'delete' ? 'danger' : 'primary'}
				loading={actionLoading === 'bulk'}
			/>
		</div>
	);
};

export default AdminEventsPage;

