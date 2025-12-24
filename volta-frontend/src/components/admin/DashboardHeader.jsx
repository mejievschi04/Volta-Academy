import React, { useState, useEffect, useRef } from 'react';

const DashboardHeader = ({ 
	period, 
	onPeriodChange, 
	searchQuery, 
	onSearchChange,
	notifications,
	user 
}) => {
	const [showNotifications, setShowNotifications] = useState(false);
	const notificationsRef = useRef(null);

	const periods = [
		{ value: 'today', label: 'Astăzi' },
		{ value: 'week', label: 'Săptămâna aceasta' },
		{ value: 'month', label: 'Luna aceasta' },
		{ value: 'quarter', label: 'Trimestrul acesta' },
		{ value: 'year', label: 'Anul acesta' },
		{ value: 'all', label: 'Toate' },
	];

	const criticalNotifications = notifications?.filter(n => n.severity === 'critical') || [];
	const notificationCount = criticalNotifications.length;

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

	return (
		<header className="admin-dashboard-header">
			<div className="admin-dashboard-header-left">
				<div className="admin-dashboard-title">
					<h1>Dashboard Admin</h1>
					<p className="admin-dashboard-subtitle">
						Centru de comandă business + operațional
					</p>
				</div>
			</div>
			
			<div className="admin-dashboard-header-right">
				<div className="admin-dashboard-controls">
					{/* Period Selector */}
					<div className="admin-period-selector">
						<select 
							value={period} 
							onChange={(e) => onPeriodChange(e.target.value)}
							className="admin-period-select"
						>
							{periods.map(p => (
								<option key={p.value} value={p.value}>{p.label}</option>
							))}
						</select>
					</div>

					{/* Global Search */}
					<div className="admin-search-box">
						<input
							type="text"
							placeholder="Caută utilizatori, cursuri, evenimente..."
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							className="admin-search-input"
						/>
						<span className="admin-search-icon">🔍</span>
					</div>

					{/* Notifications */}
					<div className="admin-notifications" ref={notificationsRef}>
						<button 
							className="admin-notification-btn"
							onClick={() => setShowNotifications(!showNotifications)}
							aria-label="Notifications"
						>
							🔔
							{notificationCount > 0 && (
								<span className="admin-notification-badge">{notificationCount}</span>
							)}
						</button>
						{showNotifications && (
							<div className="admin-notifications-dropdown">
								<div className="admin-notifications-header">
									<h3>Notificări Critice</h3>
								</div>
								{criticalNotifications.length > 0 ? (
									<div className="admin-notifications-list">
										{criticalNotifications.slice(0, 5).map((notif) => (
											<div key={notif.id} className="admin-notification-item">
												<div className="admin-notification-icon">⚠️</div>
												<div className="admin-notification-content">
													<div className="admin-notification-title">{notif.title}</div>
													<div className="admin-notification-time">
														{new Date(notif.created_at).toLocaleString('ro-RO')}
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="admin-notifications-empty">
										Nu există notificări critice
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</header>
	);
};

export default DashboardHeader;

