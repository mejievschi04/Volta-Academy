import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { examService, courseProgressService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ExamPage = () => {
	const { courseId, examId } = useParams();
	const { user } = useAuth();
	const navigate = useNavigate();
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
	const [showFeedback, setShowFeedback] = useState(false); // 'instant' | 'final' | false
	const timerIntervalRef = useRef(null);

	useEffect(() => {
		const fetchExam = async () => {
			try {
				setLoading(true);
				const data = await examService.getExam(examId);
				setExam(data);

				if (data.latest_result) {
					setResult(data.latest_result);
					setAnswers(data.latest_result.answers || {});
					setSubmitted(true);
				}

				if (data.time_limit_minutes && !data.latest_result) {
					setTimeRemaining(data.time_limit_minutes * 60);
					setStartTime(Date.now());
				}

				// Determine feedback mode (instant if exam allows, otherwise final)
				setShowFeedback(data.show_feedback_instant ?? false);
			} catch (err) {
				console.error('Error fetching exam:', err);
				setError(err.response?.data?.message || 'Testul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchExam();
	}, [examId]);

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

			const resultData = await examService.submitExam(examId, answers);
			setResult(resultData.result);
			setSubmitted(true);

			// If exam is required and not passed, show blocking message
			if (exam?.is_required && !resultData.result.passed) {
				// Progress will be blocked by backend
			}
		} catch (err) {
			console.error('Error submitting exam:', err);
			setError(err.response?.data?.message || 'Eroare la trimiterea testului');
		}
	}, [examId, answers, exam]);

	// Handle retry
	const handleRetry = useCallback(() => {
		if (!exam?.can_retake) {
			alert('Ai atins numărul maxim de încercări pentru acest test.');
			return;
		}

		setAnswers({});
		setSubmitted(false);
		setResult(null);
		setCurrentQuestionIndex(0);
		setFlaggedQuestions(new Set());
		setError(null);

		if (exam.time_limit_minutes) {
			setTimeRemaining(exam.time_limit_minutes * 60);
			setStartTime(Date.now());
		}
	}, [exam]);

	// Format time
	const formatTime = useCallback((seconds) => {
		if (!seconds) return '00:00';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
			if (q.type === 'open_text') return false;
			return answers[q.id] === q.answerIndex;
		}).length;
		const incorrectAnswers = totalQuestions - correctAnswers;

		return {
			totalQuestions,
			correctAnswers,
			incorrectAnswers,
			percentage: result.percentage || 0,
			passed: result.passed || false,
		};
	}, [result, exam, answers]);

	// Get question status
	const getQuestionStatus = useCallback((questionId, index) => {
		if (submitted && result) {
			const question = exam.questions.find(q => q.id === questionId);
			if (question.type === 'open_text') return 'pending';
			const isCorrect = answers[questionId] === question.answerIndex;
			return isCorrect ? 'completed' : 'incorrect';
		}
		const isAnswered = answers[questionId] !== undefined;
		const isCurrent = index === currentQuestionIndex;
		if (isCurrent) return 'current';
		if (isAnswered) return 'answered';
		return 'not-started';
	}, [answers, currentQuestionIndex, submitted, result, exam]);

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
					{courseId && (
						<Link to={`/courses/${courseId}`} className="student-exam-btn student-exam-btn-secondary">
							Înapoi la curs
						</Link>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="student-exam-page">
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

			{/* Questions */}
			{!submitted && (
				<div className="student-exam-questions">
					{exam.questions.map((q, idx) => {
						const isOpenText = q.type === 'open_text';
						const isCorrect = !isOpenText && answers[q.id] === q.answerIndex;
						const showResult = showFeedback === 'instant' && answers[q.id] !== undefined;
						const isFlagged = flaggedQuestions.has(q.id);

						return (
							<div
								key={q.id}
								id={`question-${q.id}`}
								className={`student-exam-question ${showResult ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
							>
								<div className="student-exam-question-header">
									<div className={`student-exam-question-number ${showResult ? (isCorrect ? 'correct' : 'incorrect') : ''}`}>
										{showResult ? (isCorrect ? '✓' : '✗') : idx + 1}
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
											const isCorrectOption = i === q.answerIndex;

											return (
												<label
													key={i}
													className={`student-exam-answer-option ${showResult 
														? (isCorrectOption ? 'correct' : isSelected ? 'incorrect' : 'default')
														: (isSelected ? 'selected' : 'default')
													}`}
												>
													<input
														type="radio"
														name={q.id}
														checked={isSelected}
														onChange={() => handleAnswerChange(q.id, i)}
													/>
													<span>{opt}</span>
													{showResult && isCorrectOption && (
														<span className="student-exam-answer-check">✓</span>
													)}
													{showResult && isSelected && !isCorrectOption && (
														<span className="student-exam-answer-cross">✗</span>
													)}
												</label>
											);
										})}
									</div>
								)}

								{/* Instant Feedback */}
								{showResult && showFeedback === 'instant' && (
									<div className={`student-exam-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
										<div className="student-exam-feedback-header">
											<span className="student-exam-feedback-icon">{isCorrect ? '✓' : '✗'}</span>
											<span className="student-exam-feedback-title">
												{isCorrect ? 'Răspuns corect!' : 'Răspuns incorect'}
											</span>
										</div>
										{q.explanation && (
											<div className="student-exam-feedback-explanation">
												<strong>Explicație:</strong> {q.explanation}
											</div>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* Results */}
			{submitted && result && (
				<div className="student-exam-results">
					<div className={`student-exam-result-header ${result.passed ? 'passed' : 'failed'}`}>
						<div className="student-exam-result-icon">{result.passed ? '✓' : '✗'}</div>
						<div className="student-exam-result-title">
							{result.passed ? 'Test promovat!' : 'Test nepromovat'}
						</div>
						<div className="student-exam-result-subtitle">
							{result.passed 
								? 'Felicitări! Ai promovat testul cu succes.'
								: `Ai obținut ${result.percentage}%, dar ai nevoie de minim ${exam.passing_score}% pentru a promova.`
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

					{/* Final Feedback */}
					{showFeedback === 'final' && (
						<div className="student-exam-final-feedback">
							{exam.questions.map((q, idx) => {
								const isCorrect = q.type !== 'open_text' && answers[q.id] === q.answerIndex;
								const userAnswer = answers[q.id];

								return (
									<div key={q.id} className={`student-exam-feedback-item ${isCorrect ? 'correct' : 'incorrect'}`}>
										<div className="student-exam-feedback-item-header">
											<span className="student-exam-feedback-item-number">{idx + 1}</span>
											<span className="student-exam-feedback-item-status">
												{isCorrect ? '✓ Corect' : '✗ Incorect'}
											</span>
										</div>
										<div className="student-exam-feedback-item-question">{q.text}</div>
										{q.type !== 'open_text' && (
											<div className="student-exam-feedback-item-answers">
												<div className="student-exam-feedback-item-correct">
													<strong>Răspuns corect:</strong> {q.options[q.answerIndex]}
												</div>
												{userAnswer !== undefined && userAnswer !== q.answerIndex && (
													<div className="student-exam-feedback-item-user">
														<strong>Răspunsul tău:</strong> {q.options[userAnswer]}
													</div>
												)}
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
					)}

					{/* Blocking Message */}
					{exam.is_required && !result.passed && (
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
				{submitted && result && exam.can_retake && !result.passed && (
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
		</div>
	);
};

export default ExamPage;

