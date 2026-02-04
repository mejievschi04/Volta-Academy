import React, { useState, useEffect } from 'react';
import { adminService, coursesService } from '../../../../services/api';
import { useToast } from '../../../../contexts/ToastContext';

const QuestionBankBuilderStep2 = ({ bankId, data, onUpdate, errors }) => {
	const { showToast } = useToast();
	const [editingQuestion, setEditingQuestion] = useState(null);
	const [questionForm, setQuestionForm] = useState({
		type: 'multiple_choice',
		content: '',
		answers: [],
		points: 1,
		explanation: '',
		metadata: {
			difficulty: '',
			tags: [],
		},
	});

	// AI Generation state
	const [showAIModal, setShowAIModal] = useState(false);
	const [aiContent, setAiContent] = useState('');
	const [aiGenerating, setAiGenerating] = useState(false);
	const [aiError, setAiError] = useState(null);
	const [aiOptions, setAiOptions] = useState({
		numberOfQuestions: 10,
		difficulty: 'medium',
		questionTypes: ['multiple_choice']
	});

	// Load existing questions if editing
	useEffect(() => {
		if (bankId && !bankId.toString().startsWith('temp-')) {
			fetchQuestions();
		}
	}, [bankId]);

	const fetchQuestions = async () => {
		try {
			const questions = await adminService.getQuestionBankQuestions(bankId);
			onUpdate({ questions: Array.isArray(questions) ? questions : (questions?.data || []) });
		} catch (err) {
			console.error('Error fetching questions:', err);
		}
	};

	const addAnswer = () => {
		setQuestionForm(prev => ({
			...prev,
			answers: [...prev.answers, { text: '', is_correct: false }],
		}));
	};

	const updateAnswer = (index, field, value) => {
		setQuestionForm(prev => ({
			...prev,
			answers: prev.answers.map((ans, i) => 
				i === index ? { ...ans, [field]: value } : ans
			),
		}));
	};

	const removeAnswer = (index) => {
		setQuestionForm(prev => ({
			...prev,
			answers: prev.answers.filter((_, i) => i !== index),
		}));
	};

	const saveQuestion = async () => {
		if (!questionForm.content?.trim()) {
			showToast('Conținutul întrebării este obligatoriu', 'error');
			return;
		}

		if (questionForm.type !== 'short_answer' && questionForm.answers.length < 2) {
			showToast('Adaugă cel puțin 2 răspunsuri', 'error');
			return;
		}

		if (questionForm.type === 'multiple_choice' && !questionForm.answers.some(a => a.is_correct)) {
			showToast('Selectează cel puțin un răspuns corect', 'error');
			return;
		}

		try {
			const metaDifficulty = questionForm.metadata?.difficulty || '';
			const metaTags = Array.isArray(questionForm.metadata?.tags) ? questionForm.metadata.tags : [];

			const questionData = {
				type: questionForm.type,
				content: questionForm.content.trim(),
				answers: questionForm.answers,
				points: questionForm.points || 1,
				explanation: questionForm.explanation || '',
				metadata: {
					difficulty: metaDifficulty || null,
					tags: metaTags,
				},
			};

			if (bankId && !bankId.toString().startsWith('temp-') && editingQuestion !== null && data.questions?.[editingQuestion]?.id && !data.questions[editingQuestion].id.toString().startsWith('temp-')) {
				// Update existing question
				await adminService.updateQuestionInBank(bankId, data.questions[editingQuestion].id, questionData);
				const updated = await adminService.getQuestionBankQuestions(bankId);
				onUpdate({ questions: Array.isArray(updated) ? updated : (updated?.data || []) });
			} else if (bankId && !bankId.toString().startsWith('temp-')) {
				// Add new question to existing bank
				await adminService.addQuestionToBank(bankId, questionData);
				const updated = await adminService.getQuestionBankQuestions(bankId);
				onUpdate({ questions: Array.isArray(updated) ? updated : (updated?.data || []) });
			} else {
				// Temporary question for new bank
				const questions = [...(data.questions || [])];
				if (editingQuestion !== null) {
					questions[editingQuestion] = { ...questionData, id: questions[editingQuestion]?.id || `temp-${Date.now()}` };
				} else {
					questions.push({
						...questionData,
						id: `temp-${Date.now()}`,
						order: questions.length,
					});
				}
				onUpdate({ questions });
			}

			setEditingQuestion(null);
			setQuestionForm({
				type: 'multiple_choice',
				content: '',
				answers: [],
				points: 1,
				explanation: '',
				metadata: {
					difficulty: '',
					tags: [],
				},
			});
			showToast(editingQuestion !== null ? 'Întrebarea a fost actualizată' : 'Întrebarea a fost adăugată', 'success');
		} catch (err) {
			console.error('Error saving question:', err);
			showToast('Eroare la salvarea întrebării: ' + (err.response?.data?.message || err.message), 'error');
		}
	};

	const persistReorder = async (nextQuestions) => {
		// Temporary bank: only reorder locally
		if (!bankId || bankId.toString().startsWith('temp-')) {
			onUpdate({ questions: nextQuestions.map((q, idx) => ({ ...q, order: idx })) });
			return;
		}

		try {
			const ids = nextQuestions.map((q) => q.id).filter(Boolean);
			await adminService.reorderQuestionBankQuestions(bankId, ids);
			const updated = await adminService.getQuestionBankQuestions(bankId);
			onUpdate({ questions: Array.isArray(updated) ? updated : (updated?.data || []) });
		} catch (err) {
			console.error('Error reordering questions:', err);
			showToast('Eroare la reordonarea întrebărilor', 'error');
		}
	};

	const moveQuestion = async (index, direction) => {
		const list = Array.isArray(data.questions) ? [...data.questions] : [];
		const nextIndex = direction === 'up' ? index - 1 : index + 1;
		if (nextIndex < 0 || nextIndex >= list.length) return;

		const tmp = list[index];
		list[index] = list[nextIndex];
		list[nextIndex] = tmp;

		await persistReorder(list);
	};

	const editQuestion = (index) => {
		const question = data.questions?.[index];
		if (question) {
			const meta = question.metadata || {};
			const tags = Array.isArray(meta.tags)
				? meta.tags
				: typeof meta.tags === 'string'
					? meta.tags.split(',').map((t) => t.trim()).filter(Boolean)
					: [];

			setQuestionForm({
				type: question.type || 'multiple_choice',
				content: question.content || question.text || '',
				answers: question.answers || [],
				points: question.points || 1,
				explanation: question.explanation || '',
				metadata: {
					difficulty: meta.difficulty || '',
					tags,
				},
			});
			setEditingQuestion(index);
		}
	};

	const deleteQuestion = async (index) => {
		if (!confirm('Sigur dorești să ștergi această întrebare?')) return;

		try {
			const question = data.questions?.[index];
			if (bankId && !bankId.toString().startsWith('temp-') && question?.id && !question.id.toString().startsWith('temp-')) {
				await adminService.removeQuestionFromBank(bankId, question.id);
				const updated = await adminService.getQuestionBankQuestions(bankId);
				onUpdate({ questions: Array.isArray(updated) ? updated : (updated?.data || []) });
			} else {
				const questions = (data.questions || []).filter((_, i) => i !== index);
				onUpdate({ questions });
			}
			showToast('Întrebarea a fost ștearsă', 'success');
		} catch (err) {
			console.error('Error deleting question:', err);
			showToast('Eroare la ștergerea întrebării: ' + (err.response?.data?.message || err.message), 'error');
		}
	};

	const handleOpenAIModal = () => {
		// Pre-fill with bank title and description if available
		const contextText = [data.title, data.description].filter(Boolean).join('\n\n');
		setAiContent(contextText);
		setAiOptions({
			numberOfQuestions: 10,
			difficulty: 'medium',
			questionTypes: ['multiple_choice']
		});
		setAiError(null);
		setShowAIModal(true);
	};

	const handleGenerateQuestions = async () => {
		if (!aiContent?.trim()) {
			showToast('Introdu conținutul pentru generarea întrebărilor', 'error');
			return;
		}

		// Need bank ID for generation - if new bank, save it first
		let actualBankId = bankId;
		if (!actualBankId || actualBankId.toString().startsWith('temp-')) {
			// Bank not saved yet - need to save it first
			if (!data.title?.trim()) {
				showToast('Salvează mai întâi banca de întrebări (completează pasul 1)', 'error');
				return;
			}
			try {
				const saved = await adminService.createQuestionBank({
					title: data.title.trim(),
					description: data.description || null,
					category: data.category || null,
				});
				if (saved?.id) {
					actualBankId = saved.id;
					// Update the bankId in parent component if possible
					window.history.replaceState({}, '', `/admin/question-banks/${actualBankId}/builder`);
				}
			} catch (err) {
				console.error('Error creating bank:', err);
				showToast('Eroare la crearea băncii de întrebări', 'error');
				return;
			}
		}

		try {
			setAiGenerating(true);
			setAiError(null);
			
			// Generate questions using AI with the provided text content
			const result = await adminService.generateQuestionsFromText(
				actualBankId,
				aiContent.trim(),
				aiOptions
			);
			
			showToast(`S-au generat ${result.questions_generated || 0} întrebări cu succes!`, 'success');
			setShowAIModal(false);
			setAiContent('');
			
			// Reload questions
			if (actualBankId) {
				const updated = await adminService.getQuestionBankQuestions(actualBankId);
				onUpdate({ questions: Array.isArray(updated) ? updated : (updated?.data || []) });
			}
		} catch (err) {
			console.error('Error generating questions:', err);
			const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Eroare la generarea întrebărilor cu AI';
			setAiError(message);
			showToast(message, 'error');
		} finally {
			setAiGenerating(false);
		}
	};

	return (
		<div className="admin-course-builder-step-content step2-questions">
			<h2>Întrebări</h2>
			<p className="admin-course-builder-step-description">
				Adaugă întrebările pentru banca de întrebări
			</p>

			{errors?.questions && (
				<div className="lms-error-message">
					{errors.questions}
				</div>
			)}

			{/* Split layout: form left, list right */}
			<div className="step2-split-layout">
				{/* Left: Form (scrollable) */}
				<div className="step2-form-column">
					<div className="admin-course-builder-form">
						{/* AI Generation Button */}
						<div className="admin-form-section" style={{ marginBottom: '1.5rem' }}>
							<div className="admin-form-section-header">
								<h3 className="admin-form-section-title">Adaugă Întrebări</h3>
								<button
									type="button"
									className="lms-btn-primary"
									onClick={handleOpenAIModal}
								>
									🤖 Generează cu AI
								</button>
							</div>
						</div>

						{/* Question Form */}
						<div className="admin-form-section">
					<h3 className="admin-form-section-title">
						{editingQuestion !== null ? 'Editează Întrebare' : 'Adaugă Întrebare Nouă'}
					</h3>

					<div className="admin-form-group">
						<label className="admin-form-label">Tip Întrebare</label>
						<select
							className="admin-form-select"
							value={questionForm.type}
							onChange={(e) => {
								setQuestionForm({
									...questionForm,
									type: e.target.value,
									answers: e.target.value === 'true_false' 
										? [
											{ text: 'Adevărat', is_correct: true },
											{ text: 'Fals', is_correct: false },
										]
										: questionForm.answers,
								});
							}}
						>
							<option value="multiple_choice">Răspuns multiplu</option>
							<option value="true_false">Adevărat/Fals</option>
							<option value="short_answer">Răspuns scurt</option>
						</select>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Conținut Întrebare <span className="admin-form-required">*</span></label>
						<textarea
							className="admin-form-textarea"
							value={questionForm.content}
							onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })}
							placeholder="Scrie întrebarea aici..."
							rows={3}
						/>
					</div>

					{questionForm.type !== 'short_answer' && (
						<div className="admin-form-group">
							<label className="admin-form-label">Răspunsuri</label>
							<div className="admin-answer-list">
								{questionForm.answers.map((answer, index) => (
									<div key={index} className="admin-answer-item">
										<input
											type={questionForm.type === 'multiple_choice' ? 'checkbox' : 'radio'}
											className="admin-answer-checkbox"
											checked={answer.is_correct}
											onChange={(e) => {
												if (questionForm.type === 'multiple_choice') {
													updateAnswer(index, 'is_correct', e.target.checked);
												} else {
													questionForm.answers.forEach((_, i) => {
														updateAnswer(i, 'is_correct', i === index);
													});
												}
											}}
										/>
										<input
											type="text"
											className="admin-form-input"
											value={answer.text}
											onChange={(e) => updateAnswer(index, 'text', e.target.value)}
											placeholder={`Răspuns ${index + 1}`}
										/>
										<button
											type="button"
											className="lms-btn-secondary lms-btn-sm va-btn-danger"
											onClick={() => removeAnswer(index)}
										>
											🗑️
										</button>
									</div>
								))}
							</div>
							<button
								type="button"
								className="lms-btn-secondary lms-btn-sm"
								onClick={addAnswer}
							>
								+ Adaugă Răspuns
							</button>
						</div>
					)}

					<div className="admin-form-group">
						<label className="admin-form-label">Puncte</label>
						<input
							type="number"
							className="admin-form-input"
							value={questionForm.points}
							onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 1 })}
							min="1"
						/>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Difficulty (pentru bank rules)</label>
						<select
							className="admin-form-select"
							value={questionForm.metadata?.difficulty || ''}
							onChange={(e) =>
								setQuestionForm({
									...questionForm,
									metadata: {
										...(questionForm.metadata || {}),
										difficulty: e.target.value,
									},
								})
							}
						>
							<option value="">—</option>
							<option value="easy">Ușor</option>
							<option value="medium">Mediu</option>
							<option value="hard">Dificil</option>
						</select>
						<p className="admin-form-hint">Se folosește la regulile băncii în Editorul de Teste.</p>
					</div>


					<div className="admin-form-group">
						<label className="admin-form-label">Tags (pentru bank rules)</label>
						<input
							type="text"
							className="admin-form-input"
							value={(questionForm.metadata?.tags || []).join(', ')}
							onChange={(e) =>
								setQuestionForm({
									...questionForm,
									metadata: {
										...(questionForm.metadata || {}),
										tags: e.target.value
											.split(',')
											.map((t) => t.trim())
											.filter(Boolean),
									},
								})
							}
							placeholder="ex: tablouri, bucle, oop"
						/>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Explicație (opțional)</label>
						<textarea
							className="admin-form-textarea"
							value={questionForm.explanation}
							onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
							placeholder="Explicație pentru răspunsul corect..."
							rows={2}
						/>
					</div>

					<div className="step2-form-actions">
						<button
							type="button"
							className="lms-btn-primary"
							onClick={saveQuestion}
						>
							{editingQuestion !== null ? 'Actualizează' : 'Adaugă'} Întrebare
						</button>
						{editingQuestion !== null && (
							<button
								type="button"
								className="lms-btn-secondary"
								onClick={() => {
									setEditingQuestion(null);
									setQuestionForm({
										type: 'multiple_choice',
										content: '',
										answers: [],
										points: 1,
										explanation: '',
										metadata: {
											difficulty: '',
											tags: [],
										},
									});
								}}
							>
								Anulează
							</button>
						)}
					</div>
				</div>
					</div>
				</div>

				{/* Right: Questions List (sticky) */}
				<div className="step2-list-column">
				<div className="admin-form-section step2-questions-list">
					<h3 className="admin-form-section-title">
						Întrebări ({data?.questions?.length || 0})
					</h3>

					{data?.questions && data.questions.length > 0 ? (
						<div className="admin-question-list">
							{data.questions.map((question, index) => (
								<div
									key={question.id || index}
									className={`admin-question-item ${editingQuestion === index ? 'editing' : ''}`}
								>
									<div className="admin-question-item-content">
										<div className="admin-question-item-header">
											<div className="admin-question-item-title">
												#{index + 1}: {question.content || question.text || 'Fără conținut'}
											</div>
											<div className="admin-question-item-meta">
												{question.points || 1} puncte • {question.type || 'multiple_choice'}
											</div>
											{question.answers && question.answers.length > 0 && (
												<div className="admin-question-item-answers">
													{question.answers.map((ans, ansIdx) => (
														<div 
															key={ansIdx} 
															className={`admin-question-answer ${ans.is_correct ? 'correct' : ''}`}
														>
															{ans.is_correct ? '✓' : '○'} {ans.text}
														</div>
													))}
												</div>
											)}
										</div>
										<div className="admin-question-item-actions">
											<button
												type="button"
												className="lms-btn-secondary lms-btn-sm"
												onClick={() => moveQuestion(index, 'up')}
												disabled={index === 0}
												title="Mută sus"
											>
												↑
											</button>
											<button
												type="button"
												className="lms-btn-secondary lms-btn-sm"
												onClick={() => moveQuestion(index, 'down')}
												disabled={index === (data.questions.length - 1)}
												title="Mută jos"
											>
												↓
											</button>
											<button
												type="button"
												className="lms-btn-secondary lms-btn-sm"
												onClick={() => editQuestion(index)}
											>
												✏️ Editează
											</button>
											<button
												type="button"
												className="lms-btn-secondary lms-btn-sm va-btn-danger"
												onClick={() => deleteQuestion(index)}
											>
												🗑️ Șterge
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="lms-empty-state step2-empty-state">
							<div className="lms-empty-icon">📝</div>
							<h3 className="lms-empty-title">Nicio întrebare încă</h3>
							<p className="lms-empty-description">
								Adaugă prima întrebare folosind formularul alăturat sau generează cu AI
							</p>
						</div>
					)}
				</div>
			</div>
			</div>

			{/* AI Generation Modal */}
			{showAIModal && (
				<div
					className="admin-team-modal-overlay"
					onClick={() => !aiGenerating && setShowAIModal(false)}
					style={{ zIndex: 10000 }}
				>
					<div
						className="admin-team-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="admin-team-modal-header">
							<div>
								<h2 className="admin-team-modal-title">🤖 Generează Întrebări cu AI</h2>
								<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
									Introdu conținutul pentru care vrei să generezi întrebări
								</p>
							</div>
							{!aiGenerating && (
								<button
									type="button"
									className="admin-team-modal-close"
									onClick={() => setShowAIModal(false)}
								>
									×
								</button>
							)}
						</div>
						<div className="admin-team-modal-body">
							<div className="admin-team-modal-form">
								<div className="admin-form-group">
									<label className="admin-form-label">Conținut pentru Generare *</label>
									<textarea
										className="admin-form-input"
										value={aiContent}
										onChange={(e) => setAiContent(e.target.value)}
										placeholder="Introdu conținutul pentru care vrei să generezi întrebări...&#10;&#10;Exemplu:&#10;PHP este un limbaj de programare server-side folosit pentru dezvoltarea aplicațiilor web. Suportă programare orientată pe obiecte și poate fi integrat cu baze de date MySQL."
										rows={8}
										disabled={aiGenerating}
										required
									/>
									<p className="admin-form-hint">
										AI-ul va analiza conținutul introdus și va genera întrebări relevante
									</p>
								</div>

								<div className="admin-form-group">
									<label className="admin-form-label">Număr de Întrebări</label>
									<input
										type="number"
										className="admin-form-input"
										value={aiOptions.numberOfQuestions}
										onChange={(e) => setAiOptions({
											...aiOptions,
											numberOfQuestions: parseInt(e.target.value) || 10
										})}
										min="1"
										max="50"
										disabled={aiGenerating}
									/>
								</div>

								<div className="admin-form-group">
									<label className="admin-form-label">Dificultate</label>
									<select
										className="admin-form-input"
										value={aiOptions.difficulty}
										onChange={(e) => setAiOptions({
											...aiOptions,
											difficulty: e.target.value
										})}
										disabled={aiGenerating}
									>
										<option value="easy">Ușor</option>
										<option value="medium">Mediu</option>
										<option value="hard">Dificil</option>
									</select>
								</div>

								{aiGenerating && (
									<div className="admin-ai-generating">
										<div className="lms-spinner" style={{ margin: '0 auto 1rem' }}></div>
										<p style={{ color: 'var(--color-primary)', fontWeight: 600, textAlign: 'center' }}>
											AI-ul generează întrebări din conținutul introdus...
										</p>
										<p className="admin-form-hint" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
											Aceasta poate dura câteva momente
										</p>
									</div>
								)}

								{aiError && (
									<div className="lms-error-message">
										<strong>Eroare AI:</strong>
										<p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>{aiError}</p>
									</div>
								)}

								<div className="admin-team-modal-footer">
									<button
										type="button"
										className="lms-btn-secondary"
										onClick={() => setShowAIModal(false)}
										disabled={aiGenerating}
									>
										Anulează
									</button>
									<button
										type="button"
										className="lms-btn-primary"
										onClick={handleGenerateQuestions}
										disabled={aiGenerating || !aiContent?.trim()}
									>
										🤖 {aiGenerating ? 'Se generează...' : 'Generează Întrebări'}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuestionBankBuilderStep2;
