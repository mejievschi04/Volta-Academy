import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import AutoSaveIndicator from '../../components/common/AutoSaveIndicator';

const debounceMs = 900;

const shuffleInPlace = (arr) => {
	for (let i = arr.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
	return arr;
};

const defaultTest = {
	title: '',
	description: '',
	type: 'graded',
	status: 'draft',
	time_limit_minutes: null,
	max_attempts: null,
	randomize_questions: false,
	randomize_answers: false,
	show_results_immediately: true,
	show_correct_answers: false,
	allow_review: true,
	requires_manual_verification: false,
	question_source: 'direct',
	question_selection: null,
};

const defaultNewQuestion = () => ({
	type: 'multiple_choice',
	content: 'Întrebare nouă',
	points: 1,
	answers: [
		{ text: 'Răspuns A', is_correct: true },
		{ text: 'Răspuns B', is_correct: false },
	],
	explanation: '',
});

const AdminTestEditorPage = () => {
	const { id } = useParams();
	const testId = id && id !== 'new' ? Number(id) : null;
	const isEdit = Number.isFinite(testId);

	const navigate = useNavigate();
	const { showToast } = useToast();

	const [loading, setLoading] = useState(true);
	const [savingStatus, setSavingStatus] = useState(null);
	const [test, setTest] = useState(defaultTest);
	const [questions, setQuestions] = useState([]);
	const [questionBanks, setQuestionBanks] = useState([]);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewShuffleKey, setPreviewShuffleKey] = useState(0);
	const [previewAnswers, setPreviewAnswers] = useState({});
	const [selectionPreviewOpen, setSelectionPreviewOpen] = useState(false);
	const [selectionPreviewLoading, setSelectionPreviewLoading] = useState(false);
	const [selectionPreview, setSelectionPreview] = useState(null);
	const [activeTab, setActiveTab] = useState('details'); // details | source | settings

	const pendingPatchRef = useRef({});
	const debounceRef = useRef(null);

	const fetchTest = useCallback(async () => {
		if (!isEdit) {
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			const data = await adminService.getTest(testId);
			setTest({
				...defaultTest,
				...data,
			});

			try {
				const qs = await adminService.getQuestions(testId);
				setQuestions(Array.isArray(qs) ? qs : []);
			} catch (e) {
				setQuestions([]);
			}

			try {
				const banks = await adminService.getQuestionBanks();
				setQuestionBanks(Array.isArray(banks) ? banks : []);
			} catch (e) {
				setQuestionBanks([]);
			}
		} catch (e) {
			console.error('Failed to load test:', e);
			showToast('Nu s-a putut încărca testul', 'error');
		} finally {
			setLoading(false);
		}
	}, [isEdit, showToast, testId]);

	useEffect(() => {
		fetchTest();
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [fetchTest]);

	const scheduleSave = (patch) => {
		setTest((prev) => ({ ...prev, ...patch }));

		// Only autosave when editing an existing test (avoids creating half-baked tests)
		if (!isEdit) return;

		pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...patch };
		setSavingStatus('saving');

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			const pending = pendingPatchRef.current;
			pendingPatchRef.current = {};
			try {
				await adminService.updateTest(testId, pending);
				setSavingStatus('saved');
			} catch (e) {
				console.error('Autosave test failed:', e);
				setSavingStatus('error');
			}
		}, debounceMs);
	};

	const ensureBanksLoaded = async () => {
		if (questionBanks.length > 0) return;
		try {
			const banks = await adminService.getQuestionBanks();
			setQuestionBanks(Array.isArray(banks) ? banks : []);
		} catch (e) {
			setQuestionBanks([]);
		}
	};

	const handleSave = async () => {
		try {
			setSavingStatus('saving');

			if (!test.title?.trim()) {
				showToast('Titlul este obligatoriu', 'error');
				setSavingStatus('error');
				return;
			}

			if (isEdit) {
				await adminService.updateTest(testId, test);
				setSavingStatus('saved');
				showToast('Test salvat', 'success');
			} else {
				const created = await adminService.createTest(test);
				const createdId = created?.test?.id || created?.id || created?.data?.id;
				showToast('Test creat', 'success');
				if (createdId) {
					navigate(`/admin/tests/${createdId}`);
				} else {
					await fetchTest();
				}
			}
		} catch (e) {
			console.error('Save test failed:', e);
			showToast('Eroare la salvare', 'error');
			setSavingStatus('error');
		}
	};

	const handlePublish = async () => {
		if (!isEdit) {
			showToast('Salvează testul înainte de publicare', 'info');
			return;
		}
		try {
			await adminService.publishTest(testId);
			showToast('Test publicat', 'success');
			await fetchTest();
		} catch (e) {
			console.error('Publish test failed:', e);
			showToast('Eroare la publicare', 'error');
		}
	};

	const addQuestion = async () => {
		if (!isEdit) {
			showToast('Salvează testul înainte de a adăuga întrebări', 'info');
			return;
		}
		if ((test.question_source || 'direct') === 'bank') {
			showToast('Acest test folosește Question Bank. Schimbă sursa pe “Direct” ca să adaugi întrebări aici.', 'info');
			return;
		}
		try {
			const q = defaultNewQuestion();
			await adminService.createQuestion(testId, q);
			const qs = await adminService.getQuestions(testId);
			setQuestions(Array.isArray(qs) ? qs : []);
			showToast('Întrebare adăugată', 'success');
		} catch (e) {
			console.error('Create question failed:', e);
			showToast('Eroare la adăugarea întrebării', 'error');
		}
	};

	const updateQuestion = async (questionId, patch) => {
		if ((test.question_source || 'direct') === 'bank') return;
		try {
			const current = questions.find((q) => q.id === questionId);
			const next = { ...current, ...patch };
			setQuestions((prev) => prev.map((q) => (q.id === questionId ? next : q)));
			await adminService.updateQuestion(questionId, next);
		} catch (e) {
			console.error('Update question failed:', e);
			showToast('Eroare la salvarea întrebării', 'error');
		}
	};

	const deleteQuestion = async (questionId) => {
		if ((test.question_source || 'direct') === 'bank') return;
		if (!window.confirm('Ștergi întrebarea?')) return;
		try {
			await adminService.deleteQuestion(questionId);
			setQuestions((prev) => prev.filter((q) => q.id !== questionId));
			showToast('Întrebare ștearsă', 'success');
		} catch (e) {
			console.error('Delete question failed:', e);
			showToast('Eroare la ștergere', 'error');
		}
	};

	const persistReorder = async (nextQuestions) => {
		if (!isEdit) return;
		if ((test.question_source || 'direct') === 'bank') return;

		try {
			setQuestions(nextQuestions);
			await adminService.reorderTestQuestions(
				testId,
				nextQuestions.map((q) => q.id).filter(Boolean)
			);
		} catch (e) {
			console.error('Reorder questions failed:', e);
			showToast('Eroare la reordonarea întrebărilor', 'error');
		}
	};

	const moveQuestion = async (questionId, direction) => {
		const index = questions.findIndex((q) => q.id === questionId);
		if (index < 0) return;
		const nextIndex = direction === 'up' ? index - 1 : index + 1;
		if (nextIndex < 0 || nextIndex >= questions.length) return;

		const next = [...questions];
		const tmp = next[index];
		next[index] = next[nextIndex];
		next[nextIndex] = tmp;

		await persistReorder(next);
	};

	const headerTitle = useMemo(() => {
		if (!isEdit) return 'Creează Test';
		return `Editează Test: ${test?.title || ''}`;
	}, [isEdit, test?.title]);

	const previewQuestions = useMemo(() => {
		// Force reshuffle when the modal is opened or refreshed
		void previewShuffleKey;

		const base = (Array.isArray(questions) ? questions : []).slice().sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
		if (!test.randomize_questions) {
			if (!test.randomize_answers) return base;
			return base.map((q) => {
				const answers = Array.isArray(q.answers) ? q.answers.slice() : [];
				return { ...q, answers: shuffleInPlace(answers) };
			});
		}

		const shuffled = shuffleInPlace(base);
		if (!test.randomize_answers) return shuffled;
		return shuffled.map((q) => {
			const answers = Array.isArray(q.answers) ? q.answers.slice() : [];
			return { ...q, answers: shuffleInPlace(answers) };
		});
	}, [questions, test.randomize_answers, test.randomize_questions, previewShuffleKey]);

	const openPreview = () => {
		if (!isEdit) {
			showToast('Salvează testul înainte de preview', 'info');
			return;
		}
		setPreviewAnswers({});
		setPreviewShuffleKey(Date.now());
		setPreviewOpen(true);
	};

	const openSelectionPreview = async () => {
		if (!isEdit) {
			showToast('Salvează testul înainte de preview', 'info');
			return;
		}
		try {
			setSelectionPreviewOpen(true);
			setSelectionPreviewLoading(true);
			const data = await adminService.previewTestSelection(testId);
			setSelectionPreview(data);
		} catch (e) {
			console.error('Selection preview failed:', e);
			showToast('Nu s-a putut genera preview-ul selecției', 'error');
			setSelectionPreview(null);
		} finally {
			setSelectionPreviewLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="va-spinner va-spinner-lg"></div>
					<p>Se încarcă...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">{headerTitle}</h1>
					<p className="admin-page-subtitle">
						Creare/editare teste (fără vechiul Test Builder).
					</p>
				</div>
				<div className="admin-page-header-actions">
					<AutoSaveIndicator status={savingStatus} />
					<button className="admin-btn admin-btn-secondary" onClick={openPreview} disabled={!isEdit}>
						Preview
					</button>
					<button className="admin-btn admin-btn-secondary" onClick={() => navigate('/admin/tests')}>
						← Înapoi
					</button>
					<button className="admin-btn admin-btn-secondary" onClick={handleSave}>
						Salvează
					</button>
					<button className="admin-btn admin-btn-primary" onClick={handlePublish} disabled={!isEdit}>
						Publică
					</button>
				</div>
			</div>

			<div className="admin-test-creator-split" style={{ marginTop: 'var(--space-6)' }}>
				<div className="admin-test-creator-left">
					<div className="admin-settings-tabs">
						<button
							className={`admin-settings-tab ${activeTab === 'details' ? 'active' : ''}`}
							onClick={() => setActiveTab('details')}
							type="button"
						>
							Detalii
						</button>
						<button
							className={`admin-settings-tab ${activeTab === 'source' ? 'active' : ''}`}
							onClick={() => setActiveTab('source')}
							type="button"
						>
							Sursă & Rules
						</button>
						<button
							className={`admin-settings-tab ${activeTab === 'settings' ? 'active' : ''}`}
							onClick={() => setActiveTab('settings')}
							type="button"
						>
							Setări
						</button>
					</div>

					{activeTab === 'details' && (
						<div className="admin-settings-section">
							<h3 className="admin-settings-section-title">Detalii</h3>

							<div className="admin-settings-form-group">
								<label className="admin-settings-label">Titlu</label>
								<input
									className="admin-settings-input"
									value={test.title || ''}
									onChange={(e) => scheduleSave({ title: e.target.value })}
								/>
							</div>

							<div className="admin-settings-form-group">
								<label className="admin-settings-label">Descriere</label>
								<textarea
									className="admin-settings-textarea"
									rows={4}
									value={test.description || ''}
									onChange={(e) => scheduleSave({ description: e.target.value })}
								/>
							</div>

							<div className="admin-settings-form-row">
								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Tip</label>
									<select
										className="admin-settings-select"
										value={test.type || 'graded'}
										onChange={(e) => scheduleSave({ type: e.target.value })}
									>
										<option value="practice">Practice</option>
										<option value="graded">Graded</option>
										<option value="final">Final</option>
									</select>
								</div>

								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Status</label>
									<select
										className="admin-settings-select"
										value={test.status || 'draft'}
										onChange={(e) => scheduleSave({ status: e.target.value })}
									>
										<option value="draft">Draft</option>
										<option value="published">Publicat</option>
										<option value="archived">Arhivat</option>
									</select>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'source' && (
						<div className="admin-settings-section">
							<h3 className="admin-settings-section-title">Sursă & Rules</h3>

							<div className="admin-settings-form-row">
								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Sursă întrebări</label>
									<select
										className="admin-settings-select"
										value={test.question_source || 'direct'}
										onChange={async (e) => {
											const nextSource = e.target.value;
											if (nextSource === 'bank') {
												await ensureBanksLoaded();
											}
											scheduleSave({ question_source: nextSource, question_set_id: nextSource === 'bank' ? (test.question_set_id || null) : null });
										}}
									>
										<option value="direct">Direct (în test)</option>
										<option value="bank">Din Question Bank</option>
									</select>
									<div className="admin-settings-hint">
										Direct = întrebările sunt salvate în test. Bank = testul folosește întrebările dintr-o bancă reutilizabilă.
									</div>
								</div>

								{(test.question_source || 'direct') === 'bank' && (
									<div className="admin-settings-form-group">
										<label className="admin-settings-label">Question Bank</label>
										<select
											className="admin-settings-select"
											value={test.question_set_id || ''}
											onChange={(e) =>
												scheduleSave({ question_set_id: e.target.value ? Number(e.target.value) : null })
											}
										>
											<option value="">Alege o bancă…</option>
											{questionBanks.map((b) => (
												<option key={b.id} value={b.id}>
													{b.title}
												</option>
											))}
										</select>
										<div className="admin-settings-hint">
											Editezi banca din „Question Banks”.
										</div>
									</div>
								)}
							</div>

							{(test.question_source || 'direct') === 'bank' && (
								<div style={{ marginTop: 'var(--space-4)' }}>
									<div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
										Bank Rules
									</div>
									<div className="admin-settings-hint" style={{ marginBottom: 'var(--space-3)' }}>
										Opțional: dacă setezi reguli, testul va lua automat un subset din bancă (deterministic per încercare).
									</div>

									<div className="admin-settings-form-row">
										<div className="admin-settings-form-group">
											<label className="admin-settings-label">Mod</label>
											<select
												className="admin-settings-select"
												value={(test.question_selection?.mode) || 'random'}
												onChange={(e) => {
													const next = {
														...(test.question_selection || {}),
														mode: e.target.value,
													};
													scheduleSave({ question_selection: next });
												}}
											>
												<option value="random">Random (recomandat)</option>
												<option value="ordered">Ordine (după order)</option>
											</select>
										</div>

										<div className="admin-settings-form-group">
											<label className="admin-settings-label">Număr întrebări</label>
											<input
												className="admin-settings-input"
												type="number"
												min="0"
												value={test.question_selection?.count ?? 20}
												onChange={(e) => {
													const count = e.target.value === '' ? 0 : Number(e.target.value);
													const next = {
														...(test.question_selection || {}),
														count,
													};
													scheduleSave({ question_selection: next });
												}}
											/>
											<div className="admin-settings-hint">0 = toate întrebările din bancă.</div>
										</div>
									</div>

									<div className="admin-settings-form-row">
										<div className="admin-settings-form-group">
											<label className="admin-settings-label">Difficulty (optional)</label>
											<select
												className="admin-settings-select"
												value={test.question_selection?.difficulty || ''}
												onChange={(e) => {
													const next = {
														...(test.question_selection || {}),
														difficulty: e.target.value || null,
													};
													scheduleSave({ question_selection: next });
												}}
											>
												<option value="">Orice</option>
												<option value="easy">Easy</option>
												<option value="medium">Medium</option>
												<option value="hard">Hard</option>
											</select>
										</div>

										<div className="admin-settings-form-group">
											<label className="admin-settings-label">Tags (optional)</label>
											<input
												className="admin-settings-input"
												value={(test.question_selection?.tags || []).join(', ')}
												onChange={(e) => {
													const tags = e.target.value
														.split(',')
														.map((t) => t.trim())
														.filter(Boolean);
													const next = {
														...(test.question_selection || {}),
														tags,
													};
													scheduleSave({ question_selection: next });
												}}
												placeholder="ex: tablouri, bucle, oop"
											/>
										</div>
									</div>

									<div style={{ display: 'flex', gap: 'var(--space-2)' }}>
										<button
											type="button"
											className="admin-btn admin-btn-secondary"
											onClick={() => scheduleSave({ question_selection: null })}
										>
											Resetează reguli
										</button>
										<button
											type="button"
											className="admin-btn admin-btn-secondary"
											onClick={openSelectionPreview}
											disabled={!isEdit}
										>
											Preview selecție
										</button>
									</div>
								</div>
							)}
						</div>
					)}

					{activeTab === 'settings' && (
						<div className="admin-settings-section">
							<h3 className="admin-settings-section-title">Setări</h3>

							<div className="admin-settings-form-row">
								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Limită timp (minute)</label>
									<input
										className="admin-settings-input"
										type="number"
										min="0"
										value={test.time_limit_minutes ?? ''}
										onChange={(e) =>
											scheduleSave({ time_limit_minutes: e.target.value === '' ? null : Number(e.target.value) })
										}
									/>
								</div>
								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Max încercări</label>
									<input
										className="admin-settings-input"
										type="number"
										min="0"
										value={test.max_attempts ?? ''}
										onChange={(e) =>
											scheduleSave({ max_attempts: e.target.value === '' ? null : Number(e.target.value) })
										}
									/>
								</div>
							</div>

							<div className="admin-settings-form-group">
								<label className="admin-settings-label">Comportament</label>
								<div style={{ display: 'grid', gap: 'var(--space-2)' }}>
									<label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={!!test.randomize_questions}
											onChange={(e) => scheduleSave({ randomize_questions: e.target.checked })}
										/>
										Randomizează întrebările
									</label>
									<label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={!!test.randomize_answers}
											onChange={(e) => scheduleSave({ randomize_answers: e.target.checked })}
										/>
										Randomizează răspunsurile
									</label>
									<label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={!!test.show_results_immediately}
											onChange={(e) => scheduleSave({ show_results_immediately: e.target.checked })}
										/>
										Afișează rezultatele imediat
									</label>
									<label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={!!test.show_correct_answers}
											onChange={(e) => scheduleSave({ show_correct_answers: e.target.checked })}
										/>
										Afișează răspunsurile corecte
									</label>
									<label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={!!test.allow_review}
											onChange={(e) => scheduleSave({ allow_review: e.target.checked })}
										/>
										Permite review
									</label>
									<label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
										<input
											type="checkbox"
											checked={!!test.requires_manual_verification}
											onChange={(e) => scheduleSave({ requires_manual_verification: e.target.checked })}
										/>
										Verificare manuală (răspuns scurt, eseu)
									</label>
								</div>
							</div>
						</div>
					)}
				</div>

				<div className="admin-test-creator-right">
					<div className="admin-settings-section">
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
							<h3 className="admin-settings-section-title" style={{ marginBottom: 0 }}>
								Întrebări
							</h3>
							<button className="admin-btn admin-btn-secondary" onClick={addQuestion} disabled={(test.question_source || 'direct') === 'bank'}>
								+ Adaugă întrebare
							</button>
						</div>

						{(test.question_source || 'direct') === 'bank' && (
							<div className="admin-card" style={{ marginTop: 'var(--space-4)' }}>
								<div className="admin-card-body">
									<div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
										Acest test folosește o Question Bank
									</div>
									<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
										Întrebările se editează în Question Bank-ul selectat. Pentru întrebări “direct”, schimbă sursa în “Direct”.
									</div>
								</div>
							</div>
						)}

						{questions.length === 0 ? (
							<div className="lms-empty-state" style={{ marginTop: 'var(--space-4)' }}>
								<p>Nu există întrebări încă.</p>
							</div>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
								{questions.map((q) => (
									<div key={q.id} className="admin-card">
										<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
												<div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
													<select
														className="admin-settings-select"
														value={q.type}
														onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
														disabled={(test.question_source || 'direct') === 'bank'}
													>
														<option value="multiple_choice">Multiple choice</option>
														<option value="true_false">True/False</option>
														<option value="short_answer">Short answer</option>
														<option value="essay">Essay</option>
														<option value="fill_in_blank">Fill in blank</option>
														<option value="matching">Matching</option>
														<option value="ordering">Ordering</option>
													</select>
													<input
														className="admin-settings-input"
														style={{ width: 110 }}
														type="number"
														min="0"
														value={q.points ?? 1}
														onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
														title="Puncte"
														disabled={(test.question_source || 'direct') === 'bank'}
													/>
												</div>
												<div style={{ display: 'flex', gap: 'var(--space-2)' }}>
													<button
														className="admin-btn admin-btn-secondary"
														onClick={() => moveQuestion(q.id, 'up')}
														disabled={(test.question_source || 'direct') === 'bank'}
														title="Mută sus"
													>
														↑
													</button>
													<button
														className="admin-btn admin-btn-secondary"
														onClick={() => moveQuestion(q.id, 'down')}
														disabled={(test.question_source || 'direct') === 'bank'}
														title="Mută jos"
													>
														↓
													</button>
													<button
														className="admin-btn admin-btn-secondary"
														onClick={() => deleteQuestion(q.id)}
														disabled={(test.question_source || 'direct') === 'bank'}
													>
														Șterge
													</button>
												</div>
											</div>

											<textarea
												className="admin-settings-textarea"
												rows={3}
												value={q.content || ''}
												onChange={(e) => updateQuestion(q.id, { content: e.target.value })}
												placeholder="Conținut întrebare"
												disabled={(test.question_source || 'direct') === 'bank'}
											/>

											{(q.type === 'multiple_choice' || q.type === 'true_false') && (
												<div style={{ display: 'grid', gap: 'var(--space-2)' }}>
													<label className="admin-settings-label">Răspunsuri</label>
													{(q.answers || []).map((a, idx) => (
														<div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
															<input
																type="radio"
																name={`q-${q.id}-correct`}
																checked={!!a?.is_correct}
																onChange={() => {
																	const nextAnswers = (q.answers || []).map((x, i) => ({ ...(x || {}), is_correct: i === idx }));
																	updateQuestion(q.id, { answers: nextAnswers });
																}}
																title="Corect"
																disabled={(test.question_source || 'direct') === 'bank'}
															/>
															<input
																className="admin-settings-input"
																value={a?.text || ''}
																onChange={(e) => {
																	const nextAnswers = (q.answers || []).map((x, i) => (i === idx ? { ...(x || {}), text: e.target.value } : x));
																	updateQuestion(q.id, { answers: nextAnswers });
																}}
																placeholder={`Răspuns ${idx + 1}`}
																disabled={(test.question_source || 'direct') === 'bank'}
															/>
														</div>
													))}
												</div>
											)}

											<textarea
												className="admin-settings-textarea"
												rows={2}
												value={q.explanation || ''}
												onChange={(e) => updateQuestion(q.id, { explanation: e.target.value })}
												placeholder="Explicație (opțional)"
												disabled={(test.question_source || 'direct') === 'bank'}
											/>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{selectionPreviewOpen && (
				<div
					className="admin-team-modal-overlay"
					onClick={() => setSelectionPreviewOpen(false)}
					style={{ zIndex: 10000 }}
				>
					<div
						className="admin-team-modal"
						onClick={(e) => e.stopPropagation()}
						style={{ width: 'min(980px, calc(100vw - 32px))' }}
					>
						<div className="admin-team-modal-header">
							<div>
								<h2 className="admin-team-modal-title">Preview selecție întrebări</h2>
								<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
									Îți arată câte întrebări match-uiesc regulile și ce se selectează (sample stabil).
								</p>
							</div>
							<button
								type="button"
								className="admin-team-modal-close"
								onClick={() => setSelectionPreviewOpen(false)}
							>
								×
							</button>
						</div>

						<div className="admin-team-modal-body">
							{selectionPreviewLoading ? (
								<div className="lms-dashboard-loading">
									<div className="lms-spinner"></div>
									<p>Se încarcă...</p>
								</div>
							) : !selectionPreview ? (
								<div className="lms-empty-state">
									<p>Nu există date de preview.</p>
								</div>
							) : (
								<>
									<div className="admin-card" style={{ marginBottom: 'var(--space-4)' }}>
										<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
											<div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
												<span className="lms-tag">bank_total: {selectionPreview.bank_total ?? 0}</span>
												<span className="lms-tag">matched_total: {selectionPreview.matched_total ?? 0}</span>
												<span className="lms-tag">selected_total: {selectionPreview.selected_total ?? 0}</span>
												<span className="lms-tag">mode: {selectionPreview.mode || '—'}</span>
											</div>
											{selectionPreview.note ? (
												<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
													{selectionPreview.note}
												</div>
											) : null}
										</div>
									</div>

									{Array.isArray(selectionPreview.selected) && selectionPreview.selected.length > 0 ? (
										<div style={{ display: 'grid', gap: 'var(--space-3)' }}>
											{selectionPreview.selected.slice(0, 50).map((q, idx) => (
												<div key={q.id || idx} className="admin-card">
													<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
														<div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
															{idx + 1}. {q.content || q.text || '—'}
														</div>
														<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
															{q.type || '—'} • {q.points ?? 1}p • difficulty: {q.metadata?.difficulty || '—'} • tags:{' '}
															{Array.isArray(q.metadata?.tags) ? q.metadata.tags.join(', ') : (q.metadata?.tags || '—')}
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="lms-empty-state">
											<p>Nu s-au selectat întrebări (verifică bank + reguli).</p>
										</div>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{previewOpen && (
				<div
					className="admin-team-modal-overlay"
					onClick={() => setPreviewOpen(false)}
					style={{ zIndex: 10000 }}
				>
					<div
						className="admin-team-modal"
						onClick={(e) => e.stopPropagation()}
						style={{ width: 'min(980px, calc(100vw - 32px))' }}
					>
						<div className="admin-team-modal-header">
							<div style={{ minWidth: 0 }}>
								<h2 className="admin-team-modal-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									Preview: {test.title || '(fără titlu)'}
								</h2>
								{test.description ? (
									<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
										{test.description}
									</p>
								) : null}
							</div>
							<button
								type="button"
								className="admin-team-modal-close"
								onClick={() => setPreviewOpen(false)}
							>
								×
							</button>
						</div>

						<div className="admin-team-modal-body">
							<div className="admin-card" style={{ marginBottom: 'var(--space-4)' }}>
								<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
										<span className="lms-tag">{test.type || 'graded'}</span>
										<span className="lms-tag">{test.question_source || 'direct'}</span>
										{test.time_limit_minutes ? <span className="lms-tag">{test.time_limit_minutes} min</span> : <span className="lms-tag">fără timp</span>}
										{test.max_attempts ? <span className="lms-tag">{test.max_attempts} încercări</span> : <span className="lms-tag">încercări nelimitate</span>}
									</div>
									<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
										{test.randomize_questions ? 'Întrebări randomizate' : 'Ordine fixă'} · {test.randomize_answers ? 'Răspunsuri randomizate' : 'Răspunsuri fixe'}
									</div>
									{(test.randomize_questions || test.randomize_answers) && (
										<div style={{ display: 'flex', gap: 'var(--space-2)' }}>
											<button
												type="button"
												className="admin-btn admin-btn-secondary"
												onClick={() => setPreviewShuffleKey(Date.now())}
											>
												Regenerează ordinea
											</button>
										</div>
									)}
								</div>
							</div>

							{previewQuestions.length === 0 ? (
								<div className="lms-empty-state">
									<p>Nu există întrebări pentru preview.</p>
								</div>
							) : (
								<div style={{ display: 'grid', gap: 'var(--space-4)' }}>
									{previewQuestions.map((q, idx) => {
										const selected = previewAnswers[q.id];
										const correct = Array.isArray(q.answers) ? q.answers.find((a) => a?.is_correct) : null;
										const showCorrectNow = !!test.show_results_immediately && !!test.show_correct_answers;

										return (
											<div key={q.id} className="admin-card">
												<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
													<div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
														{idx + 1}. {q.content || ''}
													</div>
													<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
														{q.type} · {q.points ?? 1}p
													</div>

													{(q.type === 'multiple_choice' || q.type === 'true_false') && (
														<div style={{ display: 'grid', gap: 'var(--space-2)' }}>
															{(q.answers || []).map((a, aIdx) => {
																const value = a?.text ?? '';
																const isSelected = selected === value;
																const isCorrect = !!a?.is_correct;
																const highlight = showCorrectNow ? (isCorrect ? '1px solid rgba(16,185,129,.55)' : isSelected ? '1px solid rgba(239,68,68,.55)' : '1px solid rgba(0,0,0,.08)') : '1px solid rgba(0,0,0,.08)';
																const bg = showCorrectNow ? (isCorrect ? 'rgba(16,185,129,.08)' : isSelected ? 'rgba(239,68,68,.08)' : 'transparent') : (isSelected ? 'rgba(59,130,246,.08)' : 'transparent');

																return (
																	<label
																		key={aIdx}
																		style={{
																			display: 'flex',
																			gap: 'var(--space-2)',
																			alignItems: 'center',
																			padding: '10px 12px',
																			borderRadius: 'var(--radius-md)',
																			border: highlight,
																			background: bg,
																			cursor: 'pointer',
																		}}
																	>
																		<input
																			type="radio"
																			name={`preview-q-${q.id}`}
																			checked={isSelected}
																			onChange={() => setPreviewAnswers((prev) => ({ ...prev, [q.id]: value }))}
																		/>
																		<span style={{ flex: 1, minWidth: 0 }}>{value}</span>
																		{showCorrectNow && isCorrect ? (
																			<span style={{ color: 'rgb(16,185,129)', fontWeight: 600 }}>corect</span>
																		) : null}
																	</label>
																);
															})}
														</div>
													)}

													{q.type === 'short_answer' && (
														<input
															className="admin-settings-input"
															value={selected || ''}
															onChange={(e) => setPreviewAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
															placeholder="Răspuns…"
														/>
													)}

													{(q.type === 'essay' || q.type === 'fill_in_blank' || q.type === 'matching' || q.type === 'ordering') && (
														<textarea
															className="admin-settings-textarea"
															rows={3}
															value={selected || ''}
															onChange={(e) => setPreviewAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
															placeholder="Răspuns (preview)…"
														/>
													)}

													{showCorrectNow && (q.explanation || correct?.text) ? (
														<div className="admin-settings-hint">
															<strong>Explicație:</strong> {q.explanation || '—'}
														</div>
													) : null}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminTestEditorPage;

