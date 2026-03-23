import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import AdminTestReviewsPage from './AdminTestReviewsPage';
import './AdminTestsPage.css';

const STATUS_LABELS = { published: 'Publicat', draft: 'Ciornă', archived: 'Arhivat' };
const TYPE_LABELS = { practice: 'Exersare', graded: 'Notat', final: 'Final' };

const AdminTestsPage = ({ embedded = false, reviewsTab = false, onSubTabChange }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const isReviewsTab = embedded ? reviewsTab : location.pathname === '/admin/tests/reviews';
	const { showToast } = useToast();

	const [tests, setTests] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [typeFilter, setTypeFilter] = useState('all');
	const [sortBy, setSortBy] = useState('recent');
	const [deleteId, setDeleteId] = useState(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [duplicateId, setDuplicateId] = useState(null);
	const [duplicateLoading, setDuplicateLoading] = useState(false);

	const fetchTests = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const params = {
				search: search || undefined,
				status: statusFilter !== 'all' ? statusFilter : undefined,
				type: typeFilter !== 'all' ? typeFilter : undefined,
			};
			const data = await adminService.getTests(params);
			setTests(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error(err);
			setError('Nu s-au putut încărca testele.');
			showToast('Eroare la încărcarea testelor', 'error');
		} finally {
			setLoading(false);
		}
	}, [search, statusFilter, typeFilter, showToast]);

	useEffect(() => { fetchTests(); }, [fetchTests]);

	const filteredTests = useMemo(() => {
		let list = [...tests];
		if (sortBy === 'recent') list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
		else if (sortBy === 'alpha') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
		else if (sortBy === 'questions') list.sort((a, b) => (b.questions_count || 0) - (a.questions_count || 0));
		return list;
	}, [tests, sortBy]);

	const handlePublish = async (id) => {
		try {
			await adminService.publishTest(id);
			showToast('Test publicat cu succes', 'success');
			fetchTests();
		} catch (err) {
			const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
			const friendly = msg && (
				msg.includes('without questions') ? 'Testul trebuie să aibă cel puțin o întrebare.' :
				msg.includes('without question bank') ? 'Selectează o bancă de întrebări.' :
				msg.includes('empty question bank') ? 'Banca de întrebări selectată este goală.' :
				null
			);
			showToast(friendly || msg || 'Eroare la publicare', 'error');
		}
	};

	const handleArchive = async (id) => {
		try {
			await adminService.updateTest(id, { status: 'archived' });
			showToast('Test arhivat', 'success');
			fetchTests();
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare', 'error');
		}
	};

	const handleConfirmDelete = async () => {
		if (!deleteId) return;
		setDeleteLoading(true);
		try {
			await adminService.deleteTest(deleteId);
			showToast('Test șters', 'success');
			setDeleteId(null);
			fetchTests();
		} catch (err) {
			const d = err?.response?.data;
			showToast(d?.error || d?.message || 'Eroare la ștergere', 'error');
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleCreate = () => navigate('/admin/tests/new');

	const handleDuplicate = async (id) => {
		setDuplicateId(id);
		setDuplicateLoading(true);
		try {
			const test = await adminService.getTest(id);
			const payload = {
				title: `Copia – ${test.title || 'Test'}`,
				description: test.description || null,
				type: test.type || 'graded',
				status: 'draft',
				time_limit_minutes: test.time_limit_minutes ?? null,
				max_attempts: test.max_attempts ?? null,
				randomize_questions: !!test.randomize_questions,
				randomize_answers: !!test.randomize_answers,
				show_results_immediately: test.show_results_immediately !== false,
				show_correct_answers: !!test.show_correct_answers,
				allow_review: test.allow_review !== false,
				requires_manual_verification: !!test.requires_manual_verification,
				question_source: test.question_source || 'direct',
				question_set_id: test.question_set_id || null,
				question_selection: test.question_selection || null,
			};
			if (payload.question_source === 'direct') {
				const questions = await adminService.getQuestions(id);
				payload.questions = (Array.isArray(questions) ? questions : []).map((q) => ({
					type: q.type || 'multiple_choice',
					content: q.content || '',
					answers: q.answers || [],
					points: q.points ?? 1,
					order: q.order ?? 0,
					explanation: q.explanation || null,
				}));
			}
			const res = await adminService.createTest(payload);
			const newId = res?.test?.id ?? res?.id;
			if (newId) {
				showToast('Test duplicat. Poți edita copia.', 'success');
				navigate(`/admin/tests/${newId}`);
			} else {
				showToast('Eroare la duplicare', 'error');
			}
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la duplicare', 'error');
		} finally {
			setDuplicateId(null);
			setDuplicateLoading(false);
		}
	};

	const tabClass = (active) => `tests-nav-tab ${active ? 'active' : ''}`;

	return (
		<div className="admin-tests-page">
			<header className="tests-page-header">
				<div className="tests-page-header-top">
					<h1 className="tests-page-title">Teste</h1>
					<p className="tests-page-subtitle">
						{isReviewsTab ? 'Rezultate care necesită notare manuală' : 'Gestionează și creează teste'}
					</p>
				</div>
				<nav className="tests-nav">
					{embedded && onSubTabChange ? (
						<>
							<button type="button" className={tabClass(!isReviewsTab)} onClick={() => onSubTabChange('')}>Lista teste</button>
							<button type="button" className={tabClass(isReviewsTab)} onClick={() => onSubTabChange('reviews')}>Verificări manuale</button>
						</>
					) : (
						<>
							<NavLink to="/admin/tests" end className={({ isActive }) => tabClass(isActive)}>Lista teste</NavLink>
							<NavLink to="/admin/tests/reviews" className={({ isActive }) => tabClass(isActive)}>Verificări manuale</NavLink>
						</>
					)}
					{!isReviewsTab && (
						<button type="button" className="tests-btn-create" onClick={handleCreate}>
							<span className="tests-btn-create-icon">+</span> Test nou
						</button>
					)}
				</nav>
			</header>

			{isReviewsTab ? (
				<AdminTestReviewsPage embedded />
			) : (
				<>
					<div className="tests-toolbar">
						<div className="tests-search">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
							<input type="search" placeholder="Caută teste..." value={search} onChange={(e) => setSearch(e.target.value)} className="tests-search-input" aria-label="Caută teste" />
						</div>
						<div className="tests-filters">
							<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="tests-select" aria-label="Filtru status">
								<option value="all">Toate statusurile</option>
								<option value="published">Publicat</option>
								<option value="draft">Ciornă</option>
								<option value="archived">Arhivat</option>
							</select>
							<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="tests-select" aria-label="Filtru tip">
								<option value="all">Toate tipurile</option>
								<option value="practice">Exersare</option>
								<option value="graded">Notat</option>
								<option value="final">Final</option>
							</select>
							<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="tests-select" aria-label="Sortare">
								<option value="recent">Cele mai recente</option>
								<option value="alpha">Alfabetic</option>
								<option value="questions">Nr. întrebări</option>
							</select>
						</div>
					</div>

					{error && (
						<div className="tests-error">
							<p>{error}</p>
							<button type="button" className="tests-btn-secondary" onClick={fetchTests}>Încearcă din nou</button>
						</div>
					)}

					{!error && loading && tests.length === 0 && (
						<div className="tests-loading">
							<div className="va-spinner va-spinner-lg" aria-hidden />
							<p>Se încarcă testele...</p>
						</div>
					)}

					{!error && !loading && filteredTests.length === 0 && (
						<div className="tests-empty">
							<p>Nu există teste.</p>
							<button type="button" className="tests-btn-primary" onClick={handleCreate}>Creează primul test</button>
						</div>
					)}

					{!error && !loading && filteredTests.length > 0 && (
						<div className="tests-grid">
							{filteredTests.map((test) => (
								<article key={test.id} className="tests-card" onClick={() => navigate(`/admin/tests/${test.id}`)}>
									<div className="tests-card-badges">
										<span className="tests-badge tests-badge-status" data-status={test.status}>{STATUS_LABELS[test.status] || test.status}</span>
										<span className="tests-badge tests-badge-type" data-type={test.type}>{TYPE_LABELS[test.type] || test.type}</span>
									</div>
									<h3 className="tests-card-title">{test.title || 'Fără titlu'}</h3>
									{test.description && <p className="tests-card-desc">{test.description.slice(0, 120)}{test.description.length > 120 ? '…' : ''}</p>}
									<div className="tests-card-meta">
										<span>{test.questions_count ?? 0} întrebări</span>
										{test.time_limit_minutes && <span>{test.time_limit_minutes} min</span>}
									</div>
									<div className="tests-card-actions" onClick={(e) => e.stopPropagation()}>
										<button type="button" className="tests-card-btn" onClick={() => navigate(`/admin/tests/${test.id}`)} title="Deschide">Deschide</button>
										<button type="button" className="tests-card-btn" onClick={() => handleDuplicate(test.id)} disabled={duplicateLoading && duplicateId === test.id} title="Duplică test">{duplicateLoading && duplicateId === test.id ? '...' : 'Duplică'}</button>
										{test.status !== 'published' && (
											<button type="button" className="tests-card-btn tests-card-btn-success" onClick={() => handlePublish(test.id)}>Publică</button>
										)}
										{test.status === 'published' && (
											<button type="button" className="tests-card-btn" onClick={() => handleArchive(test.id)}>Arhivează</button>
										)}
										<button type="button" className="tests-card-btn tests-card-btn-danger" onClick={() => setDeleteId(test.id)}>Șterge</button>
									</div>
								</article>
							))}
						</div>
					)}
				</>
			)}

			<ConfirmModal
				open={!!deleteId}
				onClose={() => setDeleteId(null)}
				onConfirm={handleConfirmDelete}
				title="Șterge test"
				message="Ești sigur? Acest test va fi șters definitiv."
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteLoading}
			/>
		</div>
	);
};

export default AdminTestsPage;
