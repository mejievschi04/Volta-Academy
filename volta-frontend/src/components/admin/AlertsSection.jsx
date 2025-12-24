import React from 'react';

const AlertsSection = ({ alerts, loading, onDismiss }) => {
	if (loading) {
		return (
			<div className="admin-section-card">
				<div className="skeleton-card" style={{ height: '300px' }}></div>
			</div>
		);
	}

	if (!alerts || alerts.length === 0) {
		return (
			<div className="admin-section-card">
				<div className="admin-section-header">
					<h2>Alerte și Task-uri</h2>
				</div>
				<div className="empty-state">
					<div className="empty-state-icon">✅</div>
					<div className="empty-state-title">Nu există alerte</div>
					<div className="empty-state-description">Totul funcționează perfect!</div>
				</div>
			</div>
		);
	}

	const getAlertIcon = (type) => {
		const icons = {
			payment_failed: '💳',
			course_outdated: '📚',
			instructor_inactive: '👨‍🏫',
			low_completion: '⚠️',
			high_dropoff: '📉',
		};
		return icons[type] || '🔔';
	};

	const getAlertColor = (severity) => {
		const colors = {
			critical: '#e63946',
			warning: '#f77f00',
			info: '#09A86B',
		};
		return colors[severity] || colors.info;
	};

	return (
		<div className="admin-section-card">
			<div className="admin-section-header">
				<h2>Alerte și Task-uri</h2>
				<p className="admin-section-subtitle">Acțiuni care necesită atenție</p>
			</div>
			<div className="admin-alerts-list">
				{alerts.map((alert) => (
					<div 
						key={alert.id} 
						className="admin-alert-item"
						style={{ borderLeftColor: getAlertColor(alert.severity) }}
					>
						<div className="admin-alert-icon">
							{getAlertIcon(alert.type)}
						</div>
						<div className="admin-alert-content">
							<div className="admin-alert-title">{alert.title}</div>
							<div className="admin-alert-description">{alert.description}</div>
							{alert.action_url && (
								<a 
									href={alert.action_url} 
									className="admin-alert-action"
								>
									Vezi detalii →
								</a>
							)}
						</div>
						{onDismiss && (
							<button 
								className="admin-alert-dismiss"
								onClick={() => onDismiss(alert.id)}
								aria-label="Dismiss alert"
							>
								×
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

export default AlertsSection;

