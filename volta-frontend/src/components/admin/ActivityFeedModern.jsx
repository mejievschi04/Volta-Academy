import React from 'react';

const ACTIVITY_ICONS = {
	enrollment: '👤',
	completion: '✅',
	lesson_completed: '📘',
	learning_time: '⏱️',
	payment: '💳',
	course_created: '📚',
	user_registered: '🆕',
	exam_submitted: '📝',
	test: '📝',
	course_published: '🚀',
	user_invited: '📧',
};

const ACTIVITY_COLORS = {
	enrollment: 'var(--admin-info)',
	completion: 'var(--admin-success)',
	lesson_completed: 'var(--admin-primary)',
	learning_time: 'var(--admin-info)',
	payment: 'var(--admin-primary)',
	course_created: 'var(--admin-primary)',
	user_registered: 'var(--admin-success)',
	exam_submitted: 'var(--admin-warning)',
	test: 'var(--admin-warning)',
	course_published: 'var(--admin-primary)',
	user_invited: 'var(--admin-info)',
};

const formatTimeAgo = (date) => {
	const now = new Date();
	const then = new Date(date);
	const diffMs = now - then;
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Acum';
	if (diffMins < 60) return `acum ${diffMins}m`;
	if (diffHours < 24) return `acum ${diffHours}h`;
	if (diffDays < 7) return `acum ${diffDays}z`;
	return then.toLocaleDateString('ro-RO');
};

export default function ActivityFeedModern({ activities, loading }) {
	if (loading) {
		return (
			<div className="admin-section-card">
				<div className="admin-widget-header">
					<h3>Activitate recenta</h3>
					<p className="admin-widget-subtitle">Ultimele evenimente din academie</p>
				</div>
				<div className="admin-activity-list">
					{Array.from({ length: 5 }).map((_, index) => (
						<div key={index} className="admin-activity-item admin-skeleton">
							<div className="admin-activity-avatar admin-skeleton" />
							<div className="admin-activity-content">
								<div className="admin-activity-header admin-skeleton" />
								<div className="admin-activity-description admin-skeleton" />
								<div className="admin-activity-time admin-skeleton" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!activities || activities.length === 0) {
		return (
			<div className="admin-section-card">
				<div className="admin-widget-header">
					<h3>Activitate recenta</h3>
					<p className="admin-widget-subtitle">Ultimele evenimente din academie</p>
				</div>
				<div className="admin-widget-empty">
					<p>Nu exista activitate recenta de afisat.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-section-card">
			<div className="admin-widget-header">
				<h3>Activitate recenta</h3>
				<p className="admin-widget-subtitle">Ultimele evenimente din academie</p>
			</div>
			<div className="admin-activity-list">
				{activities.slice(0, 8).map((activity, index) => (
					<div key={activity.id || index} className="admin-activity-item">
						<div
							className="admin-activity-avatar"
							style={{ backgroundColor: ACTIVITY_COLORS[activity.type] || 'var(--admin-neutral-400)' }}
						>
							{ACTIVITY_ICONS[activity.type] || '📋'}
						</div>
						<div className="admin-activity-content">
							<div className="admin-activity-header">
								<span className="admin-activity-actor">{activity.actor || 'Sistem'}</span>
								<span className="admin-activity-action">{activity.action || 'actiune inregistrata'}</span>
							</div>
							<div className="admin-activity-description">
								{activity.description || activity.message}
							</div>
							<div className="admin-activity-time">
								{formatTimeAgo(activity.created_at || activity.timestamp)}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
