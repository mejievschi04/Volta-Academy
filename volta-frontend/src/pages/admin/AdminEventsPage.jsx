import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';

import { useToast } from '../../contexts/ToastContextShared.js';
import { logger } from '../../utils/logger';
import AdminEventListCard from '../../components/admin/events/AdminEventListCard';
import AdminEventFormModal from '../../components/admin/events/AdminEventFormModal';
import AdminEventDetailModal from '../../components/admin/events/AdminEventDetailModal';
import { EventListNavigation, EventListPagination } from '../../components/common/EventListNavigation';

import { useAuth } from '../../contexts/AuthContextShared.js';
import { scrollElementToTop } from '../../utils/scrollToTop';

const AdminEventsPage = () => {
	const { canMutateInAdminArea, user } = useAuth();
	const { error: showError } = useToast();
	// Raportul de prezență arată toți angajații: doar admin / analist
	const canDownloadAttendance = user?.role === 'admin' || user?.role === 'analyst';
	const currentYear = new Date().getFullYear();
	const [reportYear, setReportYear] = useState(currentYear);
	const [reportLoading, setReportLoading] = useState(false);
	const downloadAttendanceReport = async () => {
		setReportLoading(true);
		try {
			await adminService.downloadEventAttendanceReport(reportYear);
		} catch (err) {
			logger.error('Attendance report failed', err);
			showError('Raportul de prezență nu a putut fi descărcat.');
		} finally {
			setReportLoading(false);
		}
	};
	const [events, setEvents] = useState([]);
	const [history, setHistory] = useState(false);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [refreshKey, setRefreshKey] = useState(0);
	const requestId = useRef(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingEvent, setEditingEvent] = useState(null);
	const [viewingEventId, setViewingEventId] = useState(null);

	const [searchParams, setSearchParams] = useSearchParams();
	// căutarea globală din bara de sus deschide pagina cu evenimentul căutat (?search=)
	const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
	const eventsPanelRef = useRef(null);

	useLayoutEffect(() => {
		scrollElementToTop(eventsPanelRef.current);
	}, [history, page]);

	const fetchEvents = useCallback(async ({ silent = false } = {}) => {
		const id = ++requestId.current;
		try {
			if (!silent) setLoading(true);
			const params = {
				search: searchQuery,
				date_filter: history ? 'past' : 'active',
				sort_by: 'start_date',
				sort_direction: history ? 'desc' : 'asc',
				per_page: 50,
				page,
			};
			const data = await adminService.getEvents(params);
			if (requestId.current !== id) return;
			setError(null);
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
	}, [history, page, searchQuery]);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			fetchEvents();
		}, 300);
		return () => {
			clearTimeout(timeoutId);
			requestId.current += 1;
		};
	}, [fetchEvents, refreshKey]);

	useEffect(() => {
		if (history) return undefined;
		const id = window.setInterval(() => {
			if (!document.hidden) fetchEvents({ silent: true });
		}, 60_000);
		return () => window.clearInterval(id);
	}, [fetchEvents, history]);

	useEffect(() => {
		const onRefresh = () => {
			setRefreshKey((key) => key + 1);
		};
		window.addEventListener('volta-admin-events-refresh', onRefresh);
		return () => window.removeEventListener('volta-admin-events-refresh', onRefresh);
	}, []);

	useEffect(() => {
		const raw = Number(searchParams.get('event'));
		if (Number.isFinite(raw) && raw > 0) {
			setViewingEventId(raw);
		}
	}, [searchParams]);

	const closeEventDetail = () => {
		setViewingEventId(null);
		if (!searchParams.get('event')) return;
		const next = new URLSearchParams(searchParams);
		next.delete('event');
		setSearchParams(next, { replace: true });
	};

	const handleView = (event) => {
		setViewingEventId(event.id);
	};

	const handleEdit = (event) => {
		setViewingEventId(null);
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
			setRefreshKey((key) => key + 1);
		} catch (err) {
			logger.error('Error deleting event:', err);
			showError('Eroare la ștergerea evenimentului');
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
		if (!parts) return dateString;

		const [, year, month, day, hour, minute] = parts;
		return `${day}.${month}.${year}, ${hour}:${minute}`;
	};

	const calculateDuration = (startDateString, endDateString) => {
		if (!startDateString || !endDateString) return '';

		try {
			const startMatch = startDateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
			const endMatch = endDateString.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);

			if (!startMatch || !endMatch) return '';

			const start = new Date(
				parseInt(startMatch[1], 10),
				parseInt(startMatch[2], 10) - 1,
				parseInt(startMatch[3], 10),
				parseInt(startMatch[4], 10),
				parseInt(startMatch[5], 10),
			);
			const end = new Date(
				parseInt(endMatch[1], 10),
				parseInt(endMatch[2], 10) - 1,
				parseInt(endMatch[3], 10),
				parseInt(endMatch[4], 10),
				parseInt(endMatch[5], 10),
			);

			const durationMinutes = Math.round((end - start) / 60000);
			const hours = Math.floor(durationMinutes / 60);
			const minutes = durationMinutes % 60;
			const hourLabel = hours === 1 ? 'ora' : 'ore';

			if (hours > 0 && minutes > 0) {
				return `${hours} ${hourLabel} ${minutes} min`;
			}
			if (hours > 0) {
				return `${hours} ${hourLabel}`;
			}
			return `${minutes} min`;
		} catch {
			return '';
		}
	};

	const renderEventGrid = (list) => (
		<div className="aev-list-grid">
			{list.map((event) => (
				<AdminEventListCard
					key={event.id}
					event={event}
					formatDate={formatDate}
					calculateDuration={calculateDuration}
					onView={handleView}
					onEdit={handleEdit}
					onDelete={handleDelete}
					readOnly={!canMutateInAdminArea}
				/>
			))}
		</div>
	);

	const filtersActive = Boolean(searchQuery);
	const updateSearch = (value) => {
		if (value === searchQuery) return;
		setLoading(true);
		setPage(1);
		setSearchQuery(value);
	};

	return (
		<div className="admin-container admin-events-page">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Gestionare Evenimente</h1>
				</div>
				<div className="admin-events-header-actions">
					{canDownloadAttendance && (
						<div className="admin-events-report">
							<select
								className="admin-events-report-year"
								aria-label="Anul raportului de prezență"
								value={reportYear}
								onChange={(e) => setReportYear(Number(e.target.value))}
								disabled={reportLoading}
							>
								{[0, 1, 2, 3].map((back) => (
									<option key={back} value={currentYear - back}>{currentYear - back}</option>
								))}
							</select>
							<button
								type="button"
								className="lms-btn-secondary"
								onClick={downloadAttendanceReport}
								disabled={reportLoading}
								title="Tabel Excel: angajații pe echipe × evenimentele anului, verde = a participat"
							>
								{reportLoading ? 'Se generează…' : 'Raport prezență (.xlsx)'}
							</button>
						</div>
					)}
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
			</div>

			<div className="admin-courses-toolbar">
				<div className="admin-courses-search">
					<input
						type="text"
						className="admin-search-input"
						placeholder="Caută evenimente..."
						aria-label="Caută evenimente"
						value={searchQuery}
						onChange={(e) => updateSearch(e.target.value)}
					/>
					{searchQuery && (
						<button
							className="admin-search-clear-btn"
							onClick={() => updateSearch('')}
							aria-label="Golește căutarea"
							type="button"
						>
							×
						</button>
					)}
				</div>
			</div>
			<EventListNavigation history={history} onChange={(nextHistory) => {
				if (nextHistory === history) return;
				setLoading(true);
				setPage(1);
				setHistory(nextHistory);
			}} />

			{error && <div className="lms-error-message">{error}</div>}

			<div
				ref={eventsPanelRef}
				id="admin-events-panel"
				style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
			>
				{loading && (
					<div className="lms-dashboard-loading" role="status" aria-label="Se încarcă evenimentele">
						<div className="lms-spinner"></div>
					</div>
				)}
				{!loading && !error && (events.length === 0 ? (
					<div className="lms-empty-state">
						<div className="lms-empty-icon">📅</div>
						<h3 className="lms-empty-title">{history && !filtersActive ? 'Istoricul este gol' : 'Nu există evenimente'}</h3>
						<p className="lms-empty-description">
							{filtersActive
								? 'Încearcă să modifici căutarea'
								: history ? 'Evenimentele încheiate vor apărea aici.' : 'Nu sunt programate evenimente momentan.'}
						</p>
						{!history && !filtersActive && canMutateInAdminArea && (
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
				) : (
					renderEventGrid(events)
				))}
				{!error && (
					<EventListPagination page={page} lastPage={lastPage} loading={loading} onChange={(nextPage) => {
						setLoading(true);
						setPage(nextPage);
					}} />
				)}
			</div>

			<AdminEventDetailModal
				open={viewingEventId != null}
				eventId={viewingEventId}
				onClose={closeEventDetail}
				onEdit={canMutateInAdminArea ? handleEdit : undefined}
				readOnly={!canMutateInAdminArea}
			/>

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
						setRefreshKey((key) => key + 1);
					}}
				/>
			)}

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
					role="presentation"
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
						onClick={(e) => e.stopPropagation()}
						role="presentation"
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
								className="lms-btn-secondary va-btn-delete va-btn-danger"
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
		</div>
	);
};

export default AdminEventsPage;
