import React, { useState, useEffect } from 'react';

const CourseOverview = ({ course, onQuickAction, readOnly = false }) => {

	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#09A86B', bg: 'rgba(9, 168, 107, 0.1)' },
			draft: { label: 'Ciornă', color: '#9FE22F', bg: 'rgba(159, 226, 47, 0.1)' },
		};
		return badges[status] || badges.draft;
	};

	const statusBadge = getStatusBadge(course.status);

	return (
		<div className="admin-course-overview">
			<div className="admin-course-overview-header">
				<div className="admin-course-overview-title">
					<h2>Overview Curs</h2>
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
				<div className="admin-course-overview-actions">
					{!readOnly && course.status !== 'published' && (
						<button
							className="lms-btn-primary"
							onClick={() => onQuickAction('publish')}
						>
							✅ Publish
						</button>
					)}
					{!readOnly && course.status === 'published' && (
						<button
							className="lms-btn-secondary"
							onClick={() => onQuickAction('unpublish')}
						>
							👁️ Unpublish
						</button>
					)}
					<button
						className="lms-btn-secondary"
						onClick={() => onQuickAction('preview')}
					>
						👁️ Preview ca Student
					</button>
					{!readOnly && (
						<button
							className="lms-btn-secondary va-btn-danger"
							onClick={() => onQuickAction('delete')}
						>
							🗑️ Șterge Curs
						</button>
					)}
				</div>
			</div>

			<div className="admin-course-overview-grid">
				{/* Basic Info */}
				<div className="admin-course-overview-card">
					<h3>Informații de Bază</h3>
					<div className="admin-course-overview-info">
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Categorie:</span>
							<span className="admin-course-overview-value">
								N/A
							</span>
						</div>
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Nivel:</span>
							<span className="admin-course-overview-value">
								{course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : 'N/A'}
							</span>
						</div>
					</div>
				</div>

				{/* KPIs */}
				<div className="admin-course-overview-card">
					<h3>KPI-uri Agregate</h3>
					<div className="admin-course-overview-kpis">
						<div className="admin-course-overview-kpi">
							<div className="admin-course-overview-kpi-label">Înscrieri</div>
							<div className="admin-course-overview-kpi-value">
								{course.total_enrollments || 0}
							</div>
						</div>
						<div className="admin-course-overview-kpi">
							<div className="admin-course-overview-kpi-label">Finalizare</div>
							<div className="admin-course-overview-kpi-value">
								{course.completion_rate || 0}%
							</div>
						</div>
						<div className="admin-course-overview-kpi">
							<div className="admin-course-overview-kpi-label">Rating</div>
							<div className="admin-course-overview-kpi-value">
								{course.average_rating ? (
									<>
										⭐ {course.average_rating.toFixed(1)}
										<span className="admin-course-overview-kpi-sub">
											({course.rating_count || 0})
										</span>
									</>
								) : (
									'N/A'
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Structure Summary */}
				<div className="admin-course-overview-card">
					<h3>Structură</h3>
					<div className="admin-course-overview-info">
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Module:</span>
							<span className="admin-course-overview-value">
								{course.modules_count || 0}
							</span>
						</div>
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Lecții:</span>
							<span className="admin-course-overview-value">
								{course.lessons_count || 0}
							</span>
						</div>
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Teste:</span>
							<span className="admin-course-overview-value">
								{course.exams_count || 0}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseOverview;
