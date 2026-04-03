import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';
import ConfirmModal from '../../components/common/ConfirmModal';
import AdminEventListCard from '../../components/admin/events/AdminEventListCard';
import AdminEventFormModal from '../../components/admin/events/AdminEventFormModal';
import { useAuth } from '../../contexts/AuthContext';

const AdminEventsPage = () => {
	const { canMutateInAdminArea } = useAuth();
	const { success: showSuccess, error: showError } = useToast();
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingEvent, setEditingEvent] = useState(null);
	
	// Filters and search
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		status: 'all',
		type: 'all',
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

	useEffect(() => {
		if (!canMutateInAdminArea) {
			setSelectedEvents(new Set());
		}
	}, [canMutateInAdminArea]);
	
	// Insights
	const [insights, setInsights] = useState(null);

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

	const fetchInsights = useCallback(async () => {
		try {
			const data = await adminService.getEventInsights();
			setInsights(data);
		} catch (err) {
			console.error('Error fetching insights:', err);
		}
	}, []);

	// Fetch events with filters
	const fetchEvents = useCallback(async () => {
		try {
			setLoading(true);
			const params = {
				search: searchQuery,
				status: filters.status !== 'all' ? filters.status : null,
				type: filters.type !== 'all' ? filters.type : null,
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

	useEffect(() => {
		fetchInsights();
	}, [fetchInsights]);

	// Update events when filters change
	useEffect(() => {
		const timeoutId = setTimeout(() => {
			fetchEvents();
		}, 300); // Debounce search

		return () => clearTimeout(timeoutId);
	}, [fetchEvents]);

	useEffect(() => {
		const onRefresh = () => {
			fetchEvents();
			fetchInsights();
		};
		window.addEventListener('volta-admin-events-refresh', onRefresh);
		return () => window.removeEventListener('volta-admin-events-refresh', onRefresh);
	}, [fetchEvents, fetchInsights]);

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

	const handleEdit = (event) => {
		setEditingEvent(event);
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
					<p className="admin-page-subtitle">
						Gestionează toate evenimentele din platformă. Pentru calendar și creare rapidă, folosește iconița de calendar din bara de sus (lângă notificări).
					</p>
				</div>
				{canMutateInAdminArea && (
				<button
					type="button"
					className="lms-btn-primary"
					onClick={() => {
						setEditingEvent(null);
						setShowModal(true);
					}}
				>
					+ Adaugă Eveniment Nou
				</button>
				)}
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
				</div>
			</div>

			{error && (
				<div className="lms-error-message">
					{error}
				</div>
			)}


			{/* Bulk Actions Toolbar */}
			{selectedEvents.size > 0 && canMutateInAdminArea && (
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
									readOnly={!canMutateInAdminArea}
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
							{!searchQuery && filters.status === 'all' && filters.type === 'all' && canMutateInAdminArea && (
								<button
									type="button"
									className="lms-btn-primary"
									onClick={() => {
										setEditingEvent(null);
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

			{showModal && canMutateInAdminArea && (
				<AdminEventFormModal
					open={showModal}
					onClose={() => {
						setShowModal(false);
						setEditingEvent(null);
					}}
					editingEvent={editingEvent}
					prefill={null}
					onSaved={() => {
						fetchEvents();
						fetchInsights();
					}}
				/>
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

