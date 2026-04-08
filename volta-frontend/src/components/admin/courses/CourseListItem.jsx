import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseCoverSrc } from '../../../utils/imageUrl';

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
			draft: { label: 'Ciornă', color: '#9FE22F', bg: 'rgba(159, 226, 47, 0.1)' },
		};
		return badges[status] || badges.draft;
	};

	const statusBadge = getStatusBadge(course.status || 'draft');
	const coverSrc = courseCoverSrc(course);

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
					{coverSrc ? (
						<img src={coverSrc} alt={course.title} loading="lazy" decoding="async" />
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
			className={`admin-course-card admin-course-card-simple ${selected ? 'selected' : ''} ${course.hasAlerts ? 'has-alerts' : ''}`}
		>
			{/* Checkbox overlay */}
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

			{/* Zonă conținut gri (thumbnail) */}
			<div 
				className="admin-course-card-thumbnail"
				onClick={() => navigate(`/admin/courses/${course.id}`)}
			>
				{coverSrc ? (
					<img src={coverSrc} alt={course.title} loading="lazy" decoding="async" />
				) : (
					<div className="admin-course-card-thumbnail-placeholder">
						📚
					</div>
				)}
				{statusBadge && (
					<div
						className="admin-course-card-status-badge admin-course-card-status-overlay"
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

			{/* Titlu */}
			<h3 
				className="admin-course-card-title"
				onClick={() => navigate(`/admin/courses/${course.id}`)}
			>
				{course.title}
			</h3>

			{/* Plus / acțiune colț - deschide curs */}
			<div
				className="admin-course-card-corner-action"
				onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/${course.id}`); }}
				title="Deschide curs"
				aria-label="Deschide curs"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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
