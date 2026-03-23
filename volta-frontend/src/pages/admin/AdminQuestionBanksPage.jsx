import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import VoltInstructor from '../../components/admin/VoltInstructor';

const AdminQuestionBanksPage = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [banks, setBanks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	
	// Filters and search
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		status: 'all',
		activeCount: 0
	});
	const [sortBy, setSortBy] = useState('recent');
	const [viewMode, setViewMode] = useState('grid');
	
	// Selection
	const [selectedBanks, setSelectedBanks] = useState(new Set());
	const [deleteConfirmBankId, setDeleteConfirmBankId] = useState(null);
	const [deleteLoading, setDeleteLoading] = useState(false);

	// Fetch question banks
	const fetchBanks = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			
			const params = {
				search: searchQuery || undefined,
				status: filters.status !== 'all' ? filters.status : undefined,
			};
			
			const data = await adminService.getQuestionBanks(params);
			setBanks(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching question banks:', err);
			setError('Nu s-au putut încărca băncile de întrebări');
			showToast('Eroare la încărcarea băncilor de întrebări', 'error');
		} finally {
			setLoading(false);
		}
	}, [searchQuery, filters, showToast]);

	useEffect(() => {
		fetchBanks();
	}, [fetchBanks]);

	// Calculate active filters count
	useEffect(() => {
		let count = 0;
		if (filters.status !== 'all') count++;
		setFilters(prev => ({ ...prev, activeCount: count }));
	}, [filters.status]);

	// Handle filter change
	const handleFilterChange = (key, value) => {
		setFilters(prev => ({ ...prev, [key]: value }));
	};

	// Handle bank selection
	const handleSelectBank = (bankId, selected) => {
		setSelectedBanks(prev => {
			const newSet = new Set(prev);
			if (selected) {
				newSet.add(bankId);
			} else {
				newSet.delete(bankId);
			}
			return newSet;
		});
	};

	// Handle quick actions
	const handleQuickAction = async (bankId, action) => {
		try {
			switch (action) {
				case 'delete':
					setDeleteConfirmBankId(bankId);
					return;
				case 'archive':
					await adminService.updateQuestionBank(bankId, { status: 'archived' });
					showToast('Banca de întrebări a fost arhivată', 'success');
					break;
				default:
					console.warn('Unknown action:', action);
			}
			if (action !== 'delete') fetchBanks();
		} catch (err) {
			console.error('Error performing action:', err);
			showToast('Eroare la executarea acțiunii', 'error');
		}
	};

	const handleConfirmDeleteBank = async () => {
		if (!deleteConfirmBankId) return;
		setDeleteLoading(true);
		try {
			await adminService.deleteQuestionBank(deleteConfirmBankId);
			showToast('Banca de întrebări a fost ștearsă cu succes', 'success');
			setDeleteConfirmBankId(null);
			fetchBanks();
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la ștergere', 'error');
		} finally {
			setDeleteLoading(false);
		}
	};

	// Handle create bank
	const handleCreateBank = () => {
		navigate('/admin/question-banks/new/builder');
	};

	// Handle create bank with Volt (questions + generate)
	const handleCreateBankWithVolt = async (voltData) => {
		if (!voltData?.answers?.length) {
			handleCreateBank();
			return;
		}
		try {
			const title = voltData.answers[0]?.trim() || 'Bancă nouă';
			const [desc, teme, nr, tip, pdf] = voltData.answers.slice(1);
			const parts = [desc].filter(Boolean);
			if (teme) parts.push(`Teme: ${teme}`);
			if (nr) parts.push(`Nr. întrebări: ${nr}`);
			if (tip) parts.push(`Tipuri: ${tip}`);
			if (pdf) parts.push(`Fișier brut: ${pdf}`);
			const description = parts.join('\n\n');
			const saved = await adminService.createQuestionBank({
				title,
				description: description || null,
				status: 'draft',
			});
			const bankId = saved?.bank?.id ?? saved?.id ?? saved?.data?.id;
			if (bankId) {
				showToast('Banca creată. Adaugă întrebări în builder.', 'success');
				navigate(`/admin/question-banks/${bankId}/builder`);
			} else {
				handleCreateBank();
			}
		} catch (err) {
			console.error('Error creating bank:', err);
			showToast('Eroare la crearea băncii', 'error');
			handleCreateBank();
		}
	};

	// Get status badge
	const getStatusBadge = (status) => {
		const badges = {
			active: { label: 'Activă', color: '#09A86B', bg: 'rgba(9, 168, 107, 0.1)' },
			draft: { label: 'Ciornă', color: '#9FE22F', bg: 'rgba(159, 226, 47, 0.1)' },
			archived: { label: 'Arhivată', color: '#696E79', bg: 'rgba(105, 110, 121, 0.1)' },
		};
		return badges[status] || badges.draft;
	};

	// Filtered and sorted banks
	const filteredAndSortedBanks = useMemo(() => {
		let filtered = [...banks];

		// Apply search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(bank => 
				(bank.title || '').toLowerCase().includes(query) ||
				(bank.description || '').toLowerCase().includes(query)
			);
		}

		// Apply status filter
		if (filters.status !== 'all') {
			filtered = filtered.filter(bank => bank.status === filters.status);
		}

		// Apply sorting
		if (sortBy === 'recent') {
			filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
		} else if (sortBy === 'alphabetical') {
			filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
		} else if (sortBy === 'questions') {
			filtered.sort((a, b) => (b.questions_count || 0) - (a.questions_count || 0));
		}

		return filtered;
	}, [banks, searchQuery, filters.status, sortBy]);

	if (error) {
		return (
			<div className="admin-container">
				<div className="lms-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error}</p>
					<button className="lms-btn-primary" onClick={fetchBanks}>
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
						<h1 className="admin-courses-title">Bănci de Întrebări</h1>
						<p className="admin-courses-subtitle">
							Gestionează și creează bănci de întrebări reutilizabile pentru teste
						</p>
					</div>
					<div className="admin-courses-header-actions">
						<button className="admin-btn-create-course" onClick={handleCreateBank}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 5V19M5 12H19" strokeLinecap="round"/>
							</svg>
							Creează Bancă
						</button>
					</div>
				</div>

				{/* Search and Filters */}
				<div className="admin-courses-toolbar">
					<div className="admin-courses-search-wrapper">
						<div className="admin-courses-search">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.35-4.35"/>
							</svg>
							<input
								type="text"
								placeholder="Caută bănci de întrebări..."
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
							<option value="active">Active</option>
							<option value="draft">Ciornă</option>
							<option value="archived">Arhivate</option>
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
			</div>

			{/* Banks List/Grid */}
			{loading && banks.length === 0 ? (
				<div className="admin-courses-loading">
					<div className="va-spinner va-spinner-lg"></div>
					<p>Se încarcă băncile de întrebări...</p>
				</div>
			) : filteredAndSortedBanks.length === 0 ? (
				<div className="lms-empty-state">
					<p>Nu există bănci de întrebări disponibile.</p>
					<button className="lms-btn-primary" onClick={handleCreateBank}>
						+ Creează prima bancă
					</button>
				</div>
			) : (
				<div className={viewMode === 'grid' ? 'admin-courses-grid' : 'admin-courses-table'}>
					{viewMode === 'grid' ? (
						<div className="admin-courses-grid-container">
							{filteredAndSortedBanks.map(bank => {
								const statusBadge = getStatusBadge(bank.status);
								return (
									<div
										key={bank.id}
										className={`admin-course-card admin-course-card-simple ${selectedBanks.has(bank.id) ? 'selected' : ''}`}
										onClick={() => navigate(`/admin/question-banks/${bank.id}/builder`)}
									>
										<div className="admin-course-card-checkbox" onClick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedBanks.has(bank.id)}
												onChange={(e) => {
													e.stopPropagation();
													handleSelectBank(bank.id, e.target.checked);
												}}
												className="admin-checkbox-input"
											/>
										</div>
										<div className="admin-course-card-thumbnail">
											<div className="admin-course-card-thumbnail-placeholder admin-course-card-thumbnail-placeholder-icon-only">📋</div>
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
										</div>
										<h3
											className="admin-course-card-title"
											onClick={(e) => { e.stopPropagation(); navigate(`/admin/question-banks/${bank.id}/builder`); }}
										>
											{bank.title}
										</h3>
										<div
											className="admin-course-card-corner-action"
											onClick={(e) => { e.stopPropagation(); navigate(`/admin/question-banks/${bank.id}/builder`); }}
											title="Deschide bancă"
											aria-label="Deschide bancă"
										>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="admin-courses-table-container">
							<div className="admin-courses-table-header">
								<div className="admin-course-table-checkbox"></div>
								<div className="admin-course-table-info-header">Bancă de Întrebări</div>
								<div className="admin-course-table-metrics-header">Metrici</div>
								<div className="admin-course-table-actions-header">Acțiuni</div>
							</div>
							{filteredAndSortedBanks.map(bank => {
								const statusBadge = getStatusBadge(bank.status);
								
								return (
									<div key={bank.id} className="admin-course-table-row">
										<div className="admin-course-table-checkbox">
											<input
												type="checkbox"
												checked={selectedBanks.has(bank.id)}
												onChange={(e) => handleSelectBank(bank.id, e.target.checked)}
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
											</div>
											<h3 className="admin-course-table-title">{bank.title}</h3>
											{bank.description && (
												<p className="admin-course-table-description">
													{bank.description.length > 150 
														? bank.description.substring(0, 150) + '...' 
														: bank.description}
												</p>
											)}
										</div>
										<div className="admin-course-table-metrics">
											<div className="admin-course-table-metric">
												<span className="admin-course-table-metric-label">Întrebări:</span>
												<span className="admin-course-table-metric-value">{bank.questions_count || 0}</span>
											</div>
											{bank.tests_count > 0 && (
												<div className="admin-course-table-metric">
													<span className="admin-course-table-metric-label">Teste:</span>
													<span className="admin-course-table-metric-value">{bank.tests_count}</span>
												</div>
											)}
											{bank.creator && (
												<div className="admin-course-table-metric">
													<span className="admin-course-table-metric-label">Creator:</span>
													<span className="admin-course-table-metric-value">{bank.creator.name || 'Necunoscut'}</span>
												</div>
											)}
										</div>
										<div className="admin-course-table-actions">
											<button
												className="admin-course-table-action-btn"
												onClick={() => navigate(`/admin/question-banks/${bank.id}/builder`)}
											>
												✏️ Editează
											</button>
											<button
												className="admin-course-table-action-btn"
												onClick={() => navigate(`/admin/question-banks/${bank.id}/questions`)}
											>
												📋 Întrebări
											</button>
											<button
												className="admin-course-table-action-btn va-btn-danger"
												onClick={() => handleQuickAction(bank.id, 'delete')}
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

			<VoltInstructor
				actions={[
					{
						label: 'Creează bancă',
						onClick: handleCreateBankWithVolt,
						primary: true,
						questions: [
							'Ce nume vrei pentru banca de întrebări?',
							'Despre ce teme vor fi întrebările? Descrie în detaliu.',
							'Câte întrebări aproximativ vrei să generezi?',
							'Ce tipuri de întrebări? (multiplu răspuns, răspuns scurt, eseu, adevărat/fals, mixt)',
							'Ai material sursă în PDF? Încarcă sau scrie „nu".',
						],
						pdfUploadQuestionIndex: 4,
					},
				]}
			/>

			<ConfirmModal
				open={!!deleteConfirmBankId}
				onClose={() => setDeleteConfirmBankId(null)}
				onConfirm={handleConfirmDeleteBank}
				title="Șterge bancă de întrebări"
				message="Ești sigur că vrei să ștergi această bancă de întrebări?"
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteLoading}
			/>
		</div>
	);
};

export default AdminQuestionBanksPage;
