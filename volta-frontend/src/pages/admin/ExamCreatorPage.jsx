import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const ExamCreatorPage = () => {
	const { id } = useParams(); // exam ID if editing
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const courseId = searchParams.get('course_id');
	const categoryId = searchParams.get('category_id');

	const [loading, setLoading] = useState(false);
	const [courses, setCourses] = useState([]);
	const [formData, setFormData] = useState({
		course_id: courseId || '',
		title: '',
		max_score: 100,
		questions: [],
	});

	useEffect(() => {
		// Require course_id to create/edit exams
		if (!courseId && !id) {
			alert('Trebuie să selectezi un curs pentru a crea un test!');
			navigate('/admin/courses');
			return;
		}
		
		fetchCourses();
		if (id) {
			fetchExam();
		} else if (courseId) {
			// Set course_id if provided via URL
			setFormData(prev => ({ ...prev, course_id: courseId }));
		}
	}, [id, courseId]);

	const fetchCourses = async () => {
		try {
			const allCourses = await adminService.getCourses();
			const filteredCourses = categoryId
				? allCourses.filter(c => c.category_id == categoryId)
				: allCourses;
			setCourses(filteredCourses);
			if (courseId && !formData.course_id) {
				setFormData(prev => ({ ...prev, course_id: courseId }));
			}
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const fetchExam = async () => {
		try {
			setLoading(true);
			const exam = await adminService.getExam(id);
			setFormData({
				course_id: exam.course_id,
				title: exam.title,
				max_score: exam.max_score || 100,
				questions: exam.questions || [],
			});
		} catch (err) {
			console.error('Error fetching exam:', err);
			alert('Eroare la încărcarea testului');
		} finally {
			setLoading(false);
		}
	};

	const addQuestion = () => {
		setFormData(prev => ({
			...prev,
			questions: [
				...prev.questions,
				{
					question_text: '',
					points: 1,
					order: prev.questions.length,
					answers: [
						{ answer_text: '', is_correct: false, order: 0 },
						{ answer_text: '', is_correct: false, order: 1 },
					],
				},
			],
		}));
	};

	const updateQuestion = (questionIndex, field, value) => {
		setFormData(prev => {
			const newQuestions = [...prev.questions];
			newQuestions[questionIndex] = {
				...newQuestions[questionIndex],
				[field]: value,
			};
			return { ...prev, questions: newQuestions };
		});
	};

	const deleteQuestion = (questionIndex) => {
		if (!confirm('Sigur dorești să ștergi această întrebare?')) return;
		setFormData(prev => ({
			...prev,
			questions: prev.questions.filter((_, index) => index !== questionIndex),
		}));
	};

	const addAnswer = (questionIndex) => {
		setFormData(prev => {
			const newQuestions = [...prev.questions];
			const question = newQuestions[questionIndex];
			question.answers = [
				...question.answers,
				{
					answer_text: '',
					is_correct: false,
					order: question.answers.length,
				},
			];
			return { ...prev, questions: newQuestions };
		});
	};

	const updateAnswer = (questionIndex, answerIndex, field, value) => {
		setFormData(prev => {
			const newQuestions = [...prev.questions];
			const question = newQuestions[questionIndex];
			question.answers[answerIndex] = {
				...question.answers[answerIndex],
				[field]: value,
			};
			return { ...prev, questions: newQuestions };
		});
	};

	const deleteAnswer = (questionIndex, answerIndex) => {
		setFormData(prev => {
			const newQuestions = [...prev.questions];
			const question = newQuestions[questionIndex];
			if (question.answers.length <= 2) {
				alert('Trebuie să existe cel puțin 2 răspunsuri!');
				return prev;
			}
			question.answers = question.answers.filter((_, index) => index !== answerIndex);
			return { ...prev, questions: newQuestions };
		});
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		
		// Validate that course_id is required
		if (!formData.course_id) {
			alert('Trebuie să selectezi un curs!');
			return;
		}
		
		// Validate questions
		if (formData.questions.length === 0) {
			alert('Adaugă cel puțin o întrebare!');
			return;
		}

		for (let i = 0; i < formData.questions.length; i++) {
			const question = formData.questions[i];
			if (!question.question_text.trim()) {
				alert(`Întrebarea ${i + 1} trebuie să aibă text!`);
				return;
			}
			if (question.answers.length < 2) {
				alert(`Întrebarea ${i + 1} trebuie să aibă cel puțin 2 răspunsuri!`);
				return;
			}
			const hasCorrectAnswer = question.answers.some(a => a.is_correct);
			if (!hasCorrectAnswer) {
				alert(`Întrebarea ${i + 1} trebuie să aibă cel puțin un răspuns corect!`);
				return;
			}
			for (let j = 0; j < question.answers.length; j++) {
				if (!question.answers[j].answer_text.trim()) {
					alert(`Răspunsul ${j + 1} din întrebarea ${i + 1} trebuie să aibă text!`);
					return;
				}
			}
		}

		try {
			setLoading(true);
			const dataToSend = {
				...formData,
				questions: formData.questions.map((q, qIndex) => ({
					...(id && q.id ? { id: q.id } : {}),
					question_text: q.question_text,
					points: q.points || 1,
					order: q.order || qIndex,
					answers: q.answers.map((a, aIndex) => ({
						...(id && a.id ? { id: a.id } : {}),
						answer_text: a.answer_text,
						is_correct: a.is_correct || false,
						order: a.order || aIndex,
					})),
				})),
			};

			if (id) {
				await adminService.updateExam(id, dataToSend);
				alert('Test actualizat cu succes!');
			} else {
				await adminService.createExam(dataToSend);
				alert('Test creat cu succes!');
			}
			
			// Always navigate back to course detail page
			if (formData.course_id) {
				navigate(`/admin/courses/${formData.course_id}`);
			} else {
				navigate('/admin/courses');
			}
		} catch (err) {
			console.error('Error saving exam:', err);
			alert('Eroare la salvarea testului');
		} finally {
			setLoading(false);
		}
	};

	if (loading && id) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">
						{id ? 'Editează Test' : 'Creează Test Nou'}
					</h1>
					<p className="va-muted admin-page-subtitle">
						Completează informațiile pentru {id ? 'actualizarea' : 'crearea'} testului
					</p>
				</div>
				<button className="va-btn" onClick={() => {
					if (categoryId) {
						navigate(`/admin/categories/${categoryId}`);
					} else {
						navigate('/admin/courses');
					}
				}}>
					Înapoi
				</button>
			</div>

			<div className="va-card">
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Curs *</label>
							<select
								className="va-form-input"
								value={formData.course_id}
								onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
								required
								disabled={!!courseId}
							>
								<option value="">Selectează curs</option>
								{courses.map((course) => (
									<option key={course.id} value={course.id}>
										{course.title}
									</option>
								))}
							</select>
							{courses.length === 0 && (
								<small style={{ color: 'var(--va-danger)', display: 'block', marginTop: '0.5rem' }}>
									Nu există cursuri disponibile. Creează mai întâi un curs!
								</small>
							)}
						</div>

						<div className="va-form-group">
							<label className="va-form-label">Titlu Test *</label>
							<input
								type="text"
								className="va-form-input"
								value={formData.title}
								onChange={(e) => setFormData({ ...formData, title: e.target.value })}
								placeholder="Ex: Test Final - React Basics"
								required
							/>
						</div>

						<div className="va-form-group">
							<label className="va-form-label">Scor Maxim</label>
							<input
								type="number"
								className="va-form-input"
								value={formData.max_score}
								onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 100 })}
								min="1"
								placeholder="100"
							/>
						</div>

						{/* Questions Section */}
						<div style={{ marginTop: '2rem', borderTop: '2px solid var(--va-border)', paddingTop: '2rem' }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
								<h2 style={{ margin: 0, fontSize: '1.25rem' }}>Întrebări</h2>
								<button
									type="button"
									className="va-btn va-btn-primary"
									onClick={addQuestion}
								>
									+ Adaugă Întrebare
								</button>
							</div>

							{formData.questions.length === 0 ? (
								<div style={{ 
									padding: '2rem', 
									textAlign: 'center', 
									background: 'var(--va-surface-2)', 
									borderRadius: '8px',
									border: '1px dashed var(--va-border)'
								}}>
									<p className="va-muted">Nu există întrebări. Adaugă prima întrebare!</p>
								</div>
							) : (
								<div className="va-stack" style={{ gap: '2rem' }}>
									{formData.questions.map((question, questionIndex) => (
										<div key={questionIndex} style={{
											padding: '1.5rem',
											border: '1px solid var(--va-border)',
											borderRadius: '8px',
											background: 'var(--va-surface)',
										}}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
												<h3 style={{ margin: 0, fontSize: '1.1rem' }}>
													Întrebare {questionIndex + 1}
												</h3>
												<button
													type="button"
													className="va-btn va-btn-sm va-btn-danger"
													onClick={() => deleteQuestion(questionIndex)}
												>
													Șterge
												</button>
											</div>

											<div className="va-form-group">
												<label className="va-form-label">Text Întrebare *</label>
												<textarea
													className="va-form-input"
													value={question.question_text}
													onChange={(e) => updateQuestion(questionIndex, 'question_text', e.target.value)}
													placeholder="Scrie întrebarea aici..."
													required
													rows={3}
												/>
											</div>

											<div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '1rem', marginBottom: '1rem' }}>
												<div className="va-form-group">
													<label className="va-form-label">Puncte</label>
													<input
														type="number"
														className="va-form-input"
														value={question.points || 1}
														onChange={(e) => updateQuestion(questionIndex, 'points', parseInt(e.target.value) || 1)}
														min="1"
													/>
												</div>
											</div>

											<div style={{ marginTop: '1.5rem' }}>
												<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
													<label className="va-form-label" style={{ margin: 0 }}>Răspunsuri *</label>
													<button
														type="button"
														className="va-btn va-btn-sm"
														onClick={() => addAnswer(questionIndex)}
													>
														+ Adaugă Răspuns
													</button>
												</div>

												<div className="va-stack" style={{ gap: '0.75rem' }}>
													{question.answers.map((answer, answerIndex) => (
														<div key={answerIndex} style={{
															display: 'flex',
															gap: '0.75rem',
															alignItems: 'flex-start',
															padding: '0.75rem',
															background: answer.is_correct ? 'rgba(76, 175, 80, 0.1)' : 'var(--va-surface-2)',
															borderRadius: '6px',
															border: answer.is_correct ? '2px solid #4CAF50' : '1px solid var(--va-border)',
														}}>
															<input
																type="checkbox"
																checked={answer.is_correct}
																onChange={(e) => updateAnswer(questionIndex, answerIndex, 'is_correct', e.target.checked)}
																style={{ marginTop: '0.5rem', cursor: 'pointer' }}
															/>
															<div style={{ flex: 1 }}>
																<input
																	type="text"
																	className="va-form-input"
																	value={answer.answer_text}
																	onChange={(e) => updateAnswer(questionIndex, answerIndex, 'answer_text', e.target.value)}
																	placeholder={`Răspuns ${answerIndex + 1}`}
																	required
																/>
															</div>
															{question.answers.length > 2 && (
																<button
																	type="button"
																	className="va-btn va-btn-sm va-btn-danger"
																	onClick={() => deleteAnswer(questionIndex, answerIndex)}
																>
																	Șterge
																</button>
															)}
														</div>
													))}
												</div>
												<small className="va-muted" style={{ marginTop: '0.5rem', display: 'block' }}>
													✓ Bifează răspunsul corect
												</small>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
							<button
								type="button"
								className="va-btn"
								onClick={() => {
									if (categoryId) {
										navigate(`/admin/categories/${categoryId}`);
									} else {
										navigate('/admin/courses');
									}
								}}
								disabled={loading}
							>
								Anulează
							</button>
							<button
								type="submit"
								className="va-btn va-btn-primary"
								disabled={loading}
							>
								{loading ? 'Se salvează...' : id ? 'Actualizează Test' : 'Creează Test'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

export default ExamCreatorPage;
