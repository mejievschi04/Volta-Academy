import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

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
			draft: { label: 'Draft', color: '#888' },
			published: { label: 'Publicat', color: '#4caf50' },
			archived: { label: 'Arhivat', color: '#ff9800' },
		};
		const badge = badges[status] || badges.draft;
		return (
			<span style={{
				padding: '0.25rem 0.75rem',
				borderRadius: '12px',
				background: `${badge.color}20`,
				color: badge.color,
				fontSize: '0.875rem',
				fontWeight: 500,
			}}>
				{badge.label}
			</span>
		);
	};

	const getTypeBadge = (type) => {
		const types = {
			practice: { label: 'Practică', color: '#2196f3' },
			graded: { label: 'Notat', color: '#9c27b0' },
			final: { label: 'Final', color: '#f44336' },
		};
		const badge = types[type] || types.graded;
		return (
			<span style={{
				padding: '0.25rem 0.75rem',
				borderRadius: '12px',
				background: `${badge.color}20`,
				color: badge.color,
				fontSize: '0.875rem',
				fontWeight: 500,
			}}>
				{badge.label}
			</span>
		);
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
					<div className="va-loading-spinner"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Test Builder</h1>
					<p className="va-muted admin-page-subtitle">
						Gestionează testele standalone. Testele pot fi reutilizate în multiple cursuri.
					</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => navigate('/admin/tests/new/builder')}
				>
					+ Creează Test Nou
				</button>
			</div>

			{/* Filters */}
			<div style={{
				display: 'flex',
				gap: '1rem',
				marginBottom: '2rem',
				flexWrap: 'wrap',
				alignItems: 'center',
			}}>
				<div className="va-form-group" style={{ margin: 0, minWidth: '200px' }}>
					<input
						type="text"
						className="va-form-input"
						placeholder="Caută teste..."
						value={filters.search}
						onChange={(e) => setFilters({ ...filters, search: e.target.value })}
					/>
				</div>
				<div className="va-form-group" style={{ margin: 0, minWidth: '150px' }}>
					<select
						className="va-form-input"
						value={filters.status}
						onChange={(e) => setFilters({ ...filters, status: e.target.value })}
					>
						<option value="all">Toate statusurile</option>
						<option value="draft">Draft</option>
						<option value="published">Publicat</option>
						<option value="archived">Arhivat</option>
					</select>
				</div>
				<div className="va-form-group" style={{ margin: 0, minWidth: '150px' }}>
					<select
						className="va-form-input"
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
				<div style={{
					padding: '1rem',
					background: 'rgba(244, 67, 54, 0.1)',
					color: '#f44336',
					borderRadius: '8px',
					marginBottom: '1rem',
					border: '1px solid rgba(244, 67, 54, 0.3)',
				}}>
					{error}
				</div>
			)}

			{tests.length > 0 ? (
				<div className="admin-grid">
					{tests.map((test) => (
						<div key={test.id} className="va-card admin-card">
							<div className="admin-card-body">
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
									<h3 className="admin-card-title" style={{ margin: 0, flex: 1 }}>
										{test.title}
									</h3>
									<div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
										{getStatusBadge(test.status)}
										{getTypeBadge(test.type)}
									</div>
								</div>

								{test.description && (
									<p className="va-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
										{test.description}
									</p>
								)}

								<div className="admin-card-info" style={{ marginBottom: '1rem' }}>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem' }}>
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
										className="va-btn va-btn-sm"
										onClick={() => navigate(`/admin/tests/${test.id}/builder`)}
									>
										✏️ Editează
									</button>
									{test.status === 'draft' && (
										<button
											className="va-btn va-btn-sm va-btn-success"
											onClick={() => handlePublish(test.id)}
										>
											📤 Publică
										</button>
									)}
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(test.id)}
									>
										🗑️ Șterge
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body" style={{ textAlign: 'center', padding: '3rem' }}>
						<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
						<p className="va-muted" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
							Nu există teste
						</p>
						<p className="va-muted" style={{ fontSize: '0.9rem' }}>
							{Object.values(filters).some(f => f !== 'all' && f !== '') 
								? 'Încearcă să modifici filtrele' 
								: 'Creează primul test pentru a începe'}
						</p>
						{!Object.values(filters).some(f => f !== 'all' && f !== '') && (
							<button
								className="va-btn va-btn-primary"
								style={{ marginTop: '1.5rem' }}
								onClick={() => navigate('/admin/tests/new/builder')}
							>
								+ Creează Test Nou
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminTestsPage;

