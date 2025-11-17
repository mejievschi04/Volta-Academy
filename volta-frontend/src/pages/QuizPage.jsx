import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quizService } from '../services/api';

const QuizPage = () => {
	const { courseId } = useParams();
	const [quiz, setQuiz] = useState(null);
	const [answers, setAnswers] = useState({});
	const [submitted, setSubmitted] = useState(false);
	const [result, setResult] = useState(null);
	const [saved, setSaved] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
	const observerRef = useRef(null);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 1024);
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		const fetchQuiz = async () => {
			try {
				setLoading(true);
				const data = await quizService.getQuiz(courseId);
				setQuiz(data);
				
				if (data.hasResult && data.result) {
					setResult(data.result);
					setAnswers(data.result.answers || {});
					setSubmitted(true);
					setSaved(true);
				}
			} catch (err) {
				console.error('Error fetching quiz:', err);
				setError('Testul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchQuiz();
	}, [courseId]);

	// Track scroll position to update current question
	useEffect(() => {
		if (!quiz || !quiz.questions || saved) return;

		if (observerRef.current) {
			observerRef.current.disconnect();
		}

		const observerOptions = {
			root: null,
			rootMargin: '-20% 0px -60% 0px',
			threshold: 0
		};

		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const questionId = entry.target.id.replace('question-', '');
					const questionIndex = quiz.questions.findIndex(q => q.id === parseInt(questionId));
					if (questionIndex !== -1) {
						setCurrentQuestionIndex(questionIndex);
					}
				}
			});
		}, observerOptions);

		observerRef.current = observer;

		requestAnimationFrame(() => {
			quiz.questions.forEach(q => {
				const element = document.getElementById(`question-${q.id}`);
				if (element) observer.observe(element);
			});
		});

		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
				observerRef.current = null;
			}
		};
	}, [quiz, saved]);

	const handleSubmit = useCallback(async () => {
		try {
			const resultData = await quizService.submitQuiz(courseId, answers);
			setResult(resultData);
			setSubmitted(true);
		} catch (err) {
			console.error('Error submitting quiz:', err);
			setError('Eroare la trimiterea testului');
		}
	}, [courseId, answers]);

	const handleSave = useCallback(() => {
		setSaved(true);
	}, []);

	const handleAnswerChange = useCallback((questionId, answerIndex) => {
		setAnswers(prev => ({
			...prev,
			[questionId]: answerIndex
		}));
	}, []);

	const scrollToQuestion = useCallback((index) => {
		if (!quiz || !quiz.questions || index < 0 || index >= quiz.questions.length) return;
		setCurrentQuestionIndex(index);
		const questionElement = document.getElementById(`question-${quiz.questions[index].id}`);
		if (questionElement) {
			questionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, [quiz]);

	if (loading) {
		return (
			<div className="va-stack" style={{ padding: '2rem', textAlign: 'center' }}>
				<p className="va-muted">Se încarcă testul...</p>
			</div>
		);
	}

	if (error || !quiz) {
		return (
			<div className="va-stack" style={{ padding: '2rem' }}>
				<p style={{ color: 'var(--va-primary)' }}>{error || 'Testul nu a fost găsit'}</p>
				<Link to={`/courses/${courseId}`} className="va-btn va-btn-secondary">
					Înapoi la curs
				</Link>
			</div>
		);
	}

	return (
		<div style={{
			display: 'flex',
			gap: '2rem',
			maxWidth: '1600px',
			margin: '0 auto',
			padding: isMobile ? '1rem' : '2rem',
			flexDirection: isMobile ? 'column' : 'row'
		}}>
			{/* Question Navigation Sidebar */}
			{quiz && quiz.questions && quiz.questions.length > 0 && !saved && (
				<aside style={{
					width: sidebarOpen ? (isMobile ? '100%' : '280px') : '0',
					minWidth: sidebarOpen ? (isMobile ? '100%' : '280px') : '0',
					background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
					border: '1px solid rgba(255,238,0,0.25)',
					borderRadius: '20px',
					padding: sidebarOpen ? (isMobile ? '1rem' : '1.5rem') : '0',
					height: isMobile ? 'auto' : 'fit-content',
					position: isMobile ? 'relative' : 'sticky',
					top: isMobile ? 'auto' : '2rem',
					maxHeight: isMobile ? 'none' : 'calc(100vh - 4rem)',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					transition: 'all 0.3s ease',
					boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
					opacity: sidebarOpen ? 1 : 0,
					pointerEvents: sidebarOpen ? 'auto' : 'none',
					order: isMobile ? -1 : 0
				}}>
					{sidebarOpen && (
						<>
							<div style={{ marginBottom: '1.5rem' }}>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
									<h3 style={{
										color: 'var(--va-text)',
										fontSize: '1.1rem',
										fontWeight: 700,
										margin: 0,
										display: 'flex',
										alignItems: 'center',
										gap: '0.5rem'
									}}>
										<span>📝</span>
										<span>Întrebări</span>
									</h3>
									<button
										onClick={() => setSidebarOpen(false)}
										style={{
											background: 'rgba(255,255,255,0.05)',
											border: '1px solid rgba(255,238,0,0.2)',
											borderRadius: '8px',
											padding: '0.5rem',
											cursor: 'pointer',
											color: 'var(--va-text)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											transition: 'all 0.2s ease'
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = 'rgba(255,238,0,0.1)';
											e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
											e.currentTarget.style.borderColor = 'rgba(255,238,0,0.2)';
										}}
									>
										<span>←</span>
									</button>
								</div>
								<div style={{
									color: 'var(--va-muted)',
									fontSize: '0.85rem',
									fontWeight: 600
								}}>
									{Object.keys(answers).length} / {quiz.questions.length} răspunsuri
								</div>
							</div>
							<div style={{
								flex: 1,
								overflowY: 'auto',
								paddingRight: '0.5rem',
								marginRight: '-0.5rem'
							}}>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
									{quiz.questions.map((q, index) => {
										const isAnswered = answers[q.id] !== undefined;
										const isCurrent = index === currentQuestionIndex;
										
										return (
											<button
												key={q.id}
												type="button"
												onClick={() => scrollToQuestion(index)}
												style={{
													width: '40px',
													height: '40px',
													borderRadius: '10px',
													background: isCurrent
														? 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))'
														: isAnswered
															? 'linear-gradient(135deg, rgba(255,238,0,0.15), rgba(255,238,0,0.1))'
															: 'rgba(255,255,255,0.05)',
													border: `2px solid ${isCurrent ? 'rgba(255,238,0,0.5)' : isAnswered ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.15)'}`,
													color: isCurrent ? 'var(--va-primary)' : isAnswered ? 'var(--va-primary)' : 'var(--va-text)',
													fontSize: '0.9rem',
													fontWeight: 700,
													cursor: 'pointer',
													transition: 'all 0.2s ease',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													position: 'relative'
												}}
												onMouseEnter={(e) => {
													if (!isCurrent) {
														e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))';
														e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
														e.currentTarget.style.transform = 'scale(1.1)';
													}
												}}
												onMouseLeave={(e) => {
													if (!isCurrent) {
														e.currentTarget.style.background = isAnswered
															? 'linear-gradient(135deg, rgba(255,238,0,0.15), rgba(255,238,0,0.1))'
															: 'rgba(255,255,255,0.05)';
														e.currentTarget.style.borderColor = isAnswered ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.15)';
														e.currentTarget.style.transform = 'scale(1)';
													}
												}}
											>
												{isAnswered ? '✓' : index + 1}
												{isCurrent && (
													<div style={{
														position: 'absolute',
														bottom: '-2px',
														left: '50%',
														transform: 'translateX(-50%)',
														width: '6px',
														height: '6px',
														borderRadius: '50%',
														background: 'var(--va-primary)',
														boxShadow: '0 0 8px rgba(255,238,0,0.6)'
													}} />
												)}
											</button>
										);
									})}
								</div>
							</div>
						</>
					)}
				</aside>
			)}
			
			{/* Sidebar Toggle Button (when closed) */}
			{!sidebarOpen && quiz && quiz.questions && quiz.questions.length > 0 && !saved && (
				<button
					onClick={() => setSidebarOpen(true)}
					style={{
						position: 'fixed',
						left: '1rem',
						top: '50%',
						transform: 'translateY(-50%)',
						background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
						border: '1px solid rgba(255,238,0,0.3)',
						borderRadius: '12px',
						padding: '1rem',
						cursor: 'pointer',
						color: 'var(--va-primary)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 100,
						boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
						transition: 'all 0.2s ease'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.15), rgba(255,238,0,0.1))';
						e.currentTarget.style.borderColor = 'rgba(255,238,0,0.5)';
						e.currentTarget.style.transform = 'translateY(-50%) translateX(4px)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))';
						e.currentTarget.style.borderColor = 'rgba(255,238,0,0.3)';
						e.currentTarget.style.transform = 'translateY(-50%) translateX(0)';
					}}
				>
					<span style={{ fontSize: '1.2rem' }}>→</span>
				</button>
			)}

			{/* Main Content */}
			<div className="va-stack" style={{ flex: 1, maxWidth: sidebarOpen && !saved && !isMobile ? 'calc(100% - 320px)' : '100%', minWidth: 0 }}>
				{/* Breadcrumb */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
					<Link 
						to="/courses"
						style={{
							color: 'var(--va-muted)',
							textDecoration: 'none',
							fontSize: '0.95rem',
							transition: 'color 0.2s ease'
						}}
						onMouseEnter={(e) => e.currentTarget.style.color = 'var(--va-primary)'}
						onMouseLeave={(e) => e.currentTarget.style.color = 'var(--va-muted)'}
					>
						Cursuri
					</Link>
					<span style={{ color: 'var(--va-muted)', fontSize: '1.2rem' }}>/</span>
					<Link 
						to={`/courses/${courseId}`}
						style={{
							color: 'var(--va-muted)',
							textDecoration: 'none',
							fontSize: '0.95rem',
							transition: 'color 0.2s ease'
						}}
						onMouseEnter={(e) => e.currentTarget.style.color = 'var(--va-primary)'}
						onMouseLeave={(e) => e.currentTarget.style.color = 'var(--va-muted)'}
					>
						Curs
					</Link>
					<span style={{ color: 'var(--va-muted)', fontSize: '1.2rem' }}>/</span>
					<span style={{ color: 'var(--va-primary)', fontWeight: 600 }}>
						Test final
					</span>
				</div>

				{/* Quiz Header */}
				<div style={{
					background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
					border: '1px solid rgba(255,238,0,0.3)',
					borderRadius: '24px',
					padding: '2.5rem',
					marginBottom: '2.5rem',
					boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset',
					position: 'relative',
					overflow: 'hidden'
				}}>
					<div style={{
						position: 'absolute',
						top: '-30%',
						right: '-10%',
						width: '300px',
						height: '300px',
						background: 'radial-gradient(circle, rgba(255,238,0,0.12), transparent)',
						pointerEvents: 'none'
					}} />
					
					<div style={{ position: 'relative', zIndex: 1 }}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
							<h1 className="va-page-title" style={{
								margin: 0,
								background: 'linear-gradient(135deg, #fff, #ffee00)',
								WebkitBackgroundClip: 'text',
								WebkitTextFillColor: 'transparent',
								fontSize: '2.25rem',
								letterSpacing: '-0.02em',
								lineHeight: 1.2
							}}>
								{quiz.title || 'Test final'}
							</h1>
							{saved && result && (
								<div style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '0.75rem',
									padding: '0.75rem 1.5rem',
									background: 'linear-gradient(135deg, rgba(255,238,0,0.15), rgba(255,238,0,0.1))',
									border: '1px solid rgba(255,238,0,0.35)',
									borderRadius: '16px',
									color: 'var(--va-primary)',
									fontSize: '0.95rem',
									fontWeight: 700,
									boxShadow: '0 4px 16px rgba(255,238,0,0.15)'
								}}>
									<div style={{
										width: '28px',
										height: '28px',
										borderRadius: '8px',
										background: 'linear-gradient(135deg, #ffee00, #ffd700)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										color: '#000',
										fontWeight: 700
									}}>
										✓
									</div>
									<span>Test completat</span>
								</div>
							)}
						</div>

						{/* Pre-Quiz Overview */}
						{!submitted && !saved && quiz.questions && (
							<div style={{
								background: 'rgba(255,255,255,0.05)',
								border: '1px solid rgba(255,238,0,0.2)',
								borderRadius: '16px',
								padding: '1.5rem',
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
								gap: '1.5rem'
							}}>
								<div>
									<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
										Întrebări
									</div>
									<div style={{ color: 'var(--va-primary)', fontSize: '1.5rem', fontWeight: 700 }}>
										{quiz.questions.length}
									</div>
								</div>
								{quiz.duration_minutes && (
									<div>
										<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
											Durată estimată
										</div>
										<div style={{ color: 'var(--va-text)', fontSize: '1.5rem', fontWeight: 700 }}>
											{quiz.duration_minutes} min
										</div>
									</div>
								)}
								<div>
									<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
										Puncte disponibile
									</div>
									<div style={{ color: 'var(--va-text)', fontSize: '1.5rem', fontWeight: 700 }}>
										{quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0)}
									</div>
								</div>
								{quiz.passing_score && (
									<div>
										<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
											Punctaj minim
										</div>
										<div style={{ color: 'var(--va-primary)', fontSize: '1.5rem', fontWeight: 700 }}>
											{quiz.passing_score}%
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				<div className="va-card" style={{
					background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
					border: '1px solid rgba(255,238,0,0.25)',
					borderRadius: '24px',
					boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset',
					overflow: 'hidden'
				}}>
					<div className="va-card-body va-stack" style={{ padding: '2.5rem' }}>
						{quiz.questions && quiz.questions.length > 0 ? (
							quiz.questions.map((q, idx) => {
								const isCorrect = answers[q.id] === q.answerIndex;
								const showResult = (submitted || saved) && result;
								
								return (
									<div 
										id={`question-${q.id}`}
										key={q.id}
										style={{
											padding: '2rem',
											background: showResult 
												? (isCorrect 
													? 'linear-gradient(135deg, rgba(255,238,0,0.08), rgba(255,238,0,0.05))' 
													: 'linear-gradient(135deg, rgba(255,107,107,0.08), rgba(255,107,107,0.05))')
												: 'rgba(255,255,255,0.02)',
											border: `1px solid ${showResult 
												? (isCorrect ? 'rgba(255,238,0,0.3)' : 'rgba(255,107,107,0.3)')
												: 'rgba(255,238,0,0.18)'}`,
											borderRadius: '20px',
											marginBottom: '2rem',
											transition: 'all 0.3s ease',
											position: 'relative',
											overflow: 'hidden'
										}}>
										{showResult && (
											<div style={{
												position: 'absolute',
												left: 0,
												top: 0,
												bottom: 0,
												width: '4px',
												background: isCorrect 
													? 'linear-gradient(180deg, #ffee00, #ffd700)' 
													: 'linear-gradient(180deg, #ff6b6b, #ff5252)',
												borderRadius: '0 4px 4px 0'
											}} />
										)}
										
										<div style={{
											display: 'flex',
											alignItems: 'flex-start',
											gap: '1.25rem',
											marginBottom: '1.5rem',
											position: 'relative',
											zIndex: 1
										}}>
											<div style={{
												width: '44px',
												height: '44px',
												borderRadius: '12px',
												background: showResult 
													? (isCorrect 
														? 'linear-gradient(135deg, #ffee00, #ffd700)' 
														: 'linear-gradient(135deg, #ff6b6b, #ff5252)')
													: 'rgba(255,238,0,0.12)',
												border: showResult ? 'none' : '1px solid rgba(255,238,0,0.3)',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												fontWeight: 700,
												color: showResult 
													? (isCorrect ? '#000' : '#fff')
													: 'var(--va-text)',
												flexShrink: 0,
												fontSize: '1.1rem',
												boxShadow: showResult 
													? (isCorrect 
														? '0 4px 12px rgba(255,238,0,0.3)' 
														: '0 4px 12px rgba(255,107,107,0.3)')
													: 'none'
											}}>
												{showResult ? (isCorrect ? '✓' : '✗') : idx + 1}
											</div>
											<div style={{ flex: 1 }}>
												<div style={{
													fontSize: '1.2rem',
													fontWeight: 700,
													color: showResult 
														? (isCorrect ? 'var(--va-primary)' : '#ff6b6b')
														: 'var(--va-text)',
													marginBottom: '0.75rem',
													lineHeight: 1.5,
													letterSpacing: '-0.01em'
												}}>
													{q.text}
												</div>
												{!submitted && !saved && (
													<div style={{
														color: 'var(--va-muted)',
														fontSize: '0.85rem',
														fontWeight: 600
													}}>
														Întrebarea {idx + 1} din {quiz.questions.length}
													</div>
												)}
											</div>
										</div>
										<div style={{ display: 'grid', gap: '1rem', marginBottom: showResult ? '1.5rem' : '0', position: 'relative', zIndex: 1 }}>
											{q.options && q.options.map((opt, i) => {
												const isSelected = answers[q.id] === i;
												const isCorrectOption = i === q.answerIndex;
												
												return (
													<label key={i} style={{
														display: 'flex',
														alignItems: 'center',
														gap: '1rem',
														padding: '1.25rem 1.5rem',
														background: showResult 
															? (isCorrectOption 
																? 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))' 
																: isSelected 
																	? 'linear-gradient(135deg, rgba(255,107,107,0.12), rgba(255,107,107,0.08))' 
																	: 'rgba(255,255,255,0.03)')
															: (isSelected 
																? 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))' 
																: 'rgba(255,255,255,0.03)'),
														border: `1px solid ${showResult 
															? (isCorrectOption 
																? 'rgba(255,238,0,0.35)' 
																: isSelected 
																	? 'rgba(255,107,107,0.35)' 
																	: 'rgba(255,238,0,0.18)')
															: (isSelected ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.18)')}`,
														borderRadius: '16px',
														cursor: (submitted || saved) ? 'default' : 'pointer',
														transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
														position: 'relative',
														overflow: 'hidden'
													}}
													onMouseEnter={(e) => {
														if (!submitted && !saved) {
															e.currentTarget.style.background = isSelected 
																? 'linear-gradient(135deg, rgba(255,238,0,0.18), rgba(255,238,0,0.12))' 
																: 'rgba(255,255,255,0.06)';
															e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
															e.currentTarget.style.transform = 'translateX(4px)';
														}
													}}
													onMouseLeave={(e) => {
														if (!submitted && !saved) {
															e.currentTarget.style.background = isSelected 
																? 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))' 
																: 'rgba(255,255,255,0.03)';
															e.currentTarget.style.borderColor = isSelected ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.18)';
															e.currentTarget.style.transform = 'translateX(0)';
														}
													}}
													>
														{showResult && isCorrectOption && (
															<div style={{
																position: 'absolute',
																left: 0,
																top: 0,
																bottom: 0,
																width: '4px',
																background: 'linear-gradient(180deg, #ffee00, #ffd700)',
																borderRadius: '0 4px 4px 0'
															}} />
														)}
														{showResult && isSelected && !isCorrectOption && (
															<div style={{
																position: 'absolute',
																left: 0,
																top: 0,
																bottom: 0,
																width: '4px',
																background: 'linear-gradient(180deg, #ff6b6b, #ff5252)',
																borderRadius: '0 4px 4px 0'
															}} />
														)}
														<input
															type="radio"
															name={q.id}
															checked={isSelected}
															onChange={() => {
																if (!submitted && !saved) {
																	handleAnswerChange(q.id, i);
																}
															}}
															disabled={submitted || saved}
															style={{ margin: 0 }}
														/>
														<span style={{
															flex: 1,
															color: showResult 
																? (isCorrectOption ? 'var(--va-primary)' : isSelected ? '#ff6b6b' : 'var(--va-text)')
																: 'var(--va-text)',
															fontWeight: isSelected ? 500 : 400
														}}>
															{opt}
														</span>
														{showResult && isCorrectOption && (
															<span style={{ color: 'var(--va-primary)', fontSize: '1.2rem' }}>✓</span>
														)}
														{showResult && isSelected && !isCorrectOption && (
															<span style={{ color: '#ff6b6b', fontSize: '1.2rem' }}>✗</span>
														)}
													</label>
												);
											})}
										</div>
										{showResult && (
											<div style={{
												padding: '1rem 1.25rem',
												background: isCorrect ? 'rgba(255,238,0,0.1)' : 'rgba(255,107,107,0.1)',
												border: `1px solid ${isCorrect ? 'rgba(255,238,0,0.3)' : 'rgba(255,107,107,0.3)'}`,
												borderRadius: '12px',
												marginTop: '1rem'
											}}>
												<div style={{
													display: 'flex',
													alignItems: 'center',
													gap: '0.75rem',
													marginBottom: '0.5rem'
												}}>
													<span style={{ fontSize: '1.2rem' }}>
														{isCorrect ? '✓' : '✗'}
													</span>
													<span style={{
														color: isCorrect ? 'var(--va-primary)' : '#ff6b6b',
														fontWeight: 700,
														fontSize: '1rem'
													}}>
														{isCorrect ? 'Răspuns corect' : 'Răspuns incorect'}
													</span>
												</div>
												{q.explanation && (
													<div style={{
														color: 'var(--va-text)',
														fontSize: '0.9rem',
														lineHeight: 1.6,
														marginTop: '0.5rem',
														paddingTop: '0.5rem',
														borderTop: `1px solid ${isCorrect ? 'rgba(255,238,0,0.2)' : 'rgba(255,107,107,0.2)'}`
													}}>
														<strong>Explicație:</strong> {q.explanation}
													</div>
												)}
											</div>
										)}
									</div>
								);
							})
						) : (
							<p style={{ color: 'var(--va-muted)', textAlign: 'center', padding: '2rem' }}>
								Nu există întrebări disponibile pentru acest test.
							</p>
						)}
					</div>
				</div>

				<div style={{ marginTop: '2rem' }}>
					{!submitted && !saved ? (
						<div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-start' }}>
							<button 
								className="va-btn va-btn-primary" 
								onClick={handleSubmit}
								style={{
									padding: '0.875rem 2rem',
									fontSize: '1rem',
									fontWeight: 600
								}}
							>
								Trimite testul
							</button>
							<Link 
								to={`/courses/${courseId}`}
								className="va-btn va-btn-link"
								style={{ padding: '0.875rem 1.5rem' }}
							>
								Înapoi la curs
							</Link>
						</div>
					) : (
						<div>
							<div style={{
								background: result?.passed ? 'rgba(255,238,0,0.1)' : 'rgba(255,107,107,0.1)',
								border: `1px solid ${result?.passed ? 'rgba(255,238,0,0.3)' : 'rgba(255,107,107,0.3)'}`,
								borderRadius: '16px',
								padding: '2rem',
								marginBottom: '1.5rem',
								textAlign: 'center'
							}}>
								<div style={{
									fontSize: '2rem',
									fontWeight: 700,
									color: result?.passed ? 'var(--va-primary)' : '#ff6b6b',
									marginBottom: '1rem'
								}}>
									{result?.passed ? '✓ Promovat' : '✗ Nepromovat'}
								</div>
								<div style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
									gap: '1rem',
									marginBottom: '1rem'
								}}>
									<div>
										<div style={{ color: 'var(--va-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
											Scor
										</div>
										<div style={{ color: 'var(--va-text)', fontSize: '1.5rem', fontWeight: 700 }}>
											<strong>{result?.score || 0}</strong> / <strong>{result?.total || quiz.questions?.length || 0}</strong>
										</div>
									</div>
									<div>
										<div style={{ color: 'var(--va-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
											Procentaj
										</div>
										<div style={{ color: 'var(--va-text)', fontSize: '1.5rem', fontWeight: 700 }}>
											<strong>{result?.percentage || 0}%</strong>
										</div>
									</div>
								</div>
								{saved && result?.completed_at && (
									<div style={{
										color: 'var(--va-muted)',
										fontSize: '0.9rem',
										paddingTop: '1rem',
										borderTop: '1px solid rgba(255,238,0,0.2)'
									}}>
										Completat la: {new Date(result.completed_at).toLocaleString('ro-RO')}
									</div>
								)}
							</div>
							{!saved && submitted && (
								<button 
									className="va-btn va-btn-primary" 
									onClick={handleSave}
									style={{
										marginBottom: '1rem',
										padding: '0.875rem 2rem',
										fontSize: '1rem',
										fontWeight: 600,
										width: '100%'
									}}
								>
									Salvează rezultat
								</button>
							)}
							{saved && (
								<div style={{
									background: 'rgba(255,238,0,0.1)',
									border: '1px solid rgba(255,238,0,0.3)',
									borderRadius: '12px',
									padding: '1rem',
									marginBottom: '1rem',
									color: 'var(--va-primary)',
									fontWeight: 600,
									textAlign: 'center',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '0.5rem'
								}}>
									<span style={{ fontSize: '1.2rem' }}>✓</span>
									<span>Rezultat salvat</span>
								</div>
							)}
							<div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
								<Link 
									to={`/courses/${courseId}`}
									className="va-btn va-btn-secondary"
									style={{ padding: '0.875rem 1.5rem' }}
								>
									Înapoi la curs
								</Link>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default QuizPage;

