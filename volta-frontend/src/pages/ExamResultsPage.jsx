import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examResultsService } from '../services/api';
import '../styles/exam-results.css';

const ExamResultsPage = () => {
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedResult, setSelectedResult] = useState(null);
	const [loadingDetails, setLoadingDetails] = useState(false);

	useEffect(() => {
		fetchResults();
	}, []);

	const fetchResults = async () => {
		try {
			setLoading(true);
			const data = await examResultsService.getAll();
			setResults(data);
		} catch (err) {
			console.error('Error fetching exam results:', err);
			setError('Nu s-au putut încărca rezultatele testelor');
		} finally {
			setLoading(false);
		}
	};

	const handleSelectResult = async (result) => {
		try {
			setLoadingDetails(true);
			// Load full details with questions
			const fullDetails = await examResultsService.getById(result.id);
			setSelectedResult(fullDetails);
		} catch (err) {
			console.error('Error fetching result details:', err);
			// Fallback to basic result if detail fetch fails
			setSelectedResult(result);
		} finally {
			setLoadingDetails(false);
		}
	};

	const getUserAnswer = (question) => {
		// Check if question already has user_answer from backend
		if (question.user_answer !== undefined) {
			return question.user_answer;
		}
		// Fallback to old method
		if (!selectedResult || !selectedResult.answers) return null;
		return selectedResult.answers[question.id];
	};

	const getQuestionType = (question) => {
		return question.question_type || question.type || 'multiple_choice';
	};

	const isCorrectAnswer = (question) => {
		// Check if backend already calculated this
		if (question.is_correct !== undefined) {
			return question.is_correct;
		}
		// Fallback to old calculation
		if (getQuestionType(question) === 'open_text' || getQuestionType(question) === 'short_answer') {
			return null; // Open text questions need manual review
		}
		
		const userAnswer = getUserAnswer(question);
		if (userAnswer === null) return false;
		
		const correctAnswerIndex = question.answers?.findIndex(a => a.is_correct) ?? -1;
		return userAnswer === correctAnswerIndex;
	};

	const getManualReviewScore = (questionId) => {
		if (!selectedResult || !selectedResult.manual_review_scores) return null;
		return selectedResult.manual_review_scores[questionId] ?? null;
	};

	if (loading) {
		return (
			<div className="va-main fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="exam-results-page">
			<div style={{ marginBottom: '2.5rem' }}>
				<h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
					Rezultate Teste
				</h1>
				<p style={{ fontSize: '1.1rem', color: 'var(--text-tertiary)' }}>
					Vezi toate testele completate și răspunsurile tale
				</p>
			</div>

			{error && (
				<div style={{
					padding: '1rem',
					background: 'var(--bg-tertiary)',
					border: '1px solid var(--border-primary)',
					borderRadius: '8px',
					marginBottom: '1.5rem',
					color: 'var(--text-primary)'
				}}>
					{error}
				</div>
			)}

			<div className="exam-results-grid">
				{/* Results List */}
				<div>
					<h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', color: 'var(--text-primary)' }}>Teste Completate</h2>
					{results.length > 0 ? (
						<div className="exam-results-list">
							{results.map((result) => (
								<button
									key={result.id}
									type="button"
									onClick={() => handleSelectResult(result)}
									className={`exam-result-item ${selectedResult?.id === result.id ? 'selected' : ''}`}
								>
									<div className="exam-result-header">
										<div className="exam-result-title">
											{result.exam?.title || 'Test'}
										</div>
										<div className={`exam-result-status-badge ${result.passed ? 'passed' : 'failed'}`}>
											{result.passed ? '✓ Promovat' : '✗ Ne promovat'}
										</div>
									</div>
									<div className="exam-result-meta">
										<div>📚 {result.exam?.course?.title || 'Curs'}</div>
										<div>🕐 {new Date(result.completed_at).toLocaleString('ro-RO')}</div>
									</div>
									<div className="exam-result-score">
										<div className="exam-result-score-label">
											Scor:
										</div>
										<div className="exam-result-score-value">
											{result.score} / {result.total_points} ({result.percentage}%)
										</div>
									</div>
									{result.needs_manual_review && !result.reviewed_at && (
										<div className="exam-result-manual-review pending">
											⏳ În așteptarea verificării
										</div>
									)}
								</button>
							))}
						</div>
					) : (
						<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
							<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
							<div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Nu ai completat niciun test</div>
							<div style={{ fontSize: '0.9rem' }}>Completează teste pentru a vedea rezultatele aici</div>
						</div>
					)}
				</div>

				{/* Result Details */}
				{selectedResult && (
					<div className="exam-result-details">
						<div className="exam-result-details-header">
							<h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Detalii Rezultat</h2>
							<button
								type="button"
								onClick={() => setSelectedResult(null)}
								className="va-btn va-btn-sm"
								disabled={loadingDetails}
							>
								Închide
							</button>
						</div>
						
						{loadingDetails && (
							<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
								<div>Se încarcă detaliile...</div>
							</div>
						)}
						
						{!loadingDetails && (
							<>

						{/* Summary */}
						<div className="exam-result-summary">
							<div className="exam-result-summary-item">
								<strong>Test:</strong> {selectedResult.exam?.title}
							</div>
							<div className="exam-result-summary-item">
								<strong>Curs:</strong> {selectedResult.exam?.course?.title}
							</div>
							<div className="exam-result-summary-item">
								<strong>Data completării:</strong> {new Date(selectedResult.completed_at).toLocaleString('ro-RO')}
							</div>
							<div className="exam-result-summary-item">
								<strong>Încercare:</strong> #{selectedResult.attempt_number || 1}
							</div>
							<div className="exam-result-score-display">
								<div className="exam-result-score-display-item">
									<div className="exam-result-score-display-label">
										Scor Final
									</div>
									<div className="exam-result-score-display-value">
										{selectedResult.score} / {selectedResult.total_points}
									</div>
								</div>
								<div className="exam-result-score-display-item" style={{ textAlign: 'right' }}>
									<div className="exam-result-score-display-label">
										Procentaj
									</div>
									<div className={`exam-result-score-display-value percentage ${selectedResult.passed ? 'passed' : 'failed'}`}>
										{selectedResult.percentage}%
									</div>
								</div>
							</div>
							<div className={`exam-result-status-display ${selectedResult.passed ? 'passed' : 'failed'}`}>
								{selectedResult.passed ? '✓ TEST PROMOVAT' : '✗ TEST NE PROMOVAT'}
							</div>
						</div>

						{/* Questions and Answers */}
						{selectedResult.exam?.questions && selectedResult.exam.questions.length > 0 ? (
							<div>
								<h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Răspunsurile Tale</h3>
								<div className="exam-result-questions">
									{selectedResult.exam.questions.map((question, index) => {
										const userAnswer = getUserAnswer(question);
										const isOpenText = getQuestionType(question) === 'open_text' || getQuestionType(question) === 'short_answer';
										const isCorrect = !isOpenText ? isCorrectAnswer(question) : null;
										const manualScore = getManualReviewScore(question.id);
										const maxPoints = question.points || 1;
										const correctAnswerIndex = question.correct_answer_index ?? question.answers?.findIndex(a => a.is_correct) ?? -1;

										return (
											<div
												key={question.id}
												className={`exam-result-question ${isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : ''}`}
											>
												<div className="exam-result-question-header">
													<div className="exam-result-question-number">
														Întrebare {index + 1} ({maxPoints} puncte)
													</div>
													{isCorrect !== null && (
														<div className={`exam-result-question-status ${isCorrect ? 'correct' : 'incorrect'}`}>
															{isCorrect ? '✓ Corect' : '✗ Incorect'}
														</div>
													)}
													{isOpenText && manualScore !== null && (
														<div className="exam-result-question-status">
															{manualScore} / {maxPoints} puncte
														</div>
													)}
												</div>
												<div className="exam-result-question-text">
													{question.question_text || question.content}
												</div>

												{isOpenText ? (
													<div>
														<div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
															Răspunsul tău:
														</div>
														<div className={`exam-result-open-text-answer ${!userAnswer ? 'empty' : ''}`}>
															{userAnswer || <em>Fără răspuns</em>}
														</div>
														{manualScore !== null ? (
															<div className="exam-result-manual-review">
																✓ Evaluat manual: {manualScore} / {maxPoints} puncte
															</div>
														) : (
															<div className="exam-result-manual-review pending">
																⏳ În așteptarea evaluării manuale
															</div>
														)}
													</div>
												) : (
													<div>
														<div style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
															Răspunsurile tale:
														</div>
														<div className="exam-result-answers">
															{question.answers && question.answers.map((answer, answerIndex) => {
																const isSelected = userAnswer === answerIndex;
																const isCorrectAnswer = answer.is_correct || answer.is_correct === true;
																const answerText = answer.answer_text || answer.text || answer.content || '';

																return (
																	<div
																		key={answerIndex}
																		className={`exam-result-answer ${
																			isSelected && isCorrectAnswer ? 'correct' 
																			: isSelected && !isCorrectAnswer ? 'user-incorrect'
																			: isCorrectAnswer ? 'correct'
																			: 'default'
																		}`}
																	>
																		{isSelected && (
																			<span style={{ fontSize: '1.2rem' }}>
																				{isCorrectAnswer ? '✓' : '✗'}
																			</span>
																		)}
																		{isCorrectAnswer && !isSelected && (
																			<span style={{ fontSize: '1.2rem' }}>✓</span>
																		)}
																		<span className="exam-result-answer-text">
																			{answerText}
																		</span>
																		{isCorrectAnswer && (
																			<span className="exam-result-answer-label">
																				Răspuns corect
																			</span>
																		)}
																	</div>
																);
															})}
														</div>
														{/* Show correct answer if user's answer was wrong */}
														{isCorrect === false && correctAnswerIndex >= 0 && question.answers && question.answers[correctAnswerIndex] && (
															<div className="exam-result-answer correct" style={{ marginTop: '0.75rem' }}>
																<span style={{ fontSize: '1.2rem' }}>✓</span>
																<span style={{ flex: 1, fontWeight: 600 }}>
																	Răspunsul corect:
																</span>
																<span className="exam-result-answer-text">
																	{question.answers[correctAnswerIndex].answer_text || 
																	 question.answers[correctAnswerIndex].text || 
																	 question.answers[correctAnswerIndex].content}
																</span>
															</div>
														)}
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						) : (
							<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
								<div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</div>
								<div>Nu sunt disponibile întrebări pentru acest rezultat.</div>
								<div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
									{selectedResult.exam ? `Test: ${selectedResult.exam.title}` : 'Detaliile testului nu sunt disponibile.'}
								</div>
							</div>
						)}
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default ExamResultsPage;

