import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import AITestChat from '../../components/admin/ai/AITestChat';

const AdminTestsPage = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [tests, setTests] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [filters, setFilters] = useState({
		status: 'all',
		type: 'all',
		search: '',
	});
	const [showAIChat, setShowAIChat] = useState(false);

	useEffect(() => {
		fetchTests();
	}, [filters]);

	const fetchTests = async () => {
		try {
			setLoading(true);
			setError(null);
			const params = {};
			if (filters.status !== 'all') params.status = filters.status;
			if (filters.type !== 'all') params.type = filters.type;
			if (filters.search) params.search = filters.search;
			
			const data = await adminService.getTests(params);
			setTests(Array.isArray(data) ? data : (data?.data || []));
		} catch (err) {
			console.error('Error fetching tests:', err);
			setError('Nu s-au putut încărca testele');
			showToast('Eroare la încărcarea testelor', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi acest test? Testele legate de cursuri nu pot fi șterse.')) {
			return;
		}

		try {
			await adminService.deleteTest(id);
			showToast('Test șters cu succes', 'success');
			fetchTests();
		} catch (err) {
			console.error('Error deleting test:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la ștergerea testului';
			showToast(errorMsg, 'error');
		}
	};

	const handlePublish = async (id) => {
		try {
			await adminService.publishTest(id);
			showToast('Test publicat cu succes', 'success');
			fetchTests();
		} catch (err) {
			console.error('Error publishing test:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la publicarea testului';
			showToast(errorMsg, 'error');
		}
	};

	const getStatusBadge = (status) => {
		const badges = {
			draft: { label: 'Draft', color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.15)' },
			published: { label: 'Publicat', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.15)' },
			archived: { label: 'Arhivat', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
		};
		const badge = badges[status] || badges.draft;
		return (
			<span className="admin-card-badge" style={{
				background: badge.bgColor,
				color: badge.color,
				border: `1px solid ${badge.color}40`,
			}}>
				{badge.label}
			</span>
		);
	};

	const getTypeBadge = (type) => {
		const types = {
			practice: { label: 'Practică', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
			graded: { label: 'Notat', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
			final: { label: 'Final', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
		};
		const badge = types[type] || types.graded;
		return (
			<span className="admin-card-badge" style={{
				background: badge.bgColor,
				color: badge.color,
				border: `1px solid ${badge.color}40`,
			}}>
				{badge.label}
			</span>
		);
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă testele...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="admin-page-title">Test Builder</h1>
					<p className="admin-page-subtitle">
						Gestionează testele standalone. Testele pot fi reutilizate în multiple cursuri.
					</p>
				</div>
				<div className="admin-page-header-actions">
					<button
						className="lms-btn-secondary"
						onClick={() => setShowAIChat(true)}
						title="Creează test cu AI"
					>
						<span>🤖</span>
						AI Creator
					</button>
					<button
						className="lms-btn-primary"
						onClick={() => navigate('/admin/tests/new/builder')}
					>
						<span>+</span>
						Creează Test Nou
					</button>
				</div>
			</div>

			{/* AI Chat Modal */}
			{showAIChat && (
				<div className="ai-chat-modal-overlay" onClick={() => setShowAIChat(false)}>
					<div className="ai-chat-modal" onClick={(e) => e.stopPropagation()}>
						<AITestChat
							courseId={null}
							onTestGenerated={(test) => {
								if (test?.id) {
									navigate(`/admin/tests/${test.id}/builder`);
								} else {
									fetchTests();
								}
								setShowAIChat(false);
							}}
							onClose={() => setShowAIChat(false)}
						/>
					</div>
				</div>
			)}

			{/* Filters */}
			<div className="admin-courses-toolbar" style={{ marginBottom: '2rem' }}>
				<div className="admin-courses-search">
					<input
						type="text"
						className="admin-search-input"
						placeholder="Caută teste..."
						value={filters.search}
						onChange={(e) => setFilters({ ...filters, search: e.target.value })}
					/>
					{filters.search && (
						<button
							className="admin-search-clear-btn"
							onClick={() => setFilters({ ...filters, search: '' })}
							aria-label="Clear search"
						>
							×
						</button>
					)}
				</div>
				<div className="admin-courses-actions">
					<select
						className="admin-filter-select"
						value={filters.status}
						onChange={(e) => setFilters({ ...filters, status: e.target.value })}
					>
						<option value="all">Toate statusurile</option>
						<option value="draft">Draft</option>
						<option value="published">Publicat</option>
						<option value="archived">Arhivat</option>
					</select>
					<select
						className="admin-filter-select"
						value={filters.type}
						onChange={(e) => setFilters({ ...filters, type: e.target.value })}
					>
						<option value="all">Toate tipurile</option>
						<option value="practice">Practică</option>
						<option value="graded">Notat</option>
						<option value="final">Final</option>
					</select>
				</div>
			</div>

			{error && (
				<div className="lms-error-message">
					<strong>Eroare:</strong> {error}
				</div>
			)}

			{tests.length > 0 ? (
				<div className="admin-grid">
					{tests.map((test) => (
						<div key={test.id} className="admin-card">
							<div className="admin-card-body">
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
									<h3 className="admin-card-title" style={{ margin: 0, flex: 1 }}>
										{test.title}
									</h3>
									<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
										{getStatusBadge(test.status)}
										{getTypeBadge(test.type)}
									</div>
								</div>

								{test.description && (
									<p className="admin-card-description" style={{ marginBottom: '1rem' }}>
										{test.description}
									</p>
								)}

								<div className="admin-card-info" style={{ marginBottom: '1rem' }}>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
										{test.time_limit_minutes && (
											<div>⏱️ {test.time_limit_minutes} min</div>
										)}
										{test.max_attempts && (
											<div>🔄 {test.max_attempts} încercări</div>
										)}
										{test.questions_count !== undefined && (
											<div>❓ {test.questions_count} întrebări</div>
										)}
										{test.courses_count !== undefined && (
											<div>📚 Folosit în {test.courses_count} cursuri</div>
										)}
									</div>
								</div>

								<div className="admin-card-actions">
									<button
										className="lms-btn-secondary lms-btn-sm"
										onClick={() => navigate(`/admin/tests/${test.id}/builder`)}
									>
										<span>✏️</span>
										<span>Editează</span>
									</button>
									{test.status === 'draft' && (
										<button
											className="lms-btn-primary lms-btn-sm"
											onClick={() => handlePublish(test.id)}
										>
											<span>📤</span>
											<span>Publică</span>
										</button>
									)}
									<button
										className="lms-btn-secondary lms-btn-sm va-btn-danger"
										onClick={() => handleDelete(test.id)}
									>
										<span>🗑️</span>
										<span>Șterge</span>
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="lms-empty-state">
					<div className="lms-empty-icon">📝</div>
					<div className="lms-empty-title">Nu există teste</div>
					<div className="lms-empty-description">
						{Object.values(filters).some(f => f !== 'all' && f !== '') 
							? 'Încearcă să modifici filtrele' 
							: 'Creează primul test pentru a începe'}
					</div>
					{!Object.values(filters).some(f => f !== 'all' && f !== '') && (
						<button
							className="lms-btn-primary"
							onClick={() => navigate('/admin/tests/new/builder')}
						>
							<span>+</span>
							Creează Test Nou
						</button>
					)}
				</div>
			)}
		</div>
	);
};

export default AdminTestsPage;

