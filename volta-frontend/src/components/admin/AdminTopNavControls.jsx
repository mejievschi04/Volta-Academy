import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../../services/api';

const AdminTopNavControls = () => {
	const [searchQuery, setSearchQuery] = useState('');
	const [notifications, setNotifications] = useState([]);
	const [showNotifications, setShowNotifications] = useState(false);
	const notificationsRef = useRef(null);
	const location = useLocation();

	// Load notifications when on dashboard
	useEffect(() => {
		if (location.pathname === '/admin') {
			const loadNotifications = async () => {
				try {
					const data = await adminService.getDashboard({ period: 'month' });
					setNotifications(data?.notifications || []);
				} catch (err) {
					console.error('Error loading notifications:', err);
				}
			};
			loadNotifications();
		}
	}, [location.pathname]);

	// Close notifications when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
				setShowNotifications(false);
			}
		};

		if (showNotifications) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showNotifications]);

	const criticalNotifications = notifications?.filter(n => n.severity === 'critical') || [];
	const notificationCount = criticalNotifications.length;

	return (
		<>
			{/* Global Search */}
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

			{/* Notifications */}
			<div className="admin-topnav-notifications" ref={notificationsRef}>
				<button 
					className="admin-topnav-notification-btn"
					onClick={() => setShowNotifications(!showNotifications)}
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
					<div className="admin-topnav-notifications-dropdown">
						<div className="admin-topnav-notifications-header">
							<h3>Notificări Critice</h3>
						</div>
						{criticalNotifications.length > 0 ? (
							<div className="admin-topnav-notifications-list">
								{criticalNotifications.slice(0, 5).map((notif) => (
									<div key={notif.id} className="admin-topnav-notification-item">
										<div className="admin-topnav-notification-icon">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
												<path d="M12 9v4"/>
												<path d="M12 17h.01"/>
											</svg>
										</div>
										<div className="admin-topnav-notification-content">
											<div className="admin-topnav-notification-title">{notif.title}</div>
											<div className="admin-topnav-notification-time">
												{new Date(notif.created_at).toLocaleString('ro-RO')}
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="admin-topnav-notifications-empty">
								Nu există notificări critice
							</div>
						)}
					</div>
				)}
			</div>
		</>
	);
};

export default AdminTopNavControls;

