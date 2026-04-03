import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { dashboardService } from '../../services/api';
import { countPrimite } from '../../utils/notificationInboxStorage';
import NotificationsDrawer from '../common/NotificationsDrawer';

const StudentTopNavNotifications = () => {
	const [apiItems, setApiItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [inboxTick, setInboxTick] = useState(0);
	const location = useLocation();

	const load = useCallback(async () => {
		try {
			setLoading(true);
			const data = await dashboardService.getStudentDashboard();
			setApiItems(Array.isArray(data?.notifications) ? data.notifications : []);
		} catch (err) {
			console.error('Error loading student notifications:', err);
			setApiItems([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load, location.pathname]);

	const onLocalStateChange = useCallback(() => setInboxTick((t) => t + 1), []);

	const primiteCount = useMemo(() => countPrimite(apiItems, 'student'), [apiItems, inboxTick]);

	return (
		<div className="va-topnav-notifications admin-topnav-notifications">
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
				variant="student"
				apiItems={apiItems}
				loading={loading}
				onLocalStateChange={onLocalStateChange}
			/>
		</div>
	);
};

export default StudentTopNavNotifications;
