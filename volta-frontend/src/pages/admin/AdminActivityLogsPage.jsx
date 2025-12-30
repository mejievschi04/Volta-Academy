import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';

const AdminActivityLogsPage = () => {
	const [logs, setLogs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [pagination, setPagination] = useState({
		current_page: 1,
		last_page: 1,
		per_page: 50,
		total: 0,
	});
	const [filters, setFilters] = useState({
		search: '',
		action: '',
		model_type: '',
		user_id: '',
		date_from: '',
		date_to: '',
	});
	const [availableFilters, setAvailableFilters] = useState({
		actions: [],
		model_types: [],
	});

	useEffect(() => {
		fetchLogs();
	}, [pagination.current_page, filters]);

	const fetchLogs = async () => {
		try {
			setLoading(true);
			const params = {
				page: pagination.current_page,
				per_page: pagination.per_page,
				...filters,
			};
			// Remove empty filters
			Object.keys(params).forEach(key => {
				if (params[key] === '' || params[key] === null) {
					delete params[key];
				}
			});
			
			const data = await adminService.getActivityLogs(params);
			setLogs(data.data || []);
			setPagination(prev => ({
				...prev,
				current_page: data.pagination?.current_page || prev.current_page,
				last_page: data.pagination?.last_page || prev.last_page,
				total: data.pagination?.total || 0,
			}));
			if (data.filters) {
				setAvailableFilters(data.filters);
			}
		} catch (err) {
			console.error('Error fetching activity logs:', err);
			setError('Nu s-a putut încărca activitatea');
		} finally {
			setLoading(false);
		}
	};

	const handleFilterChange = (key, value) => {
		setFilters(prev => ({ ...prev, [key]: value }));
		setPagination(prev => ({ ...prev, current_page: 1 }));
	};

	const handlePageChange = (page) => {
		setPagination(prev => ({ ...prev, current_page: page }));
	};

	const getActionIcon = (action) => {
		switch (action) {
			case 'created':
				return '➕';
			case 'updated':
				return '✏️';
			case 'deleted':
				return '🗑️';
			case 'viewed':
				return '👁️';
			case 'logged_in':
				return '🔐';
			case 'logged_out':
				return '🚪';
			case 'assigned':
				return '📋';
			case 'completed_exam':
				return '✅';
			case 'completed_course':
				return '🎓';
			default:
				return '📝';
		}
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('ro-RO', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date);
	};

	const stripHtml = (html) => {
		if (!html) return '';
		// Remove HTML tags
		const tmp = document.createElement('DIV');
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || '';
	};

	const truncateMessage = (message, maxLength = 100) => {
		if (!message) return '';
		const cleanMessage = stripHtml(message);
		if (cleanMessage.length <= maxLength) return cleanMessage;
		return cleanMessage.substring(0, maxLength) + '...';
	};

	if (loading && logs.length === 0) {
		return (
			<div className="admin-container fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Activitate</h1>
					<p className="va-muted admin-page-subtitle">
						Istoricul complet al acțiunilor utilizatorilor în sistem
					</p>
				</div>
			</div>

			{error && (
				<div className="va-auth-error" style={{ marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{/* Filters */}
			<div className="admin-activity-logs-filters">
				<div className="admin-activity-logs-filters-grid">
					<div className="admin-activity-logs-filter-group">
						<label className="admin-activity-logs-filter-label">Căutare</label>
						<input
							type="text"
							className="admin-activity-logs-filter-input"
							placeholder="Caută în descrieri..."
							value={filters.search}
							onChange={(e) => handleFilterChange('search', e.target.value)}
						/>
					</div>
					<div className="admin-activity-logs-filter-group">
						<label className="admin-activity-logs-filter-label">Acțiune</label>
						<select
							className="admin-activity-logs-filter-input"
							value={filters.action}
							onChange={(e) => handleFilterChange('action', e.target.value)}
						>
							<option value="">Toate acțiunile</option>
							{availableFilters.actions.map(action => (
								<option key={action} value={action}>{action}</option>
							))}
						</select>
					</div>
					<div className="admin-activity-logs-filter-group">
						<label className="admin-activity-logs-filter-label">Tip Model</label>
						<select
							className="admin-activity-logs-filter-input"
							value={filters.model_type}
							onChange={(e) => handleFilterChange('model_type', e.target.value)}
						>
							<option value="">Toate tipurile</option>
							{availableFilters.model_types.map(type => (
								<option key={type} value={type}>{type}</option>
							))}
						</select>
					</div>
					<div className="admin-activity-logs-filter-group">
						<label className="admin-activity-logs-filter-label">De la dată</label>
						<input
							type="date"
							className="admin-activity-logs-filter-input"
							value={filters.date_from}
							onChange={(e) => handleFilterChange('date_from', e.target.value)}
						/>
					</div>
					<div className="admin-activity-logs-filter-group">
						<label className="admin-activity-logs-filter-label">Până la dată</label>
						<input
							type="date"
							className="admin-activity-logs-filter-input"
							value={filters.date_to}
							onChange={(e) => handleFilterChange('date_to', e.target.value)}
						/>
					</div>
				</div>
			</div>

			{/* Logs List */}
			<div className="admin-activity-logs-list">
				{logs.length > 0 ? (
					<div>
						{logs.map((log) => {
							const description = log.description 
								? truncateMessage(log.description, 120)
								: `${log.action} ${log.model_type || ''}`;
							
							return (
								<div key={log.id} className="admin-activity-logs-item">
									<div className="admin-activity-logs-item-content">
										<div className="admin-activity-logs-icon">
											{getActionIcon(log.action)}
										</div>
										<div className="admin-activity-logs-main">
											<div className="admin-activity-logs-header">
												<span className="admin-activity-logs-description">
													{description}
												</span>
												<span className="admin-activity-logs-badge action">
													{log.action}
												</span>
												{log.model_type && (
													<span className="admin-activity-logs-badge model">
														{log.model_type}
													</span>
												)}
											</div>
											<div className="admin-activity-logs-meta">
												{log.user && (
													<span className="admin-activity-logs-meta-item">
														👤 {log.user.name} ({log.user.email})
													</span>
												)}
												<span className="admin-activity-logs-meta-item">
													🕐 {formatDate(log.created_at)}
												</span>
												{log.ip_address && (
													<span className="admin-activity-logs-meta-item">
														🌐 {log.ip_address}
													</span>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="admin-activity-logs-empty">
						<div className="admin-activity-logs-empty-icon">📋</div>
						<div className="admin-activity-logs-empty-title">Nu există activitate</div>
						<div className="admin-activity-logs-empty-text">
							Activitatea va apărea aici când utilizatorii vor efectua acțiuni în sistem
						</div>
					</div>
				)}

				{/* Pagination */}
				{pagination.last_page > 1 && (
					<div className="admin-activity-logs-pagination">
						<button
							onClick={() => handlePageChange(pagination.current_page - 1)}
							disabled={pagination.current_page === 1}
							className="va-btn va-btn-sm"
							style={{ opacity: pagination.current_page === 1 ? 0.5 : 1 }}
						>
							← Anterior
						</button>
						<span className="admin-activity-logs-pagination-info">
							Pagina {pagination.current_page} din {pagination.last_page} ({pagination.total} total)
						</span>
						<button
							onClick={() => handlePageChange(pagination.current_page + 1)}
							disabled={pagination.current_page === pagination.last_page}
							className="va-btn va-btn-sm"
							style={{ opacity: pagination.current_page === pagination.last_page ? 0.5 : 1 }}
						>
							Următor →
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default AdminActivityLogsPage;

