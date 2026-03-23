import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { dashboardService } from '../../services/api';

const DISMISSED_NOTIFICATIONS_KEY = 'va_dismissed_student_notifications';

const getDismissedNotifications = () => {
	try {
		const raw = localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
	} catch {
		return new Set();
	}
};

const saveDismissedNotifications = (idsSet) => {
	try {
		localStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify(Array.from(idsSet)));
	} catch {
		// ignore storage errors
	}
};

const StudentTopNavNotifications = () => {
	const [notifications, setNotifications] = useState([]);
	const [showNotifications, setShowNotifications] = useState(false);
	const notificationsRef = useRef(null);
	const location = useLocation();

	useEffect(() => {
		const loadNotifications = async () => {
			try {
				const data = await dashboardService.getStudentDashboard();
				const allNotifications = data?.notifications || [];
				const dismissed = getDismissedNotifications();
				const visible = allNotifications.filter((n) => !dismissed.has(String(n.id)));
				setNotifications(visible);
			} catch (err) {
				console.error('Error loading student notifications:', err);
			}
		};
		loadNotifications();
	}, [location.pathname]);

	const dismissByIds = useCallback((ids) => {
		if (!ids?.length) return;
		const dismissed = getDismissedNotifications();
		ids.forEach((id) => dismissed.add(String(id)));
		saveDismissedNotifications(dismissed);
		setNotifications((prev) => prev.filter((n) => !ids.map(String).includes(String(n.id))));
	}, []);

	const handleClearAll = useCallback(
		(e) => {
			e.preventDefault();
			e.stopPropagation();
			dismissByIds(notifications.map((n) => n.id));
		},
		[notifications, dismissByIds]
	);

	const handleNotificationRead = useCallback(
		(notifId) => {
			dismissByIds([notifId]);
		},
		[dismissByIds]
	);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
				setShowNotifications(false);
			}
		};
		if (showNotifications) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showNotifications]);

	const notificationCount = notifications.length;

	return (
		<div className="va-topnav-notifications admin-topnav-notifications" ref={notificationsRef}>
			<button
				className="admin-topnav-notification-btn"
				onClick={() => setShowNotifications((prev) => !prev)}
				aria-label="Notificări"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
				{notificationCount > 0 && (
					<span className="admin-topnav-notification-badge">{notificationCount}</span>
				)}
			</button>
			{showNotifications && (
				<div className="va-topnav-notifications-dropdown admin-topnav-notifications-dropdown">
					<div className="admin-topnav-notifications-header va-topnav-notifications-header-row">
						<h3>Notificări</h3>
						{notifications.length > 0 && (
							<button
								type="button"
								className="va-topnav-notifications-clear-btn"
								onClick={handleClearAll}
							>
								Curăță
							</button>
						)}
					</div>
					{notifications.length > 0 ? (
						<div className="admin-topnav-notifications-list">
							{notifications.slice(0, 8).map((notif) => {
								const content = (
									<>
										<div className="admin-topnav-notification-icon">
											{notif.type === 'pending_exam' ? (
												<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
													<polyline points="14 2 14 8 20 8"/>
													<line x1="16" y1="13" x2="8" y2="13"/>
													<line x1="16" y1="17" x2="8" y2="17"/>
													<polyline points="10 9 9 9 8 9"/>
												</svg>
											) : (
												<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<path d="M12 2L2 7l10 5 10-5-10-5z"/>
													<path d="M2 17l10 5 10-5"/>
												</svg>
											)}
										</div>
										<div className="admin-topnav-notification-content">
											<div className="admin-topnav-notification-title">{notif.title}</div>
											{notif.message && (
												<div className="admin-topnav-notification-time">{notif.message}</div>
											)}
										</div>
									</>
								);
								return notif.link ? (
									<Link
										key={notif.id}
										to={notif.link}
										className="admin-topnav-notification-item"
										onClick={() => {
											handleNotificationRead(notif.id);
											setShowNotifications(false);
										}}
									>
										{content}
									</Link>
								) : (
									<button
										key={notif.id}
										type="button"
										className="admin-topnav-notification-item va-topnav-notification-item-plain"
										onClick={() => handleNotificationRead(notif.id)}
									>
										{content}
									</button>
								);
							})}
						</div>
					) : (
						<div className="admin-topnav-notifications-empty">
							Nu ai notificări noi
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default StudentTopNavNotifications;
