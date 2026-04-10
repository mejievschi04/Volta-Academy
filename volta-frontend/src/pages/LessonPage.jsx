import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { normalizeRichTextMediaHtml } from '../utils/richTextContent';
import { lessonsService, coursesService, courseProgressService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LessonBlocksPreview from '../components/admin/content-blocks/LessonBlocksPreview';
import CourseCongratulationsModal from '../components/student/CourseCongratulationsModal';
import { getNextLessonIdAfter } from '../utils/lessonOrder';
import { useLessonTimeTracking } from '../hooks/useLessonTimeTracking';
import './LessonPage.css';

const LESSON_MILESTONES = [25, 50, 75, 100];

const LessonPage = () => {
	const { courseId, lessonId } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { showToast } = useToast();
	const contentRef = useRef(null);
	const sentMilestonesRef = useRef(new Set());
	
	const [lesson, setLesson] = useState(null);
	const [course, setCourse] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isCompleted, setIsCompleted] = useState(false);
	const [isCompleting, setIsCompleting] = useState(false);
	const [showCourseCongrats, setShowCourseCongrats] = useState(false);
	const [finalizingCourse, setFinalizingCourse] = useState(false);
	const [reachedMilestones, setReachedMilestones] = useState(() => new Set());

	useLessonTimeTracking(lessonId, {
		userId: user?.id,
		isCompleted,
		enabled: Boolean(user?.id && lessonId && !['admin', 'analyst'].includes(user?.actualRole || user?.role || '')),
	});

	// Handle auto-complete function
	const handleAutoComplete = useCallback(async () => {
		if (isCompleting || isCompleted) return;
		
		try {
			setIsCompleting(true);
			await lessonsService.complete(lessonId);
			setIsCompleted(true);
			showToast('Lecția a fost marcată automat ca completată!', 'success');
		} catch (err) {
			console.error('Error completing lesson:', err);
			// Don't show error toast for auto-complete failures
		} finally {
			setIsCompleting(false);
		}
	}, [lessonId, isCompleting, isCompleted, showToast]);

	useEffect(() => {
		if (lessonId && courseId) {
			fetchLessonData();
		}
	}, [lessonId, courseId]);

	useEffect(() => {
		setReachedMilestones(new Set());
		sentMilestonesRef.current = new Set();
	}, [lessonId]);

	useEffect(() => {
		const pendingMilestones = LESSON_MILESTONES.filter(
			(milestone) => reachedMilestones.has(milestone) && !sentMilestonesRef.current.has(milestone)
		);

		if (!pendingMilestones.length) return;

		pendingMilestones.forEach((milestone) => sentMilestonesRef.current.add(milestone));

		let cancelled = false;

		const syncMilestones = async () => {
			for (const milestone of pendingMilestones) {
				try {
					const response = await courseProgressService.updateLessonProgress(lessonId, {
						milestone,
						milestone_reached: milestone,
						progress_percentage: milestone,
						completed: milestone >= 100,
					});

					if (cancelled) return;

					if (response?.completed || response?.auto_completed || milestone >= 100) {
						setIsCompleted(true);
					}
				} catch (err) {
					if (cancelled) return;
					sentMilestonesRef.current.delete(milestone);
				}
			}
		};

		syncMilestones();

		return () => {
			cancelled = true;
		};
	}, [lessonId, reachedMilestones]);

	// Auto-complete on scroll
	useEffect(() => {
		if (!lesson || isCompleted || isCompleting) return;

	
		const checkCompletion = () => {
			if (isCompleted || isCompleting) return;

			const markers = Array.from(contentRef.current?.querySelectorAll('[data-lesson-milestone]') || []);
			if (!markers.length) return;

			const viewportBottom = window.innerHeight;
			const seen = [];

			markers.forEach((marker) => {
				const milestone = Number(marker.dataset.lessonMilestone);
				if (!Number.isFinite(milestone)) return;
				const rect = marker.getBoundingClientRect();
				if (rect.top <= viewportBottom) {
					seen.push(milestone);
				}
			});

			if (seen.length) {
				setReachedMilestones((prev) => {
					const next = new Set(prev);
					seen.forEach((value) => next.add(value));
					return next.size === prev.size ? prev : next;
				});
			}
		};

		// Throttle scroll events
		let ticking = false;
		const throttledScroll = () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					checkCompletion();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener('scroll', throttledScroll, { passive: true });
		
		// Check on initial load (for short content)
		const checkInitial = setTimeout(() => {
			checkCompletion();
		}, 500);

		// Also check when content changes
		if (contentRef.current) {
			checkCompletion();
		}

		return () => {
			window.removeEventListener('scroll', throttledScroll);
			clearTimeout(checkInitial);
		};
	}, [lesson, isCompleted, isCompleting, reachedMilestones]);

	const fetchLessonData = async () => {
		try {
			setLoading(true);
			setError(null);
			
			// Fetch lesson
			const lessonData = await lessonsService.getById(lessonId);
			setLesson(lessonData);
			
			// Fetch course for context
			try {
				const courseData = await coursesService.getById(courseId);
				setCourse(courseData);
			} catch (err) {
				console.log('Could not fetch course data');
			}
			
			// Check if lesson is already completed
			if (user?.id) {
				try {
					const progress = await courseProgressService.getCourseProgress(courseId);
					if (progress?.lessons) {
						const lessonProgress = progress.lessons.find(l => l.lesson_id === parseInt(lessonId));
						if (lessonProgress?.completed) {
							setIsCompleted(true);
						}
					}
				} catch (err) {
					console.log('Could not fetch progress data');
				}
			}
		} catch (err) {
			console.error('Error fetching lesson:', err);
			setError('Nu s-a putut încărca lecția');
			showToast('Eroare la încărcarea lecției', 'error');
		} finally {
			setLoading(false);
		}
	};

	const nextLessonTarget = getNextLessonIdAfter(course?.modules, lessonId);
	const isLastLessonInCourse = nextLessonTarget === null;

	const handleNext = () => {
		if (typeof nextLessonTarget === 'number') {
			navigate(`/courses/${courseId}/lessons/${nextLessonTarget}`);
			return;
		}
		navigate(`/courses/${courseId}`);
	};

	const handleFinalizeCourse = async () => {
		if (finalizingCourse) return;
		setFinalizingCourse(true);
		try {
			if (!user?.id) {
				navigate(`/courses/${courseId}`);
				return;
			}
			if (!isCompleted) {
				await lessonsService.complete(lessonId);
				setIsCompleted(true);
			}
			const p = await courseProgressService.getCourseProgress(courseId);
			if (p?.next_exam?.id) {
				navigate(`/courses/${courseId}/exams/${p.next_exam.id}`);
				return;
			}
			if (p?.course_complete) {
				setShowCourseCongrats(true);
				return;
			}
			try {
				await coursesService.finishCourse(courseId);
			} catch (err) {
				const status = err?.response?.status;
				const nextId = err?.response?.data?.next_test_id;
				if (status === 409 && nextId) {
					navigate(`/courses/${courseId}/exams/${nextId}`);
					return;
				}
				throw err;
			}
			setShowCourseCongrats(true);
		} catch (err) {
			console.error('Finalize course:', err);
			showToast('Nu s-a putut finaliza cursul. Încearcă din nou.', 'error');
		} finally {
			setFinalizingCourse(false);
		}
	};

	const handleCongratsClose = () => {
		setShowCourseCongrats(false);
		navigate('/courses');
	};

	if (loading) {
		return (
			<div className="lesson-page-modern">
				<div className="lesson-page-loading">
					<div className="lesson-page-spinner"></div>
					<p>Se încarcă lecția...</p>
				</div>
			</div>
		);
	}

	if (error || !lesson) {
		return (
			<div className="lesson-page-modern">
				<div className="lesson-page-error">
					<div className="lesson-page-error-icon">⚠️</div>
					<h2>Eroare</h2>
					<p>{error || 'Lecția nu a fost găsită'}</p>
					<button
						className="lesson-page-btn lesson-page-btn-primary"
						onClick={() => navigate(`/courses/${courseId}`)}
					>
						Înapoi la curs
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="lesson-page-modern">
			<CourseCongratulationsModal
				open={showCourseCongrats}
				courseTitle={course?.title}
				onClose={handleCongratsClose}
			/>
			{/* Header */}
			<div className="lesson-page-header">
				<div className="lesson-page-header-content">
					<button 
						className="lesson-page-back-btn"
						onClick={() => navigate(`/courses/${courseId}`)}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M19 12H5M12 19l-7-7 7-7"/>
						</svg>
						<span>Înapoi la curs</span>
					</button>
					
					{course && (
						<div className="lesson-page-course-info">
							<span className="lesson-page-course-name">{course.title}</span>
						</div>
					)}
				</div>
			</div>

			{/* Main Content */}
			<div className="lesson-page-content">
				<div className="lesson-page-main">
					{/* Lesson Header */}
					<div className="lesson-page-title-section">
						<h1 className="lesson-page-title">{lesson.title}</h1>
						{lesson.description && (
							<p className="lesson-page-description">{lesson.description}</p>
						)}
						<div className="lesson-page-meta">
							{lesson.content_type && (
								<div className="lesson-page-meta-item">
									<span className="lesson-page-type-badge">
										{lesson.content_type === 'video' ? '🎥 Video' :
										 lesson.content_type === 'text' ? '📄 Text' :
										 lesson.content_type === 'live' ? '🔴 Live' : '📚 Lecție'}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Lesson Content */}
					<div className="lesson-page-body" ref={contentRef}>
						{LESSON_MILESTONES.map((milestone) => (
							<div
								key={`lesson-milestone-${milestone}`}
								className="lesson-progress-marker"
								data-lesson-milestone={milestone}
								style={{ top: `${milestone}%` }}
								aria-hidden="true"
							/>
						))}

						{(() => {
							const blocks = Array.isArray(lesson.content_blocks) ? lesson.content_blocks : Array.isArray(lesson.contentBlocks) ? lesson.contentBlocks : [];
							const hasBlocks = blocks.length > 0;
							const hasLegacyContent = lesson.content && lesson.content.trim().length > 0;

							if (hasBlocks) {
								return (
									<div className="lesson-page-blocks">
										<LessonBlocksPreview blocks={blocks} variant="student" />
									</div>
								);
							}
							if (hasLegacyContent) {
								const html = normalizeRichTextMediaHtml(lesson.content || '');
								return (
									<div
										className="lesson-page-content-text"
										dangerouslySetInnerHTML={{ __html: html }}
									/>
								);
							}
							return (
								<div className="lesson-page-empty-content">
									<div className="lesson-page-empty-icon">
										<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
											<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
										</svg>
									</div>
									<h3>Lecția nu are conținut configurat</h3>
									<p>Conținutul lecției va fi disponibil în curând.</p>
								</div>
							);
						})()}
					</div>

					{/* Actions */}
					<div className="lesson-page-actions">
						{isCompleted && (
							<div className="lesson-page-completed-badge">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M20 6L9 17l-5-5"/>
								</svg>
								<span>Lecție completată</span>
							</div>
						)}
						
						<button
							type="button"
							className="lesson-page-btn lesson-page-btn-secondary"
							disabled={finalizingCourse}
							onClick={isLastLessonInCourse ? handleFinalizeCourse : handleNext}
						>
							{isLastLessonInCourse ? (
								finalizingCourse ? (
									<span>Se procesează…</span>
								) : (
									<>
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M20 6L9 17l-5-5"/>
										</svg>
										<span>Finalizează</span>
									</>
								)
							) : (
								<>
									<span>Următoarea lecție</span>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M5 12h14M12 5l7 7-7 7"/>
									</svg>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LessonPage;
