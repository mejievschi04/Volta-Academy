import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { coursesService, dashboardService, quizService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const CourseDetailPage = () => {
	const { courseId } = useParams();
	const { user } = useAuth();
	const navigate = useNavigate();
	const [course, setCourse] = useState(null);
	const [progress, setProgress] = useState(null);
	const [quiz, setQuiz] = useState(null);
	const [quizResult, setQuizResult] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [expandedSections, setExpandedSections] = useState({});

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const [courseData, progressData] = await Promise.all([
					coursesService.getById(courseId),
					user ? dashboardService.getProgress(courseId, user.id).catch(() => null) : null
				]);
				setCourse(courseData);
				setProgress(progressData);
				
				// Try to load quiz/exam for the course
				try {
					const quizData = await quizService.getQuiz(courseId);
					setQuiz(quizData);
					if (quizData.hasResult && quizData.result) {
						setQuizResult(quizData.result);
					}
				} catch (err) {
					console.log('No quiz found for course:', courseId);
				}
			} catch (err) {
				console.error('Error fetching course:', err);
				setError('Cursul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [courseId, user]);

	// Initialize expanded sections
	useEffect(() => {
		if (course && course.lessons && course.lessons.length > 0 && Object.keys(expandedSections).length === 0) {
			// Expand first module by default
			setExpandedSections({ [course.lessons[0].id]: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [course?.lessons?.length]);

	const toggleModule = (moduleId) => {
		setExpandedSections(prev => ({
			...prev,
			[moduleId]: !prev[moduleId]
		}));
	};

	if (loading) {
		return (
			<div className="va-stack" style={{ padding: '2rem', textAlign: 'center' }}>
				<p className="va-muted">Se încarcă...</p>
			</div>
		);
	}

	if (error || !course) {
		return (
			<div className="va-stack" style={{ padding: '2rem' }}>
				<p style={{ color: 'var(--va-primary)' }}>{error || 'Cursul nu a fost găsit'}</p>
				<Link to="/courses" className="va-btn va-btn-secondary">Înapoi la cursuri</Link>
			</div>
		);
	}

	// Calculate progress
	const totalLessons = course.lessons?.length || 0;
	const completedLessons = progress?.completedLessons?.length || 0;
	const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

	return (
		<div className="va-stack" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
			{/* Breadcrumb */}
			<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
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
				<span style={{ color: 'var(--va-primary)', fontWeight: 600 }}>
					{course.title}
				</span>
			</div>

			{/* Course Header */}
			<div className="va-course-detail-header" style={{
				background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
				border: '1px solid rgba(255,238,0,0.3)',
				borderRadius: '24px',
				padding: '3rem',
				marginBottom: '2.5rem',
				boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset',
				position: 'relative',
				overflow: 'hidden'
			}}>
				<div style={{
					position: 'absolute',
					top: '-30%',
					right: '-10%',
					width: '400px',
					height: '400px',
					background: 'radial-gradient(circle, rgba(255,238,0,0.12), transparent)',
					pointerEvents: 'none'
				}} />
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2.5rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
					<div style={{ flex: 1, minWidth: '300px' }}>
						<h1 className="va-page-title" style={{
							marginBottom: '0.75rem',
							background: 'linear-gradient(135deg, #fff, #ffee00)',
							WebkitBackgroundClip: 'text',
							WebkitTextFillColor: 'transparent',
							fontSize: '2.5rem',
							letterSpacing: '-0.02em',
							lineHeight: 1.2
						}}>
							{course.title}
						</h1>
						<p className="va-muted" style={{ fontSize: '1.15rem', marginBottom: '2rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
							{course.description}
						</p>

						{/* Action Buttons */}
						<div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
							{progressPercentage > 0 ? (
								<Link
									to={`/courses/${courseId}/lessons/${course.lessons?.find(l => !progress?.completedLessons?.includes(l.id))?.id || course.lessons?.[0]?.id}`}
									className="va-btn"
									style={{
										background: 'linear-gradient(135deg, #ffee00, #ffd700)',
										color: '#000000',
										fontWeight: 600,
										padding: '0.875rem 1.75rem',
										borderRadius: '12px',
										textDecoration: 'none',
										display: 'inline-flex',
										alignItems: 'center',
										gap: '0.5rem',
										transition: 'all 0.3s ease'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.transform = 'translateY(-2px)';
										e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,238,0,0.3)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.transform = 'translateY(0)';
										e.currentTarget.style.boxShadow = 'none';
									}}
								>
									<span>Continuă</span>
									<span>→</span>
								</Link>
							) : (
								<Link
									to={`/courses/${courseId}/lessons/${course.lessons?.[0]?.id}`}
									className="va-btn"
									style={{
										background: 'linear-gradient(135deg, #ffee00, #ffd700)',
										color: '#000000',
										fontWeight: 600,
										padding: '0.875rem 1.75rem',
										borderRadius: '12px',
										textDecoration: 'none',
										display: 'inline-flex',
										alignItems: 'center',
										gap: '0.5rem',
										transition: 'all 0.3s ease'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.transform = 'translateY(-2px)';
										e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,238,0,0.3)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.transform = 'translateY(0)';
										e.currentTarget.style.boxShadow = 'none';
									}}
								>
									<span>Începe cursul</span>
									<span>→</span>
								</Link>
							)}
						</div>

						{/* Progress Bar */}
						{progress && (
							<div style={{ marginTop: '2rem' }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
									<span style={{ color: 'var(--va-text)', fontWeight: 600, fontSize: '0.95rem' }}>Progres curs</span>
									<span style={{
										color: 'var(--va-primary)',
										fontWeight: 700,
										fontSize: '1.25rem',
										display: 'inline-flex',
										alignItems: 'center',
										gap: '0.5rem'
									}}>
										{progressPercentage}%
									</span>
								</div>
								<div style={{
									width: '100%',
									height: '14px',
									background: 'rgba(255,255,255,0.08)',
									borderRadius: '12px',
									overflow: 'hidden',
									position: 'relative',
									boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
								}}>
									<div style={{
										width: `${progressPercentage}%`,
										height: '100%',
										background: 'linear-gradient(90deg, #ffee00, #ffd700)',
										borderRadius: '12px',
										transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
										boxShadow: '0 0 20px rgba(255,238,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
									}} />
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Modules List */}
			<div className="va-course-content">
				{course.lessons && course.lessons.length > 0 && (
					<div style={{
						background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
						border: '1px solid rgba(255,238,0,0.25)',
						borderRadius: '20px',
						padding: '2rem',
						marginBottom: '2rem',
						boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset'
					}}>
						<h2 style={{
							color: 'var(--va-text)',
							fontSize: '1.5rem',
							fontWeight: 700,
							margin: 0,
							marginBottom: '1.5rem',
							display: 'flex',
							alignItems: 'center',
							gap: '0.75rem'
						}}>
							<span>📚</span>
							<span>Module</span>
						</h2>
						<div style={{ display: 'grid', gap: '1rem' }}>
							{course.lessons.map((lesson, index) => {
								const isCompleted = progress?.completedLessons?.includes(lesson.id);
								const isExpanded = expandedSections[lesson.id];
								
								return (
									<div key={lesson.id} style={{
										background: isCompleted 
											? 'linear-gradient(135deg, rgba(255,238,0,0.08), rgba(255,238,0,0.05))' 
											: 'rgba(255,255,255,0.03)',
										border: `1px solid ${isCompleted ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.18)'}`,
										borderRadius: '16px',
										padding: '1.5rem',
										transition: 'all 0.3s ease'
									}}>
										<button
											type="button"
											onClick={() => toggleModule(lesson.id)}
											style={{
												width: '100%',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between',
												background: 'transparent',
												border: 'none',
												cursor: 'pointer',
												padding: 0,
												textAlign: 'left'
											}}
										>
											<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
												<div style={{
													width: '48px',
													height: '48px',
													borderRadius: '12px',
													background: isCompleted 
														? 'linear-gradient(135deg, #ffee00, #ffd700)' 
														: 'rgba(255,238,0,0.12)',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													fontWeight: 700,
													color: isCompleted ? '#000' : 'var(--va-primary)',
													fontSize: '1.1rem',
													boxShadow: isCompleted ? '0 4px 12px rgba(255,238,0,0.3)' : 'none'
												}}>
													{isCompleted ? '✓' : `Modul ${index + 1}`}
												</div>
												<div style={{ flex: 1 }}>
													<div style={{
														fontWeight: isCompleted ? 700 : 600,
														color: isCompleted ? 'var(--va-primary)' : 'var(--va-text)',
														fontSize: '1.1rem',
														marginBottom: '0.25rem'
													}}>
														{lesson.title || `Modul ${index + 1}`}
													</div>
													{lesson.duration_minutes && (
														<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem' }}>
															⏱ {lesson.duration_minutes} minute
														</div>
													)}
												</div>
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
												{isCompleted && (
													<span style={{ color: 'var(--va-primary)', fontSize: '1.2rem' }}>✓</span>
												)}
												<span style={{
													color: 'var(--va-primary)',
													fontSize: '1.2rem',
													transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
													transition: 'transform 0.3s ease'
												}}>
													▼
												</span>
											</div>
										</button>
										{isExpanded && (
											<div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,238,0,0.15)' }}>
												<Link
													to={`/courses/${courseId}/lessons/${lesson.id}`}
													className="va-btn"
													style={{
														background: 'linear-gradient(135deg, #ffee00, #ffd700)',
														color: '#000000',
														fontWeight: 600,
														padding: '0.875rem 1.5rem',
														borderRadius: '12px',
														textDecoration: 'none',
														display: 'inline-flex',
														alignItems: 'center',
														gap: '0.5rem',
														transition: 'all 0.3s ease'
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.transform = 'translateY(-2px)';
														e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,238,0,0.3)';
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.transform = 'translateY(0)';
														e.currentTarget.style.boxShadow = 'none';
													}}
												>
													<span>Accesează modulul</span>
													<span>→</span>
												</Link>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Test Final */}
				{quiz && (
					<div style={{
						background: quizResult 
							? 'linear-gradient(135deg, rgba(255,238,0,0.08), rgba(255,238,0,0.05))' 
							: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
						border: `1px solid ${quizResult ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.25)'}`,
						borderRadius: '20px',
						padding: '2rem',
						boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset'
					}}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
							<div style={{
								width: '56px',
								height: '56px',
								borderRadius: '12px',
								background: quizResult 
									? 'linear-gradient(135deg, #ffee00, #ffd700)' 
									: 'rgba(255,238,0,0.12)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '1.5rem',
								boxShadow: quizResult ? '0 4px 12px rgba(255,238,0,0.3)' : 'none'
							}}>
								{quizResult ? '✓' : '📝'}
							</div>
							<div style={{ flex: 1 }}>
								<h3 style={{
									color: quizResult ? 'var(--va-primary)' : 'var(--va-text)',
									fontSize: '1.3rem',
									fontWeight: 700,
									margin: 0,
									marginBottom: '0.5rem'
								}}>
									Test final
								</h3>
								{quizResult && (
									<div style={{ color: 'var(--va-muted)', fontSize: '0.9rem' }}>
										Rezultat: {quizResult.score}/{quizResult.total} ({quizResult.percentage}%)
										{quizResult.passed ? ' ✓ Promovat' : ' ✗ Nepromovat'}
									</div>
								)}
							</div>
						</div>
						<Link
							to={`/courses/${courseId}/quiz`}
							className="va-btn"
							style={{
								background: quizResult 
									? 'rgba(255,238,0,0.1)' 
									: 'linear-gradient(135deg, #ffee00, #ffd700)',
								border: `1px solid ${quizResult ? 'rgba(255,238,0,0.3)' : 'rgba(255,238,0,0.5)'}`,
								color: quizResult ? 'var(--va-primary)' : '#000000',
								fontWeight: 600,
								padding: '0.875rem 1.5rem',
								textDecoration: 'none',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '0.5rem',
								borderRadius: '12px',
								transition: 'all 0.3s ease'
							}}
							onMouseEnter={(e) => {
								if (!quizResult) {
									e.currentTarget.style.transform = 'translateY(-2px)';
									e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,238,0,0.3)';
								}
							}}
							onMouseLeave={(e) => {
								if (!quizResult) {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = 'none';
								}
							}}
						>
							<span>{quizResult ? 'Vezi rezultatele' : 'Susține testul'}</span>
							<span>→</span>
						</Link>
					</div>
				)}
			</div>
		</div>
	);
};

export default CourseDetailPage;

