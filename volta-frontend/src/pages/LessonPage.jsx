import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lessonsService, coursesService, courseProgressService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './LessonPage.css';

const LessonPage = () => {
	const { courseId, lessonId } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { showToast } = useToast();
	const contentRef = useRef(null);
	
	const [lesson, setLesson] = useState(null);
	const [course, setCourse] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isCompleted, setIsCompleted] = useState(false);
	const [isCompleting, setIsCompleting] = useState(false);

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

	// Auto-complete on scroll
	useEffect(() => {
		if (!lesson || isCompleted || isCompleting) return;

		let shortContentTimer = null;

		const checkCompletion = () => {
			if (isCompleted || isCompleting) return;

			// Calculate scroll position
			const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
			const windowHeight = window.innerHeight;
			const documentHeight = document.documentElement.scrollHeight;
			
			// Check if user is near the bottom (within 100px)
			const isNearBottom = scrollTop + windowHeight >= documentHeight - 100;
			const isContentShort = documentHeight <= windowHeight + 50; // Content fits in viewport with small margin

			// For short content: auto-complete after 2 seconds (user has time to read)
			if (isContentShort) {
				if (!shortContentTimer) {
					shortContentTimer = setTimeout(() => {
						if (!isCompleted && !isCompleting) {
							handleAutoComplete();
						}
					}, 2000); // 2 seconds delay for short content
				}
			} 
			// For long content: auto-complete when scrolled to bottom
			else if (isNearBottom) {
				// Clear short content timer if it exists
				if (shortContentTimer) {
					clearTimeout(shortContentTimer);
					shortContentTimer = null;
				}
				// Complete when at bottom
				handleAutoComplete();
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
			if (shortContentTimer) {
				clearTimeout(shortContentTimer);
			}
		};
	}, [lesson, isCompleted, isCompleting, handleAutoComplete]);

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

	const handleNext = () => {
		// Navigate to next lesson or back to course
		navigate(`/courses/${courseId}`);
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
							{lesson.duration_minutes && (
								<div className="lesson-page-meta-item">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<circle cx="12" cy="12" r="10"/>
										<polyline points="12 6 12 12 16 14"/>
									</svg>
									<span>{lesson.duration_minutes} minute</span>
								</div>
							)}
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
						{lesson.content ? (
							<div 
								className="lesson-page-content-text"
								dangerouslySetInnerHTML={{ __html: lesson.content }}
							/>
						) : (
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
						)}
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
							className="lesson-page-btn lesson-page-btn-secondary"
							onClick={handleNext}
						>
							<span>Următoarea lecție</span>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M5 12h14M12 5l7 7-7 7"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LessonPage;
