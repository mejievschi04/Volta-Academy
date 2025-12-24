import React, { useState, useEffect } from 'react';
import { adminService } from '../../../../services/api';

const TestBuilderStep2 = ({ testId, data, onUpdate, errors }) => {
	const [editingQuestion, setEditingQuestion] = useState(null);
	const [questionBanks, setQuestionBanks] = useState([]);
	const [loadingBanks, setLoadingBanks] = useState(false);
	const [questionForm, setQuestionForm] = useState({
		type: 'multiple_choice',
		content: '',
		answers: [],
		points: 1,
		explanation: '',
	});

	useEffect(() => {
		if (data.question_source === 'bank') {
			fetchQuestionBanks();
		}
	}, [data.question_source]);

	const fetchQuestionBanks = async () => {
		try {
			setLoadingBanks(true);
			const banks = await adminService.getQuestionBanks();
			setQuestionBanks(Array.isArray(banks) ? banks : (banks?.data || []));
		} catch (err) {
			console.error('Error fetching question banks:', err);
		} finally {
			setLoadingBanks(false);
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

	const saveQuestion = () => {
		if (!questionForm.content.trim()) {
			alert('Conținutul întrebării este obligatoriu');
			return;
		}

		if (questionForm.answers.length < 2) {
			alert('Adaugă cel puțin 2 răspunsuri');
			return;
		}

		if (questionForm.type === 'multiple_choice' && !questionForm.answers.some(a => a.is_correct)) {
			alert('Selectează cel puțin un răspuns corect');
			return;
		}

		const questions = [...(data.questions || [])];
		
		if (editingQuestion !== null) {
			questions[editingQuestion] = { ...questionForm };
		} else {
			questions.push({
				...questionForm,
				order: questions.length,
			});
		}

		onUpdate({ questions });
		setEditingQuestion(null);
		setQuestionForm({
			type: 'multiple_choice',
			content: '',
			answers: [],
			points: 1,
			explanation: '',
		});
	};

	const editQuestion = (index) => {
		const question = data.questions[index];
		setQuestionForm(question);
		setEditingQuestion(index);
	};

	const deleteQuestion = (index) => {
		if (confirm('Sigur dorești să ștergi această întrebare?')) {
			const questions = data.questions.filter((_, i) => i !== index);
			onUpdate({ questions });
		}
	};

	const reorderQuestion = (index, direction) => {
		const questions = [...data.questions];
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex >= 0 && newIndex < questions.length) {
			[questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
			questions.forEach((q, i) => { q.order = i; });
			onUpdate({ questions });
		}
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Întrebări</h2>
			<p className="admin-course-builder-step-description">
				Adaugă întrebările pentru test sau folosește o bancă de întrebări
			</p>

			<div className="admin-course-builder-form">
				{/* Question Source Selection */}
				<div className="admin-form-section" style={{ marginBottom: '2rem' }}>
					<h3 className="admin-form-section-title">Sursa Întrebărilor</h3>
					<div className="admin-form-group">
						<label className="admin-form-label">Mod de adăugare</label>
						<select
							className="admin-form-input"
							value={data.question_source || 'direct'}
							onChange={(e) => {
								onUpdate({ question_source: e.target.value, question_set_id: null });
								if (e.target.value === 'bank') {
									fetchQuestionBanks();
								}
							}}
						>
							<option value="direct">Adaugă întrebări direct</option>
							<option value="bank">Folosește bancă de întrebări</option>
						</select>
					</div>

					{data.question_source === 'bank' && (
						<div className="admin-form-group">
							<label className="admin-form-label">Selectează Bancă de Întrebări</label>
							{loadingBanks ? (
								<div style={{ padding: '1rem', textAlign: 'center' }}>
									<div className="va-loading-spinner"></div>
								</div>
							) : (
								<select
									className={`admin-form-input ${errors.question_set_id ? 'error' : ''}`}
									value={data.question_set_id || ''}
									onChange={(e) => onUpdate({ question_set_id: e.target.value ? parseInt(e.target.value) : null })}
								>
									<option value="">Selectează o bancă de întrebări...</option>
									{questionBanks.map((bank) => (
										<option key={bank.id} value={bank.id}>
											{bank.title} ({bank.questions_count || 0} întrebări)
										</option>
									))}
								</select>
							)}
							{errors.question_set_id && (
								<span className="admin-form-error">{errors.question_set_id}</span>
							)}
							<p className="admin-form-hint">
								Testul va folosi toate întrebările din banca selectată
							</p>
						</div>
					)}
				</div>
				{errors.questions && (
					<div style={{
						padding: '1rem',
						background: 'rgba(244, 67, 54, 0.1)',
						color: '#f44336',
						borderRadius: '8px',
						marginBottom: '1rem',
					}}>
						{errors.questions}
					</div>
				)}

				{/* Question Form - Only show if using direct questions */}
				{data.question_source === 'direct' && (
				<div className="admin-form-section" style={{ marginBottom: '2rem' }}>
					<h3 className="admin-form-section-title">
						{editingQuestion !== null ? 'Editează Întrebare' : 'Adaugă Întrebare Nouă'}
					</h3>

					<div className="admin-form-group">
						<label className="admin-form-label">Tip Întrebare</label>
						<select
							className="admin-form-input"
							value={questionForm.type}
							onChange={(e) => {
								setQuestionForm({
									...questionForm,
									type: e.target.value,
									answers: e.target.value === 'true_false' 
										? [
											{ text: 'True', is_correct: true },
											{ text: 'False', is_correct: false },
										]
										: questionForm.answers,
								});
							}}
						>
							<option value="multiple_choice">Multiple Choice</option>
							<option value="true_false">True/False</option>
							<option value="short_answer">Răspuns Scurt</option>
						</select>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Conținut Întrebare</label>
						<textarea
							className="admin-form-input"
							value={questionForm.content}
							onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })}
							placeholder="Scrie întrebarea aici..."
							rows={3}
						/>
					</div>

					{questionForm.type !== 'short_answer' && (
						<div className="admin-form-group">
							<label className="admin-form-label">Răspunsuri</label>
							{questionForm.answers.map((answer, index) => (
								<div key={index} style={{
									display: 'flex',
									gap: '0.5rem',
									marginBottom: '0.5rem',
									alignItems: 'center',
								}}>
									<input
										type={questionForm.type === 'multiple_choice' ? 'checkbox' : 'radio'}
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
										style={{ width: '20px', height: '20px' }}
									/>
									<input
										type="text"
										className="admin-form-input"
										value={answer.text}
										onChange={(e) => updateAnswer(index, 'text', e.target.value)}
										placeholder={`Răspuns ${index + 1}`}
										style={{ flex: 1 }}
									/>
									<button
										type="button"
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => removeAnswer(index)}
									>
										🗑️
									</button>
								</div>
							))}
							<button
								type="button"
								className="va-btn va-btn-sm"
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
						<label className="admin-form-label">Explicație (opțional)</label>
						<textarea
							className="admin-form-input"
							value={questionForm.explanation}
							onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
							placeholder="Explicație pentru răspunsul corect..."
							rows={2}
						/>
					</div>

					<div style={{ display: 'flex', gap: '0.5rem' }}>
						<button
							type="button"
							className="va-btn va-btn-primary"
							onClick={saveQuestion}
						>
							{editingQuestion !== null ? 'Actualizează' : 'Adaugă'} Întrebare
						</button>
						{editingQuestion !== null && (
							<button
								type="button"
								className="va-btn"
								onClick={() => {
									setEditingQuestion(null);
									setQuestionForm({
										type: 'multiple_choice',
										content: '',
										answers: [],
										points: 1,
										explanation: '',
									});
								}}
							>
								Anulează
							</button>
						)}
					</div>
				</div>

				{/* Questions List */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">
						Întrebări ({data.questions?.length || 0})
					</h3>

					{data.questions && data.questions.length > 0 ? (
						<div className="va-stack" style={{ gap: '1rem' }}>
							{data.questions.map((question, index) => (
								<div
									key={index}
									style={{
										padding: '1.5rem',
										background: 'rgba(0, 0, 0, 0.3)',
										border: '1px solid rgba(255, 238, 0, 0.2)',
										borderRadius: '8px',
									}}
								>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
										<div style={{ flex: 1 }}>
											<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
												<span style={{
													padding: '0.25rem 0.75rem',
													background: 'rgba(255, 238, 0, 0.2)',
													borderRadius: '12px',
													fontSize: '0.875rem',
												}}>
													#{index + 1}
												</span>
												<span style={{
													padding: '0.25rem 0.75rem',
													background: 'rgba(33, 150, 243, 0.2)',
													borderRadius: '12px',
													fontSize: '0.875rem',
												}}>
													{question.type}
												</span>
												<span style={{
													padding: '0.25rem 0.75rem',
													background: 'rgba(76, 175, 80, 0.2)',
													borderRadius: '12px',
													fontSize: '0.875rem',
												}}>
													{question.points} puncte
												</span>
											</div>
											<h4 style={{ marginBottom: '0.5rem' }}>{question.content}</h4>
											{question.answers && question.answers.length > 0 && (
												<div style={{ marginTop: '0.5rem' }}>
													{question.answers.map((answer, ansIndex) => (
														<div
															key={ansIndex}
															style={{
																padding: '0.5rem',
																marginBottom: '0.25rem',
																background: answer.is_correct ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0, 0, 0, 0.2)',
																borderLeft: `3px solid ${answer.is_correct ? '#4caf50' : 'transparent'}`,
																borderRadius: '4px',
															}}
														>
															{answer.is_correct && '✓ '}
															{answer.text}
														</div>
													))}
												</div>
											)}
											{question.explanation && (
												<div style={{
													marginTop: '0.5rem',
													padding: '0.75rem',
													background: 'rgba(255, 238, 0, 0.1)',
													borderRadius: '4px',
													fontSize: '0.875rem',
												}}>
													<strong>Explicație:</strong> {question.explanation}
												</div>
											)}
										</div>
										<div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
											<button
												type="button"
												className="va-btn va-btn-sm"
												onClick={() => reorderQuestion(index, 'up')}
												disabled={index === 0}
											>
												↑
											</button>
											<button
												type="button"
												className="va-btn va-btn-sm"
												onClick={() => reorderQuestion(index, 'down')}
												disabled={index === data.questions.length - 1}
											>
												↓
											</button>
											<button
												type="button"
												className="va-btn va-btn-sm"
												onClick={() => editQuestion(index)}
											>
												✏️
											</button>
											<button
												type="button"
												className="va-btn va-btn-sm va-btn-danger"
												onClick={() => deleteQuestion(index)}
											>
												🗑️
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="admin-info-box">
							<p>Nu există întrebări. Adaugă prima întrebare folosind formularul de mai sus.</p>
						</div>
					)}
				</div>
				)}

				{/* Question Bank Info */}
				{data.question_source === 'bank' && data.question_set_id && (
					<div className="admin-info-box" style={{ marginTop: '2rem' }}>
						<h4 style={{ marginBottom: '0.5rem' }}>📚 Bancă de Întrebări Selectată</h4>
						{questionBanks.find(b => b.id === parseInt(data.question_set_id)) && (
							<div>
								<p><strong>{questionBanks.find(b => b.id === parseInt(data.question_set_id)).title}</strong></p>
								<p className="admin-info-box-hint">
									Testul va include toate întrebările din această bancă. 
									Poți gestiona întrebările din pagina Question Banks.
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default TestBuilderStep2;

