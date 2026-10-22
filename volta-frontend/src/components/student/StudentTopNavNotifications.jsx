import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationsService } from '../../services/api';
import { useBadges } from '../../utils/badges';
import { countPrimite } from '../../utils/notificationInboxStorage';
import NotificationsDrawer from '../common/NotificationsDrawer';
import { Bell } from '@phosphor-icons/react';


const StudentTopNavNotifications = () => {
	const [apiItems, setApiItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [inboxTick, setInboxTick] = useState(0);
	const serverUnread = useBadges().notifications;

	const loadFull = useCallback(async () => {
		try {
			setLoading(true);
			// Doar notificările salvate (ex. curs atribuit), fără dashboard-ul complet al elevului.
			const items = await notificationsService.list({ unread_only: 1, limit: 20 });
			setApiItems(Array.isArray(items) ? items : []);
		} catch (err) {
			console.error('Error loading student notifications:', err);
			setApiItems([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (drawerOpen) loadFull();
	}, [drawerOpen, loadFull]);

	const onLocalStateChange = useCallback(() => setInboxTick((t) => t + 1), []);

	const localPrimite = useMemo(() => countPrimite(apiItems, 'student'), [apiItems, inboxTick]);
	const primiteCount = drawerOpen || apiItems.length > 0 ? localPrimite : Math.max(serverUnread, localPrimite);

	return (
		<div className="va-topnav-notifications admin-topnav-notifications">
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
				variant="student"
				apiItems={apiItems}
				loading={loading}
				onLocalStateChange={onLocalStateChange}
				onRefresh={loadFull}
			/>
		</div>
	);
};

export default StudentTopNavNotifications;
