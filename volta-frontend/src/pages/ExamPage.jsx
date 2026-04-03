import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { examService, courseProgressService, coursesService } from '../services/api';
import CourseCongratulationsModal from '../components/student/CourseCongratulationsModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';

/** Ciornă răspunsuri în sessionStorage — supraviețuiește navigării înapoi la curs (nu la trimitere). */
function buildExamDraftKey(userId, courseId, examId) {
	return `volta_exam_draft:${userId ?? 'guest'}:${courseId ?? ''}:${examId}`;
}

function restoreExamDraftAnswers(rawJson, questions) {
	let restored = {};
	try {
		const parsed = rawJson ? JSON.parse(rawJson) : null;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			restored = parsed;
		}
	} catch {
		return {};
	}
	const next = {};
	for (const q of questions || []) {
		const id = q.id;
		if (Object.prototype.hasOwnProperty.call(restored, id)) {
			next[id] = restored[id];
		} else if (Object.prototype.hasOwnProperty.call(restored, String(id))) {
			next[id] = restored[String(id)];
		}
	}
	return next;
}

/** Mapează chei string/number din API la id-uri numerice de întrebări (răspunsuri salvate). */
function normalizeAnswersFromApi(raw, questions) {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const next = {};
	for (const q of questions || []) {
		const id = q.id;
		if (Object.prototype.hasOwnProperty.call(raw, id)) {
			next[id] = raw[id];
		} else if (Object.prototype.hasOwnProperty.call(raw, String(id))) {
			next[id] = raw[String(id)];
		}
	}
	return next;
}

const ExamPage = () => {
	const params = useParams();
	const courseId = params.courseId ?? null;
	const examId = params.examId;
	const { user } = useAuth();
	const navigate = useNavigate();
	const { warning: showWarning, error: showError } = useToast();
	const [exam, setExam] = useState(null);
	const [answers, setAnswers] = useState({});
	const [submitted, setSubmitted] = useState(false);
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [timeRemaining, setTimeRemaining] = useState(null);
	const [startTime, setStartTime] = useState(null);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
	const [showCourseCongrats, setShowCourseCongrats] = useState(false);
	const [congratsCourseTitle, setCongratsCourseTitle] = useState('');
	const timerIntervalRef = useRef(null);

	const fetchExamData = useCallback(async ({ forceFreshAttempt = false } = {}) => {
		const draftKey = buildExamDraftKey(user?.id, courseId, examId);
		try {
			setLoading(true);
			if (forceFreshAttempt) {
				try {
					sessionStorage.removeItem(draftKey);
				} catch {
					/* ignore */
				}
			}
			const data = await examService.getExam(examId, courseId, { newAttempt: forceFreshAttempt });
			setExam(data);

			if (data.latest_result && !forceFreshAttempt) {
				setResult(data.latest_result);
				setAnswers(normalizeAnswersFromApi(data.latest_result.answers, data.questions));
				setSubmitted(true);
			} else {
				setResult(null);
				setSubmitted(false);
				let draftAnswers = {};
				if (!forceFreshAttempt) {
					try {
						const raw = sessionStorage.getItem(draftKey);
						if (raw) {
							draftAnswers = restoreExamDraftAnswers(raw, data.questions);
						}
					} catch {
						draftAnswers = {};
					}
				}
				setAnswers(draftAnswers);
			}

			if (data.time_limit_minutes && (!data.latest_result || forceFreshAttempt)) {
				setTimeRemaining(data.time_limit_minutes * 60);
				setStartTime(Date.now());
			} else if (!data.time_limit_minutes) {
				setTimeRemaining(null);
				setStartTime(null);
			}

			// În timpul testului nu dezvăluim varianta corectă (UI nu folosește answerIndex până la submit).
			// După trimitere afișăm mereu rezumatul: corect/greșit, răspunsul tău și (dacă e cazul) varianta corectă.
			setCurrentQuestionIndex(0);
			setFlaggedQuestions(new Set());
			setError(null);
		} catch (err) {
			const errorMessage = handleApiError(err, 'fetchExam');
			setError(errorMessage || 'Testul nu a fost găsit');
		} finally {
			setLoading(false);
		}
	}, [examId, courseId, user?.id]);

	useEffect(() => {
		fetchExamData();
	}, [fetchExamData]);

	// Persistă răspunsurile în timp real ca să nu se piardă la ieșire din pagină / refresh (până la trimitere).
	useEffect(() => {
		if (!exam || submitted) return;
		const draftKey = buildExamDraftKey(user?.id, courseId, examId);
		try {
			sessionStorage.setItem(draftKey, JSON.stringify(answers));
		} catch {
			/* quota / private mode */
		}
	}, [exam, submitted, answers, user?.id, courseId, examId]);

	// Timer countdown
	useEffect(() => {
		if (!exam?.time_limit_minutes || submitted || !startTime) return;

		timerIntervalRef.current = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			const remaining = (exam.time_limit_minutes * 60) - elapsed;

			if (remaining <= 0) {
				setTimeRemaining(0);
				clearInterval(timerIntervalRef.current);
				handleSubmit();
			} else {
				setTimeRemaining(remaining);
			}
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [exam?.time_limit_minutes, submitted, startTime]);

	// Handle submit
	const handleSubmit = useCallback(async () => {
		try {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}

			const resultData = await examService.submitExam(examId, answers, courseId || null);
			const submittedResult = resultData.result;
			setResult(submittedResult);
			if (submittedResult?.answers && typeof submittedResult.answers === 'object') {
				setAnswers((prev) => ({ ...prev, ...normalizeAnswersFromApi(submittedResult.answers, exam?.questions || []) }));
			}
			setSubmitted(true);
			try {
				sessionStorage.removeItem(buildExamDraftKey(user?.id, courseId, examId));
			} catch {
				/* ignore */
			}

			// Felicitare + navigare la meniul cursului (ca la finalizarea din lecții), când testul încheie cursul
			if (courseId && submittedResult?.passed) {
				let showCongrats = exam?.type === 'final';
				if (!showCongrats) {
					try {
						const p = await courseProgressService.getCourseProgress(courseId);
						if (p?.course_complete) showCongrats = true;
					} catch {
						/* progres opțional */
					}
				}
				if (showCongrats) {
					setShowCourseCongrats(true);
					setCongratsCourseTitle('');
					try {
						const c = await coursesService.getById(courseId);
						const title = c?.title ?? c?.name;
						if (title) setCongratsCourseTitle(title);
					} catch {
						/* titlu opțional */
					}
				}
			}

			// If exam is required and not passed, show blocking message
			if (exam?.is_required && !submittedResult.passed) {
				// Progress will be blocked by backend
			}
		} catch (err) {
			const errorMessage = handleApiError(err, 'submitExam');
			setError(errorMessage || 'Eroare la trimiterea testului');
		}
	}, [examId, answers, exam, courseId, user?.id]);

	const handleCongratsClose = useCallback(() => {
		setShowCourseCongrats(false);
		if (courseId) {
			navigate(`/courses/${courseId}`, { replace: true });
		} else {
			navigate('/courses', { replace: true });
		}
	}, [courseId, navigate]);

	// Handle retry
	const handleRetry = useCallback(async () => {
		if (!exam?.can_retake) {
			showWarning('Ai atins numărul maxim de încercări pentru acest test.');
			return;
		}
		setShowCourseCongrats(false);
		await fetchExamData({ forceFreshAttempt: true });
	}, [exam, fetchExamData, showWarning]);

	// Format time
	const formatTime = useCallback((seconds) => {
		if (!seconds) return '00:00';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}, []);

	const normalizeAnswerIndex = useCallback((value) => {
		if (value === null || value === undefined || value === '') return null;
		const parsed = Number(value);
		return Number.isNaN(parsed) ? null : parsed;
	}, []);

	// Handle answer change
	const handleAnswerChange = useCallback((questionId, answer) => {
		setAnswers(prev => ({
			...prev,
			[questionId]: answer
		}));
	}, []);

	// Toggle flag
	const toggleFlag = useCallback((questionId) => {
		setFlaggedQuestions(prev => {
			const newSet = new Set(prev);
			if (newSet.has(questionId)) {
				newSet.delete(questionId);
			} else {
				newSet.add(questionId);
			}
			return newSet;
		});
	}, []);

	// Scroll to question
	const scrollToQuestion = useCallback((index) => {
		if (!exam || !exam.questions || index < 0 || index >= exam.questions.length) return;
		setCurrentQuestionIndex(index);
		const questionElement = document.getElementById(`question-${exam.questions[index].id}`);
		if (questionElement) {
			questionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, [exam]);

	// Calculate performance metrics
	const performanceMetrics = useMemo(() => {
		if (!result || !exam) return null;

		const totalQuestions = exam.questions.length;
		const correctAnswers = exam.questions.filter(q => {
			if (['open_text', 'short_answer', 'essay'].includes(q.type || '')) return false;
			const userAnswer = normalizeAnswerIndex(answers[q.id]);
			const correctIndex = normalizeAnswerIndex(q.answerIndex);
			return userAnswer !== null && correctIndex !== null && userAnswer === correctIndex;
		}).length;
		const incorrectAnswers = totalQuestions - correctAnswers;

		return {
			totalQuestions,
			correctAnswers,
			incorrectAnswers,
			percentage: result.percentage || 0,
			passed: result.passed || false,
		};
	}, [result, exam, answers, normalizeAnswerIndex]);
	const needsManualReview = Boolean(result?.needs_manual_review || result?.status === 'pending_review');

	// Get question status
	const getQuestionStatus = useCallback((questionId, index) => {
		if (submitted && result) {
			const question = exam.questions.find(q => q.id === questionId);
			if (['open_text', 'short_answer', 'essay'].includes(question.type || '')) return 'pending';
			const userAnswer = normalizeAnswerIndex(answers[questionId]);
			const correctIndex = normalizeAnswerIndex(question.answerIndex);
			const isCorrect = userAnswer !== null && correctIndex !== null && userAnswer === correctIndex;
			return isCorrect ? 'completed' : 'incorrect';
		}
		const isAnswered = answers[questionId] !== undefined;
		const isCurrent = index === currentQuestionIndex;
		if (isCurrent) return 'current';
		if (isAnswered) return 'answered';
		return 'not-started';
	}, [answers, currentQuestionIndex, submitted, result, exam, normalizeAnswerIndex]);

	if (loading) {
		return (
			<div className="student-exam-page">
				<div className="student-exam-loading">
					<div className="student-loading-spinner"></div>
					<p>Se încarcă testul...</p>
				</div>
			</div>
		);
	}

	if (error || !exam) {
		return (
			<div className="student-exam-page">
				<div className="student-exam-error">
					<p>{error || 'Testul nu a fost găsit'}</p>
					{courseId ? (
						<Link to={`/courses/${courseId}`} className="student-exam-btn student-exam-btn-secondary">
							Înapoi la curs
						</Link>
					) : (
						<Link to="/courses" className="student-exam-btn student-exam-btn-secondary">
							Înapoi la mape
						</Link>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="student-exam-page">
			{/* Back link */}
			{courseId ? (
				<Link to={`/courses/${courseId}`} className="student-exam-back-link">
					← Înapoi la curs
				</Link>
			) : (
				<Link to="/courses" className="student-exam-back-link">
					← Înapoi la mape
				</Link>
			)}

			<p className="student-exam-context-note" role="note">
				<span className="student-exam-context-badge">Evaluare</span>
				{courseId ? (
					<>
						Această pagină este un <strong>examen sau test</strong> din curs, nu întregul parcurs. După trimitere poți continua lecțiile din meniul stânga.
					</>
				) : (
					<>
						<strong>Examen independent</strong> — nu este legat de un curs anume. Testele din interiorul unui curs rămân pe pagina acelui curs.
					</>
				)}
			</p>

			{/* Header */}
			<div className="student-exam-header">
				<div className="student-exam-header-main">
					<div className="student-exam-header-info">
						<h1 className="student-exam-title">{exam.title}</h1>
						{exam.description && (
							<p className="student-exam-description">{exam.description}</p>
						)}
					</div>
					{exam.is_required && (
						<div className="student-exam-required-badge">
							<span>⚠️</span>
							<span>Obligatoriu</span>
						</div>
					)}
				</div>

				{/* Instructions & Passing Criteria */}
				<div className="student-exam-instructions">
					<div className="student-exam-instructions-section">
						<h3 className="student-exam-instructions-title">📋 Instrucțiuni</h3>
						{exam.instructions ? (
							<p className="student-exam-custom-instructions">{exam.instructions}</p>
						) : null}
						<ul className="student-exam-instructions-list">
							<li>Citește cu atenție fiecare întrebare înainte de a răspunde</li>
							<li>Poți marca întrebări pentru revizie folosind butonul 🚩</li>
							{exam.time_limit_minutes && (
								<li>Ai la dispoziție {exam.time_limit_minutes} minute pentru a completa testul</li>
							)}
							{exam.max_attempts && (
								<li>Ai {exam.max_attempts} {exam.max_attempts === 1 ? 'încercare' : 'încercări'} disponibile</li>
							)}
							{exam.is_required && (
								<li className="student-exam-instructions-warning">
									⚠️ Acest test este obligatoriu. Progresul tău va fi blocat până când îl promovezi.
								</li>
							)}
						</ul>
					</div>
					<div className="student-exam-instructions-section">
						<h3 className="student-exam-instructions-title">✅ Criterii de trecere</h3>
						<div className="student-exam-passing-criteria">
							<div className="student-exam-passing-criteria-item">
								<span className="student-exam-passing-criteria-label">Punctaj minim:</span>
								<span className="student-exam-passing-criteria-value">{exam.passing_score}%</span>
							</div>
							<div className="student-exam-passing-criteria-item">
								<span className="student-exam-passing-criteria-label">Întrebări totale:</span>
								<span className="student-exam-passing-criteria-value">{exam.questions.length}</span>
							</div>
							<div className="student-exam-passing-criteria-item">
								<span className="student-exam-passing-criteria-label">Puncte totale:</span>
								<span className="student-exam-passing-criteria-value">
									{exam.questions.reduce((sum, q) => sum + (q.points || 1), 0)}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Timer */}
				{timeRemaining !== null && !submitted && (
					<div className={`student-exam-timer ${timeRemaining < 300 ? 'student-exam-timer-warning' : ''}`}>
						<span className="student-exam-timer-icon">⏱️</span>
						<span className="student-exam-timer-value">{formatTime(timeRemaining)}</span>
						<span className="student-exam-timer-label">rămas</span>
					</div>
				)}

				{/* Attempt Info */}
				{exam.current_attempt > 0 && (
					<div className="student-exam-attempt-info">
						<span>Încercare {exam.current_attempt}</span>
						{exam.remaining_attempts !== null && (
							<span className="student-exam-attempt-remaining">
								({exam.remaining_attempts} {exam.remaining_attempts === 1 ? 'încercare' : 'încercări'} rămase)
							</span>
						)}
					</div>
				)}
			</div>

			{/* Navigator + Questions */}
			{!submitted && (
				<div className="student-exam-layout">
					<aside className="student-exam-nav" aria-label="Navigare întrebări">
						<div className="student-exam-nav-title">Întrebări</div>
						<div className="student-exam-nav-list">
							{exam.questions.map((q, idx) => {
								const status = getQuestionStatus(q.id, idx);
								const isFlagged = flaggedQuestions.has(q.id);
								return (
									<button
										key={q.id}
										type="button"
										onClick={() => scrollToQuestion(idx)}
										className={`student-exam-nav-item ${status === 'current' ? 'current' : ''} ${status === 'answered' ? 'answered' : ''} ${isFlagged ? 'flagged' : ''}`}
										title={`Întrebarea ${idx + 1}`}
										aria-current={status === 'current' ? 'true' : undefined}
									>
										{idx + 1}
									</button>
								);
							})}
						</div>
					</aside>
					<div className="student-exam-questions">
					{exam.questions.map((q, idx) => {
						const isOpenText = ['open_text', 'short_answer', 'essay'].includes(q.type || '');
						const isFlagged = flaggedQuestions.has(q.id);

						return (
							<div
								key={q.id}
								id={`question-${q.id}`}
								className="student-exam-question"
							>
								<div className="student-exam-question-header">
									<div className="student-exam-question-number">
										{idx + 1}
									</div>
									<div className="student-exam-question-content">
										<div className="student-exam-question-text">{q.text}</div>
										<div className="student-exam-question-meta">
											<span className="student-exam-question-points">{q.points || 1} {q.points === 1 ? 'punct' : 'puncte'}</span>
											{!submitted && (
												<button
													onClick={() => toggleFlag(q.id)}
													className={`student-exam-question-flag ${isFlagged ? 'flagged' : ''}`}
													title={isFlagged ? 'Elimină marcaj' : 'Marchează pentru revizie'}
												>
													🚩
												</button>
											)}
										</div>
									</div>
								</div>

								{isOpenText ? (
									<textarea
										className="student-exam-answer-textarea"
										value={answers[q.id] || ''}
										onChange={(e) => handleAnswerChange(q.id, e.target.value)}
										placeholder="Scrie răspunsul tău aici..."
										rows={6}
									/>
								) : (
									<div className="student-exam-answer-options">
										{q.options.map((opt, i) => {
											const isSelected = answers[q.id] === i;

											return (
												<label
													key={i}
													className={`student-exam-answer-option ${isSelected ? 'selected' : 'default'}`}
												>
													<input
														type="radio"
														name={q.id}
														checked={isSelected}
														onChange={() => handleAnswerChange(q.id, i)}
													/>
													<span>{opt}</span>
												</label>
											);
										})}
									</div>
								)}

							</div>
						);
					})}
					</div>
				</div>
			)}

			{/* Results */}
			{submitted && result && (
				<div className="student-exam-results">
					<div className={`student-exam-result-header ${needsManualReview ? 'pending' : (result.passed ? 'passed' : 'failed')}`}>
						<div className="student-exam-result-icon">{needsManualReview ? '⏳' : (result.passed ? '✓' : '✗')}</div>
						<div className="student-exam-result-title">
							{needsManualReview ? 'În așteptare evaluare manuală' : (result.passed ? 'Test promovat!' : 'Test nepromovat')}
						</div>
						<div className="student-exam-result-subtitle">
							{needsManualReview
								? 'Întrebările cu răspuns deschis vor fi evaluate de instructor/admin. Vei primi rezultatul final după aprobare.'
								: (result.passed
									? 'Felicitări! Ai promovat testul cu succes.'
									: `Ai obținut ${result.percentage}%, dar ai nevoie de minim ${exam.passing_score}% pentru a promova.`)
							}
						</div>
					</div>

					<div className="student-exam-result-stats">
						<div className="student-exam-result-stat">
							<div className="student-exam-result-stat-label">Scor</div>
							<div className="student-exam-result-stat-value">
								{result.score} / {result.total_points}
							</div>
						</div>
						<div className="student-exam-result-stat">
							<div className="student-exam-result-stat-label">Procentaj</div>
							<div className="student-exam-result-stat-value">{result.percentage}%</div>
						</div>
						{performanceMetrics && (
							<>
								<div className="student-exam-result-stat">
									<div className="student-exam-result-stat-label">Corecte</div>
									<div className="student-exam-result-stat-value success">
										{performanceMetrics.correctAnswers}
									</div>
								</div>
								<div className="student-exam-result-stat">
									<div className="student-exam-result-stat-label">Incorecte</div>
									<div className="student-exam-result-stat-value error">
										{performanceMetrics.incorrectAnswers}
									</div>
								</div>
							</>
						)}
					</div>

					{/* După trimitere: rezumat pe întrebări (în timpul testului nu se arată varianta corectă). */}
					<div className="student-exam-final-feedback">
						{exam.questions.map((q, idx) => {
							const userAnswer = answers[q.id];
							const userAnswerIndex = normalizeAnswerIndex(userAnswer);
							const correctIndex = normalizeAnswerIndex(q.answerIndex);
							const isOpenText = ['open_text', 'short_answer', 'essay'].includes(q.type || '');
							const isCorrect = !isOpenText
								&& userAnswerIndex !== null
								&& correctIndex !== null
								&& userAnswerIndex === correctIndex;

							return (
								<div key={q.id} className={`student-exam-feedback-item ${isCorrect ? 'correct' : 'incorrect'}`}>
									<div className="student-exam-feedback-item-header">
										<span className="student-exam-feedback-item-number">{idx + 1}</span>
										<span className="student-exam-feedback-item-status">
											{isOpenText ? '⏳ În evaluare manuală' : (isCorrect ? '✓ Corect' : '✗ Incorect')}
										</span>
									</div>
									<div className="student-exam-feedback-item-question">{q.text}</div>
									{!['open_text', 'short_answer', 'essay'].includes(q.type || '') && (
										<div className="student-exam-feedback-item-answers">
											{userAnswerIndex !== null && q.options?.[userAnswerIndex] != null && (
												<div className="student-exam-feedback-item-user">
													<strong>Răspunsul tău:</strong> {q.options[userAnswerIndex]}
												</div>
											)}
											{!isCorrect && correctIndex !== null && q.options?.[correctIndex] != null && (
												<div className="student-exam-feedback-item-correct">
													<strong>Răspuns corect:</strong> {q.options[correctIndex]}
												</div>
											)}
										</div>
									)}
									{['open_text', 'short_answer', 'essay'].includes(q.type || '') && userAnswer != null && String(userAnswer).trim() !== '' && (
										<div className="student-exam-feedback-item-user">
											<strong>Răspunsul tău:</strong> {userAnswer}
										</div>
									)}
									{q.explanation && (
										<div className="student-exam-feedback-item-explanation">
											<strong>Explicație:</strong> {q.explanation}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* Blocking Message */}
					{exam.is_required && !result.passed && !needsManualReview && (
						<div className="student-exam-blocking-message">
							<div className="student-exam-blocking-icon">🔒</div>
							<div className="student-exam-blocking-content">
								<h3 className="student-exam-blocking-title">Progres blocat</h3>
								<p className="student-exam-blocking-text">
									Acest test este obligatoriu și trebuie promovat pentru a continua. 
									{exam.can_retake && exam.remaining_attempts > 0 && (
										<span> Mai ai {exam.remaining_attempts} {exam.remaining_attempts === 1 ? 'încercare' : 'încercări'} disponibile.</span>
									)}
								</p>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Actions */}
			<div className="student-exam-actions">
				{!submitted && (
					<button
						onClick={handleSubmit}
						className="student-exam-btn student-exam-btn-primary"
						disabled={Object.keys(answers).length === 0}
					>
						Trimite testul
					</button>
				)}
				{submitted && result && exam.can_retake && !result.passed && !needsManualReview && (
					<button
						onClick={handleRetry}
						className="student-exam-btn student-exam-btn-primary"
					>
						Reîncearcă testul
					</button>
				)}
				{courseId && (
					<Link
						to={`/courses/${courseId}`}
						className="student-exam-btn student-exam-btn-secondary"
					>
						Înapoi la curs
					</Link>
				)}
			</div>

			<CourseCongratulationsModal
				open={showCourseCongrats}
				onClose={handleCongratsClose}
				courseTitle={congratsCourseTitle}
				closeButtonLabel="Înapoi la curs"
			/>
		</div>
	);
};

export default ExamPage;

