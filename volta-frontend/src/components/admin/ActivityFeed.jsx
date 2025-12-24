import React from 'react';

const ActivityFeed = ({ activities, loading }) => {
	if (loading) {
		return (
			<div className="admin-section-card">
				<div className="skeleton-card" style={{ height: '400px' }}></div>
			</div>
		);
	}

	if (!activities || activities.length === 0) {
		return (
			<div className="admin-section-card">
				<div className="admin-section-header">
					<h2>Activitate Recentă</h2>
				</div>
				<div className="empty-state">
					<div className="empty-state-icon">📋</div>
					<div className="empty-state-title">Nu există activitate</div>
				</div>
			</div>
		);
	}

	const getActivityIcon = (type) => {
		const icons = {
			enrollment: '👤',
			completion: '✅',
			payment: '💳',
			course_created: '📚',
			user_registered: '🆕',
			exam_submitted: '📝',
		};
		return icons[type] || '📋';
	};

	const formatTimeAgo = (date) => {
		const now = new Date();
		const then = new Date(date);
		const diffMs = now - then;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Acum';
		if (diffMins < 60) return `Acum ${diffMins} min`;
		if (diffHours < 24) return `Acum ${diffHours} ore`;
		if (diffDays < 7) return `Acum ${diffDays} zile`;
		return then.toLocaleDateString('ro-RO');
	};

	return (
		<div className="admin-section-card">
			<div className="admin-section-header">
				<h2>Activitate Recentă</h2>
				<p className="admin-section-subtitle">Ultimele evenimente din platformă</p>
			</div>
			<div className="admin-activity-feed">
				{activities.map((activity, index) => (
					<div key={activity.id || index} className="admin-activity-item">
						<div className="admin-activity-icon">
							{getActivityIcon(activity.type)}
						</div>
						<div className="admin-activity-content">
							<div className="admin-activity-text">{activity.description}</div>
							<div className="admin-activity-time">
								{formatTimeAgo(activity.created_at)}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default ActivityFeed;

