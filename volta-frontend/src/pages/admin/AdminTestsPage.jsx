import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import AdminTestReviewsPage from './AdminTestReviewsPage';
import VoltInstructor from '../../components/admin/VoltInstructor';

const AdminTestsPage = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const isReviewsTab = location.pathname === '/admin/tests/reviews';
	const { showToast } = useToast();
	const [tests, setTests] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	
	// Filters and search
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		status: 'all',
		type: 'all',
		activeCount: 0
	});
	const [sortBy, setSortBy] = useState('recent');
	const [viewMode, setViewMode] = useState('grid');
	
	// Selection
	const [selectedTests, setSelectedTests] = useState(new Set());

	// Fetch tests
	const fetchTests = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			
			const params = {
				search: searchQuery || undefined,
				status: filters.status !== 'all' ? filters.status : undefined,
				type: filters.type !== 'all' ? filters.type : undefined,
				sort: sortBy
			};
			
			const data = await adminService.getTests(params);
			setTests(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching tests:', err);
			setError('Nu s-au putut încărca testele');
			showToast('Eroare la încărcarea testelor', 'error');
		} finally {
			setLoading(false);
		}
	}, [searchQuery, filters, sortBy, showToast]);

	useEffect(() => {
		fetchTests();
	}, [fetchTests]);

	// Calculate active filters count
	useEffect(() => {
		let count = 0;
		if (filters.status !== 'all') count++;
		if (filters.type !== 'all') count++;
		setFilters(prev => ({ ...prev, activeCount: count }));
	}, [filters.status, filters.type]);

	// Handle filter change
	const handleFilterChange = (key, value) => {
		setFilters(prev => ({ ...prev, [key]: value }));
	};

	// Handle test selection
	const handleSelectTest = (testId, selected) => {
		setSelectedTests(prev => {
			const newSet = new Set(prev);
			if (selected) {
				newSet.add(testId);
			} else {
				newSet.delete(testId);
			}
			return newSet;
		});
	};

	// Handle quick actions
	const handleQuickAction = async (testId, action) => {
		try {
			switch (action) {
				case 'publish':
					await adminService.publishTest(testId);
					showToast('Testul a fost publicat cu succes', 'success');
					break;
				case 'delete':
					if (window.confirm('Ești sigur că vrei să ștergi acest test?')) {
						await adminService.deleteTest(testId);
						showToast('Testul a fost șters cu succes', 'success');
					}
					break;
				case 'archive':
					await adminService.updateTest(testId, { status: 'archived' });
					showToast('Testul a fost arhivat', 'success');
					break;
				default:
					console.warn('Unknown action:', action);
			}
			fetchTests();
		} catch (err) {
			console.error('Error performing action:', err);
			showToast('Eroare la executarea acțiunii', 'error');
		}
	};

	// Handle create test
	const handleCreateTest = () => {
		navigate('/admin/tests/new');
	};

	// Get status badge
	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#09A86B', bg: 'rgba(9, 168, 107, 0.1)' },
			draft: { label: 'Ciornă', color: '#9FE22F', bg: 'rgba(159, 226, 47, 0.1)' },
			archived: { label: 'Arhivat', color: '#696E79', bg: 'rgba(105, 110, 121, 0.1)' },
		};
		return badges[status] || badges.draft;
	};

	// Get type badge
	const getTypeBadge = (type) => {
		const badges = {
			practice: { label: 'Exersare', color: '#FFEE00', bg: 'rgba(255, 238, 0, 0.1)' },
			graded: { label: 'Notat', color: '#FFEE00', bg: 'rgba(255, 238, 0, 0.1)' },
			final: { label: 'Final', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
		};
		return badges[type] || badges.graded;
	};

	// Filtered and sorted tests
	const filteredAndSortedTests = useMemo(() => {
		let filtered = [...tests];

		// Apply sorting
		if (sortBy === 'recent') {
			filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
		} else if (sortBy === 'alphabetical') {
			filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
		} else if (sortBy === 'questions') {
			filtered.sort((a, b) => (b.questions_count || 0) - (a.questions_count || 0));
		}

		return filtered;
	}, [tests, sortBy]);

	if (error) {
		return (
			<div className="admin-container">
				<div className="lms-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error}</p>
					<button className="lms-btn-primary" onClick={fetchTests}>
						Încearcă din nou
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			{/* Header */}
			<div className="admin-courses-page-header">
				<div className="admin-courses-header-content">
					<div className="admin-courses-header-text">
						<h1 className="admin-courses-title">Teste</h1>
						<p className="admin-courses-subtitle">
							{isReviewsTab
								? 'Rezultate cu întrebări deschise (răspuns scurt, eseu) care necesită notare manuală'
								: 'Gestionează și creează teste pentru cursuri'}
						</p>
					</div>
					<div className="admin-courses-header-actions" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
						<nav className="admin-tests-tabs" style={{ display: 'flex', gap: 'var(--space-1)', marginRight: 'var(--space-4)' }}>
							<NavLink
								to="/admin/tests"
								end
								className={({ isActive }) => `admin-tests-tab ${isActive ? 'active' : ''}`}
								style={({ isActive }) => ({
									padding: 'var(--space-2) var(--space-4)',
									borderRadius: 'var(--radius-md)',
									fontSize: 'var(--font-size-sm)',
									fontWeight: 500,
									textDecoration: 'none',
									color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
									background: isActive ? 'rgba(255, 238, 0, 0.1)' : 'transparent',
									border: `1px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
								})}
							>
								Lista teste
							</NavLink>
							<NavLink
								to="/admin/tests/reviews"
								className={({ isActive }) => `admin-tests-tab ${isActive ? 'active' : ''}`}
								style={({ isActive }) => ({
									padding: 'var(--space-2) var(--space-4)',
									borderRadius: 'var(--radius-md)',
									fontSize: 'var(--font-size-sm)',
									fontWeight: 500,
									textDecoration: 'none',
									color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
									background: isActive ? 'rgba(255, 238, 0, 0.1)' : 'transparent',
									border: `1px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
								})}
							>
								Verificări manuale
							</NavLink>
						</nav>
						{!isReviewsTab && (
							<button className="admin-btn-create-course" onClick={handleCreateTest}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M12 5V19M5 12H19" strokeLinecap="round"/>
								</svg>
								Creează Test
							</button>
						)}
					</div>
				</div>

				{/* Search and Filters - only on list tab */}
				{!isReviewsTab && (
				<div className="admin-courses-toolbar">
					<div className="admin-courses-search-wrapper">
						<div className="admin-courses-search">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.35-4.35"/>
							</svg>
							<input
								type="text"
								placeholder="Caută teste..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="admin-courses-search-input"
							/>
						</div>
					</div>

					<div className="admin-courses-toolbar-actions">
						<div className="admin-courses-filters">
						{/* Status Filter */}
						<select
							value={filters.status}
							onChange={(e) => handleFilterChange('status', e.target.value)}
							className="admin-courses-filter-select"
						>
							<option value="all">Toate statusurile</option>
							<option value="published">Publicat</option>
							<option value="draft">Ciornă</option>
							<option value="archived">Arhivat</option>
						</select>

						{/* Type Filter */}
						<select
							value={filters.type}
							onChange={(e) => handleFilterChange('type', e.target.value)}
							className="admin-courses-filter-select"
						>
							<option value="all">Toate tipurile</option>
							<option value="practice">Practice</option>
							<option value="graded">Graded</option>
							<option value="final">Final</option>
						</select>

						{/* Sort */}
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							className="admin-courses-filter-select"
						>
							<option value="recent">Cele mai recente</option>
							<option value="alphabetical">Alfabetic</option>
							<option value="questions">Nr. întrebări</option>
						</select>
						</div>
					</div>
				</div>
				)}
			</div>

			{/* Content: Reviews or Tests List/Grid */}
			{isReviewsTab ? (
				<AdminTestReviewsPage embedded />
			) : (
			<>
			{/* Tests List/Grid */}
			{loading && tests.length === 0 ? (
				<div className="admin-courses-loading">
					<div className="va-spinner va-spinner-lg"></div>
					<p>Se încarcă testele...</p>
				</div>
			) : filteredAndSortedTests.length === 0 ? (
				<div className="lms-empty-state">
					<p>Nu există teste disponibile.</p>
					<button className="lms-btn-primary" onClick={handleCreateTest}>
						+ Creează primul test
					</button>
				</div>
			) : (
				<div className={viewMode === 'grid' ? 'admin-courses-grid' : 'admin-courses-table'}>
					{viewMode === 'grid' ? (
						<div className="admin-courses-grid-container">
							{filteredAndSortedTests.map(test => {
								const statusBadge = getStatusBadge(test.status);
								const typeBadge = getTypeBadge(test.type);
								
								return (
									<div
										key={test.id}
										className="admin-course-card"
										onClick={() => navigate(`/admin/tests/${test.id}`)}
									>
										{/* Header with badges */}
										<div className="admin-course-card-header">
											<div className="admin-course-card-badges">
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
												<div
													className="admin-course-status-badge"
													style={{
														backgroundColor: typeBadge.bg,
														color: typeBadge.color,
														borderColor: typeBadge.color,
													}}
												>
													{typeBadge.label}
												</div>
											</div>
										</div>

										{/* Content */}
										<div className="admin-course-card-content">
											<h3 className="admin-course-card-title">{test.title}</h3>
											{test.description && (
												<p className="admin-course-card-description">
													{test.description.length > 100 
														? test.description.substring(0, 100) + '...' 
														: test.description}
												</p>
											)}

											{/* Stats */}
											<div className="admin-course-card-stats">
												<span className="admin-course-card-stat">
													📝 {test.questions_count || 0} întrebări
												</span>
												{test.time_limit_minutes && (
													<span className="admin-course-card-stat">
														⏱️ {test.time_limit_minutes} min
													</span>
												)}
												{test.attempts_count > 0 && (
													<span className="admin-course-card-stat">
														👥 {test.attempts_count} încercări
													</span>
												)}
											</div>
										</div>

										{/* Actions */}
										<div className="admin-course-card-actions">
											<button
												className="admin-course-card-action-btn"
												onClick={(e) => {
													e.stopPropagation();
													navigate(`/admin/tests/${test.id}`);
												}}
											>
												✏️ Editează
											</button>
											{test.status !== 'published' && (
												<button
													className="admin-course-card-action-btn"
													onClick={(e) => {
														e.stopPropagation();
														handleQuickAction(test.id, 'publish');
													}}
												>
													✅ Publică
												</button>
											)}
											<button
												className="admin-course-card-action-btn va-btn-danger"
												onClick={(e) => {
													e.stopPropagation();
													handleQuickAction(test.id, 'delete');
												}}
											>
												🗑️ Șterge
											</button>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="admin-courses-table-container">
							<div className="admin-courses-table-header">
								<div className="admin-course-table-checkbox"></div>
								<div className="admin-course-table-info-header">Test</div>
								<div className="admin-course-table-metrics-header">Metrici</div>
								<div className="admin-course-table-actions-header">Acțiuni</div>
							</div>
							{filteredAndSortedTests.map(test => {
								const statusBadge = getStatusBadge(test.status);
								const typeBadge = getTypeBadge(test.type);
								
								return (
									<div key={test.id} className="admin-course-table-row">
										<div className="admin-course-table-checkbox">
											<input
												type="checkbox"
												checked={selectedTests.has(test.id)}
												onChange={(e) => handleSelectTest(test.id, e.target.checked)}
												onClick={(e) => e.stopPropagation()}
											/>
										</div>
										<div className="admin-course-table-info">
											<div className="admin-course-table-badges">
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
												<div
													className="admin-course-status-badge"
													style={{
														backgroundColor: typeBadge.bg,
														color: typeBadge.color,
														borderColor: typeBadge.color,
													}}
												>
													{typeBadge.label}
												</div>
											</div>
											<h3 className="admin-course-table-title">{test.title}</h3>
											{test.description && (
												<p className="admin-course-table-description">
													{test.description.length > 150 
														? test.description.substring(0, 150) + '...' 
														: test.description}
												</p>
											)}
										</div>
										<div className="admin-course-table-metrics">
											<div className="admin-course-table-metric">
												<span className="admin-course-table-metric-label">Întrebări:</span>
												<span className="admin-course-table-metric-value">{test.questions_count || 0}</span>
											</div>
											{test.time_limit_minutes && (
												<div className="admin-course-table-metric">
													<span className="admin-course-table-metric-label">Durată:</span>
													<span className="admin-course-table-metric-value">{test.time_limit_minutes} min</span>
												</div>
											)}
											{test.attempts_count > 0 && (
												<div className="admin-course-table-metric">
													<span className="admin-course-table-metric-label">Încercări:</span>
													<span className="admin-course-table-metric-value">{test.attempts_count}</span>
												</div>
											)}
										</div>
										<div className="admin-course-table-actions">
											<button
												className="admin-course-table-action-btn"
												onClick={() => navigate(`/admin/tests/${test.id}`)}
											>
												✏️ Editează
											</button>
											{test.status !== 'published' && (
												<button
													className="admin-course-table-action-btn"
													onClick={() => handleQuickAction(test.id, 'publish')}
												>
													✅ Publică
												</button>
											)}
											<button
												className="admin-course-table-action-btn va-btn-danger"
												onClick={() => handleQuickAction(test.id, 'delete')}
											>
												🗑️ Șterge
											</button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
			</>
			)}

			{!isReviewsTab && (
				<VoltInstructor
					questions={[
						'Ce titlu vrei pentru test?',
						'Câte întrebări aproximativ?',
						'Despre ce teme vor fi întrebările?',
					]}
					actions={[
						{ label: '+ Test', onClick: handleCreateTest, primary: true },
						{ label: 'Bănci', onClick: () => navigate('/admin/question-banks') },
					]}
				/>
			)}
		</div>
	);
};

export default AdminTestsPage;
