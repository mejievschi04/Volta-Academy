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

	// Fetch lesson data
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
				} catch (err) {
					console.error('Error fetching lesson:', err);
					setError('Lecția nu a fost găsită');
				}
			};
			fetchLesson();
		}
	}, [lessonId, viewMode, progress]);

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
			{/* Sidebar Navigation */}
			<aside className={`unified-course-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
				<div className="unified-course-sidebar-header">
					{sidebarOpen && (
						<>
							<Link to="/courses" className="unified-course-sidebar-back">
								← Înapoi
							</Link>
							<h2 className="unified-course-sidebar-title">{course.title}</h2>
							{/* Progress Bar */}
							<div className="unified-course-progress-bar">
								<div className="unified-course-progress-fill" style={{ width: `${courseProgressPercentage}%` }} />
								<span className="unified-course-progress-text">
									{courseProgressPercentage}% completat
								</span>
							</div>
						</>
					)}
				</div>

				{sidebarOpen && (
					<div className="unified-course-sidebar-content">
						{/* Modules and Lessons */}
								{course.modules && course.modules.length > 0 && (
									<div className="unified-course-modules">
										{course.modules.map((module, moduleIndex) => (
											<div key={module.id} className="unified-course-module">
												<div className="unified-course-module-header">
													<span className="unified-course-module-icon" style={{ fontSize: '1.25rem' }}>📚</span>
													<span className="unified-course-module-title">{module.title}</span>
												</div>
										{module.lessons && module.lessons.length > 0 && (
											<div className="unified-course-lessons">
												{module.lessons.map((lesson, lessonIndex) => {
													const isActive = lessonId && parseInt(lessonId) === lesson.id;
													const isCompleted = isLessonCompleted(lesson.id);
													
													return (
														<Link
															key={lesson.id}
															to={`/courses/${courseId}/lessons/${lesson.id}`}
															className={`unified-course-lesson ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
														>
															<span className="unified-course-lesson-icon">
																{isCompleted ? '✓' : '▶'}
															</span>
															<span className="unified-course-lesson-title">{lesson.title}</span>
															{lesson.duration_minutes && (
																<span className="unified-course-lesson-duration">
																	⏱ {lesson.duration_minutes} min
																</span>
															)}
														</Link>
													);
												})}
											</div>
										)}
									</div>
								))}
							</div>
						)}

						{/* Exams */}
								{course.exams && course.exams.length > 0 && (
									<div className="unified-course-exams">
										<h3 className="unified-course-exams-title">
											<span style={{ fontSize: '1.25rem' }}>📝</span>
											<span>Teste</span>
										</h3>
										{course.exams.map((exam) => {
											const isActive = examId && parseInt(examId) === exam.id;
											
											return (
												<Link
													key={exam.id}
													to={`/courses/${courseId}/exams/${exam.id}`}
													className={`unified-course-exam ${isActive ? 'active' : ''}`}
												>
													<span className="unified-course-exam-icon" style={{ fontSize: '1rem' }}>📝</span>
													<span className="unified-course-exam-title">{exam.title}</span>
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
						{/* Course Header */}
						<div className="unified-course-header">
							{course.image_url && (
								<img src={course.image_url} alt={course.title} className="unified-course-image" />
							)}
							<div className="unified-course-header-content">
								<h1 className="unified-course-title">{course.title}</h1>
								{course.description && (
									<p className="unified-course-description">{course.description}</p>
								)}
								<div className="unified-course-meta">
									{course.estimated_duration_hours && (
										<span className="unified-course-meta-item">
											⏱ {course.estimated_duration_hours} ore
										</span>
									)}
									{course.level && (
										<span className="unified-course-meta-item">
											Nivel: {course.level}
										</span>
									)}
								</div>
							</div>
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
					<div className="unified-course-lesson-view">
						{/* Lesson Header */}
						<div className="unified-course-lesson-header">
							<div className="unified-course-lesson-breadcrumb">
								<Link to={`/courses/${courseId}`}>Curs</Link>
								<span>/</span>
								<span>{currentLesson.moduleTitle || 'Lecție'}</span>
								<span>/</span>
								<span>{currentLesson.title}</span>
							</div>
							<h1 className="unified-course-lesson-title">{currentLesson.title}</h1>
							{currentLesson.description && (
								<p className="unified-course-lesson-description">{currentLesson.description}</p>
							)}
						</div>

						{/* Lesson Content */}
						<div className="unified-course-lesson-content">
							{/* Video */}
							{currentLesson.video_url && (
								<div className="unified-course-lesson-video">
									<video
										ref={videoRef}
										controls
										src={currentLesson.video_url}
										className="unified-course-video-player"
									>
										Browser-ul tău nu suportă tag-ul video.
									</video>
								</div>
							)}

							{/* Text Content */}
							{currentLesson.content && (
								<div className="unified-course-lesson-text">
									<div className="unified-course-prose" dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
								</div>
							)}

							{!currentLesson.video_url && !currentLesson.content && (
								<div className="unified-course-lesson-empty">
									<p>Conținutul lecției nu este disponibil momentan.</p>
								</div>
							)}
						</div>

						{/* Lesson Navigation */}
						<div className="unified-course-lesson-navigation">
							{prevLesson ? (
								<Link
									to={`/courses/${courseId}/lessons/${prevLesson.id}`}
									className="unified-course-nav-button prev"
								>
									<span>←</span>
									<span>Lecția anterioară</span>
								</Link>
							) : (
								<div />
							)}
							
							{!completed && (
								<button
									onClick={handleCompleteLesson}
									className="unified-course-complete-button"
								>
									<span>✓</span>
									<span>Marchează ca completată</span>
								</button>
							)}
							
							{nextLesson ? (
								<Link
									to={`/courses/${courseId}/lessons/${nextLesson.id}`}
									className="unified-course-nav-button next"
								>
									<span>Lecția următoare</span>
									<span>→</span>
								</Link>
							) : course.exams && course.exams.length > 0 ? (
								<Link
									to={`/courses/${courseId}/exams/${course.exams[0].id}`}
									className="unified-course-nav-button next"
								>
									<span>Mergi la test</span>
									<span>→</span>
								</Link>
							) : null}
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

