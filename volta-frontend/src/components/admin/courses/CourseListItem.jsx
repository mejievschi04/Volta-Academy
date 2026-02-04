import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CourseListItem = React.memo(({
	course,
	selected,
	onSelect,
	onQuickAction,
	loading,
	viewMode = 'grid',
	onPreview
}) => {
	const navigate = useNavigate();

	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#09A86B', bg: 'rgba(9, 168, 107, 0.1)' },
			draft: { label: 'Draft', color: '#9FE22F', bg: 'rgba(159, 226, 47, 0.1)' },
			archived: { label: 'Arhivat', color: '#696E79', bg: 'rgba(105, 110, 121, 0.1)' },
			disabled: { label: 'Dezactivat', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
		};
		return badges[status] || badges.draft;
	};

	const statusBadge = getStatusBadge(course.status || 'draft');

	const handleQuickAction = (action, e) => {
		e.stopPropagation();
		onQuickAction(course.id, action);
	};


	const formatDate = (date) => {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString('ro-RO', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	};

	if (viewMode === 'list' || viewMode === 'table') {
		return (
			<div
				className={`admin-course-table-row ${selected ? 'selected' : ''} ${course.hasAlerts ? 'has-alerts' : ''}`}
			>
				<div className="admin-course-table-checkbox" onClick={(e) => e.stopPropagation()}>
					<input
						type="checkbox"
						checked={selected}
						onChange={(e) => {
							e.stopPropagation();
							onSelect(course.id, e.target.checked);
						}}
						className="admin-checkbox-input"
					/>
				</div>
				<div className="admin-course-table-thumbnail" onClick={() => navigate(`/admin/courses/${course.id}`)}>
					{course.image_url ? (
						<img src={course.image_url} alt={course.title} loading="lazy" decoding="async" />
					) : (
						<div className="admin-course-thumbnail-placeholder">📚</div>
					)}
				</div>
				<div className="admin-course-table-info" onClick={() => navigate(`/admin/courses/${course.id}`)}>
					<div className="admin-course-table-title-row">
						<h3 className="admin-course-table-title">{course.title}</h3>
						<div
							className="admin-course-status-badge"
							style={{
								backgroundColor: statusBadge.bg,
								color: statusBadge.color,
								borderColor: statusBadge.color,
							}}
						>
							{statusBadge.label}
						</div>
					</div>
					<div className="admin-course-table-meta">
						{course.modules_count !== undefined && <span>📖 {course.modules_count} module</span>}
					</div>
				</div>
				<div className="admin-course-table-metrics">
					<div className="admin-course-table-metric">
						<div className="admin-course-metric-label">Studenți</div>
						<div className="admin-course-metric-value">{course.enrollments_count || 0}</div>
					</div>
					<div className="admin-course-table-metric">
						<div className="admin-course-metric-label">Rating</div>
						<div className="admin-course-metric-value">
							{course.rating ? `⭐ ${course.rating.toFixed(1)}` : 'N/A'}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`admin-course-card ${selected ? 'selected' : ''} ${course.hasAlerts ? 'has-alerts' : ''}`}
		>
			{/* Card Header - Checkbox and Status Badge */}
			<div className="admin-course-card-header">
				<div className="admin-course-card-checkbox" onClick={(e) => e.stopPropagation()}>
					<input
						type="checkbox"
						checked={selected}
						onChange={(e) => {
							e.stopPropagation();
							onSelect(course.id, e.target.checked);
						}}
						className="admin-checkbox-input"
					/>
				</div>
				{statusBadge && (
					<div
						className="admin-course-card-status-badge"
						style={{
							backgroundColor: statusBadge.bg,
							color: statusBadge.color,
							borderColor: statusBadge.color,
						}}
					>
						{statusBadge.label}
					</div>
				)}
			</div>

			{/* Course Thumbnail */}
			<div 
				className="admin-course-card-thumbnail"
				onClick={() => navigate(`/admin/courses/${course.id}`)}
			>
				{course.image_url ? (
					<img src={course.image_url} alt={course.title} loading="lazy" decoding="async" />
				) : (
					<div className="admin-course-card-thumbnail-placeholder">
						📚
					</div>
				)}
			</div>

			{/* Course Content */}
			<div className="admin-course-card-content">
				{/* Title Section */}
				<div className="admin-course-card-title-section">
					<h3 
						className="admin-course-card-title"
						onClick={() => navigate(`/admin/courses/${course.id}`)}
					>
						{course.title}
					</h3>
				</div>

				{/* Modules */}
				<div className="admin-course-card-meta">
					{course.modules_count !== undefined && (
						<span className="admin-course-card-meta-item">
							{course.modules_count} module
						</span>
					)}
				</div>

				{/* Statistics Grid */}
				<div className="admin-course-card-stats">
					<div className="admin-course-card-stat">
						<div className="admin-course-card-stat-label">ÎNSCRIERI</div>
						<div className="admin-course-card-stat-value">
							{course.enrollments_count || 0}
						</div>
					</div>
					<div className="admin-course-card-stat">
						<div className="admin-course-card-stat-label">FINALIZARE</div>
						<div className="admin-course-card-stat-value">
							{course.completion_rate || 0}%
						</div>
					</div>
					<div className="admin-course-card-stat">
						<div className="admin-course-card-stat-label">RATING</div>
						<div className="admin-course-card-stat-value">
							{course.rating ? (
								<>⭐ {course.rating.toFixed(1)}</>
							) : (
								'N/A'
							)}
						</div>
					</div>
					<div className="admin-course-card-stat">
						<div className="admin-course-card-stat-label">ACTUALIZAT</div>
						<div className="admin-course-card-stat-value admin-course-card-stat-value-small">
							{formatDate(course.updated_at)}
						</div>
					</div>
				</div>

				{/* Publish Button for Drafts */}
				{course.status !== 'published' && (
					<div className="admin-course-card-publish">
						<button
							className="lms-btn-primary"
							onClick={(e) => {
								e.stopPropagation();
								handleQuickAction('publish', e);
							}}
							disabled={loading}
							style={{ width: '100%' }}
						>
							<span>✅</span>
							Publish
						</button>
					</div>
				)}

				<div className="admin-course-card-publish" style={{ marginTop: 'var(--space-3)' }}>
					<button
						className="lms-btn-secondary"
						onClick={(e) => {
							e.stopPropagation();
							navigate(`/admin/courses/${course.id}/builder`);
						}}
						style={{ width: '100%' }}
					>
						🛠 Builder
					</button>
				</div>
			</div>
		</div>
	);
}, (prevProps, nextProps) => {
	// Custom comparison for memo - only re-render if relevant props change
	return (
		prevProps.course?.id === nextProps.course?.id &&
		prevProps.course?.status === nextProps.course?.status &&
		prevProps.course?.enrollments_count === nextProps.course?.enrollments_count &&
		prevProps.course?.rating === nextProps.course?.rating &&
		prevProps.course?.completion_rate === nextProps.course?.completion_rate &&
		prevProps.selected === nextProps.selected &&
		prevProps.loading === nextProps.loading &&
		prevProps.viewMode === nextProps.viewMode &&
		prevProps.onSelect === nextProps.onSelect &&
		prevProps.onQuickAction === nextProps.onQuickAction &&
		prevProps.onPreview === nextProps.onPreview
	);
});

CourseListItem.displayName = 'CourseListItem';

export default CourseListItem;

