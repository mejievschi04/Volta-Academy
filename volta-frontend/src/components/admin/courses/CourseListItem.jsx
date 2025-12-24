import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, getDefaultCurrency } from '../../../utils/currency';

const CourseListItem = ({
	course,
	selected,
	onSelect,
	onQuickAction,
	loading,
	viewMode = 'grid',
	onPreview
}) => {
	const navigate = useNavigate();
	const [currency, setCurrency] = useState(getDefaultCurrency());

	useEffect(() => {
		// Listen for currency changes
		const handleStorageChange = () => {
			setCurrency(getDefaultCurrency());
		};
		const handleCurrencyChange = (e) => {
			setCurrency(e.detail);
		};
		window.addEventListener('storage', handleStorageChange);
		window.addEventListener('currencyChanged', handleCurrencyChange);
		// Also check on mount
		setCurrency(getDefaultCurrency());
		return () => {
			window.removeEventListener('storage', handleStorageChange);
			window.removeEventListener('currencyChanged', handleCurrencyChange);
		};
	}, []);

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

	if (viewMode === 'table') {
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
						<img src={course.image_url} alt={course.title} />
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
						{course.teacher && <span>👤 {course.teacher.name}</span>}
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
					<div className="admin-course-table-metric">
						<div className="admin-course-metric-label">Preț</div>
						<div className="admin-course-metric-value">
							{course.price ? formatCurrency(course.price, currency) : 'Gratuit'}
						</div>
					</div>
				</div>
				<div className="admin-course-table-actions" onClick={(e) => e.stopPropagation()}>
					{onPreview && (
						<button
							className="admin-course-action-btn"
							onClick={() => onPreview()}
							title="Previzualizează"
						>
							👁️
						</button>
					)}
					<button
						className="admin-course-action-btn"
						onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
						title="Editează"
					>
						✏️
					</button>
					<button
						className="admin-course-action-btn"
						onClick={(e) => handleQuickAction('duplicate', e)}
						disabled={loading}
						title="Duplică"
					>
						📋
					</button>
					{course.status !== 'archived' && (
						<button
							className="admin-course-action-btn"
							onClick={(e) => handleQuickAction('archive', e)}
							disabled={loading}
							title="Arhivează"
						>
							📦
						</button>
					)}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`admin-course-list-item ${selected ? 'selected' : ''} ${course.hasAlerts ? 'has-alerts' : ''}`}
			onClick={() => navigate(`/admin/courses/${course.id}`)}
		>
			{/* Checkbox for bulk selection */}
			<div className="admin-course-checkbox" onClick={(e) => e.stopPropagation()}>
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

			{/* Thumbnail */}
			<div className="admin-course-thumbnail">
				{course.image_url ? (
					<img src={course.image_url} alt={course.title} />
				) : (
					<div className="admin-course-thumbnail-placeholder">
						📚
					</div>
				)}
				{statusBadge && (
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
				)}
			</div>

			{/* Course Info */}
			<div className="admin-course-info">
				<div className="admin-course-header">
					<h3 className="admin-course-title">{course.title}</h3>
					{course.hasAlerts && (
						<span className="admin-course-alert-indicator" title="Alerte active">
							⚠️
						</span>
					)}
					{/* Quick Action Buttons */}
					<div className="admin-course-header-actions" onClick={(e) => e.stopPropagation()}>
						{onPreview && (
							<button
								className="admin-course-header-btn"
								onClick={(e) => {
									e.stopPropagation();
									onPreview();
								}}
								title="Previzualizează"
							>
								👁️
							</button>
						)}
						<button
							className="admin-course-header-btn"
							onClick={(e) => {
								e.stopPropagation();
								navigate(`/admin/courses/${course.id}/edit`);
							}}
							title="Editează"
						>
							✏️
						</button>
						<button
							className="admin-course-header-btn"
							onClick={(e) => handleQuickAction('duplicate', e)}
							disabled={loading}
							title="Duplică"
						>
							📋
						</button>
						{course.status !== 'archived' && (
							<button
								className="admin-course-header-btn"
								onClick={(e) => handleQuickAction('archive', e)}
								disabled={loading}
								title="Arhivează"
							>
								📦
							</button>
						)}
						{course.status === 'archived' && (
							<button
								className="admin-course-header-btn"
								onClick={(e) => handleQuickAction('unarchive', e)}
								disabled={loading}
								title="Dezarhivează"
							>
								📤
							</button>
						)}
						<button
							className="admin-course-header-btn"
							onClick={(e) => {
								e.stopPropagation();
								navigate(`/admin/courses/${course.id}/analytics`);
							}}
							title="Analytics"
						>
							📊
						</button>
						{course.status !== 'disabled' && (
							<button
								className="admin-course-header-btn admin-course-header-btn-danger"
								onClick={(e) => handleQuickAction('disable', e)}
								disabled={loading}
								title="Dezactivează"
							>
								🚫
							</button>
						)}
						<button
							className="admin-course-header-btn admin-course-header-btn-danger"
							onClick={(e) => handleQuickAction('delete', e)}
							disabled={loading}
							title="Șterge"
						>
							🗑️
						</button>
					</div>
				</div>
				<div className="admin-course-meta">
					{course.teacher && (
						<span className="admin-course-meta-item">
							👤 {course.teacher.name}
						</span>
					)}
					{course.modules_count !== undefined && (
						<span className="admin-course-meta-item">
							📖 {course.modules_count} module
						</span>
					)}
				</div>
			</div>

			{/* Metrics */}
			<div className="admin-course-metrics">
				<div className="admin-course-metric">
					<div className="admin-course-metric-label">Înscrieri</div>
					<div className="admin-course-metric-value">
						{course.enrollments_count || 0}
					</div>
				</div>
				<div className="admin-course-metric">
					<div className="admin-course-metric-label">Venit</div>
					<div className="admin-course-metric-value">
						{formatCurrency(course.revenue || 0, currency)}
					</div>
				</div>
				<div className="admin-course-metric">
					<div className="admin-course-metric-label">Finalizare</div>
					<div className="admin-course-metric-value">
						{course.completion_rate || 0}%
					</div>
				</div>
				<div className="admin-course-metric">
					<div className="admin-course-metric-label">Rating</div>
					<div className="admin-course-metric-value">
						{course.rating ? (
							<>
								⭐ {course.rating.toFixed(1)}
								<span className="admin-course-rating-count">
									({course.rating_count || 0})
								</span>
							</>
						) : (
							'N/A'
						)}
					</div>
				</div>
				<div className="admin-course-metric">
					<div className="admin-course-metric-label">Preț</div>
					<div className="admin-course-metric-value">
						{course.price ? formatCurrency(course.price, currency) : 'Gratuit'}
					</div>
				</div>
				<div className="admin-course-metric">
					<div className="admin-course-metric-label">Actualizat</div>
					<div className="admin-course-metric-value admin-course-metric-value-small">
						{formatDate(course.updated_at)}
					</div>
				</div>
			</div>

			{/* Publish Button */}
			{course.status !== 'published' && (
				<div className="admin-course-publish-section">
					<button
						className="admin-course-publish-btn"
						onClick={(e) => {
							e.stopPropagation();
							handleQuickAction('publish', e);
						}}
						disabled={loading}
					>
						<span className="admin-course-publish-icon">✅</span>
						Publish
					</button>
				</div>
			)}
		</div>
	);
};

export default CourseListItem;

