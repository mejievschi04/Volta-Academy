import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import './QuestionBankEditor.css';

const QuestionBankEditor = ({ bankId, questions = [], onUpdate }) => {
	const { showToast } = useToast();
	const [editingQuestion, setEditingQuestion] = useState(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [questionForm, setQuestionForm] = useState({
		type: 'multiple_choice',
		content: '',
		answers: [],
		points: 1,
		explanation: '',
		order: 0,
	});
	const [draggedIndex, setDraggedIndex] = useState(null);

	const questionTypes = [
		{ value: 'multiple_choice', label: 'Multiple Choice', icon: '☑️', description: 'Alege unul sau mai multe răspunsuri' },
		{ value: 'true_false', label: 'Adevărat/Fals', icon: '✓', description: 'Răspuns simplu Adevărat sau Fals' },
		{ value: 'short_answer', label: 'Răspuns scurt', icon: '✏️', description: 'Răspuns text scurt' },
		{ value: 'essay', label: 'Eseu', icon: '📝', description: 'Răspuns text lung' },
		{ value: 'matching', label: 'Potrivire', icon: '🔗', description: 'Potrivește elementele' },
		{ value: 'fill_in_blank', label: 'Completează spațiile', icon: '⬜', description: 'Completează spațiile goale' },
	];

	useEffect(() => {
		if (editingQuestion !== null && questions[editingQuestion]) {
			const q = questions[editingQuestion];
			setQuestionForm({
				type: q.type || 'multiple_choice',
				content: q.content || q.text || '',
				answers: q.answers || [],
				points: q.points || 1,
				explanation: q.explanation || '',
				order: q.order || editingQuestion,
			});
		} else if (!showAddForm) {
			resetForm();
		}
	}, [editingQuestion, questions, showAddForm]);

	const resetForm = () => {
		setQuestionForm({
			type: 'multiple_choice',
			content: '',
			answers: [],
			points: 1,
			explanation: '',
			order: questions.length,
		});
	};

	const handleTypeChange = (newType) => {
		setQuestionForm(prev => {
			let newAnswers = prev.answers;
			
			if (newType === 'true_false') {
				newAnswers = [
					{ text: 'Adevărat', is_correct: true },
					{ text: 'Fals', is_correct: false },
				];
			} else if (newType === 'short_answer' || newType === 'essay') {
				newAnswers = [];
			} else if (newType === 'multiple_choice' && newAnswers.length === 0) {
				newAnswers = [
					{ text: '', is_correct: true },
					{ text: '', is_correct: false },
				];
			}

			return {
				...prev,
				type: newType,
				answers: newAnswers,
			};
		});
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
			if (editingQuestion !== null && questions[editingQuestion]?.id) {
				// Update existing question
				await adminService.updateQuestionInBank(bankId, questions[editingQuestion].id, questionForm);
				showToast('Întrebare actualizată', 'success');
			} else {
				// Add new question
				await adminService.addQuestionToBank(bankId, questionForm);
				showToast('Întrebare adăugată', 'success');
			}

			resetForm();
			setEditingQuestion(null);
			setShowAddForm(false);
			onUpdate?.();
		} catch (err) {
			console.error('Error saving question:', err);
			const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Eroare la salvarea întrebării';
			showToast(errorMessage, 'error');
		}
	};

	const handleEdit = (index) => {
		setEditingQuestion(index);
		setShowAddForm(true);
	};

	const handleDelete = async (questionId, index) => {
		if (!confirm('Sigur dorești să ștergi această întrebare?')) return;
		
		try {
			await adminService.removeQuestionFromBank(bankId, questionId);
			showToast('Întrebare ștearsă', 'success');
			onUpdate?.();
		} catch (err) {
			console.error('Error deleting question:', err);
			showToast('Eroare la ștergerea întrebării', 'error');
		}
	};

	const handleCancel = () => {
		resetForm();
		setEditingQuestion(null);
		setShowAddForm(false);
	};

	const getQuestionTypeLabel = (type) => {
		return questionTypes.find(t => t.value === type)?.label || type;
	};

	return (
		<div className="question-bank-editor">
			{/* Header with Add Button */}
			<div className="question-bank-editor-header">
				<h3>Întrebări ({questions.length})</h3>
				<button
					className="question-bank-editor-add-btn"
					onClick={() => {
						resetForm();
						setShowAddForm(true);
						setEditingQuestion(null);
					}}
					disabled={showAddForm}
				>
					<span>+</span>
					<span>Adaugă Întrebare</span>
				</button>
			</div>

			{/* Add/Edit Form */}
			{showAddForm && (
				<div className="question-bank-editor-form">
					<div className="question-bank-editor-form-header">
						<h4>{editingQuestion !== null ? 'Editează Întrebare' : 'Întrebare Nouă'}</h4>
						<button className="question-bank-editor-close-btn" onClick={handleCancel}>×</button>
					</div>

					{/* Question Type */}
					<div className="question-bank-editor-field">
						<label>Tip Întrebare</label>
						<div className="question-bank-editor-type-grid">
							{questionTypes.map(type => (
								<button
									key={type.value}
									type="button"
									className={`question-bank-editor-type-btn ${questionForm.type === type.value ? 'active' : ''}`}
									onClick={() => handleTypeChange(type.value)}
								>
									<span className="question-bank-editor-type-icon">{type.icon}</span>
									<span className="question-bank-editor-type-label">{type.label}</span>
									<span className="question-bank-editor-type-desc">{type.description}</span>
								</button>
							))}
						</div>
					</div>

					{/* Question Content */}
					<div className="question-bank-editor-field">
						<label>Conținut Întrebare *</label>
						<textarea
							className="question-bank-editor-textarea"
							value={questionForm.content}
							onChange={(e) => setQuestionForm(prev => ({ ...prev, content: e.target.value }))}
							placeholder="Scrie întrebarea aici..."
							rows={3}
						/>
					</div>

					{/* Answers (for multiple choice, true/false) */}
					{['multiple_choice', 'true_false'].includes(questionForm.type) && (
						<div className="question-bank-editor-field">
							<div className="question-bank-editor-answers-header">
								<label>Răspunsuri *</label>
								<button
									type="button"
									className="question-bank-editor-add-answer-btn"
									onClick={addAnswer}
								>
									+ Adaugă Răspuns
								</button>
							</div>
							<div className="question-bank-editor-answers">
								{questionForm.answers.map((answer, index) => (
									<div key={index} className="question-bank-editor-answer">
										<input
											type={questionForm.type === 'multiple_choice' ? 'checkbox' : 'radio'}
											checked={answer.is_correct}
											onChange={(e) => {
												if (questionForm.type === 'true_false') {
													// For true/false, only one can be correct
													setQuestionForm(prev => ({
														...prev,
														answers: prev.answers.map((a, i) => ({
															...a,
															is_correct: i === index,
														})),
													}));
												} else {
													updateAnswer(index, 'is_correct', e.target.checked);
												}
											}}
											className="question-bank-editor-answer-checkbox"
										/>
										<input
											type="text"
											className="question-bank-editor-answer-input"
											value={answer.text}
											onChange={(e) => updateAnswer(index, 'text', e.target.value)}
											placeholder={`Răspuns ${index + 1}`}
										/>
										{questionForm.answers.length > 2 && (
											<button
												type="button"
												className="question-bank-editor-remove-answer-btn"
												onClick={() => removeAnswer(index)}
											>
												🗑️
											</button>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Points */}
					<div className="question-bank-editor-field">
						<label>Puncte</label>
						<input
							type="number"
							className="question-bank-editor-input"
							value={questionForm.points}
							onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
							min="1"
						/>
					</div>

					{/* Explanation */}
					<div className="question-bank-editor-field">
						<label>Explicație (opțional)</label>
						<textarea
							className="question-bank-editor-textarea"
							value={questionForm.explanation}
							onChange={(e) => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
							placeholder="Explicație care va fi afișată după răspuns..."
							rows={2}
						/>
					</div>

					{/* Actions */}
					<div className="question-bank-editor-form-actions">
						<button
							className="question-bank-editor-cancel-btn"
							onClick={handleCancel}
						>
							Anulează
						</button>
						<button
							className="question-bank-editor-save-btn"
							onClick={handleSaveQuestion}
						>
							{editingQuestion !== null ? 'Salvează Modificările' : 'Adaugă Întrebare'}
						</button>
					</div>
				</div>
			)}

			{/* Questions List */}
			<div className="question-bank-editor-questions">
				{questions.length === 0 ? (
					<div className="question-bank-editor-empty">
						<p>Nu există întrebări în această bancă</p>
						<p className="question-bank-editor-empty-hint">Apasă "Adaugă Întrebare" pentru a începe</p>
					</div>
				) : (
					questions.map((question, index) => (
						<div key={question.id} className="question-bank-editor-question-card">
							<div className="question-bank-editor-question-header">
								<div className="question-bank-editor-question-number">
									{index + 1}
								</div>
								<div className="question-bank-editor-question-info">
									<div className="question-bank-editor-question-content">
										{question.content || question.text || 'Fără conținut'}
									</div>
									<div className="question-bank-editor-question-meta">
										<span className="question-bank-editor-question-type">
											{getQuestionTypeLabel(question.type)}
										</span>
										<span className="question-bank-editor-question-points">
											{question.points || 1} {question.points === 1 ? 'punct' : 'puncte'}
										</span>
										{question.answers && question.answers.length > 0 && (
											<span className="question-bank-editor-question-answers-count">
												{question.answers.length} {question.answers.length === 1 ? 'răspuns' : 'răspunsuri'}
											</span>
										)}
									</div>
								</div>
							</div>
							<div className="question-bank-editor-question-actions">
								<button
									className="question-bank-editor-edit-btn"
									onClick={() => handleEdit(index)}
								>
									✏️ Editează
								</button>
								<button
									className="question-bank-editor-delete-btn"
									onClick={() => handleDelete(question.id, index)}
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

export default QuestionBankEditor;
