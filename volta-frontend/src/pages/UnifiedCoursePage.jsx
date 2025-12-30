import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { coursesService, lessonsService, courseProgressService, examService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const UnifiedCoursePage = () => {
	const { courseId, lessonId, examId } = useParams();
	const location = useLocation();
	const { user } = useAuth();
	const navigate = useNavigate();
	
	// State management
	const [course, setCourse] = useState(null);
	const [progress, setProgress] = useState(null);
	const [currentLesson, setCurrentLesson] = useState(null);
	const [currentExam, setCurrentExam] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [completed, setCompleted] = useState(false);
	const [lessonProgress, setLessonProgress] = useState(0);
	const [expandedModules, setExpandedModules] = useState({});
	const [courseCompleted, setCourseCompleted] = useState(false);
	
	// Exam states
	const [examAnswers, setExamAnswers] = useState({});
	const [examSubmitted, setExamSubmitted] = useState(false);
	const [examResult, setExamResult] = useState(null);
	const [timeRemaining, setTimeRemaining] = useState(null);
	const [startTime, setStartTime] = useState(null);
	const timerIntervalRef = useRef(null);
	const videoRef = useRef(null);

	// Determine current view mode
	const viewMode = useMemo(() => {
		if (examId) return 'exam';
		if (lessonId) return 'lesson';
		return 'overview';
	}, [lessonId, examId]);

	// Fetch course data
	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const [courseData, progressData] = await Promise.all([
					coursesService.getById(courseId),
					user ? courseProgressService.getCourseProgress(courseId).catch(() => null) : null
				]);
				setCourse(courseData);
				setProgress(progressData);
			} catch (err) {
				console.error('Error fetching course:', err);
				setError('Cursul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [courseId, user]);

	// Fetch lesson data and auto-mark next lesson as read
	useEffect(() => {
		if (viewMode === 'lesson' && lessonId) {
			const fetchLesson = async () => {
				try {
					const lessonData = await lessonsService.getById(lessonId);
					setCurrentLesson(lessonData);
					
					// Check if lesson is completed
					if (progress) {
						const lessonProgressData = progress?.modules
							?.flatMap(m => m.lessons || [])
							?.find(l => l.id === parseInt(lessonId));
						
						if (lessonProgressData?.completed) {
							setCompleted(true);
							setLessonProgress(100);
						}
					}
					
					// Auto-mark next lesson as read when accessing current lesson
					if (user && course && course.modules && progress) {
						const allLessons = course.modules.flatMap(m => m.lessons || []);
						const currentIndex = allLessons.findIndex(l => l.id === parseInt(lessonId));
						
						if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
							const nextLesson = allLessons[currentIndex + 1];
							
							// Check if next lesson is not already completed
							const nextLessonCompleted = progress.modules
								?.flatMap(m => m.lessons || [])
								?.some(l => l.id === nextLesson.id && l.completed) || false;
							
							if (nextLesson && !nextLessonCompleted) {
								try {
									// Mark next lesson as read (completed)
									await courseProgressService.completeLesson(nextLesson.id);
									
									// Refresh progress to reflect the change
									const progressData = await courseProgressService.getCourseProgress(courseId);
									setProgress(progressData);
									
									console.log(`Auto-marked next lesson ${nextLesson.id} as read`);
								} catch (err) {
									console.error('Error auto-marking next lesson as read:', err);
									// Don't show error to user - this is a background operation
								}
							}
						}
					}
				} catch (err) {
					console.error('Error fetching lesson:', err);
					setError('Lecția nu a fost găsită');
				}
			};
			fetchLesson();
		}
	}, [lessonId, viewMode, progress, user, course, courseId]);

	// Fetch exam data
	useEffect(() => {
		if (viewMode === 'exam' && examId) {
			const fetchExam = async () => {
				try {
					const examData = await examService.getExam(examId);
					setCurrentExam(examData);
					
					if (examData.latest_result) {
						setExamResult(examData.latest_result);
						setExamAnswers(examData.latest_result.answers || {});
						setExamSubmitted(true);
					}
					
					if (examData.time_limit_minutes && !examData.latest_result) {
						setTimeRemaining(examData.time_limit_minutes * 60);
						setStartTime(Date.now());
					}
				} catch (err) {
					console.error('Error fetching exam:', err);
					setError('Testul nu a fost găsit');
				}
			};
			fetchExam();
		}
	}, [examId, viewMode]);

	// Timer for exams
	useEffect(() => {
		if (!currentExam?.time_limit_minutes || examSubmitted || !startTime) return;

		timerIntervalRef.current = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			const remaining = (currentExam.time_limit_minutes * 60) - elapsed;
			
			if (remaining <= 0) {
				setTimeRemaining(0);
				clearInterval(timerIntervalRef.current);
				handleExamSubmit();
			} else {
				setTimeRemaining(remaining);
			}
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [currentExam?.time_limit_minutes, examSubmitted, startTime]);

	// Get all lessons from modules
	const allLessons = useMemo(() => {
		if (!course || !course.modules) return [];
		return course.modules.flatMap(module => 
			(module.lessons || []).map(lesson => ({
				...lesson,
				moduleId: module.id,
				moduleTitle: module.title,
				moduleOrder: module.order
			}))
		).sort((a, b) => {
			if (a.moduleOrder !== b.moduleOrder) {
				return (a.moduleOrder || 0) - (b.moduleOrder || 0);
			}
			return (a.order || 0) - (b.order || 0);
		});
	}, [course]);

	// Get current lesson index
	const currentLessonIndex = useMemo(() => 
		allLessons.findIndex(l => l.id === parseInt(lessonId)),
		[allLessons, lessonId]
	);

	// Get next/previous lessons
	const nextLesson = useMemo(() => {
		if (currentLessonIndex === -1 || currentLessonIndex >= allLessons.length - 1) {
			return null;
		}
		return allLessons[currentLessonIndex + 1];
	}, [allLessons, currentLessonIndex]);

	const prevLesson = useMemo(() => {
		if (currentLessonIndex <= 0) {
			return null;
		}
		return allLessons[currentLessonIndex - 1];
	}, [allLessons, currentLessonIndex]);

	// Check lesson completion status
	const isLessonCompleted = useCallback((lessonId) => {
		if (!progress) return false;
		return progress.modules
			?.flatMap(m => m.lessons || [])
			?.some(l => l.id === lessonId && l.completed) || false;
	}, [progress]);

	// Handle lesson completion
	const handleCompleteLesson = async () => {
		if (!user || !lessonId) return;
		
		try {
			await courseProgressService.completeLesson(lessonId);
			setCompleted(true);
			setLessonProgress(100);
			
			// Refresh progress
			const progressData = await courseProgressService.getCourseProgress(courseId);
			setProgress(progressData);
		} catch (err) {
			console.error('Error completing lesson:', err);
			alert('Eroare la completarea lecției: ' + (err.response?.data?.message || err.message));
		}
	};

	// Handle exam submit
	const handleExamSubmit = async () => {
		if (!currentExam || examSubmitted) return;
		
		try {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			
			const resultData = await examService.submitExam(examId, examAnswers);
			setExamResult(resultData.result);
			setExamSubmitted(true);
			
			// Refresh progress
			if (user) {
				const progressData = await courseProgressService.getCourseProgress(courseId);
				setProgress(progressData);
			}
		} catch (err) {
			console.error('Error submitting exam:', err);
			setError('Eroare la trimiterea testului');
		}
	};

	// Handle exam answer change
	const handleExamAnswerChange = useCallback((questionId, answer) => {
		setExamAnswers(prev => ({
			...prev,
			[questionId]: answer
		}));
	}, []);

	// Format time
	const formatTime = useCallback((seconds) => {
		if (!seconds) return '00:00';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}, []);

	// Calculate course progress
	const courseProgressPercentage = useMemo(() => {
		if (!progress) return 0;
		return progress.course_progress || 0;
	}, [progress]);

	// Check if course is completed
	useEffect(() => {
		if (progress && courseProgressPercentage >= 100) {
			setCourseCompleted(true);
		}
	}, [progress, courseProgressPercentage]);

	// Auto-expand module with current lesson
	useEffect(() => {
		if (lessonId && course && course.modules) {
			const moduleWithLesson = course.modules.find(m => 
				m.lessons?.some(l => l.id === parseInt(lessonId))
			);
			if (moduleWithLesson) {
				setExpandedModules(prev => ({
					...prev,
					[moduleWithLesson.id]: true
				}));
			}
		}
	}, [lessonId, course]);

	// Toggle module expansion
	const toggleModule = useCallback((moduleId) => {
		setExpandedModules(prev => ({
			...prev,
			[moduleId]: !prev[moduleId]
		}));
	}, []);

	// Get next lesson to start/continue
	const nextLessonToStart = useMemo(() => {
		if (!allLessons.length || !progress) return allLessons[0];
		return allLessons.find(l => !isLessonCompleted(l.id)) || null;
	}, [allLessons, progress]);

	// Get lesson status
	const getLessonStatus = useCallback((lessonId) => {
		if (!progress) return 'not-started';
		const lessonProgressData = progress.modules
			?.flatMap(m => m.lessons || [])
			?.find(l => l.id === lessonId);
		
		if (lessonProgressData?.completed) return 'completed';
		if (lessonProgressData?.unlocked || lessonProgressData) return 'in-progress';
		return 'not-started';
	}, [progress]);

	// Get lesson icon based on type
	const getLessonIcon = useCallback((lesson) => {
		if (lesson.type === 'video') return '🎥';
		if (lesson.type === 'text') return '📄';
		if (lesson.type === 'quiz') return '❓';
		return '📚';
	}, []);

	// Get module progress
	const getModuleProgress = useCallback((moduleId) => {
		if (!progress) return 0;
		const moduleProgress = progress.modules?.find(m => m.id === moduleId);
		return moduleProgress?.progress || 0;
	}, [progress]);

	// Get completed lessons count for module
	const getModuleCompletedCount = useCallback((module) => {
		if (!progress || !module.lessons) return 0;
		const moduleProgress = progress.modules?.find(m => m.id === module.id);
		if (!moduleProgress) return 0;
		return moduleProgress.lessons?.filter(l => l.completed).length || 0;
	}, [progress]);

	if (loading) {
		return (
			<div className="unified-course-page">
				<div className="unified-course-loading">
					<div className="loading-spinner"></div>
					<p>Se încarcă cursul...</p>
				</div>
			</div>
		);
	}

	if (error || !course) {
		return (
			<div className="unified-course-page">
				<div className="unified-course-error">
					<div style={{
						fontSize: '4rem',
						marginBottom: '1rem',
						opacity: 0.7
					}}>⚠️</div>
					<p>{error || 'Cursul nu a fost găsit'}</p>
					<Link 
						to="/courses" 
						className="unified-course-nav-button"
						style={{ marginTop: '1rem' }}
					>
						← Înapoi la cursuri
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="unified-course-page">
			{/* Sidebar Navigation - New Modern Style */}
			<aside className={`course-sidebar-modern ${sidebarOpen ? 'open' : 'closed'}`}>
				<div className="course-sidebar-modern-header">
					{sidebarOpen && (
						<>
							<Link to="/courses" className="course-sidebar-modern-back">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
									<path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
								</svg>
								<span>Înapoi</span>
							</Link>
							<div className="course-sidebar-modern-progress-card">
								<div className="course-sidebar-modern-progress-info">
									<span className="course-sidebar-modern-progress-label">Progres</span>
									<span className="course-sidebar-modern-progress-value">{courseProgressPercentage}%</span>
								</div>
								<div className="course-sidebar-modern-progress-track">
									<div 
										className="course-sidebar-modern-progress-fill"
										style={{ width: `${courseProgressPercentage}%` }}
									/>
								</div>
								<div className="course-sidebar-modern-progress-details">
									{allLessons.filter(l => isLessonCompleted(l.id)).length} / {allLessons.length} lecții
								</div>
							</div>
						</>
					)}
				</div>

				{sidebarOpen && (
					<div className="course-sidebar-modern-content">
						<div className="course-sidebar-modern-title">Conținut curs</div>
						{course.modules && course.modules.length > 0 && (
							<div className="course-sidebar-modern-modules">
								{course.modules.map((module, moduleIndex) => {
									const isExpanded = expandedModules[module.id] !== false;
									const moduleLessons = module.lessons || [];
									const moduleProgress = getModuleProgress(module.id);
									const completedCount = getModuleCompletedCount(module);
									const totalLessons = moduleLessons.length;
									const hasActiveLesson = moduleLessons.some(l => lessonId && parseInt(lessonId) === l.id);
									
									return (
										<div key={module.id} className={`course-sidebar-modern-module ${hasActiveLesson ? 'active-module' : ''}`}>
											<div 
												className="course-sidebar-modern-module-header"
												onClick={() => toggleModule(module.id)}
											>
												<div className="course-sidebar-modern-module-badge">
													{moduleIndex + 1}
												</div>
												<div className="course-sidebar-modern-module-content">
													<div className="course-sidebar-modern-module-title">
														Modul {moduleIndex + 1}
													</div>
													{totalLessons > 0 && (
														<div className="course-sidebar-modern-module-meta">
															{completedCount} / {totalLessons} lecții
														</div>
													)}
												</div>
												<div className="course-sidebar-modern-module-actions">
													<div className="course-sidebar-modern-module-progress">
														<div 
															className="course-sidebar-modern-module-progress-bar"
															style={{ width: `${moduleProgress}%` }}
														/>
													</div>
													<svg 
														className={`course-sidebar-modern-module-arrow ${isExpanded ? 'expanded' : ''}`}
														width="12" 
														height="12" 
														viewBox="0 0 12 12" 
														fill="none"
													>
														<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
													</svg>
												</div>
											</div>
											{isExpanded && moduleLessons.length > 0 && (
												<div className="course-sidebar-modern-lessons">
													{moduleLessons.map((lesson, lessonIndex) => {
														const isActive = lessonId && parseInt(lessonId) === lesson.id;
														const lessonStatus = getLessonStatus(lesson.id);
														const lessonIcon = getLessonIcon(lesson);
														
														return (
															<Link
																key={lesson.id}
																to={`/courses/${courseId}/lessons/${lesson.id}`}
																className={`course-sidebar-modern-lesson ${isActive ? 'active' : ''} ${lessonStatus === 'completed' ? 'completed' : ''} ${lessonStatus === 'in-progress' ? 'in-progress' : ''}`}
															>
																<div className="course-sidebar-modern-lesson-indicator">
																	{lessonStatus === 'completed' ? (
																		<div className="course-sidebar-modern-lesson-check">
																			<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
																				<path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
																			</svg>
																		</div>
																	) : (
																		<div className="course-sidebar-modern-lesson-dot" />
																	)}
																</div>
																<div className="course-sidebar-modern-lesson-body">
																	<div className="course-sidebar-modern-lesson-title">
																		<span className="course-sidebar-modern-lesson-icon">{lessonIcon}</span>
																		<span>Lectie {lessonIndex + 1}</span>
																	</div>
																	{lesson.duration_minutes && (
																		<div className="course-sidebar-modern-lesson-time">
																			{lesson.duration_minutes} min
																		</div>
																	)}
																</div>
															</Link>
														);
													})}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}

						{/* Exams */}
								{course.exams && course.exams.length > 0 && (
									<div className="unified-course-exams">
										<h3 className="unified-course-exams-title">
											<span style={{ fontSize: '1.25rem' }}>📝</span>
											<span>Teste</span>
										</h3>
										{course.exams.map((exam, examIndex) => {
											const isActive = examId && parseInt(examId) === exam.id;
											
											return (
												<Link
													key={exam.id}
													to={`/courses/${courseId}/exams/${exam.id}`}
													className={`unified-course-exam ${isActive ? 'active' : ''}`}
												>
													<span className="unified-course-exam-icon">📝</span>
													<span className="unified-course-exam-title">Test {examIndex + 1}</span>
												</Link>
											);
										})}
									</div>
								)}
					</div>
				)}
			</aside>

			{/* Main Content */}
			<main className="unified-course-main">
				{viewMode === 'overview' && (
					<div className="unified-course-overview">
						{/* Premium Course Header */}
						<div className="premium-course-header">
							<div className="premium-course-header-content">
								<div className="premium-course-header-top">
									<h1 className="premium-course-title">{course.title}</h1>
									<div className="premium-course-progress-badge">
										<span className="premium-course-progress-value">{courseProgressPercentage}%</span>
										<span className="premium-course-progress-label">completat</span>
									</div>
								</div>
								{course.description && (
									<p className="premium-course-description">{course.description}</p>
								)}
								<div className="premium-course-meta">
									{course.level && (
										<div className="premium-course-meta-item">
											<span className="premium-course-meta-icon">📊</span>
											<span className="premium-course-meta-label">Nivel:</span>
											<span className="premium-course-meta-value">{course.level}</span>
										</div>
									)}
									{course.estimated_duration_hours && (
										<div className="premium-course-meta-item">
											<span className="premium-course-meta-icon">⏱</span>
											<span className="premium-course-meta-label">Durată:</span>
											<span className="premium-course-meta-value">{course.estimated_duration_hours} ore</span>
										</div>
									)}
									<div className="premium-course-meta-item">
										<span className="premium-course-meta-icon">📚</span>
										<span className="premium-course-meta-label">Module:</span>
										<span className="premium-course-meta-value">{course.modules?.length || 0}</span>
									</div>
									<div className="premium-course-meta-item">
										<span className="premium-course-meta-icon">📖</span>
										<span className="premium-course-meta-label">Lecții:</span>
										<span className="premium-course-meta-value">{allLessons.length}</span>
									</div>
								</div>
								{nextLessonToStart && (
									<Link
										to={`/courses/${courseId}/lessons/${nextLessonToStart.id}`}
										className="premium-course-start-button"
									>
										<span>{courseProgressPercentage > 0 ? 'Continuă cursul' : 'Începe cursul'}</span>
										<span>→</span>
									</Link>
								)}
							</div>
							{course.image_url && (
								<div className="premium-course-header-image">
									<img src={course.image_url} alt={course.title} />
								</div>
							)}
						</div>

						{/* Course Stats */}
						<div className="unified-course-stats">
							<div className="unified-course-stat">
								<div className="unified-course-stat-value">{course.modules?.length || 0}</div>
								<div className="unified-course-stat-label">Module</div>
							</div>
							<div className="unified-course-stat">
								<div className="unified-course-stat-value">{allLessons.length}</div>
								<div className="unified-course-stat-label">Lecții</div>
							</div>
							<div className="unified-course-stat">
								<div className="unified-course-stat-value">{course.exams?.length || 0}</div>
								<div className="unified-course-stat-label">Teste</div>
							</div>
							<div className="unified-course-stat">
								<div className="unified-course-stat-value">{courseProgressPercentage}%</div>
								<div className="unified-course-stat-label">Progres</div>
							</div>
						</div>

						{/* Quick Start */}
						{allLessons.length > 0 && (
							<div className="unified-course-quick-start">
								<h2 className="unified-course-section-title">Continuă învățarea</h2>
								{allLessons.map((lesson, index) => {
									const isCompleted = isLessonCompleted(lesson.id);
									const isNext = !isCompleted && index === allLessons.findIndex(l => !isLessonCompleted(l.id));
									
									return (
										<Link
											key={lesson.id}
											to={`/courses/${courseId}/lessons/${lesson.id}`}
											className={`unified-course-quick-lesson ${isNext ? 'next' : ''} ${isCompleted ? 'completed' : ''}`}
										>
											<span className="unified-course-quick-lesson-number">{index + 1}</span>
											<div className="unified-course-quick-lesson-content">
												<div className="unified-course-quick-lesson-title">{lesson.title}</div>
												<div className="unified-course-quick-lesson-meta">
													{lesson.moduleTitle} • {lesson.duration_minutes || 0} min
												</div>
											</div>
											{isNext && <span className="unified-course-quick-lesson-badge">Următoarea</span>}
											{isCompleted && <span className="unified-course-quick-lesson-check" style={{ fontSize: '1.25rem', color: 'var(--color-dark)' }}>✓</span>}
										</Link>
									);
								})}
							</div>
						)}
					</div>
				)}

				{viewMode === 'lesson' && currentLesson && (
					<div className="premium-lesson-view">
						{/* Premium Lesson Header */}
						<div className="premium-lesson-header">
							<div className="premium-lesson-breadcrumb">
								<Link to={`/courses/${courseId}`} className="premium-breadcrumb-link">Curs</Link>
								<span className="premium-breadcrumb-separator">/</span>
								<span className="premium-breadcrumb-item">{currentLesson.moduleTitle || 'Lecție'}</span>
								<span className="premium-breadcrumb-separator">/</span>
								<span className="premium-breadcrumb-item active">{currentLesson.title}</span>
							</div>
							<div className="premium-lesson-header-content">
								<div className="premium-lesson-header-left">
									<h1 className="premium-lesson-title">{currentLesson.title}</h1>
									{currentLesson.description && (
										<p className="premium-lesson-description">{currentLesson.description}</p>
									)}
									<div className="premium-lesson-meta">
										{currentLesson.duration_minutes && (
											<span className="premium-lesson-meta-item">
												⏱ {currentLesson.duration_minutes} min
											</span>
										)}
										{currentLesson.type && (
											<span className="premium-lesson-meta-item">
												{getLessonIcon(currentLesson)} {currentLesson.type}
											</span>
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Premium Lesson Content - Focused */}
						<div className="premium-lesson-content">
							{/* Video */}
							{currentLesson.video_url && (
								<div className="premium-lesson-video-container">
									<div className="premium-lesson-video-wrapper">
										<video
											ref={videoRef}
											controls
											src={currentLesson.video_url}
											className="premium-lesson-video"
										>
											Browser-ul tău nu suportă tag-ul video.
										</video>
									</div>
								</div>
							)}

							{/* Text Content */}
							{currentLesson.content && (
								<div className="premium-lesson-text-container">
									<div className="premium-lesson-text-content" dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
								</div>
							)}

							{!currentLesson.video_url && !currentLesson.content && (
								<div className="premium-lesson-empty">
									<div className="premium-lesson-empty-icon">📚</div>
									<p>Conținutul lecției nu este disponibil momentan.</p>
								</div>
							)}
						</div>

						{/* Premium Lesson Navigation */}
						<div className="premium-lesson-navigation">
							<div className="premium-lesson-nav-left">
								{prevLesson ? (
									<Link
										to={`/courses/${courseId}/lessons/${prevLesson.id}`}
										className="premium-nav-button premium-nav-prev"
									>
										<span className="premium-nav-icon">←</span>
										<span className="premium-nav-text">
											<span className="premium-nav-label">Lecția anterioară</span>
											<span className="premium-nav-title">{prevLesson.title}</span>
										</span>
									</Link>
								) : (
									<div className="premium-nav-spacer" />
								)}
							</div>
							
							<div className="premium-lesson-nav-center">
								{!completed && (
									<button
										onClick={handleCompleteLesson}
										className="premium-complete-button"
									>
										<span className="premium-complete-icon">✓</span>
										<span className="premium-complete-text">Marchează ca finalizat</span>
									</button>
								)}
								{completed && (
									<div className="premium-completed-badge">
										<span className="premium-completed-icon">✓</span>
										<span className="premium-completed-text">Lecție finalizată</span>
									</div>
								)}
							</div>
							
							<div className="premium-lesson-nav-right">
								{nextLesson ? (
									<Link
										to={`/courses/${courseId}/lessons/${nextLesson.id}`}
										className="premium-nav-button premium-nav-next"
									>
										<span className="premium-nav-text">
											<span className="premium-nav-label">Următoarea lecție</span>
											<span className="premium-nav-title">{nextLesson.title}</span>
										</span>
										<span className="premium-nav-icon">→</span>
									</Link>
								) : course.exams && course.exams.length > 0 ? (
									<Link
										to={`/courses/${courseId}/exams/${course.exams[0].id}`}
										className="premium-nav-button premium-nav-next"
									>
										<span className="premium-nav-text">
											<span className="premium-nav-label">Mergi la test</span>
										</span>
										<span className="premium-nav-icon">→</span>
									</Link>
								) : courseCompleted ? (
									<div className="premium-course-completed">
										<span className="premium-course-completed-icon">🎉</span>
										<span className="premium-course-completed-text">Curs finalizat!</span>
									</div>
								) : null}
							</div>
						</div>
					</div>
				)}

				{viewMode === 'exam' && currentExam && (
					<div className="unified-course-exam-view">
						{/* Exam Header */}
						<div className="unified-course-exam-header">
							<div className="unified-course-exam-breadcrumb">
								<Link to={`/courses/${courseId}`}>Curs</Link>
								<span>/</span>
								<span>{currentExam.title}</span>
							</div>
							<h1 className="unified-course-exam-title">{currentExam.title}</h1>
							{currentExam.description && (
								<p className="unified-course-exam-description">{currentExam.description}</p>
							)}
							
							{/* Timer */}
							{timeRemaining !== null && !examSubmitted && (
								<div className="unified-course-exam-timer">
									<span>⏱</span>
									<span>{formatTime(timeRemaining)}</span>
								</div>
							)}
						</div>

						{/* Exam Questions */}
						{!examSubmitted && (
							<div className="unified-course-exam-questions">
								{currentExam.questions && currentExam.questions.map((q, idx) => (
									<div key={q.id} className="unified-course-exam-question">
										<div className="unified-course-exam-question-header">
											<span className="unified-course-exam-question-number">{idx + 1}</span>
											<span className="unified-course-exam-question-text">{q.text}</span>
										</div>
										<div className="unified-course-exam-question-options">
											{q.options && q.options.map((opt, i) => (
												<label
													key={i}
													className={`unified-course-exam-option ${examAnswers[q.id] === i ? 'selected' : ''}`}
												>
													<input
														type="radio"
														name={q.id}
														checked={examAnswers[q.id] === i}
														onChange={() => handleExamAnswerChange(q.id, i)}
													/>
													<span>{opt}</span>
												</label>
											))}
										</div>
									</div>
								))}
							</div>
						)}

						{/* Exam Results */}
						{examSubmitted && examResult && (
							<div className="unified-course-exam-results">
								<div className={`unified-course-exam-result-header ${examResult.passed ? 'passed' : 'failed'}`}>
									{examResult.passed ? '✓ Test promovat!' : '✗ Test nepromovat'}
								</div>
								<div className="unified-course-exam-result-stats">
									<div className="unified-course-exam-result-stat">
										<span className="unified-course-exam-result-label">Scor</span>
										<span className="unified-course-exam-result-value">
											{examResult.score || 0} / {examResult.total_points || currentExam.questions?.length || 0}
										</span>
									</div>
									<div className="unified-course-exam-result-stat">
										<span className="unified-course-exam-result-label">Procentaj</span>
										<span className="unified-course-exam-result-value">{examResult.percentage || 0}%</span>
									</div>
								</div>
							</div>
						)}

						{/* Exam Actions */}
						<div className="unified-course-exam-actions">
							{!examSubmitted && (
								<button
									onClick={handleExamSubmit}
									className="unified-course-exam-submit-button"
									disabled={Object.keys(examAnswers).length === 0}
								>
									Trimite testul
								</button>
							)}
							<Link
								to={`/courses/${courseId}`}
								className="unified-course-exam-back-button"
							>
								Înapoi la curs
							</Link>
						</div>
					</div>
				)}
			</main>
		</div>
	);
};

export default UnifiedCoursePage;

