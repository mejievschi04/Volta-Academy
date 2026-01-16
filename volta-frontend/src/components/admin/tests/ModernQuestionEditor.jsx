import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import './ModernQuestionEditor.css';

const ModernQuestionEditor = ({ testId, questions = [], onUpdate }) => {
	const { showToast } = useToast();
	const [editingQuestion, setEditingQuestion] = useState(null);
	const [questionForm, setQuestionForm] = useState({
		type: 'multiple_choice',
		content: '',
		answers: [],
		points: 1,
		explanation: '',
		metadata: {},
	});
	const [draggedIndex, setDraggedIndex] = useState(null);

	useEffect(() => {
		if (editingQuestion !== null && questions[editingQuestion]) {
			setQuestionForm(questions[editingQuestion]);
		}
	}, [editingQuestion, questions]);

	const questionTypes = [
		{ value: 'multiple_choice', label: 'Multiple Choice', icon: '☑️' },
		{ value: 'true_false', label: 'True/False', icon: '✓' },
		{ value: 'short_answer', label: 'Răspuns scurt', icon: '✏️' },
		{ value: 'essay', label: 'Eseu', icon: '📝' },
		{ value: 'matching', label: 'Potrivire', icon: '🔗' },
		{ value: 'fill_blank', label: 'Completează spațiile', icon: '⬜' },
	];

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

	const handleSaveQuestion = async () => {
		if (!questionForm.content.trim()) {
			showToast('Conținutul întrebării este obligatoriu', 'error');
			return;
		}

		if (['multiple_choice', 'true_false'].includes(questionForm.type)) {
			if (questionForm.answers.length < 2) {
				showToast('Adaugă cel puțin 2 răspunsuri', 'error');
				return;
			}

			if (!questionForm.answers.some(a => a.is_correct)) {
				showToast('Selectează cel puțin un răspuns corect', 'error');
				return;
			}
		}

		try {
			const updatedQuestions = [...questions];

			if (editingQuestion !== null) {
				// Update existing question
				if (testId && questions[editingQuestion]?.id) {
					await adminService.updateQuestion(questions[editingQuestion].id, questionForm);
				} else {
					updatedQuestions[editingQuestion] = {
						...questionForm,
						order: editingQuestion,
					};
				}
			} else {
				// Add new question
				if (testId) {
					const newQuestion = await adminService.createQuestion(testId, {
						...questionForm,
						order: questions.length,
					});
					updatedQuestions.push(newQuestion);
				} else {
					updatedQuestions.push({
						...questionForm,
						order: questions.length,
					});
				}
			}

			onUpdate({ questions: updatedQuestions });
			setEditingQuestion(null);
			resetForm();
			showToast(
				editingQuestion !== null ? 'Întrebare actualizată' : 'Întrebare adăugată',
				'success'
			);
		} catch (err) {
			console.error('Error saving question:', err);
			showToast('Eroare la salvarea întrebării', 'error');
		}
	};

	const handleDeleteQuestion = async (index) => {
		if (!confirm('Sigur dorești să ștergi această întrebare?')) {
			return;
		}

		try {
			const question = questions[index];
			if (testId && question?.id) {
				await adminService.deleteQuestion(question.id);
			}

			const updatedQuestions = questions.filter((_, i) => i !== index);
			onUpdate({ questions: updatedQuestions });
			showToast('Întrebare ștearsă', 'success');
		} catch (err) {
			console.error('Error deleting question:', err);
			showToast('Eroare la ștergerea întrebării', 'error');
		}
	};

	const handleDragStart = (index) => {
		setDraggedIndex(index);
	};

	const handleDragOver = (e, index) => {
		e.preventDefault();
	};

	const handleDrop = (e, dropIndex) => {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex) return;

		const updatedQuestions = [...questions];
		const [draggedItem] = updatedQuestions.splice(draggedIndex, 1);
		updatedQuestions.splice(dropIndex, 0, draggedItem);

		// Update order
		updatedQuestions.forEach((q, i) => {
			q.order = i;
		});

		onUpdate({ questions: updatedQuestions });
		setDraggedIndex(null);
	};

	const resetForm = () => {
		setQuestionForm({
			type: 'multiple_choice',
			content: '',
			answers: [],
			points: 1,
			explanation: '',
			metadata: {},
		});
	};

	const cancelEdit = () => {
		setEditingQuestion(null);
		resetForm();
	};

	return (
		<div className="modern-question-editor">
			<div className="question-editor-header">
				<div>
					<h2>Întrebări Test</h2>
					<p>Gestionează întrebările pentru acest test</p>
				</div>
				<button
					className="admin-btn admin-btn-primary"
					onClick={() => {
						setEditingQuestion(null);
						resetForm();
					}}
				>
					➕ Adaugă Întrebare
				</button>
			</div>

			{/* Question Form */}
			{(editingQuestion !== null || (editingQuestion === null && questionForm.content)) && (
				<div className="question-form-card">
					<div className="question-form-header">
						<h3>{editingQuestion !== null ? 'Editează Întrebare' : 'Întrebare Nouă'}</h3>
						<button
							className="question-form-close"
							onClick={cancelEdit}
						>
							✕
						</button>
					</div>

					<div className="question-form-content">
						{/* Question Type */}
						<div className="question-form-group">
							<label>Tip Întrebare</label>
							<div className="question-type-selector">
								{questionTypes.map(type => (
									<button
										key={type.value}
										type="button"
										className={`question-type-btn ${questionForm.type === type.value ? 'active' : ''}`}
										onClick={() => {
											setQuestionForm(prev => ({
												...prev,
												type: type.value,
												answers: type.value === 'true_false'
													? [
															{ text: 'Adevărat', is_correct: false },
															{ text: 'Fals', is_correct: false },
													  ]
													: prev.answers,
											}));
										}}
									>
										<span className="question-type-icon">{type.icon}</span>
										<span>{type.label}</span>
									</button>
								))}
							</div>
						</div>

						{/* Question Content */}
						<div className="question-form-group">
							<label>Întrebare <span className="required">*</span></label>
							<textarea
								className="admin-form-input"
								rows="3"
								value={questionForm.content}
								onChange={(e) => setQuestionForm(prev => ({ ...prev, content: e.target.value }))}
								placeholder="Introdu întrebarea..."
							/>
						</div>

						{/* Answers (for multiple choice, true/false) */}
						{['multiple_choice', 'true_false'].includes(questionForm.type) && (
							<div className="question-form-group">
								<label>Răspunsuri</label>
								<div className="answers-list">
									{questionForm.answers.map((answer, index) => (
										<div key={index} className="answer-item">
											<input
												type="checkbox"
												checked={answer.is_correct}
												onChange={(e) => updateAnswer(index, 'is_correct', e.target.checked)}
												className="answer-checkbox"
											/>
											<input
												type="text"
												className="admin-form-input answer-input"
												value={answer.text}
												onChange={(e) => updateAnswer(index, 'text', e.target.value)}
												placeholder={`Răspuns ${index + 1}`}
											/>
											{questionForm.answers.length > 2 && (
												<button
													type="button"
													className="answer-remove-btn"
													onClick={() => removeAnswer(index)}
												>
													🗑️
												</button>
											)}
										</div>
									))}
								</div>
								<button
									type="button"
									className="admin-btn admin-btn-secondary admin-btn-sm"
									onClick={addAnswer}
								>
									➕ Adaugă Răspuns
								</button>
							</div>
						)}

						{/* Points */}
						<div className="question-form-group">
							<label>Puncte</label>
							<input
								type="number"
								className="admin-form-input"
								min="0.5"
								step="0.5"
								value={questionForm.points}
								onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseFloat(e.target.value) || 1 }))}
							/>
						</div>

						{/* Explanation */}
						<div className="question-form-group">
							<label>Explicație (opțional)</label>
							<textarea
								className="admin-form-input"
								rows="2"
								value={questionForm.explanation || ''}
								onChange={(e) => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
								placeholder="Explicație pentru răspunsul corect..."
							/>
						</div>
					</div>

					<div className="question-form-footer">
						<button
							className="admin-btn admin-btn-secondary"
							onClick={cancelEdit}
						>
							Anulează
						</button>
						<button
							className="admin-btn admin-btn-primary"
							onClick={handleSaveQuestion}
						>
							💾 {editingQuestion !== null ? 'Actualizează' : 'Adaugă'} Întrebare
						</button>
					</div>
				</div>
			)}

			{/* Questions List */}
			<div className="questions-list">
				{questions.length === 0 ? (
					<div className="questions-empty">
						<div className="questions-empty-icon">❓</div>
						<h3>Nu există întrebări</h3>
						<p>Adaugă prima întrebare pentru acest test</p>
					</div>
				) : (
					questions.map((question, index) => (
						<div
							key={question.id || index}
							className={`question-card ${editingQuestion === index ? 'editing' : ''}`}
							draggable
							onDragStart={() => handleDragStart(index)}
							onDragOver={(e) => handleDragOver(e, index)}
							onDrop={(e) => handleDrop(e, index)}
						>
							<div className="question-card-drag-handle">☰</div>
							<div className="question-card-content">
								<div className="question-card-header">
									<div className="question-card-number">#{index + 1}</div>
									<div className="question-card-type">
										{questionTypes.find(t => t.value === question.type)?.icon} {questionTypes.find(t => t.value === question.type)?.label}
									</div>
									<div className="question-card-points">{question.points || 1} puncte</div>
								</div>
								<div className="question-card-text">{question.content}</div>
								{question.answers && question.answers.length > 0 && (
									<div className="question-card-answers">
										{question.answers.map((answer, ansIndex) => (
											<div
												key={ansIndex}
												className={`question-answer-preview ${answer.is_correct ? 'correct' : ''}`}
											>
												{answer.is_correct && '✓'} {answer.text}
											</div>
										))}
									</div>
								)}
							</div>
							<div className="question-card-actions">
								<button
									className="question-action-btn"
									onClick={() => {
										setEditingQuestion(index);
									}}
								>
									✏️ Editează
								</button>
								<button
									className="question-action-btn danger"
									onClick={() => handleDeleteQuestion(index)}
								>
									🗑️ Șterge
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default ModernQuestionEditor;
