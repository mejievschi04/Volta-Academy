import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AdminCalendarDrawer from './AdminCalendarDrawer';
import NotificationsDrawer from '../common/NotificationsDrawer';
import { countPrimite } from '../../utils/notificationInboxStorage';

const AdminTopNavControls = () => {
	const { user } = useAuth();
	const showEventsCalendar = user?.actualRole !== 'instructor';
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [apiItems, setApiItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [inboxTick, setInboxTick] = useState(0);
	const location = useLocation();

	const loadNotifications = useCallback(async () => {
		if (!location.pathname.startsWith('/admin')) return;
		try {
			setLoading(true);
			const data = await adminService.getDashboard({ period: 'month' });
			setApiItems(Array.isArray(data?.notifications) ? data.notifications : []);
		} catch (err) {
			console.error('Error loading notifications:', err);
			setApiItems([]);
		} finally {
			setLoading(false);
		}
	}, [location.pathname]);

	useEffect(() => {
		loadNotifications();
	}, [loadNotifications]);

	useEffect(() => {
		if (!location.pathname.startsWith('/admin')) return undefined;
		const intervalId = window.setInterval(() => {
			loadNotifications();
		}, 30000);
		const onVisibilityChange = () => {
			if (!document.hidden) loadNotifications();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	}, [location.pathname, loadNotifications]);

	const onLocalStateChange = useCallback(() => setInboxTick((t) => t + 1), []);

	const primiteCount = useMemo(() => countPrimite(apiItems, 'admin'), [apiItems, inboxTick]);

	return (
		<>
			<div className="admin-topnav-search">
				<input
					type="text"
					placeholder="Căută utilizatori, cursuri, evenimente..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="admin-topnav-search-input"
					aria-label="Caută utilizatori, cursuri, evenimente"
				/>
			</div>

			<div className="admin-topnav-trailing-icons">
				{showEventsCalendar && (
					<>
						<button
							type="button"
							className="admin-topnav-calendar-btn"
							onClick={() => setCalendarOpen(true)}
							aria-label="Deschide calendarul de evenimente"
							title="Calendar evenimente"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
								<line x1="16" y1="2" x2="16" y2="6" />
								<line x1="8" y1="2" x2="8" y2="6" />
								<line x1="3" y1="10" x2="21" y2="10" />
							</svg>
						</button>
						<AdminCalendarDrawer open={calendarOpen} onClose={() => setCalendarOpen(false)} />
					</>
				)}
				<div className="admin-topnav-notifications">
					<button
						type="button"
						className="admin-topnav-notification-btn"
						onClick={() => setDrawerOpen(true)}
						aria-label="Deschide notificările"
						aria-expanded={drawerOpen}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
							<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
							<path d="M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
						{primiteCount > 0 && <span className="admin-topnav-notification-badge">{primiteCount}</span>}
					</button>
					<NotificationsDrawer
						open={drawerOpen}
						onClose={() => setDrawerOpen(false)}
						variant="admin"
						apiItems={apiItems}
						loading={loading}
						onLocalStateChange={onLocalStateChange}
					/>
				</div>
			</div>
		</>
	);
};

export default AdminTopNavControls;
