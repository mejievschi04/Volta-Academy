import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { coursesService, dashboardService, quizService, courseProgressService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import CourseHeader from '../components/student/CourseHeader';
import CourseStructure from '../components/student/CourseStructure';
import MilestoneNotification from '../components/student/MilestoneNotification';
import { useMilestoneTracker } from '../hooks/useMilestoneTracker';

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
	const [selectedLesson, setSelectedLesson] = useState(null);
	const [selectedContentType, setSelectedContentType] = useState('overview'); // 'overview' | 'lesson' | 'module' | 'quiz'
	const [lessonContent, setLessonContent] = useState(null);
	const [lessonLoading, setLessonLoading] = useState(false);
	const [currentMilestone, setCurrentMilestone] = useState(null);
	const [showMilestoneNotification, setShowMilestoneNotification] = useState(false);
	
	// Quiz states
	const [quizAnswers, setQuizAnswers] = useState({});
	const [quizSubmitted, setQuizSubmitted] = useState(false);
	const [quizSaved, setQuizSaved] = useState(false);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [timeRemaining, setTimeRemaining] = useState(null);
	const [startTime, setStartTime] = useState(null);
	const [flaggedQuestions, setFlaggedQuestions] = useState(new Set());
	const timerIntervalRef = useRef(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
			const [courseData, progressData] = await Promise.all([
				coursesService.getById(courseId),
				user ? courseProgressService.getCourseProgress(courseId).catch(() => null) : null
			]);
			
			// Debug: Log course data with modules and exams
			logger.debug('=== [CourseDetailPage] Course data loaded ===');
			logger.debug('Course ID:', courseData?.id);
			logger.debug('Course Title:', courseData?.title);
			logger.debug('Modules count:', courseData?.modules?.length || 0);
			if (courseData?.modules) {
				courseData.modules.forEach((module, idx) => {
					logger.debug(`Module ${idx + 1} (ID: ${module.id}, Title: ${module.title}):`);
					logger.debug('  - Exams count:', module.exams?.length || 0);
					if (module.exams && module.exams.length > 0) {
						module.exams.forEach(exam => {
							logger.debug(`    * Exam ID: ${exam.id}, Title: ${exam.title}, Module ID: ${exam.module_id}`);
						});
					} else {
						logger.debug('    * No exams in this module');
					}
				});
			}
			logger.debug('==========================================');
			
			setCourse(courseData);
				setProgress(progressData);
				
				// Load quiz/exam if it exists in course data
				if (courseData.exam) {
					try {
						const quizData = await quizService.getQuiz(courseId);
						setQuiz(quizData);
						if (quizData.hasResult && quizData.result) {
							setQuizResult(quizData.result);
						}
					} catch (err) {
						logger.debug('No quiz found for course:', courseId);
					}
				}
			} catch (err) {
				logger.error('Error fetching course:', err);
				setError('Cursul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [courseId, user]);

	// Track milestones
	useMilestoneTracker(
		progress?.course_progress || 0,
		(milestone) => {
			setCurrentMilestone(milestone);
			setShowMilestoneNotification(true);
		}
	);

	// Initialize expanded sections
	useEffect(() => {
		if (course && course.modules && course.modules.length > 0 && Object.keys(expandedSections).length === 0) {
			// Expand first module by default
			setExpandedSections({ [course.modules[0].id]: true });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [course?.modules?.length]);

	const toggleModule = (moduleId) => {
		setExpandedSections(prev => ({
			...prev,
			[moduleId]: !prev[moduleId]
		}));
	};

	// Share functionality
	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({
					title: course?.title,
					text: course?.description,
					url: url
				});
			} catch (err) {
				logger.error('Error sharing:', err);
			}
		} else {
			// Fallback: copy to clipboard
			try {
				await navigator.clipboard.writeText(url);
				alert('Link-ul a fost copiat în clipboard!');
			} catch (err) {
				logger.error('Error copying to clipboard:', err);
			}
		}
	};

	// Calculate progress metrics
	const progressMetrics = useMemo(() => {
		if (!course || !progress) return null;

		const courseProgress = progress.course_progress || 0;
		const totalModules = course.modules?.length || 0;
		const completedModules = progress.modules?.filter(m => m.progress >= 100).length || 0;

		// Calculate estimated time remaining
		const totalDuration = course.modules?.reduce((sum, m) => sum + (m.estimated_duration_minutes || 0), 0) || 0;
		const completedDuration = progress.modules?.reduce((sum, m) => {
			const moduleDuration = course.modules?.find(cm => cm.id === m.id)?.estimated_duration_minutes || 0;
			return sum + (moduleDuration * (m.progress || 0) / 100);
		}, 0) || 0;
		const remainingMinutes = Math.max(0, totalDuration - completedDuration);
		const remainingHours = Math.floor(remainingMinutes / 60);
		const remainingMins = remainingMinutes % 60;
		const estimatedTimeRemaining = remainingHours > 0 
			? `${remainingHours}h ${remainingMins}m`
			: `${remainingMins}m`;

		return {
			progressPercentage: courseProgress,
			completedModules,
			totalModules,
			totalDuration,
			completedDuration,
			estimatedTimeRemaining,
			isCompleted: courseProgress >= 100
		};
	}, [course, progress]);

	// Handle lesson click
	const handleLessonClick = useCallback((lesson) => {
		navigate(`/courses/${courseId}/lessons/${lesson.id}`);
	}, [courseId, navigate]);

	// Handle exam click
	const handleExamClick = useCallback((exam) => {
		navigate(`/courses/${courseId}/exams/${exam.id}`);
	}, [courseId, navigate]);

	// Check if course is near completion
	const isNearCompletion = progressMetrics?.progressPercentage >= 80 && progressMetrics?.progressPercentage < 100;


	// Get content type for lesson
	const getLessonContentType = (lesson) => {
		if (lesson.video_url) return 'Video';
		if (lesson.content) return 'Text';
		return 'Lecție';
	};

	// Handle module selection
	const handleModuleSelect = async (moduleId) => {
		setSelectedContentType('module');
		setSelectedLesson(moduleId);
		const module = course.modules?.find(m => m.id === moduleId);
		if (module) {
			// Set module data as object with content
			setLessonContent({
				title: module.title,
				content: module.content || '',
				id: module.id
			});
		}
	};

	// Note: handleLessonSelect removed - we use modules now, not lessons

	// Handle quiz selection
	const handleQuizSelect = () => {
		setSelectedContentType('quiz');
		setSelectedLesson(null);
		setLessonContent(null);
		
		// Initialize quiz if not already loaded
		if (quiz && !quizSaved) {
			if (quiz.hasResult && quiz.result) {
				setQuizResult(quiz.result);
				setQuizAnswers(quiz.result.answers || {});
				setQuizSubmitted(true);
				setQuizSaved(true);
			} else if (quiz.duration_minutes) {
				setTimeRemaining(quiz.duration_minutes * 60);
				setStartTime(Date.now());
			}
		}
	};

	// Timer countdown
	useEffect(() => {
		if (!quiz?.duration_minutes || quizSaved || quizSubmitted || !startTime || selectedContentType !== 'quiz') return;

		timerIntervalRef.current = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			const remaining = (quiz.duration_minutes * 60) - elapsed;
			
			if (remaining <= 0) {
				setTimeRemaining(0);
				clearInterval(timerIntervalRef.current);
				handleQuizSubmit();
			} else {
				setTimeRemaining(remaining);
			}
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [quiz?.duration_minutes, quizSaved, quizSubmitted, startTime, selectedContentType]);

	// Format time
	const formatTime = useCallback((seconds) => {
		if (!seconds) return '00:00';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}, []);

	// Handle answer change
	const handleAnswerChange = useCallback((questionId, answerIndex) => {
		setQuizAnswers(prev => ({
			...prev,
			[questionId]: answerIndex
		}));
	}, []);

	// Handle quiz submit
	const handleQuizSubmit = useCallback(async () => {
		try {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			const resultData = await quizService.submitQuiz(courseId, quizAnswers);
			setQuizResult(resultData);
			setQuizSubmitted(true);
			setQuizSaved(true);
			
			// Refresh progress
			if (user) {
				const progressData = await dashboardService.getProgress(courseId, user.id);
				setProgress(progressData);
			}
		} catch (err) {
			logger.error('Error submitting quiz:', err);
			setError('Eroare la trimiterea testului');
		}
	}, [courseId, quizAnswers, user]);

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
		if (!quiz || !quiz.questions || index < 0 || index >= quiz.questions.length) return;
		setCurrentQuestionIndex(index);
		const questionElement = document.getElementById(`quiz-question-${quiz.questions[index].id}`);
		if (questionElement) {
			questionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}, [quiz]);

	// Get question status
	const getQuestionStatus = useCallback((questionId, index) => {
		if (quizSaved || quizSubmitted) {
			const isCorrect = quizAnswers[questionId] === quiz.questions.find(q => q.id === questionId)?.answerIndex;
			return isCorrect ? 'completed' : 'incorrect';
		}
		const isAnswered = quizAnswers[questionId] !== undefined;
		const isCurrent = index === currentQuestionIndex;
		if (isCurrent) return 'current';
		if (isAnswered) return 'answered';
		return 'not-started';
	}, [quizAnswers, currentQuestionIndex, quizSaved, quizSubmitted, quiz]);

	// Performance metrics
	const performanceMetrics = useMemo(() => {
		if (!quizResult || !quiz) return null;

		const totalQuestions = quiz.questions.length;
		const correctAnswers = quiz.questions.filter(q => quizAnswers[q.id] === q.answerIndex).length;
		const incorrectAnswers = totalQuestions - correctAnswers;
		const percentage = quizResult.percentage || 0;

		return {
			totalQuestions,
			correctAnswers,
			incorrectAnswers,
			percentage,
			passed: quizResult.passed || false
		};
	}, [quizResult, quiz, quizAnswers]);

	// Handle back to overview
	const handleBackToOverview = () => {
		setSelectedContentType('overview');
		setSelectedLesson(null);
		setLessonContent(null);
	};

	if (loading) {
		return (
			<div className="lms-dashboard-loading">
				<div className="lms-spinner"></div>
				<p>Se încarcă cursul...</p>
			</div>
		);
	}

	if (error || !course) {
		return (
			<div className="lms-empty-state">
				<div className="lms-empty-icon">⚠️</div>
				<div className="lms-empty-title">Cursul nu a fost găsit</div>
				<div className="lms-empty-description">{error || 'Cursul solicitat nu există sau nu este disponibil.'}</div>
				<Link to="/courses" className="lms-btn-primary">Înapoi la cursuri</Link>
			</div>
		);
	}

	return (
		<div className="course-detail-layout">
			{/* Left Sidebar - Modules and Tests */}
			<aside className="course-detail-sidebar">
				{/* Breadcrumb */}
				<div className="course-detail-sidebar-header">
					<Link 
						to="/courses"
						className="course-detail-sidebar-back"
					>
						← Înapoi
					</Link>
					<h2 className="course-detail-sidebar-title">{course.title}</h2>
				</div>

				{/* Modules List */}
				<div className="course-detail-sidebar-content">
					{(course.modules && course.modules.length > 0) || course.exam ? (
						<div className="course-detail-sidebar-section">
							<h3 className="course-detail-sidebar-section-title">
								<span>📚</span>
								<span>Module și Teste</span>
							</h3>
							<div className="course-detail-sidebar-modules">
								{/* Render modules */}
								{course.modules && course.modules.map((module, index) => {
									const isCourseCompleted = course.completed_at && course.completed_at !== null && course.completed_at !== undefined && course.completed_at !== '';
									const isCompleted = isCourseCompleted;
									const isInProgress = !isCompleted;
									
									return (
										<button
											key={module.id}
											type="button"
											onClick={() => handleModuleSelect(module.id)}
											className={`course-detail-sidebar-module ${isCompleted ? 'completed' : isInProgress ? 'in-progress' : ''} ${selectedLesson === module.id ? 'active' : ''}`}
										>
											<div className="course-detail-sidebar-module-indicator">
												{isCompleted ? '✓' : index + 1}
											</div>
											<div className="course-detail-sidebar-module-content">
												<div className="course-detail-sidebar-module-title">
													{module.title || `Modul ${index + 1}`}
												</div>
											</div>
										</button>
									);
								})}
								
								{/* Render exam/test after modules */}
								{course.exam && (
									<button
										type="button"
										onClick={() => handleQuizSelect()}
										className={`course-detail-sidebar-module ${quiz && selectedContentType === 'quiz' ? 'active' : ''}`}
										style={{ marginTop: '0.5rem' }}
									>
										<div className="course-detail-sidebar-module-indicator">
											📝
										</div>
										<div className="course-detail-sidebar-module-content">
											<div className="course-detail-sidebar-module-title">
												{course.exam.title || 'Test Final'}
											</div>
										</div>
									</button>
								)}
							</div>
						</div>
					) : null}
				</div>
			</aside>

			{/* Right Content - Full Screen */}
			<main className="course-detail-content-main">
				{/* Breadcrumb */}
				<div className="course-detail-content-header">
					<Link 
						to="/courses"
						className="course-detail-breadcrumb-link"
					>
						Cursuri
					</Link>
					<span className="course-detail-breadcrumb-separator">/</span>
					<span className="course-detail-breadcrumb-current">
						{course.title}
					</span>
					{selectedContentType === 'module' && lessonContent && (
						<>
							<span className="course-detail-breadcrumb-separator">/</span>
							<span className="course-detail-breadcrumb-current">
								{course.modules?.find(m => m.id === selectedLesson)?.title || 'Modul'}
							</span>
						</>
					)}
					{selectedContentType === 'quiz' && (
						<>
							<span className="course-detail-breadcrumb-separator">/</span>
							<span className="course-detail-breadcrumb-current">
								Test Final
							</span>
						</>
					)}
				</div>

				{/* Milestone Notification */}
				{showMilestoneNotification && currentMilestone && (
					<MilestoneNotification
						milestone={currentMilestone}
						onClose={() => {
							setShowMilestoneNotification(false);
							setCurrentMilestone(null);
						}}
					/>
				)}

				{/* Content based on selection */}
				{selectedContentType === 'overview' && (
					<>
						{/* Course Header */}
						<CourseHeader 
							course={course} 
							progress={progress}
							estimatedTimeRemaining={progressMetrics?.estimatedTimeRemaining}
						/>

						{/* Course Description */}
						{course.description && (
							<div className="student-course-description">
								<p>{course.description}</p>
							</div>
						)}

						{/* Course Structure */}
						<CourseStructure 
							course={course}
							progress={progress}
							onLessonClick={handleLessonClick}
							onExamClick={handleExamClick}
						/>
					</>
				)}

				{/* Module Content */}
				{selectedContentType === 'module' && (
					<>
						{lessonLoading ? (
							<div className="lms-dashboard-loading">
								<div className="lms-spinner"></div>
								<p>Se încarcă modulul...</p>
							</div>
						) : lessonContent ? (
							<div className="course-detail-lesson-content">
								{/* Completion Badge - for modules */}
								{selectedContentType === 'module' && course.completed_at && (
									<div className="course-detail-completion-badge completed">
										<div className="course-detail-completion-icon">
											✓
										</div>
										<div>
											<div className="course-detail-completion-badge-title">
												Modul completat!
											</div>
											<div className="course-detail-completion-badge-subtitle">
												Ai finalizat cu succes acest modul
											</div>
										</div>
									</div>
								)}

								{/* Lesson Header */}
								<div className="course-detail-lesson-header-card">
									<h1 className="course-detail-lesson-header-title">
										{(typeof lessonContent === 'object' && lessonContent?.title) || (selectedContentType === 'module' && course.modules?.find(m => m.id === selectedLesson)?.title) || 'Modul'}
									</h1>
									{lessonContent?.duration_minutes && (
										<div className="course-detail-lesson-duration-badge">
											<span>⏱</span>
											<span>{lessonContent.duration_minutes} minute</span>
										</div>
									)}
								</div>

								{/* Content */}
								<div className="course-detail-lesson-content-card">
									{selectedContentType === 'module' ? (
										<div 
											dangerouslySetInnerHTML={{ __html: (typeof lessonContent === 'string' ? lessonContent : lessonContent?.content) || '' }}
										/>
									) : (
										<div style={{ whiteSpace: 'pre-wrap' }}>
											{typeof lessonContent === 'object' && lessonContent?.content ? lessonContent.content : ''}
										</div>
									)}
								</div>

								{/* Resources - only for lessons */}
								{/* Resources removed - modules use content field instead */}
								{false && lessonContent.resources && lessonContent.resources.length > 0 && (
									<div style={{
										background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
										border: '1px solid rgba(255,238,0,0.25)',
										borderRadius: '20px',
										padding: '2rem',
										marginBottom: '2.5rem',
										boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset'
									}}>
										<h3 style={{
											color: 'var(--text-primary)',
											marginBottom: '1.5rem',
											fontSize: '1.3rem',
											fontWeight: 700,
											display: 'flex',
											alignItems: 'center',
											gap: '0.75rem'
										}}>
											<span>📎</span>
											<span>Resurse</span>
										</h3>
										<div style={{ display: 'grid', gap: '1rem' }}>
											{lessonContent.resources.map((resource, idx) => (
												<a
													key={idx}
													href={resource.url || resource}
													target="_blank"
													rel="noopener noreferrer"
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: '1rem',
														padding: '1.25rem 1.5rem',
														background: 'rgba(255,255,255,0.04)',
														border: '1px solid rgba(56, 189, 248, 0.18)',
														borderRadius: '16px',
														textDecoration: 'none',
														color: 'var(--text-primary)',
														transition: 'all 0.3s ease'
													}}
													onMouseEnter={(e) => {
														e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0.08))';
														e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
														e.currentTarget.style.transform = 'translateX(6px)';
													}}
													onMouseLeave={(e) => {
														e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
														e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.18)';
														e.currentTarget.style.transform = 'translateX(0)';
													}}
												>
													<div style={{
														width: '44px',
														height: '44px',
														borderRadius: '12px',
														background: 'rgba(56, 189, 248, 0.12)',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														fontSize: '1.5rem',
														flexShrink: 0
													}}>
														📎
													</div>
													<div style={{ flex: 1 }}>
														<div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '1.05rem' }}>
															{resource.title || resource.name || `Resursă ${idx + 1}`}
														</div>
														{resource.url && (
															<div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
																{typeof resource.url === 'string' ? resource.url : 'Link resursă'}
															</div>
														)}
													</div>
													<span style={{ color: 'var(--text-tertiary)', fontSize: '1.2rem' }}>→</span>
												</a>
											))}
										</div>
									</div>
								)}

								{/* Navigation Buttons */}
								<div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
									<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
										{selectedContentType === 'module' && course.modules && (() => {
											const currentIndex = course.modules.findIndex(m => m.id === selectedLesson);
											const prevModule = currentIndex > 0 ? course.modules[currentIndex - 1] : null;
											const nextModule = currentIndex < course.modules.length - 1 ? course.modules[currentIndex + 1] : null;
											
											return (
												<>
													{prevModule && (
														<button
															onClick={() => handleModuleSelect(prevModule.id)}
															className="lms-btn-secondary"
															style={{
																display: 'inline-flex',
																alignItems: 'center',
																gap: '0.5rem'
															}}
														>
															<span>←</span>
															<span>Modulul anterior</span>
														</button>
													)}
													{nextModule ? (
														<button
															onClick={() => handleModuleSelect(nextModule.id)}
															className="lms-btn-primary"
															style={{
																display: 'inline-flex',
																alignItems: 'center',
																gap: '0.5rem'
															}}
														>
															<span>Modulul următor</span>
															<span>→</span>
														</button>
													) : course.exam ? (
														<button
															onClick={handleQuizSelect}
															className="lms-btn-primary"
															style={{
																display: 'inline-flex',
																alignItems: 'center',
																gap: '0.5rem'
															}}
														>
															<span>📝</span>
															<span>Mergi la test final</span>
														</button>
													) : null}
												</>
											);
										})()}
									</div>
									<button
										onClick={handleBackToOverview}
										className="lms-btn-secondary"
										style={{
											display: 'inline-flex',
											alignItems: 'center',
											gap: '0.5rem'
										}}
									>
										<span>←</span>
										<span>Înapoi la curs</span>
									</button>
								</div>
							</div>
						) : null}
					</>
				)}

				{/* Quiz Content */}
				{selectedContentType === 'quiz' && (
					<div className="course-detail-quiz-content">
						{!quiz ? (
							<div className="lms-empty-state">
								<div className="lms-empty-icon">📝</div>
								<div className="lms-empty-title">Testul nu este disponibil</div>
								<div className="lms-empty-description">Testul nu este disponibil pentru acest curs.</div>
								<button
									onClick={handleBackToOverview}
									className="lms-btn-primary"
								>
									Înapoi la curs
								</button>
							</div>
						) : (
							<>
								{/* Quiz Header */}
								<div className="course-detail-quiz-header">
									<div>
										<div className="course-detail-quiz-header-top">
											<h1 className="course-detail-quiz-title">
												{quiz.title || 'Test final'}
											</h1>
											{quizSaved && quizResult && (
												<div className="course-detail-quiz-completed-badge">
													<div className="course-detail-quiz-completed-icon">
														✓
													</div>
													<span>Test completat</span>
												</div>
											)}
										</div>

										{/* Pre-Quiz Overview */}
										{!quizSubmitted && !quizSaved && quiz.questions && (
											<div className="course-detail-quiz-overview">
												<div className="course-detail-quiz-overview-item">
													<div className="course-detail-quiz-overview-label">Întrebări</div>
													<div className="course-detail-quiz-overview-value">{quiz.questions.length}</div>
												</div>
												{quiz.duration_minutes && (
													<div className="course-detail-quiz-overview-item">
														<div className="course-detail-quiz-overview-label">Durată estimată</div>
														<div className="course-detail-quiz-overview-value">{quiz.duration_minutes} min</div>
													</div>
												)}
												<div className="course-detail-quiz-overview-item">
													<div className="course-detail-quiz-overview-label">Puncte disponibile</div>
													<div className="course-detail-quiz-overview-value">
														{quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0)}
													</div>
												</div>
												{quiz.passing_score && (
													<div className="course-detail-quiz-overview-item">
														<div className="course-detail-quiz-overview-label">Punctaj minim</div>
														<div className="course-detail-quiz-overview-value">{quiz.passing_score}%</div>
													</div>
												)}
											</div>
										)}

										{/* Timer Display */}
										{timeRemaining !== null && !quizSaved && !quizSubmitted && (
											<div className={`course-detail-quiz-timer ${timeRemaining < 300 ? 'warning' : ''}`}>
												<span className="course-detail-quiz-timer-icon">⏱</span>
												<span className="course-detail-quiz-timer-value">
													{formatTime(timeRemaining)}
												</span>
												<span className="course-detail-quiz-timer-label">
													rămas
												</span>
											</div>
										)}
									</div>
								</div>

								{/* Questions */}
								{!quizSaved && (
									<div className="course-detail-quiz-questions-card">
										<div className="course-detail-quiz-questions-body">
											{quiz.questions && quiz.questions.length > 0 ? (
												quiz.questions.map((q, idx) => {
													const isCorrect = quizAnswers[q.id] === q.answerIndex;
													const showResult = (quizSubmitted || quizSaved) && quizResult;
													const isFlagged = flaggedQuestions.has(q.id);
													const points = q.points || 1;
													
													return (
														<div 
															id={`quiz-question-${q.id}`}
															key={q.id}
															className={`course-detail-quiz-question-card ${showResult ? (isCorrect ? 'correct' : 'incorrect') : ''}`}
														>
															<div className="course-detail-quiz-question-header">
																<div className={`course-detail-quiz-question-number-badge ${showResult ? (isCorrect ? 'correct' : 'incorrect') : 'default'}`}>
																	{showResult ? (isCorrect ? '✓' : '✗') : idx + 1}
																</div>
																<div className="course-detail-quiz-question-content">
																	<div className="course-detail-quiz-question-top">
																		<div className="course-detail-quiz-question-text-wrapper">
																			<div className="course-detail-quiz-question-text">
																				{q.text}
																			</div>
																			{!quizSubmitted && !quizSaved && (
																				<div className="course-detail-quiz-question-progress">
																					Întrebarea {idx + 1} din {quiz.questions.length}
																				</div>
																			)}
																		</div>
																		<div className="course-detail-quiz-question-actions">
																			{points > 1 && (
																				<div className="course-detail-quiz-question-points">
																					{points} {points === 1 ? 'punct' : 'puncte'}
																				</div>
																			)}
																			{!quizSubmitted && !quizSaved && (
																				<button
																					onClick={() => toggleFlag(q.id)}
																					className={`course-detail-quiz-question-flag ${isFlagged ? 'flagged' : ''}`}
																					title={isFlagged ? 'Elimină marcaj' : 'Marchează pentru revizie'}
																				>
																					<span>🚩</span>
																				</button>
																			)}
																		</div>
																	</div>
																</div>
															</div>
															<div className="course-detail-quiz-answer-options">
																{q.options && q.options.map((opt, i) => {
																	const isSelected = quizAnswers[q.id] === i;
																	const isCorrectOption = i === q.answerIndex;
																	
																	return (
																		<label 
																			key={i} 
																			className={`course-detail-quiz-answer-option ${showResult 
																				? (isCorrectOption ? 'correct' : isSelected ? 'incorrect' : 'default')
																				: (isSelected ? 'selected' : 'default')
																			} ${(quizSubmitted || quizSaved) ? 'disabled' : ''}`}
																		>
																			<input
																				type="radio"
																				name={q.id}
																				checked={isSelected}
																				onChange={() => {
																					if (!quizSubmitted && !quizSaved) {
																						handleAnswerChange(q.id, i);
																					}
																				}}
																				disabled={quizSubmitted || quizSaved}
																			/>
																			<span className="course-detail-quiz-answer-text">
																				{opt}
																			</span>
																			{showResult && isCorrectOption && (
																				<span className="course-detail-quiz-answer-check">✓</span>
																			)}
																			{showResult && isSelected && !isCorrectOption && (
																				<span className="course-detail-quiz-answer-cross">✗</span>
																			)}
																		</label>
																	);
																})}
															</div>
															{showResult && (
																<div className={`course-detail-quiz-answer-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
																	<div className="course-detail-quiz-feedback-header">
																		<span className="course-detail-quiz-feedback-icon">
																			{isCorrect ? '✓' : '✗'}
																		</span>
																		<span className={`course-detail-quiz-feedback-title ${isCorrect ? 'correct' : 'incorrect'}`}>
																			{isCorrect ? 'Răspuns corect' : 'Răspuns incorect'}
																		</span>
																	</div>
																	{q.explanation && (
																		<div className={`course-detail-quiz-feedback-explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
																			<strong>Explicație:</strong> {q.explanation}
																		</div>
																	)}
																</div>
															)}
														</div>
													);
												})
											) : (
												<p className="course-detail-quiz-no-questions">
													Nu există întrebări disponibile pentru acest test.
												</p>
											)}
										</div>
									</div>
								)}

								{/* Results Page */}
								{quizSaved && quizResult && (
									<div className="course-detail-quiz-results">
										<div className={`course-detail-quiz-results-card ${quizResult.passed ? 'passed' : 'failed'}`}>
											<div className={`course-detail-quiz-results-header ${quizResult.passed ? 'passed' : 'failed'}`}>
												{quizResult.passed ? '✓ Promovat' : '✗ Nepromovat'}
											</div>
											<div className="course-detail-quiz-results-stats">
												<div className="course-detail-quiz-results-stat">
													<div className="course-detail-quiz-results-stat-label">Scor</div>
													<div className="course-detail-quiz-results-stat-value">
														{quizResult.score || 0} / {quizResult.total || quiz.questions?.length || 0}
													</div>
												</div>
												<div className="course-detail-quiz-results-stat">
													<div className="course-detail-quiz-results-stat-label">Procentaj</div>
													<div className="course-detail-quiz-results-stat-value">{quizResult.percentage || 0}%</div>
												</div>
												{performanceMetrics && (
													<>
														<div className="course-detail-quiz-results-stat">
															<div className="course-detail-quiz-results-stat-label">Corecte</div>
															<div className="course-detail-quiz-results-stat-value correct">
																{performanceMetrics.correctAnswers}
															</div>
														</div>
														<div className="course-detail-quiz-results-stat">
															<div className="course-detail-quiz-results-stat-label">Incorecte</div>
															<div className="course-detail-quiz-results-stat-value incorrect">
																{performanceMetrics.incorrectAnswers}
															</div>
														</div>
													</>
												)}
											</div>
										</div>
									</div>
								)}

								{/* Action Buttons */}
								<div className="course-detail-navigation">
									{!quizSaved && !quizSubmitted && (
										<button
											onClick={handleQuizSubmit}
											className="lms-btn-primary"
											disabled={Object.keys(quizAnswers).length === 0}
											style={{
												opacity: Object.keys(quizAnswers).length === 0 ? 0.5 : 1
											}}
										>
											<span>📝</span>
											<span>Trimite testul</span>
										</button>
									)}
									<button
										onClick={handleBackToOverview}
										className="lms-btn-secondary"
									>
										<span>←</span>
										<span>Înapoi la curs</span>
									</button>
								</div>
							</>
						)}
					</div>
				)}
			</main>
		</div>
	);
};

export default CourseDetailPage;
