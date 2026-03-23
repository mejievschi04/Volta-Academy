import React, { useState, useEffect, useMemo } from 'react';
import { examResultsService } from '../services/api';
import { handleApiError } from '../utils/errorHandler';

const ExamResultsPage = () => {
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedResult, setSelectedResult] = useState(null);
	const [loadingDetails, setLoadingDetails] = useState(false);
	const [filterStatus, setFilterStatus] = useState('all'); // all | passed | failed
	const [sortBy, setSortBy] = useState('recent'); // recent | oldest

	useEffect(() => {
		fetchResults();
	}, []);

	const filteredAndSortedResults = useMemo(() => {
		let list = [...results];
		if (filterStatus === 'passed') list = list.filter((r) => r.passed);
		if (filterStatus === 'failed') list = list.filter((r) => !r.passed);
		list.sort((a, b) => {
			const dateA = new Date(a.completed_at || 0).getTime();
			const dateB = new Date(b.completed_at || 0).getTime();
			return sortBy === 'recent' ? dateB - dateA : dateA - dateB;
		});
		return list;
	}, [results, filterStatus, sortBy]);

	const fetchResults = async () => {
		try {
			setLoading(true);
			const data = await examResultsService.getAll();
			setResults(data);
		} catch (err) {
			handleApiError(err, 'fetchExamResults');
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
			handleApiError(err, 'fetchResultDetails');
			// Fallback to basic result if detail fetch fails
			setSelectedResult(result);
		} finally {
			setLoadingDetails(false);
		}
	};

	const getUserAnswer = (question) => {
		// Check if question already has user_answer from backend
		if (question.user_answer_index !== undefined) {
			return question.user_answer_index;
		}
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

	const normalizeAnswerIndex = (value) => {
		if (value === null || value === undefined || value === '') return null;
		const parsed = Number(value);
		return Number.isNaN(parsed) ? null : parsed;
	};

	const isCorrectAnswer = (question) => {
		// Check if backend already calculated this
		if (question.is_correct !== undefined) {
			return question.is_correct;
		}
		// Fallback to old calculation
		if (['open_text', 'short_answer', 'essay'].includes(getQuestionType(question))) {
			return null; // Răspuns deschis – notare manuală
		}
		
		const userAnswer = getUserAnswer(question);
		const normalizedUserAnswer = normalizeAnswerIndex(userAnswer);
		if (userAnswer === null) return false;
		
		const correctAnswerIndex = question.answers?.findIndex(a => a.is_correct) ?? -1;
		return normalizedUserAnswer !== null && normalizedUserAnswer === correctAnswerIndex;
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
			<div className="exam-results-page-header">
				<h1 className="exam-results-page-title">
					Rezultate Teste
				</h1>
				<p className="exam-results-page-subtitle">
					Vezi toate testele completate și răspunsurile tale
				</p>
			</div>

			{error && (
				<div className="exam-results-error">
					{error}
				</div>
			)}

			<div className="exam-results-grid">
				{/* Results List */}
				<div>
					<div className="exam-results-toolbar">
						<h2 className="exam-results-section-title">Teste completate</h2>
						<div className="exam-results-filters">
							<select
								value={filterStatus}
								onChange={(e) => setFilterStatus(e.target.value)}
								className="exam-results-select"
								aria-label="Filtrează după status"
							>
								<option value="all">Toate</option>
								<option value="passed">Promovate</option>
								<option value="failed">Nepromovate</option>
							</select>
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
								className="exam-results-select"
								aria-label="Sortare"
							>
								<option value="recent">Cele mai recente</option>
								<option value="oldest">Cele mai vechi</option>
							</select>
						</div>
					</div>
					{filteredAndSortedResults.length > 0 ? (
						<div className="exam-results-list">
							{filteredAndSortedResults.map((result) => (
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
						<div className="exam-results-empty">
							<div className="exam-results-empty-icon">📝</div>
							<div className="exam-results-empty-title">
								{results.length === 0
									? 'Nu ai completat niciun test'
									: 'Niciun rezultat nu corespunde filtrelor'}
							</div>
							<div className="exam-results-empty-text">
								{results.length === 0
									? 'Completează teste pentru a vedea rezultatele aici'
									: 'Schimbă filtrele sau afișează toate rezultatele.'}
							</div>
						</div>
					)}
				</div>

				{/* Result Details */}
				{selectedResult && (
					<div className="exam-result-details">
						<div className="exam-result-details-header">
							<h2>Detalii Rezultat</h2>
							<button
								type="button"
								onClick={() => setSelectedResult(null)}
								className="lms-btn-secondary lms-btn-sm"
								disabled={loadingDetails}
							>
								Închide
							</button>
						</div>
						
						{loadingDetails && (
							<div className="exam-results-loading">
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
								<div className="exam-result-score-display-item exam-result-score-display-item-right">
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
								<h3 className="exam-result-questions-title">Răspunsurile Tale</h3>
								<div className="exam-result-questions">
									{selectedResult.exam.questions.map((question, index) => {
										const userAnswer = getUserAnswer(question);
										const normalizedUserAnswer = normalizeAnswerIndex(userAnswer);
										const isOpenText = ['open_text', 'short_answer', 'essay'].includes(getQuestionType(question));
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
														<div className="exam-result-answer-label-text">
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
														<div className="exam-result-answer-label-text">
															Răspunsurile tale:
														</div>
														<div className="exam-result-answers">
															{question.answers && question.answers.map((answer, answerIndex) => {
																const isSelected = answer.is_selected === true || normalizedUserAnswer === answerIndex;
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
																			<span className="exam-result-answer-icon">
																				{isCorrectAnswer ? '✓' : '✗'}
																			</span>
																		)}
																		{isCorrectAnswer && !isSelected && (
																			<span className="exam-result-answer-icon">✓</span>
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
															<div className="exam-result-answer correct exam-result-answer-correct-hint">
																<span className="exam-result-answer-icon">✓</span>
																<span className="exam-result-answer-correct-label">
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
							<div className="exam-results-empty">
								<div className="exam-results-empty-icon">📝</div>
								<div className="exam-results-empty-title">Nu sunt disponibile întrebări pentru acest rezultat.</div>
								<div className="exam-results-empty-text">
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

