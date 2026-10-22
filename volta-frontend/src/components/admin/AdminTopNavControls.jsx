import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { notificationsService } from '../../services/api';
import { useBadges } from '../../utils/badges';

import { useAuth } from '../../contexts/AuthContextShared.js';
import AdminCalendarDrawer from './AdminCalendarDrawer';
import NotificationsDrawer from '../common/NotificationsDrawer';
import { countPrimite } from '../../utils/notificationInboxStorage';
import { Bell, CalendarDots } from '@phosphor-icons/react';

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
	const isAdminArea = location.pathname.startsWith('/admin');
	const serverUnread = useBadges(isAdminArea).notifications;

	const loadNotifications = useCallback(async () => {
		try {
			setLoading(true);
			// Doar lista de notificări; înainte se încărca tot dashboard-ul (statistici grele) pentru ea.
			const items = await notificationsService.list({ unread_only: 1, limit: 20 });
			setApiItems(Array.isArray(items) ? items : []);
		} catch (err) {
			console.error('Error loading notifications:', err);
			setApiItems([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (drawerOpen && isAdminArea) loadNotifications();
	}, [drawerOpen, isAdminArea, loadNotifications]);

	const onLocalStateChange = useCallback(() => setInboxTick((t) => t + 1), []);

	const localPrimite = useMemo(() => countPrimite(apiItems, 'admin'), [apiItems, inboxTick]);
	const primiteCount = drawerOpen || apiItems.length > 0 ? localPrimite : Math.max(serverUnread, localPrimite);

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
							<CalendarDots size={20} weight="duotone" aria-hidden />
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
						<Bell size={20} weight="duotone" aria-hidden />
						{primiteCount > 0 && <span className="admin-topnav-notification-badge">{primiteCount}</span>}
					</button>
					<NotificationsDrawer
						open={drawerOpen}
						onClose={() => setDrawerOpen(false)}
						variant="admin"
						apiItems={apiItems}
						loading={loading}
						onLocalStateChange={onLocalStateChange}
						onRefresh={loadNotifications}
					/>
				</div>
			</div>
		</>
	);
};

export default AdminTopNavControls;
