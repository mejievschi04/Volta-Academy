import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { examResultsService } from '../services/api';

const ExamResultsPage = () => {
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedResult, setSelectedResult] = useState(null);

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

	const handleSelectResult = (result) => {
		setSelectedResult(result);
	};

	const getUserAnswer = (questionId) => {
		if (!selectedResult || !selectedResult.answers) return null;
		return selectedResult.answers[questionId];
	};

	const getQuestionType = (question) => {
		return question.question_type || 'multiple_choice';
	};

	const isCorrectAnswer = (question, userAnswer) => {
		if (getQuestionType(question) === 'open_text') {
			return null; // Open text questions need manual review
		}
		
		const correctAnswerIndex = question.answers.findIndex(a => a.is_correct);
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
		<div className="va-main fade-in">
			<div className="fade-in-up" style={{ marginBottom: '2.5rem' }}>
				<h1 className="va-page-title gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>
					Rezultate Teste
				</h1>
				<p className="va-muted" style={{ fontSize: '1.1rem' }}>
					Vezi toate testele completate și răspunsurile tale
				</p>
			</div>

			{error && (
				<div style={{
					padding: '1rem',
					background: 'rgba(255, 0, 0, 0.1)',
					border: '1px solid rgba(255, 0, 0, 0.3)',
					borderRadius: '8px',
					marginBottom: '1.5rem',
					color: '#ff4444'
				}}>
					{error}
				</div>
			)}

			<div style={{ display: 'grid', gridTemplateColumns: selectedResult ? '1fr 2fr' : '1fr', gap: '2rem' }}>
				{/* Results List */}
				<div className="va-card-enhanced" style={{ padding: '1.5rem' }}>
					<h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Teste Completate</h2>
					{results.length > 0 ? (
						<div className="va-stack" style={{ gap: '1rem' }}>
							{results.map((result) => (
								<button
									key={result.id}
									type="button"
									onClick={() => handleSelectResult(result)}
									style={{
										width: '100%',
										padding: '1rem',
										background: selectedResult?.id === result.id ? 'rgba(255, 238, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)',
										border: selectedResult?.id === result.id ? '2px solid #ffee00' : '1px solid rgba(255, 238, 0, 0.2)',
										borderRadius: '12px',
										textAlign: 'left',
										cursor: 'pointer',
										transition: 'all 0.2s',
									}}
									onMouseEnter={(e) => {
										if (selectedResult?.id !== result.id) {
											e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
										}
									}}
									onMouseLeave={(e) => {
										if (selectedResult?.id !== result.id) {
											e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
										}
									}}
								>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
										<div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
											{result.exam?.title || 'Test'}
										</div>
										<div style={{
											padding: '0.25rem 0.75rem',
											borderRadius: '12px',
											fontSize: '0.75rem',
											fontWeight: 700,
											background: result.passed 
												? 'rgba(76, 175, 80, 0.2)' 
												: 'rgba(255, 107, 107, 0.2)',
											color: result.passed ? '#4CAF50' : '#ff6b6b',
											border: `1px solid ${result.passed ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 107, 107, 0.3)'}`,
										}}>
											{result.passed ? '✓ Promovat' : '✗ Ne promovat'}
										</div>
									</div>
									<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
										📚 {result.exam?.course?.title || 'Curs'}
									</div>
									<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
										🕐 {new Date(result.completed_at).toLocaleString('ro-RO')}
									</div>
									<div style={{ 
										display: 'flex', 
										justifyContent: 'space-between', 
										alignItems: 'center',
										marginTop: '0.75rem',
										paddingTop: '0.75rem',
										borderTop: '1px solid rgba(255, 238, 0, 0.1)',
									}}>
										<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
											Scor:
										</div>
										<div style={{ 
											fontSize: '1.1rem', 
											fontWeight: 700,
											color: '#ffee00',
										}}>
											{result.score} / {result.total_points} ({result.percentage}%)
										</div>
									</div>
									{result.needs_manual_review && !result.reviewed_at && (
										<div style={{
											marginTop: '0.5rem',
											padding: '0.5rem',
											background: 'rgba(255, 238, 0, 0.1)',
											borderRadius: '6px',
											fontSize: '0.75rem',
											color: '#ffee00',
											textAlign: 'center',
										}}>
											⏳ În așteptarea verificării
										</div>
									)}
								</button>
							))}
						</div>
					) : (
						<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--va-muted)' }}>
							<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
							<div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Nu ai completat niciun test</div>
							<div style={{ fontSize: '0.9rem' }}>Completează teste pentru a vedea rezultatele aici</div>
						</div>
					)}
				</div>

				{/* Result Details */}
				{selectedResult && (
					<div className="va-card-enhanced" style={{ padding: '1.5rem' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
							<h2 style={{ margin: 0, fontSize: '1.5rem' }}>Detalii Rezultat</h2>
							<button
								type="button"
								onClick={() => setSelectedResult(null)}
								className="va-btn va-btn-sm"
							>
								Închide
							</button>
						</div>

						{/* Summary */}
						<div style={{ 
							marginBottom: '2rem', 
							padding: '1.5rem', 
							background: 'rgba(0, 0, 0, 0.3)', 
							borderRadius: '12px',
							border: '1px solid rgba(255, 238, 0, 0.2)',
						}}>
							<div style={{ marginBottom: '1rem' }}>
								<strong>Test:</strong> {selectedResult.exam?.title}
							</div>
							<div style={{ marginBottom: '1rem' }}>
								<strong>Curs:</strong> {selectedResult.exam?.course?.title}
							</div>
							<div style={{ marginBottom: '1rem' }}>
								<strong>Data completării:</strong> {new Date(selectedResult.completed_at).toLocaleString('ro-RO')}
							</div>
							<div style={{ marginBottom: '1rem' }}>
								<strong>Încercare:</strong> #{selectedResult.attempt_number || 1}
							</div>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								padding: '1rem',
								background: 'rgba(255, 238, 0, 0.1)',
								borderRadius: '8px',
								border: '1px solid rgba(255, 238, 0, 0.3)',
							}}>
								<div>
									<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>
										Scor Final
									</div>
									<div style={{ fontSize: '2rem', fontWeight: 700, color: '#ffee00' }}>
										{selectedResult.score} / {selectedResult.total_points}
									</div>
								</div>
								<div style={{ textAlign: 'right' }}>
									<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.25rem' }}>
										Procentaj
									</div>
									<div style={{ fontSize: '2rem', fontWeight: 700, color: selectedResult.passed ? '#4CAF50' : '#ff6b6b' }}>
										{selectedResult.percentage}%
									</div>
								</div>
							</div>
							<div style={{ marginTop: '1rem', textAlign: 'center' }}>
								<div style={{
									display: 'inline-block',
									padding: '0.5rem 1.5rem',
									borderRadius: '20px',
									fontWeight: 700,
									background: selectedResult.passed 
										? 'rgba(76, 175, 80, 0.2)' 
										: 'rgba(255, 107, 107, 0.2)',
									color: selectedResult.passed ? '#4CAF50' : '#ff6b6b',
									border: `2px solid ${selectedResult.passed ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255, 107, 107, 0.5)'}`,
								}}>
									{selectedResult.passed ? '✓ TEST PROMOVAT' : '✗ TEST NE PROMOVAT'}
								</div>
							</div>
						</div>

						{/* Questions and Answers */}
						{selectedResult.exam?.questions && selectedResult.exam.questions.length > 0 && (
							<div>
								<h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Răspunsurile Tale</h3>
								<div className="va-stack" style={{ gap: '1.5rem' }}>
									{selectedResult.exam.questions.map((question, index) => {
										const userAnswer = getUserAnswer(question.id);
										const isOpenText = getQuestionType(question) === 'open_text';
										const isCorrect = !isOpenText ? isCorrectAnswer(question, userAnswer) : null;
										const manualScore = getManualReviewScore(question.id);
										const maxPoints = question.points || 1;

										return (
											<div
												key={question.id}
												style={{
													padding: '1.5rem',
													background: 'rgba(0, 0, 0, 0.3)',
													border: `1px solid ${isCorrect === true ? 'rgba(76, 175, 80, 0.3)' : isCorrect === false ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 238, 0, 0.2)'}`,
													borderRadius: '12px',
												}}
											>
												<div style={{ marginBottom: '1rem' }}>
													<div style={{ 
														display: 'flex', 
														justifyContent: 'space-between', 
														alignItems: 'flex-start',
														marginBottom: '0.75rem',
													}}>
														<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
															Întrebare {index + 1} ({maxPoints} puncte)
														</div>
														{isCorrect !== null && (
															<div style={{
																padding: '0.25rem 0.75rem',
																borderRadius: '8px',
																fontSize: '0.75rem',
																fontWeight: 700,
																background: isCorrect 
																	? 'rgba(76, 175, 80, 0.2)' 
																	: 'rgba(255, 107, 107, 0.2)',
																color: isCorrect ? '#4CAF50' : '#ff6b6b',
															}}>
																{isCorrect ? '✓ Corect' : '✗ Incorect'}
															</div>
														)}
														{isOpenText && manualScore !== null && (
															<div style={{
																padding: '0.25rem 0.75rem',
																borderRadius: '8px',
																fontSize: '0.75rem',
																fontWeight: 700,
																background: 'rgba(255, 238, 0, 0.2)',
																color: '#ffee00',
															}}>
																{manualScore} / {maxPoints} puncte
															</div>
														)}
													</div>
													<div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
														{question.question_text}
													</div>
												</div>

												{isOpenText ? (
													<div>
														<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
															Răspunsul tău:
														</div>
														<div style={{
															padding: '1rem',
															background: 'rgba(0, 0, 0, 0.5)',
															borderRadius: '8px',
															border: '1px solid rgba(255, 238, 0, 0.1)',
															minHeight: '80px',
															whiteSpace: 'pre-wrap',
															wordWrap: 'break-word',
															marginBottom: '0.5rem',
														}}>
															{userAnswer || <em style={{ color: 'var(--va-muted)' }}>Fără răspuns</em>}
														</div>
														{manualScore !== null ? (
															<div style={{
																padding: '0.75rem',
																background: 'rgba(255, 238, 0, 0.1)',
																borderRadius: '8px',
																fontSize: '0.9rem',
																color: '#ffee00',
															}}>
																✓ Evaluat manual: {manualScore} / {maxPoints} puncte
															</div>
														) : (
															<div style={{
																padding: '0.75rem',
																background: 'rgba(255, 238, 0, 0.1)',
																borderRadius: '8px',
																fontSize: '0.9rem',
																color: '#ffee00',
															}}>
																⏳ În așteptarea evaluării manuale
															</div>
														)}
													</div>
												) : (
													<div>
														<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.75rem' }}>
															Răspunsurile tale:
														</div>
														<div className="va-stack" style={{ gap: '0.5rem' }}>
															{question.answers.map((answer, answerIndex) => {
																const isSelected = userAnswer === answerIndex;
																const isCorrectAnswer = answer.is_correct;

																return (
																	<div
																		key={answerIndex}
																		style={{
																			padding: '0.75rem 1rem',
																			borderRadius: '8px',
																			background: isSelected 
																				? (isCorrectAnswer ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.2)')
																				: (isCorrectAnswer ? 'rgba(76, 175, 80, 0.1)' : 'rgba(0, 0, 0, 0.3)'),
																			border: `1px solid ${
																				isSelected 
																					? (isCorrectAnswer ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255, 107, 107, 0.5)')
																					: (isCorrectAnswer ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 238, 0, 0.2)')
																			}`,
																			display: 'flex',
																			alignItems: 'center',
																			gap: '0.75rem',
																		}}
																	>
																		{isSelected && (
																			<span style={{ fontSize: '1.2rem' }}>
																				{isCorrectAnswer ? '✓' : '✗'}
																			</span>
																		)}
																		{isCorrectAnswer && !isSelected && (
																			<span style={{ fontSize: '1.2rem', color: '#4CAF50' }}>✓</span>
																		)}
																		<span style={{ 
																			flex: 1,
																			color: isSelected 
																				? (isCorrectAnswer ? '#4CAF50' : '#ff6b6b')
																				: (isCorrectAnswer ? '#4CAF50' : 'var(--va-text)'),
																			fontWeight: isSelected || isCorrectAnswer ? 600 : 400,
																		}}>
																			{answer.answer_text}
																		</span>
																		{isCorrectAnswer && (
																			<span style={{ 
																				fontSize: '0.75rem', 
																				color: '#4CAF50',
																				fontWeight: 700,
																			}}>
																				Răspuns corect
																			</span>
																		)}
																	</div>
																);
															})}
														</div>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default ExamResultsPage;

