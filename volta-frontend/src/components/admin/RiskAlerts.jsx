import React from 'react';

const RiskAlerts = ({ data }) => {
	const alerts = data || [];

	return (
		<div className="admin-risk-alerts">
			<div className="admin-widget-header">
				<h3>Risk & Attention Needed</h3>
				<p className="admin-widget-subtitle">Critical issues requiring action</p>
			</div>

			<div className="admin-alerts-list">
				{alerts.length > 0 ? (
					alerts.map((alert, index) => (
						<div key={index} className={`admin-alert-item admin-alert-${alert.severity || 'medium'}`}>
							<div className="admin-alert-icon">
								{alert.type === 'dropoff' && '📉'}
								{alert.type === 'inactive' && '😴'}
								{alert.type === 'failed' && '❌'}
								{alert.type === 'expiring' && '⏰'}
								{alert.type === 'payment' && '💳'}
								{!alert.type && '⚠️'}
							</div>
							<div className="admin-alert-content">
								<div className="admin-alert-title">{alert.title || 'Alert'}</div>
								<div className="admin-alert-description">{alert.description || 'No description'}</div>
								<div className="admin-alert-meta">
									{alert.course && <span className="admin-alert-course">{alert.course}</span>}
									{alert.count && <span className="admin-alert-count">{alert.count} affected</span>}
								</div>
							</div>
							<div className="admin-alert-action">
								<button className="admin-alert-action-btn">View</button>
							</div>
						</div>
					))
				) : (
					<div className="admin-widget-empty">
						<p>No alerts at this time</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default RiskAlerts;
