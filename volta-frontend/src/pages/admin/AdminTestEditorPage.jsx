import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import './AdminTestEditorPage.css';

const QUESTION_TYPES = [
	{ id: 'multiple_choice', label: 'Răspuns multiplu' },
	{ id: 'true_false', label: 'Adevărat / Fals' },
	{ id: 'short_answer', label: 'Răspuns scurt' },
	{ id: 'essay', label: 'Eseu' },
];

const DEFAULT_TEST = {
	title: '',
	description: '',
	type: 'graded',
	status: 'draft',
	time_limit_minutes: null,
	max_attempts: null,
	randomize_questions: true,
	randomize_answers: true,
	show_results_immediately: true,
	show_correct_answers: false,
	allow_review: true,
	requires_manual_verification: false,
	question_source: 'direct',
	question_set_id: null,
	question_selection: { mode: 'random', count: 20, difficulty: '', tags: '' },
};

const DEBOUNCE_MS = 800;

function normalizeAnswers(answers) {
	if (!Array.isArray(answers)) return [{ text: 'Răspuns A', is_correct: true }, { text: 'Răspuns B', is_correct: false }];
	return answers.map((a) => ({
		text: a.text ?? a.answer_text ?? '',
		is_correct: !!a.is_correct,
	}));
}

function QuestionEditModal({ question, onClose, onSave, saving }) {
	const [type, setType] = useState(question?.type || 'multiple_choice');
	const [content, setContent] = useState(question?.content || '');
	const [points, setPoints] = useState(question?.points ?? '');
	const [answers, setAnswers] = useState(() => normalizeAnswers(question?.answers));
	const [explanation, setExplanation] = useState(question?.explanation || '');

	useEffect(() => {
		if (!question) return;
		setType(question.type || 'multiple_choice');
		setContent(question.content || '');
		setPoints(question.points ?? '');
		setExplanation(question.explanation || '');
		const raw = normalizeAnswers(question.answers);
		if (question.type === 'true_false') {
			const firstCorrect = raw[0]?.is_correct ?? true;
			setAnswers([{ text: 'Adevărat', is_correct: firstCorrect }, { text: 'Fals', is_correct: !firstCorrect }]);
		} else {
			setAnswers(raw.length >= 2 ? raw : [{ text: 'Răspuns A', is_correct: true }, { text: 'Răspuns B', is_correct: false }]);
		}
	}, [question]);

	const hasChoices = type === 'multiple_choice' || type === 'true_false';

	const handleAddAnswer = () => {
		setAnswers((prev) => [...prev, { text: 'Răspuns nou', is_correct: false }]);
	};

	const handleAnswerChange = (idx, field, value) => {
		setAnswers((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
	};

	const handleRemoveAnswer = (idx) => {
		if (answers.length <= 2) return;
		setAnswers((prev) => prev.filter((_, i) => i !== idx));
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		const normalizedPoints = points === '' || points == null ? null : Math.max(1, Number(points) || 1);
		const payload = {
			type,
			content: content.trim() || 'Întrebare',
			points: normalizedPoints,
			explanation: explanation.trim() || null,
		};
		if (hasChoices) payload.answers = answers;
		else payload.answers = [];
		onSave(payload);
	};

	if (!question) return null;

	return (
		<div className="test-editor-modal-overlay" onClick={onClose}>
			<div className="test-editor-modal" onClick={(e) => e.stopPropagation()}>
				<h3 className="test-editor-modal-title">Editează întrebarea</h3>
				<form onSubmit={handleSubmit} className="test-editor-modal-form">
					<div className="test-editor-field">
						<label className="test-editor-label">Tip</label>
						<select className="test-editor-select" value={type} onChange={(e) => setType(e.target.value)}>
							{QUESTION_TYPES.map((t) => (
								<option key={t.id} value={t.id}>{t.label}</option>
							))}
						</select>
					</div>
					<div className="test-editor-field">
						<label className="test-editor-label">Întrebare</label>
						<textarea
							className="test-editor-input test-editor-textarea"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Textul întrebării"
							rows={3}
							required
						/>
					</div>
					<div className="test-editor-field">
						<label className="test-editor-label">Puncte</label>
						<input
							type="number"
							min={1}
							className="test-editor-input"
							value={points}
							onChange={(e) => setPoints(e.target.value)}
							placeholder="Auto (100 / nr. întrebări)"
						/>
					</div>
					{hasChoices && (
						<div className="test-editor-field">
							<label className="test-editor-label">Răspunsuri (bifează corecte)</label>
							{type === 'true_false' ? (
								<div className="test-editor-answers-list">
									{['Adevărat', 'Fals'].map((label, i) => (
										<label key={i} className="test-editor-answer-row">
											<input
												type="radio"
												name="tf"
												checked={answers[i]?.is_correct ?? (i === 0)}
												onChange={() => setAnswers([{ text: 'Adevărat', is_correct: i === 0 }, { text: 'Fals', is_correct: i === 1 }])}
											/>
											<span>{label}</span>
										</label>
									))}
								</div>
							) : (
								<>
									{answers.map((a, idx) => (
										<div key={idx} className="test-editor-answer-row">
											<input
												type="checkbox"
												checked={!!a.is_correct}
												onChange={(e) => handleAnswerChange(idx, 'is_correct', e.target.checked)}
											/>
											<input
												type="text"
												className="test-editor-input test-editor-answer-input"
												value={a.text}
												onChange={(e) => handleAnswerChange(idx, 'text', e.target.value)}
												placeholder={`Răspuns ${idx + 1}`}
											/>
											<button type="button" className="test-editor-answer-remove" onClick={() => handleRemoveAnswer(idx)} aria-label="Elimină">×</button>
										</div>
									))}
									<button type="button" className="test-editor-btn test-editor-btn-secondary test-editor-add-answer" onClick={handleAddAnswer}>
										+ Adaugă răspuns
									</button>
								</>
							)}
						</div>
					)}
					<div className="test-editor-field">
						<label className="test-editor-label">Explicație (opțional)</label>
						<textarea
							className="test-editor-input test-editor-textarea"
							value={explanation}
							onChange={(e) => setExplanation(e.target.value)}
							placeholder="Afișată după răspuns"
							rows={2}
						/>
					</div>
					<div className="test-editor-modal-actions">
						<button type="button" className="test-editor-btn test-editor-btn-secondary" onClick={onClose}>Anulare</button>
						<button type="submit" className="test-editor-btn test-editor-btn-primary" disabled={saving}>{saving ? 'Se salvează...' : 'Salvează'}</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function SortableQuestionItem({ q, index, onEdit, onDelete, onContentChange, onContentBlur }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `q-${q.id}` });
	const style = { transform: CSS.Transform.toString(transform), transition };
	return (
		<li ref={setNodeRef} style={style} className={`test-editor-question-item ${isDragging ? 'test-editor-question-item-dragging' : ''}`}>
			<div className="test-editor-question-head">
				<button type="button" className="test-editor-question-drag" {...attributes} {...listeners} aria-label="Reordonare">⋮⋮</button>
				<span className="test-editor-question-num">{index + 1}.</span>
				<input
					type="text"
					className="test-editor-input test-editor-question-content"
					value={q.content || ''}
					onChange={(e) => onContentChange(q.id, e.target.value)}
					onBlur={(e) => onContentBlur(q.id, e.target.value.trim())}
					placeholder="Text întrebare"
				/>
				<button type="button" className="test-editor-question-edit" onClick={() => onEdit(q)} title="Editează">✏️</button>
				<button type="button" className="test-editor-question-delete" onClick={() => onDelete(q.id)} title="Șterge" aria-label="Șterge">🗑️</button>
			</div>
			<div className="test-editor-question-meta">
				{QUESTION_TYPES.find((t) => t.id === (q.type || 'multiple_choice'))?.label ?? q.type} · Puncte: {q.points ?? 'auto'}
			</div>
		</li>
	);
}

const AdminTestEditorPage = () => {
	const { id } = useParams();
	const testId = id && id !== 'new' ? Number(id) : null;
	const isNew = !testId;
	const navigate = useNavigate();
	const { showToast } = useToast();

	const [loading, setLoading] = useState(!isNew);
	const [saving, setSaving] = useState(false);
	const [test, setTest] = useState({ ...DEFAULT_TEST });
	const [questions, setQuestions] = useState([]);
	const [banks, setBanks] = useState([]);
	const [activeTab, setActiveTab] = useState('details');
	const [deleteQId, setDeleteQId] = useState(null);
	const [deleteQLoading, setDeleteQLoading] = useState(false);
	const [editQuestion, setEditQuestion] = useState(null);
	const [editQuestionSaving, setEditQuestionSaving] = useState(false);
	const pendingRef = useRef({});
	const timerRef = useRef(null);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const loadTest = useCallback(async () => {
		if (isNew) return;
		try {
			setLoading(true);
			const data = await adminService.getTest(testId);
			setTest({ ...DEFAULT_TEST, ...data });
			const qs = await adminService.getQuestions(testId).catch(() => []);
			setQuestions(Array.isArray(qs) ? qs : []);
			const blist = await adminService.getQuestionBanks().catch(() => []);
			setBanks(Array.isArray(blist) ? blist : []);
		} catch (e) {
			console.error(e);
			showToast('Nu s-a putut încărca testul', 'error');
		} finally {
			setLoading(false);
		}
	}, [testId, isNew, showToast]);

	useEffect(() => { loadTest(); }, [loadTest]);

	const savePatch = useCallback((patch) => {
		setTest((prev) => ({ ...prev, ...patch }));
		if (isNew) return;
		Object.assign(pendingRef.current, patch);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(async () => {
			const payload = { ...pendingRef.current };
			pendingRef.current = {};
			if (Object.keys(payload).length === 0) return;
			try {
				await adminService.updateTest(testId, payload);
				showToast('Salvat', 'success');
			} catch (e) {
				showToast(e?.response?.data?.message || 'Eroare la salvare', 'error');
			}
		}, DEBOUNCE_MS);
	}, [testId, isNew, showToast]);

	const handleCreateTest = async (e) => {
		e.preventDefault();
		if (!test.title?.trim()) {
			showToast('Adaugă un titlu', 'error');
			return;
		}
		setSaving(true);
		try {
			const res = await adminService.createTest({
				title: test.title.trim(),
				description: test.description || null,
				type: test.type,
				status: test.status,
			});
			const newId = res?.test?.id ?? res?.id;
			if (newId) {
				showToast('Test creat', 'success');
				navigate(`/admin/tests/${newId}`, { replace: true });
			} else {
				showToast('Răspuns invalid de la server', 'error');
			}
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la creare', 'error');
		} finally {
			setSaving(false);
		}
	};

	const getPublishError = () => {
		if (!test.title?.trim()) return 'Adaugă un titlu test înainte de publicare.';
		if (test.question_source === 'direct') {
			if (!questions.length) return 'Adaugă cel puțin o întrebare înainte de publicare.';
		} else {
			if (!test.question_set_id) return 'Selectează o bancă de întrebări înainte de publicare.';
		}
		return null;
	};

	const handlePublish = async () => {
		const errMsg = getPublishError();
		if (errMsg) {
			showToast(errMsg, 'error');
			return;
		}
		try {
			await adminService.publishTest(testId);
			showToast('Test publicat', 'success');
			loadTest();
		} catch (err) {
			const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message;
			const friendly = msg && (
				msg.includes('without questions') ? 'Testul trebuie să aibă cel puțin o întrebare.' :
				msg.includes('without question bank') ? 'Selectează o bancă de întrebări.' :
				msg.includes('empty question bank') ? 'Banca de întrebări selectată este goală. Adaugă întrebări în bancă.' :
				null
			);
			showToast(friendly || msg || 'Eroare la publicare', 'error');
		}
	};

	const handleDeleteQuestion = async () => {
		if (!deleteQId) return;
		setDeleteQLoading(true);
		try {
			await adminService.deleteQuestion(deleteQId);
			setQuestions((prev) => prev.filter((q) => q.id !== deleteQId));
			setDeleteQId(null);
			showToast('Întrebare ștearsă', 'success');
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare', 'error');
		} finally {
			setDeleteQLoading(false);
		}
	};

	const handleAddQuestion = async () => {
		if (test.question_source === 'bank') {
			showToast('Pentru sursă bancă, adaugă întrebări în banca selectată.', 'info');
			return;
		}
		try {
			const res = await adminService.createQuestion(testId, {
				type: 'multiple_choice',
				content: 'Întrebare nouă',
				answers: [
					{ text: 'Răspuns A', is_correct: true },
					{ text: 'Răspuns B', is_correct: false },
				],
				points: null,
			});
			const q = res?.question ?? res;
			if (q) setQuestions((prev) => [...prev, q]);
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la adăugare', 'error');
		}
	};

	const updateQuestion = async (questionId, patch) => {
		try {
			await adminService.updateQuestion(questionId, patch);
			setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...patch } : q)));
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare', 'error');
		}
	};

	const handleContentChange = (questionId, value) => {
		setQuestions((prev) => prev.map((x) => (x.id === questionId ? { ...x, content: value } : x)));
	};

	const handleContentBlur = (questionId, newContent) => {
		const q = questions.find((x) => x.id === questionId);
		if (q && newContent !== (q.content || '')) updateQuestion(questionId, { content: newContent });
	};

	const handleSaveEditModal = async (payload) => {
		if (!editQuestion) return;
		setEditQuestionSaving(true);
		try {
			await adminService.updateQuestion(editQuestion.id, payload);
			setQuestions((prev) => prev.map((q) => (q.id === editQuestion.id ? { ...q, ...payload } : q)));
			setEditQuestion(null);
			showToast('Întrebare actualizată', 'success');
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la salvare', 'error');
		} finally {
			setEditQuestionSaving(false);
		}
	};

	const handleDragEnd = (event) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = questions.findIndex((q) => `q-${q.id}` === active.id);
		const newIndex = questions.findIndex((q) => `q-${q.id}` === over.id);
		if (oldIndex === -1 || newIndex === -1) return;
		const reordered = arrayMove(questions, oldIndex, newIndex);
		setQuestions(reordered);
		adminService.reorderTestQuestions(testId, reordered.map((q) => q.id)).catch((err) => {
			showToast(err?.response?.data?.message || 'Eroare la reordonare', 'error');
		});
	};

	const updateSelection = (key, value) => {
		const sel = { ...(test.question_selection || {}), [key]: value };
		savePatch({ question_selection: sel });
	};

	if (loading && !isNew) {
		return (
			<div className="test-editor-page">
				<div className="test-editor-loading">
					<div className="va-spinner va-spinner-lg" />
					<p>Se încarcă testul...</p>
				</div>
			</div>
		);
	}

	const isPublished = test.status === 'published';

	return (
		<div className="test-editor-page">
			<header className="test-editor-header">
				<Link to="/admin/tests" className="test-editor-back">← Înapoi la teste</Link>
				<h1 className="test-editor-title">{isNew ? 'Test nou' : (test.title || 'Fără titlu')}</h1>
				{!isNew && (
					<div className="test-editor-actions">
						{!isPublished && (
							<>
								{getPublishError() && (
									<span className="test-editor-publish-hint" title={getPublishError()}>
										⚠️ {getPublishError()}
									</span>
								)}
								<button
									type="button"
									className="test-editor-btn test-editor-btn-primary"
									onClick={handlePublish}
									title={getPublishError() || 'Publică testul'}
								>
									Publică
								</button>
							</>
						)}
						{isPublished && <span className="test-editor-badge-published">Publicat</span>}
					</div>
				)}
			</header>

			{isNew ? (
				<form className="test-editor-form test-editor-form-new" onSubmit={handleCreateTest}>
					<div className="test-editor-field">
						<label className="test-editor-label">Titlu *</label>
						<input
							type="text"
							className="test-editor-input"
							value={test.title}
							onChange={(e) => setTest((p) => ({ ...p, title: e.target.value }))}
							placeholder="Titlul testului"
							required
						/>
					</div>
					<div className="test-editor-field">
						<label className="test-editor-label">Descriere</label>
						<textarea
							className="test-editor-input test-editor-textarea"
							value={test.description || ''}
							onChange={(e) => setTest((p) => ({ ...p, description: e.target.value }))}
							placeholder="Opțional"
							rows={3}
						/>
					</div>
					<div className="test-editor-row">
						<div className="test-editor-field">
							<label className="test-editor-label">Tip</label>
							<select
								className="test-editor-select"
								value={test.type}
								onChange={(e) => setTest((p) => ({ ...p, type: e.target.value }))}
							>
								<option value="practice">Exersare</option>
								<option value="graded">Notat</option>
								<option value="final">Final</option>
							</select>
						</div>
						<div className="test-editor-field">
							<label className="test-editor-label">Status</label>
							<select
								className="test-editor-select"
								value={test.status}
								onChange={(e) => setTest((p) => ({ ...p, status: e.target.value }))}
							>
								<option value="draft">Ciornă</option>
								<option value="published">Publicat</option>
								<option value="archived">Arhivat</option>
							</select>
						</div>
					</div>
					<button type="submit" className="test-editor-btn test-editor-btn-primary" disabled={saving}>
						{saving ? 'Se creează...' : 'Creează test'}
					</button>
				</form>
			) : (
				<>
					<nav className="test-editor-tabs">
						{['details', 'questions', 'settings'].map((tab) => (
							<button
								key={tab}
								type="button"
								className={`test-editor-tab ${activeTab === tab ? 'active' : ''}`}
								onClick={() => setActiveTab(tab)}
							>
								{tab === 'details' && 'Detalii'}
								{tab === 'questions' && 'Întrebări'}
								{tab === 'settings' && 'Setări'}
							</button>
						))}
					</nav>

					<div className="test-editor-panel">
						{activeTab === 'details' && (
							<div className="test-editor-form">
								<div className="test-editor-field">
									<label className="test-editor-label">Titlu</label>
									<input
										type="text"
										className="test-editor-input"
										value={test.title}
										onChange={(e) => savePatch({ title: e.target.value })}
										placeholder="Titlu test"
									/>
								</div>
								<div className="test-editor-field">
									<label className="test-editor-label">Descriere</label>
									<textarea
										className="test-editor-input test-editor-textarea"
										value={test.description || ''}
										onChange={(e) => savePatch({ description: e.target.value })}
										placeholder="Opțional"
										rows={3}
									/>
								</div>
								<div className="test-editor-row">
									<div className="test-editor-field">
										<label className="test-editor-label">Tip</label>
										<select
											className="test-editor-select"
											value={test.type}
											onChange={(e) => savePatch({ type: e.target.value })}
										>
											<option value="practice">Exersare</option>
											<option value="graded">Notat</option>
											<option value="final">Final</option>
										</select>
									</div>
									<div className="test-editor-field">
										<label className="test-editor-label">Status</label>
										<select
											className="test-editor-select"
											value={test.status}
											onChange={(e) => savePatch({ status: e.target.value })}
											disabled={isPublished}
										>
											<option value="draft">Ciornă</option>
											<option value="published">Publicat</option>
											<option value="archived">Arhivat</option>
										</select>
									</div>
								</div>
							</div>
						)}

						{activeTab === 'questions' && (
							<div className="test-editor-questions">
								<div className="test-editor-field">
									<label className="test-editor-label">Sursă întrebări</label>
									<select
										className="test-editor-select"
										value={test.question_source || 'direct'}
										onChange={async (e) => {
											const v = e.target.value;
											savePatch({
												question_source: v,
												question_set_id: v === 'bank' ? (test.question_set_id || (banks[0]?.id)) : null,
											});
											if (v === 'bank' && banks.length === 0) {
												const b = await adminService.getQuestionBanks().catch(() => []);
												setBanks(Array.isArray(b) ? b : []);
											}
										}}
									>
										<option value="direct">Direct (întrebări în test)</option>
										<option value="bank">Din bancă de întrebări</option>
									</select>
								</div>

								{test.question_source === 'bank' && (
									<>
										<div className="test-editor-field">
											<label className="test-editor-label">Bancă</label>
											<select
												className="test-editor-select"
												value={test.question_set_id || ''}
												onChange={(e) => savePatch({ question_set_id: e.target.value ? Number(e.target.value) : null })}
											>
												<option value="">Alege o bancă</option>
												{banks.filter((b) => !b.archived).map((b) => (
													<option key={b.id} value={b.id}>{b.title} ({b.questions_count ?? 0} întrebări)</option>
												))}
											</select>
										</div>
										<div className="test-editor-field">
											<label className="test-editor-label">Număr întrebări (0 = toate)</label>
											<input
												type="number"
												min="0"
												className="test-editor-input"
												value={test.question_selection?.count ?? 20}
												onChange={(e) => updateSelection('count', e.target.value === '' ? 0 : Number(e.target.value))}
											/>
										</div>
										<div className="test-editor-field">
											<label className="test-editor-label">Mod selecție</label>
											<select
												className="test-editor-select"
												value={test.question_selection?.mode || 'random'}
												onChange={(e) => updateSelection('mode', e.target.value)}
											>
												<option value="random">Aleatoriu</option>
												<option value="ordered">După ordine</option>
											</select>
										</div>
										<div className="test-editor-field">
											<label className="test-editor-label">Dificultate (opțional)</label>
											<select
												className="test-editor-select"
												value={test.question_selection?.difficulty || ''}
												onChange={(e) => updateSelection('difficulty', e.target.value)}
											>
												<option value="">Orice</option>
												<option value="easy">Ușor</option>
												<option value="medium">Mediu</option>
												<option value="hard">Dificil</option>
											</select>
										</div>
									</>
								)}

								{test.question_source === 'direct' && (
									<>
										<div className="test-editor-questions-header">
											<span>Întrebări ({questions.length})</span>
											<button type="button" className="test-editor-btn test-editor-btn-secondary" onClick={handleAddQuestion}>
												+ Adaugă întrebare
											</button>
										</div>
										{questions.length > 0 ? (
											<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
												<SortableContext items={questions.map((q) => `q-${q.id}`)} strategy={verticalListSortingStrategy}>
													<ul className="test-editor-questions-list">
														{questions.map((q, idx) => (
															<SortableQuestionItem
																key={q.id}
																q={q}
																index={idx}
																onEdit={setEditQuestion}
																onDelete={setDeleteQId}
																onContentChange={handleContentChange}
																onContentBlur={handleContentBlur}
															/>
														))}
													</ul>
												</SortableContext>
											</DndContext>
										) : (
											<p className="test-editor-empty-questions">Nicio întrebare. Adaugă întrebări sau folosește o bancă.</p>
										)}
									</>
								)}
							</div>
						)}

						{activeTab === 'settings' && (
							<div className="test-editor-form">
								<div className="test-editor-row">
									<div className="test-editor-field">
										<label className="test-editor-label">Timp limită (min)</label>
										<input
											type="number"
											min="1"
											className="test-editor-input"
											value={test.time_limit_minutes ?? ''}
											onChange={(e) => savePatch({ time_limit_minutes: e.target.value === '' ? null : Number(e.target.value) })}
											placeholder="Nelimitat"
										/>
									</div>
									<div className="test-editor-field">
										<label className="test-editor-label">Nr. încercări max</label>
										<input
											type="number"
											min="1"
											className="test-editor-input"
											value={test.max_attempts ?? ''}
											onChange={(e) => savePatch({ max_attempts: e.target.value === '' ? null : Number(e.target.value) })}
											placeholder="Nelimitat"
										/>
									</div>
								</div>
								<div className="test-editor-checkboxes">
									<label className="test-editor-check">
										<input
											type="checkbox"
											checked={!!test.randomize_questions}
											onChange={(e) => savePatch({ randomize_questions: e.target.checked })}
										/>
										<span>Amestecă ordinea întrebărilor</span>
									</label>
									<label className="test-editor-check">
										<input
											type="checkbox"
											checked={!!test.randomize_answers}
											onChange={(e) => savePatch({ randomize_answers: e.target.checked })}
										/>
										<span>Amestecă ordinea răspunsurilor</span>
									</label>
									<label className="test-editor-check">
										<input
											type="checkbox"
											checked={!!test.show_results_immediately}
											onChange={(e) => savePatch({ show_results_immediately: e.target.checked })}
										/>
										<span>Afișează rezultatul imediat</span>
									</label>
									<label className="test-editor-check">
										<input
											type="checkbox"
											checked={!!test.show_correct_answers}
											onChange={(e) => savePatch({ show_correct_answers: e.target.checked })}
										/>
										<span>Afișează răspunsurile corecte după trimitere</span>
									</label>
									<label className="test-editor-check">
										<input
											type="checkbox"
											checked={!!test.allow_review}
											onChange={(e) => savePatch({ allow_review: e.target.checked })}
										/>
										<span>Permite revizuirea după finalizare</span>
									</label>
									<label className="test-editor-check">
										<input
											type="checkbox"
											checked={!!test.requires_manual_verification}
											onChange={(e) => savePatch({ requires_manual_verification: e.target.checked })}
										/>
										<span>Necesită notare manuală (răspunsuri deschise)</span>
									</label>
								</div>
							</div>
						)}
					</div>
				</>
			)}

			{editQuestion && (
				<QuestionEditModal
					question={editQuestion}
					onClose={() => setEditQuestion(null)}
					onSave={handleSaveEditModal}
					saving={editQuestionSaving}
				/>
			)}

			<ConfirmModal
				open={!!deleteQId}
				onClose={() => setDeleteQId(null)}
				onConfirm={handleDeleteQuestion}
				title="Șterge întrebare"
				message="Ești sigur că vrei să ștergi această întrebare?"
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteQLoading}
			/>
		</div>
	);
};

export default AdminTestEditorPage;
