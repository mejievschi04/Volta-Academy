import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { lessonsService, coursesService, courseProgressService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useAutoSave } from '../hooks/useAutoSave';
import LessonProgressIndicator from '../components/student/LessonProgressIndicator';
import LessonNotes from '../components/student/LessonNotes';

const LessonDetailPage = () => {
	const { courseId, lessonId } = useParams();
	const { user } = useAuth();
	const navigate = useNavigate();
	const [lesson, setLesson] = useState(null);
	const [course, setCourse] = useState(null);
	const [progress, setProgress] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [completed, setCompleted] = useState(false);
	const [lessonProgress, setLessonProgress] = useState(0);
	const [timeSpent, setTimeSpent] = useState(0);
	const [sidebarOpen, setSidebarOpen] = useState(false); // Hidden by default for focused experience
	const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
	const startTimeRef = useRef(null);
	const progressIntervalRef = useRef(null);
	const videoRef = useRef(null);

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 1024);
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const [lessonData, courseData, progressData] = await Promise.all([
					lessonsService.getById(lessonId),
					coursesService.getById(courseId),
					user ? courseProgressService.getCourseProgress(courseId).catch(() => null) : null
				]);
				setLesson(lessonData);
				setCourse(courseData);
				setProgress(progressData);
				
				// Check if lesson is already completed
				if (progressData) {
				const lessonProgressData = progressData?.modules
					?.flatMap(m => m.lessons || [])
					?.find(l => l.id === parseInt(lessonId));
				
				if (lessonProgressData?.completed) {
					setCompleted(true);
					setLessonProgress(100);
					}
				}
			} catch (err) {
				console.error('Error fetching data:', err);
				console.error('Error details:', err.response?.data);
				setError('Lecția nu a fost găsită');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [lessonId, courseId, user]);

	// Debug: Log lesson data when it changes
	useEffect(() => {
		if (lesson) {
			console.log('Lesson data loaded:', {
				id: lesson.id,
				title: lesson.title,
				content: lesson.content ? `${lesson.content.substring(0, 50)}...` : 'NO CONTENT',
				content_type: lesson.content_type,
				type: lesson.type,
				video_url: lesson.video_url,
				hasContent: !!lesson.content,
				hasVideo: !!lesson.video_url,
			});
		}
	}, [lesson]);

	// Track time spent and progress
	useEffect(() => {
		if (!lesson || completed) return;

		startTimeRef.current = Date.now();

		// Update time spent every second
		const timeInterval = setInterval(() => {
			if (startTimeRef.current) {
				const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
				setTimeSpent(elapsed);
			}
		}, 1000);

		// Track video progress if video exists
		if (lesson.video_url && videoRef.current) {
			const video = videoRef.current;
			
			const updateVideoProgress = () => {
				if (video.duration) {
					const progress = (video.currentTime / video.duration) * 100;
					setLessonProgress(Math.min(100, progress));
				}
			};

			video.addEventListener('timeupdate', updateVideoProgress);
			
			return () => {
				clearInterval(timeInterval);
				video.removeEventListener('timeupdate', updateVideoProgress);
			};
		}

		// For text lessons, track scroll progress
		const isTextLesson = lesson.type === 'text' || lesson.content_type === 'text' || (!lesson.video_url && lesson.content);
		if (isTextLesson) {
			const updateScrollProgress = () => {
				const windowHeight = window.innerHeight;
				const documentHeight = document.documentElement.scrollHeight;
				const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
				const progress = ((scrollTop + windowHeight) / documentHeight) * 100;
				setLessonProgress(Math.min(100, Math.max(0, progress)));
			};

			window.addEventListener('scroll', updateScrollProgress);
			updateScrollProgress(); // Initial check

			return () => {
				clearInterval(timeInterval);
				window.removeEventListener('scroll', updateScrollProgress);
			};
		}

		return () => {
			clearInterval(timeInterval);
		};
	}, [lesson, completed]);

	// Auto-save progress
	const { saveStatus: saveProgressStatus } = useAutoSave(
		{ lessonId, progress: lessonProgress, timeSpent },
		async (data) => {
			// Auto-save progress to backend (without marking as completed)
			try {
				// Update progress in lesson_progress table
				// This is a lightweight update, not completion
				await courseProgressService.updateLessonProgress(data.lessonId, {
					progress_percentage: data.progress,
					time_spent_seconds: data.timeSpent,
				});
			} catch (err) {
				console.error('Error auto-saving progress:', err);
			}
		},
		5000 // Save every 5 seconds
	);

	// Handle mark as completed
	const handleMarkAsCompleted = useCallback(async () => {
		try {
			await courseProgressService.completeLesson(lessonId);
			setCompleted(true);
			setLessonProgress(100);
			
			// Refresh course progress
			if (user) {
				const updatedProgress = await courseProgressService.getCourseProgress(courseId);
				setProgress(updatedProgress);
			}
		} catch (err) {
			console.error('Error completing lesson:', err);
			alert('Eroare la finalizarea lecției. Te rugăm să încerci din nou.');
		}
	}, [lessonId, courseId, user]);

	// Get next lesson
	const nextLesson = useMemo(() => {
		if (!allLessons || allLessons.length === 0) return null;
		
		const currentIndex = allLessons.findIndex(l => l.id === parseInt(lessonId));
			
		if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
			return allLessons[currentIndex + 1];
		}
		
		return null;
	}, [allLessons, lessonId]);

	// Get all lessons from course modules
	const allLessons = useMemo(() => {
		if (!course || !course.modules) return [];
		// Flatten lessons from all modules
		const lessons = course.modules.flatMap(module => 
			(module.lessons || []).map(lesson => ({
				...lesson,
				moduleId: module.id,
				moduleTitle: module.title
			}))
		);
		return lessons.sort((a, b) => {
			// First sort by module order, then by lesson order
			const moduleA = course.modules.find(m => m.id === a.moduleId);
			const moduleB = course.modules.find(m => m.id === b.moduleId);
			if (moduleA?.order !== moduleB?.order) {
				return (moduleA?.order || 0) - (moduleB?.order || 0);
			}
			return (a.order || 0) - (b.order || 0);
		});
	}, [course]);
	
	const currentLessonIndex = useMemo(() => 
		allLessons.findIndex(l => l.id === parseInt(lessonId)),
		[allLessons, lessonId]
	);
	
	const completedLessonIds = useMemo(() => 
		progress?.completedLessons || [],
		[progress]
	);

	if (loading) { return null; }

	if (error || !lesson) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Lecția nu a fost găsită'}</p>
			</div>
		);
	}

	return (
		<div style={{
			display: 'flex',
			gap: '1.5rem',
			maxWidth: '1800px',
			margin: '0 auto',
			padding: isMobile ? '0 1rem 1rem 1rem' : '0 2rem 2rem 2rem',
			flexDirection: isMobile ? 'column' : 'row'
		}}>
			{/* Sidebar Navigation */}
			{course && allLessons.length > 0 && (
				<aside style={{
					width: sidebarOpen ? (isMobile ? '100%' : '320px') : '0',
					minWidth: sidebarOpen ? (isMobile ? '100%' : '320px') : '0',
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
										<span>📚</span>
										<span>Module</span>
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
								<Link
									to={`/courses/${courseId}`}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.5rem',
										color: 'var(--va-primary)',
										textDecoration: 'none',
										fontSize: '0.9rem',
										fontWeight: 600,
										marginBottom: '1rem',
										padding: '0.5rem',
										borderRadius: '8px',
										transition: 'all 0.2s ease'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = 'rgba(255,238,0,0.1)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = 'transparent';
									}}
								>
									<span>←</span>
									<span>{course.title}</span>
								</Link>
							</div>
							<div style={{
								flex: 1,
								overflowY: 'auto',
								paddingRight: '0.5rem',
								marginRight: '-0.5rem'
							}}>
								<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
									{allLessons.map((l, index) => {
										const isCompleted = completedLessonIds.includes(l.id);
										const isCurrent = l.id === parseInt(lessonId);
										// Check if lesson is in progress (current lesson being viewed)
										const isInProgress = isCurrent && !isCompleted;
										
										return (
											<Link
												key={l.id}
												to={`/courses/${courseId}/lessons/${l.id}`}
												className={`va-lesson-list-item ${isCurrent ? 'current' : ''}`}
											>
												<div className={`va-lesson-number ${isCompleted ? 'completed' : isCurrent ? 'current' : 'available'}`}>
													{isCompleted ? '✓' : index + 1}
												</div>
												<div style={{ flex: 1, minWidth: 0 }}>
													<div style={{
														fontSize: '0.9rem',
														fontWeight: isCurrent ? 700 : 600,
														marginBottom: '0.25rem',
														color: isCompleted ? '#4ade80' : isInProgress ? '#ffc107' : isCurrent ? 'var(--va-primary)' : 'var(--va-text)',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														display: 'flex',
														alignItems: 'center',
														gap: '0.5rem'
													}}>
														<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
															{l.title || `Modul ${index + 1}`}
														</span>
														{isCompleted && (
															<span className="va-lesson-status-icon va-lesson-status-completed" title="Lecție completată">✓</span>
														)}
														{isInProgress && (
															<span className="va-lesson-status-icon va-lesson-status-progress" title="Lecție în progres">⏸</span>
														)}
													</div>
													{l.duration_minutes && (
														<div style={{
															fontSize: '0.75rem',
															color: 'var(--va-muted)',
															display: 'flex',
															alignItems: 'center',
															gap: '0.25rem'
														}}>
															<span>⏱</span>
															<span>{l.duration_minutes} min</span>
														</div>
													)}
												</div>
												{isCurrent && (
													<div style={{
														width: '6px',
														height: '6px',
														borderRadius: '50%',
														background: 'var(--va-primary)',
														boxShadow: '0 0 8px rgba(255,238,0,0.6)',
														flexShrink: 0
													}} />
												)}
											</Link>
										);
									})}
								</div>
							</div>
						</>
					)}
				</aside>
			)}
			
			{/* Sidebar Toggle Button (when closed) */}
			{!sidebarOpen && course && allLessons.length > 0 && (
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

			{/* Main Content - Focused Experience */}
			<div className="student-lesson-content">
				{/* Breadcrumb */}
				<div className="student-lesson-breadcrumb">
					<Link to="/courses" className="student-lesson-breadcrumb-link">Cursuri</Link>
					<span className="student-lesson-breadcrumb-separator">/</span>
					<Link to={`/courses/${courseId}`} className="student-lesson-breadcrumb-link">
						{course?.title || 'Curs'}
					</Link>
					<span className="student-lesson-breadcrumb-separator">/</span>
					<span className="student-lesson-breadcrumb-current">
						{lesson.title || 'Lecție'}
					</span>
				</div>

				{/* Completion Badge */}
				{completed && (
					<div className="student-lesson-completion-badge">
						<div className="student-lesson-completion-icon">✓</div>
						<div>
							<div className="student-lesson-completion-title">Lecție completată!</div>
							<div className="student-lesson-completion-subtitle">Ai finalizat cu succes această lecție</div>
						</div>
					</div>
				)}

				{/* Progress Indicator */}
				{!completed && (
					<LessonProgressIndicator 
						progress={lessonProgress}
						duration={lesson.duration_minutes}
						timeSpent={timeSpent}
					/>
				)}
			
				{/* Lesson Header */}
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
					
					<h1 className="va-page-title" style={{
						background: 'linear-gradient(135deg, #fff, #ffee00)',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						fontSize: '2.25rem',
						letterSpacing: '-0.02em',
						lineHeight: 1.2,
						margin: 0,
						position: 'relative',
						zIndex: 1
					}}>
						{lesson.title || `Modul ${currentLessonIndex + 1}`}
					</h1>
					{lesson.duration_minutes && (
						<div style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.5rem',
							marginTop: '1rem',
							padding: '0.5rem 1rem',
							background: 'rgba(255,238,0,0.1)',
							borderRadius: '12px',
							color: 'var(--va-primary)',
							fontSize: '0.9rem',
							fontWeight: 600,
							position: 'relative',
							zIndex: 1
						}}>
							<span>⏱</span>
							<span>{lesson.duration_minutes} minute</span>
						</div>
					)}
				</div>
			
				{/* Video Content */}
				{lesson.video_url && (
					<div className="student-lesson-video-container">
						<video 
							ref={videoRef}
							controls 
							className="student-lesson-video"
							src={lesson.video_url}
						>
							Browser-ul tău nu suportă tag-ul video.
						</video>
					</div>
				)}
			
			{/* Text Content - Always show */}
				<div className="va-prose" style={{
					background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
					border: '1px solid rgba(255,238,0,0.25)',
					borderRadius: '20px',
					padding: '2.5rem',
					lineHeight: 1.9,
					color: 'var(--va-text)',
					boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset',
					fontSize: '1.05rem',
					width: '100%',
					maxWidth: '100%',
					boxSizing: 'border-box',
					overflow: 'hidden',
					wordWrap: 'break-word',
				overflowWrap: 'break-word',
				minHeight: '200px'
				}}>
				{lesson.content ? (
					<div style={{ 
						whiteSpace: 'pre-wrap',
						wordWrap: 'break-word',
						overflowWrap: 'break-word',
						maxWidth: '100%',
						overflow: 'hidden'
					}}>{lesson.content}</div>
				) : (
					<div style={{
						padding: '2rem',
						textAlign: 'center',
						color: 'var(--va-text-muted)',
						fontStyle: 'italic'
					}}>
						<p>Conținutul lecției nu este disponibil momentan.</p>
						{lesson.description && (
							<p style={{ marginTop: '1rem', fontStyle: 'normal', color: 'var(--va-text)' }}>{lesson.description}</p>
						)}
						{!lesson.video_url && !lesson.content && (
							<p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
								Te rugăm să revii mai târziu sau contactează administratorul.
							</p>
						)}
					</div>
				)}
				</div>

				{/* Resources */}
				{lesson.resources && lesson.resources.length > 0 && (
					<div className="student-lesson-resources">
						<h3 className="student-lesson-resources-title">
							<span>📎</span>
							<span>Resurse</span>
						</h3>
						<div className="student-lesson-resources-list">
							{lesson.resources.map((resource, idx) => (
								<a
									key={idx}
									href={resource.url || resource}
									target="_blank"
									rel="noopener noreferrer"
									className="student-lesson-resource-item"
								>
									<div className="student-lesson-resource-icon">📎</div>
									<div className="student-lesson-resource-content">
										<div className="student-lesson-resource-title">
											{resource.title || resource.name || `Resursă ${idx + 1}`}
										</div>
										{resource.url && (
											<div className="student-lesson-resource-url">
												{typeof resource.url === 'string' ? resource.url : 'Link resursă'}
											</div>
										)}
									</div>
									<span style={{ color: 'var(--student-lesson-text-muted)', fontSize: '1.2rem' }}>→</span>
								</a>
							))}
						</div>
					</div>
				)}

				{/* Lesson Notes */}
				<LessonNotes lessonId={lessonId} />

				{/* Action Buttons */}
				<div className="student-lesson-actions">
					<div className="student-lesson-actions-primary">
						{!completed && (
							<button
								onClick={handleMarkAsCompleted}
								className="student-lesson-btn student-lesson-btn-complete"
							>
								<span className="student-lesson-btn-icon">✓</span>
								<span>Marchează ca finalizat</span>
							</button>
						)}
						{nextLesson && (
							<Link
								to={`/courses/${courseId}/lessons/${nextLesson.id}`}
								className="student-lesson-btn student-lesson-btn-next"
							>
								<span>Lecția următoare</span>
								<span className="student-lesson-btn-icon">→</span>
							</Link>
						)}
					</div>
					<Link 
						to={`/courses/${courseId}`}
						className="student-lesson-btn student-lesson-btn-back"
					>
						<span>←</span>
						<span>Înapoi la curs</span>
					</Link>
				</div>
			</div>
		</div>
	);
};

export default LessonDetailPage;

