import React, { useState, useEffect } from 'react';
import { formatCurrency, getDefaultCurrency } from '../../../utils/currency';

const CourseOverview = ({ course, onQuickAction }) => {
	const [currency, setCurrency] = useState(getDefaultCurrency());

	useEffect(() => {
		const handleCurrencyChange = (e) => {
			setCurrency(e.detail);
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		setCurrency(getDefaultCurrency());
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, []);

	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#09A86B', bg: 'rgba(9, 168, 107, 0.1)' },
			draft: { label: 'Draft', color: '#9FE22F', bg: 'rgba(159, 226, 47, 0.1)' },
			archived: { label: 'Arhivat', color: '#696E79', bg: 'rgba(105, 110, 121, 0.1)' },
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
					{course.status !== 'published' && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={() => onQuickAction('publish')}
						>
							✅ Publish
						</button>
					)}
					{course.status === 'published' && (
						<button
							className="admin-btn admin-btn-secondary"
							onClick={() => onQuickAction('unpublish')}
						>
							👁️ Unpublish
						</button>
					)}
					<button
						className="admin-btn admin-btn-secondary"
						onClick={() => onQuickAction('preview')}
					>
						👁️ Preview ca Student
					</button>
					<button
						className="admin-btn admin-btn-danger"
						onClick={() => onQuickAction('delete')}
					>
						🗑️ Șterge Curs
					</button>
				</div>
			</div>

			<div className="admin-course-overview-grid">
				{/* Basic Info */}
				<div className="admin-course-overview-card">
					<h3>Informații de Bază</h3>
					<div className="admin-course-overview-info">
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Instructor:</span>
							<span className="admin-course-overview-value">
								{course.teacher?.name || 'N/A'}
							</span>
						</div>
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
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Durată estimată:</span>
							<span className="admin-course-overview-value">
								{course.estimated_duration_hours || 0} ore
							</span>
						</div>
					</div>
				</div>

				{/* Monetization */}
				<div className="admin-course-overview-card">
					<h3>Monetizare</h3>
					<div className="admin-course-overview-info">
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Tip acces:</span>
							<span className="admin-course-overview-value">
								{course.access_type === 'free' ? '🆓 Gratuit' :
								 course.access_type === 'paid' ? '💰 Plătit' :
								 '📅 Subscription'}
							</span>
						</div>
						{course.access_type !== 'free' && (
							<div className="admin-course-overview-info-item">
								<span className="admin-course-overview-label">Preț:</span>
								<span className="admin-course-overview-value">
									{formatCurrency(course.price, course.currency || currency)}
								</span>
							</div>
						)}
						<div className="admin-course-overview-info-item">
							<span className="admin-course-overview-label">Venit total:</span>
							<span className="admin-course-overview-value admin-course-overview-value-highlight">
								{formatCurrency(course.total_revenue || 0, currency)}
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

