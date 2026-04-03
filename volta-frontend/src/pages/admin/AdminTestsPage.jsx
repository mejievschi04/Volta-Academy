import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import './AdminTestsPage.css';

const EMPTY_FORM = {
	title: '',
	description: '',
	passing_score: 70,
	max_attempts: 3,
	time_limit_minutes: '',
	status: 'draft',
	type: 'graded',
};

const normalizeTests = (raw) => (Array.isArray(raw) ? raw : []);

export default function AdminTestsPage() {
	const { success: showSuccess, error: showError } = useToast();
	const { canMutateInAdminArea } = useAuth();
	const [tests, setTests] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [query, setQuery] = useState('');
	const [showModal, setShowModal] = useState(false);
	const [editingTest, setEditingTest] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [saving, setSaving] = useState(false);
	const [testActionId, setTestActionId] = useState(null);
	const [deleteConfirmTest, setDeleteConfirmTest] = useState(null);

	const loadTests = useCallback(async () => {
		try {
			setLoading(true);
			setError('');
			const data = await adminService.getTests();
			setTests(normalizeTests(data));
		} catch (e) {
			console.error('Failed to load tests:', e);
			setTests([]);
			setError('Nu s-a putut încărca lista de teste.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadTests();
	}, [loadTests]);

	const filteredTests = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return tests;
		return tests.filter((row) => {
			const title = String(row?.title || '').toLowerCase();
			const description = String(row?.description || '').toLowerCase();
			return title.includes(needle) || description.includes(needle);
		});
	}, [tests, query]);

	const openCreateModal = () => {
		setEditingTest(null);
		setForm(EMPTY_FORM);
		setShowModal(true);
	};

	const openEditModal = (item) => {
		setEditingTest(item);
		setForm({
			title: item?.title || '',
			description: item?.description || '',
			passing_score: Number(item?.passing_score ?? 70),
			max_attempts: Number(item?.max_attempts ?? 3),
			time_limit_minutes: item?.time_limit_minutes ?? '',
			status: item?.status || 'draft',
			type: item?.type || 'graded',
		});
		setShowModal(true);
	};

	const closeModal = () => {
		if (saving) return;
		setShowModal(false);
	};

	const handleSave = async () => {
		const title = form.title.trim();
		if (!title) {
			showError('Titlul testului este obligatoriu.');
			return;
		}
		setSaving(true);
		try {
			const payload = {
				title,
				description: form.description.trim(),
				status: form.status || 'draft',
				type: form.type || 'graded',
				passing_score: Number(form.passing_score || 70),
				max_attempts: Number(form.max_attempts || 1),
				time_limit_minutes: form.time_limit_minutes === '' ? null : Number(form.time_limit_minutes),
			};
			if (editingTest?.id) {
				await adminService.updateTest(editingTest.id, payload);
				showSuccess('Test actualizat.');
			} else {
				await adminService.createTest(payload);
				showSuccess('Test creat.');
			}
			setShowModal(false);
			await loadTests();
		} catch (e) {
			console.error('Failed to save test:', e);
			showError(e?.response?.data?.message || 'Nu s-a putut salva testul.');
		} finally {
			setSaving(false);
		}
	};

	const handlePublish = async (item) => {
		if (!item?.id) return;
		setTestActionId(item.id);
		try {
			await adminService.publishTest(item.id);
			showSuccess('Test publicat.');
			await loadTests();
		} catch (e) {
			console.error('Failed to publish test:', e);
			showError(e?.response?.data?.message || 'Nu s-a putut publica testul.');
		} finally {
			setTestActionId(null);
		}
	};

	const patchTestStatus = async (item, status) => {
		if (!item?.id) return;
		setTestActionId(item.id);
		try {
			await adminService.updateTest(item.id, { status });
			const msg =
				status === 'archived'
					? 'Test arhivat.'
					: status === 'draft'
						? 'Test mutat în draft.'
						: 'Test actualizat.';
			showSuccess(msg);
			await loadTests();
		} catch (e) {
			console.error('Failed to update test status:', e);
			showError(e?.response?.data?.message || 'Nu s-a putut actualiza statusul.');
		} finally {
			setTestActionId(null);
		}
	};

	const handleRepublishTest = async (item) => {
		if (!item?.id) return;
		setTestActionId(item.id);
		try {
			await adminService.updateTest(item.id, { status: 'published' });
			showSuccess('Test publicat din nou.');
			await loadTests();
		} catch (e) {
			console.error('Failed to republish test:', e);
			showError(e?.response?.data?.message || 'Nu s-a putut republica testul.');
		} finally {
			setTestActionId(null);
		}
	};

	const handleConfirmDeleteTest = async () => {
		if (!deleteConfirmTest?.id) return;
		setTestActionId(deleteConfirmTest.id);
		try {
			await adminService.deleteTest(deleteConfirmTest.id);
			showSuccess('Test șters.');
			setTests((prev) => prev.filter((row) => row.id !== deleteConfirmTest.id));
			setDeleteConfirmTest(null);
		} catch (e) {
			console.error('Failed to delete test:', e);
			showError(e?.response?.data?.message || 'Nu s-a putut șterge testul.');
		} finally {
			setTestActionId(null);
		}
	};

	return (
		<div className="admin-tests-page">
			<header className="admin-tests-header">
				<div>
					<h1>Teste</h1>
					<p className="admin-tests-header-lead">
						Publică când e gata, arhivează sesiunile vechi, corectează lucrările din „Corectare manuală” — același ritm ca la examene.
					</p>
				</div>
				<div className="admin-tests-header-actions">
					<Link className="admin-tests-secondary-link admin-tests-pending-pill" to="/admin/tests/pending-review">
						<span className="admin-tests-pending-dot" aria-hidden />
						Corectare manuală
					</Link>
					{canMutateInAdminArea ? (
						<button type="button" className="admin-tests-primary-btn" onClick={openCreateModal}>
							+ Creează test
						</button>
					) : null}
				</div>
			</header>

			<div className="admin-tests-search">
				<input
					type="text"
					placeholder="Caută test..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>

			{loading ? (
				<div className="admin-tests-empty">Se încarcă testele...</div>
			) : error ? (
				<div className="admin-tests-empty">{error}</div>
			) : filteredTests.length === 0 ? (
				<div className="admin-tests-empty">Nu există teste încă.</div>
			) : (
				<div className="admin-tests-grid">
					{filteredTests.map((item) => {
						const st = String(item.status || 'draft').toLowerCase();
						const busy = testActionId === item.id;
						return (
							<article key={item.id} className="admin-tests-card">
								<div className="admin-tests-card-head">
									<h3>{item.title || 'Test fără titlu'}</h3>
									<span className={`status ${st}`}>{item.status || 'draft'}</span>
								</div>
								<p>{item.description || 'Fără descriere'}</p>
								<div className="admin-tests-meta">
									<span>Prag: {Number(item.passing_score ?? 70)}%</span>
									<span>Încercări: {item.max_attempts ?? '-'}</span>
									<span>Timp: {item.time_limit_minutes ? `${item.time_limit_minutes} min` : 'nelimitat'}</span>
								</div>
								{canMutateInAdminArea ? (
									<div className="admin-tests-card-footer">
										<div className="admin-tests-actions-primary">
											<button type="button" className="is-wide" disabled={busy} onClick={() => openEditModal(item)}>
												Deschide editorul
											</button>
										</div>
										<div className="admin-tests-actions-grid">
											{st === 'draft' ? (
												<button
													type="button"
													className="is-emphasis"
													disabled={busy}
													onClick={() => handlePublish(item)}
												>
													{busy ? 'Se publică…' : 'Publică'}
												</button>
											) : null}
											{st === 'published' ? (
												<button type="button" disabled={busy} onClick={() => patchTestStatus(item, 'archived')}>
													Arhivează
												</button>
											) : null}
											{st === 'archived' ? (
												<>
													<button type="button" disabled={busy} onClick={() => patchTestStatus(item, 'draft')}>
														În draft
													</button>
													<button type="button" className="is-emphasis" disabled={busy} onClick={() => handleRepublishTest(item)}>
														Publică din nou
													</button>
												</>
											) : null}
											<button type="button" className="is-danger-outline" disabled={busy} onClick={() => setDeleteConfirmTest(item)}>
												Șterge
											</button>
										</div>
									</div>
								) : null}
							</article>
						);
					})}
				</div>
			)}

			{deleteConfirmTest ? (
				<div
					className="admin-tests-modal-overlay"
					role="presentation"
					onClick={() => !testActionId && setDeleteConfirmTest(null)}
				>
					<div
						className="admin-tests-delete-dialog"
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="test-delete-title"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 id="test-delete-title">Ștergi testul?</h3>
						<p className="admin-tests-delete-lead">
							<strong>{deleteConfirmTest.title || 'Test'}</strong> va fi eliminat. Legăturile din cursuri pot înceta să funcționeze.
						</p>
						<p className="admin-tests-delete-hint">Preferi să ascunzi testul de elevi? Folosește „Arhivează” în loc de ștergere.</p>
						<div className="admin-tests-delete-actions">
							<button type="button" disabled={testActionId} onClick={() => setDeleteConfirmTest(null)}>
								Anulează
							</button>
							<button type="button" className="is-danger-solid" disabled={testActionId} onClick={handleConfirmDeleteTest}>
								{testActionId ? 'Se șterge…' : 'Da, șterge'}
							</button>
						</div>
					</div>
				</div>
			) : null}

			{showModal ? (
				<div className="admin-tests-modal-overlay" role="presentation" onClick={closeModal}>
					<div className="admin-tests-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
						<h3>{editingTest ? 'Editare test' : 'Creare test'}</h3>
						<label>
							Titlu
							<input
								type="text"
								value={form.title}
								onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
							/>
						</label>
						<label>
							Descriere
							<textarea
								rows={4}
								value={form.description}
								onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
							/>
						</label>
						<div className="admin-tests-modal-grid">
							<label>
								Prag promovare (%)
								<input
									type="number"
									min={0}
									max={100}
									value={form.passing_score}
									onChange={(e) => setForm((prev) => ({ ...prev, passing_score: Number(e.target.value || 0) }))}
								/>
							</label>
							<label>
								Număr încercări
								<input
									type="number"
									min={1}
									max={20}
									value={form.max_attempts}
									onChange={(e) => setForm((prev) => ({ ...prev, max_attempts: Number(e.target.value || 1) }))}
								/>
							</label>
							<label>
								Timp limită (minute)
								<input
									type="number"
									min={0}
									max={300}
									value={form.time_limit_minutes}
									onChange={(e) => setForm((prev) => ({ ...prev, time_limit_minutes: e.target.value }))}
									placeholder="Gol = nelimitat"
								/>
							</label>
							<label>
								Status
								<select
									value={form.status}
									onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
								>
									<option value="draft">draft</option>
									<option value="published">published</option>
									<option value="archived">archived</option>
								</select>
							</label>
						</div>
						<div className="admin-tests-modal-actions">
							<button type="button" onClick={closeModal} disabled={saving}>Anulează</button>
							<button type="button" className="is-primary" onClick={handleSave} disabled={saving}>
								{saving ? 'Se salvează...' : 'Salvează'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
