import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { coursesService, courseProgressService, lessonsService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LessonBlocksPreview from '../components/admin/content-blocks/LessonBlocksPreview';
import CourseCongratulationsModal from '../components/student/CourseCongratulationsModal';
import { getNextLessonIdAfter } from '../utils/lessonOrder';
import { normalizeRichTextMediaHtml } from '../utils/richTextContent';
import { useLessonTimeTracking } from '../hooks/useLessonTimeTracking';
import './LessonsPage.css';

const LESSON_MILESTONES = [25, 50, 75, 100];

const normalizeCourseModules = (courseData) => {
	const sortedModules = [...(courseData?.modules || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
	const rootLessons = [...(courseData?.lessons || [])]
		.filter((lesson) => lesson?.module_id == null)
		.sort((a, b) => (a.order || 0) - (b.order || 0));

	if (!rootLessons.length) {
		return sortedModules;
	}

	return [
		{
			id: `root-${courseData?.id || 'course'}`,
			title: 'Lecții fără modul',
			order: -1,
			lessons: rootLessons,
			course_tests: [],
			courseTests: [],
			isRootLessonGroup: true,
		},
		...sortedModules,
	];
};

const LessonsPage = () => {
	const { courseId } = useParams();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { showToast } = useToast();
	const contentRef = useRef(null);
	const sentMilestonesRef = useRef(new Set());
	
	const [course, setCourse] = useState(null);
	const [modules, setModules] = useState([]);
	const [progress, setProgress] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [currentLesson, setCurrentLesson] = useState(null);
	const [currentLessonLoading, setCurrentLessonLoading] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);
	const [isCompleting, setIsCompleting] = useState(false);
	const [expandedModules, setExpandedModules] = useState(new Set());
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [showCourseCongrats, setShowCourseCongrats] = useState(false);
	const [finalizingCourse, setFinalizingCourse] = useState(false);
	const [reachedMilestones, setReachedMilestones] = useState(() => new Set());

	// Get lessonId from URL or auto-select first lesson
	const lessonIdFromUrl = searchParams.get('lesson');
	const [selectedLessonId, setSelectedLessonId] = useState(lessonIdFromUrl);

	useEffect(() => {
		if (courseId) {
			fetchCourseData();
		}
	}, [courseId]);

	useEffect(() => {
		setReachedMilestones(new Set());
		sentMilestonesRef.current = new Set();
	}, [selectedLessonId]);

	// Auto-open first lesson when course loads (no lesson in URL)
	useEffect(() => {
		if (!loading && modules.length > 0 && !selectedLessonId) {
			// Find first lesson from first module
			const firstModule = modules[0];
			if (firstModule?.lessons && firstModule.lessons.length > 0) {
				const sortedLessons = firstModule.lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
				const firstLesson = sortedLessons[0];
				if (firstLesson) {
					setSelectedLessonId(firstLesson.id);
					loadLesson(firstLesson.id);
					// Expand first module
					setExpandedModules(new Set([firstModule.id]));
				}
			}
		}
	}, [loading, modules, selectedLessonId]);

	// Expand module containing lesson when loading from URL (?lesson=1)
	useEffect(() => {
		if (!loading && modules.length > 0 && selectedLessonId) {
			const lessonId = parseInt(selectedLessonId, 10);
			const moduleContainingLesson = modules.find(m => 
				m.lessons?.some(l => (l.id === lessonId || l.id === selectedLessonId))
			);
			if (moduleContainingLesson) {
				setExpandedModules(prev => new Set([...prev, moduleContainingLesson.id]));
			}
		}
	}, [loading, modules, selectedLessonId]);

	// Load lesson when selectedLessonId changes
	useEffect(() => {
		if (selectedLessonId && courseId) {
			loadLesson(selectedLessonId);
		}
	}, [selectedLessonId, courseId]);

	const lessonReadyForTracking =
		Boolean(
			user?.id &&
				selectedLessonId &&
				!currentLessonLoading &&
				currentLesson &&
				Number(currentLesson.id) === Number(selectedLessonId)
		);

	useLessonTimeTracking(selectedLessonId, {
		userId: user?.id,
		isCompleted,
		enabled: lessonReadyForTracking && !['admin', 'analyst'].includes(user?.actualRole || user?.role || ''),
	});

	const fetchCourseData = async () => {
		try {
			setLoading(true);
			setError(null);
			
			const courseData = await coursesService.getById(courseId);
			setCourse(courseData);
			
			setModules(normalizeCourseModules(courseData));
			
			// Fetch progress if user is enrolled
			if (user?.id) {
				try {
					const progressData = await courseProgressService.getCourseProgress(courseId);
					setProgress(progressData);
				} catch (err) {
					console.log('No progress data available');
				}
			}
		} catch (err) {
			console.error('Error fetching course:', err);
			setError('Nu s-a putut încărca cursul');
			showToast('Eroare la încărcarea cursului', 'error');
		} finally {
			setLoading(false);
		}
	};

	const loadLesson = async (lessonId) => {
		try {
			setCurrentLessonLoading(true);
			const lessonData = await lessonsService.getById(lessonId);
			setCurrentLesson(lessonData);
			
			// Check if lesson is completed
			if (user?.id && progress?.lessons) {
				const lessonProgress = progress.lessons.find(l => l.lesson_id === parseInt(lessonId));
				setIsCompleted(lessonProgress?.completed || false);
			} else {
				setIsCompleted(false);
			}
			
			// Update URL without navigation
			window.history.replaceState({}, '', `/courses/${courseId}?lesson=${lessonId}`);
		} catch (err) {
			console.error('Error loading lesson:', err);
			showToast('Eroare la încărcarea lecției', 'error');
		} finally {
			setCurrentLessonLoading(false);
		}
	};

	const handleLessonClick = (lessonId) => {
		setSelectedLessonId(lessonId);
		setSidebarOpen(false); // Close sidebar on mobile when selecting lesson
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const toggleModule = (moduleId) => {
		const newExpanded = new Set(expandedModules);
		if (newExpanded.has(moduleId)) {
			newExpanded.delete(moduleId);
		} else {
			newExpanded.add(moduleId);
		}
		setExpandedModules(newExpanded);
	};

	const getLessonProgress = (lessonId) => {
		if (!progress || !progress.lessons) return null;
		return progress.lessons.find(l => l.lesson_id === lessonId);
	};

	const isLessonCompleted = (lessonId) => {
		const lessonProgress = getLessonProgress(lessonId);
		return lessonProgress?.completed || false;
	};

	const getModuleProgress = (module) => {
		if (!progress || !module.lessons) return { completed: 0, total: 0, percentage: 0 };
		
		const total = module.lessons.length;
		const completed = module.lessons.filter(lesson => isLessonCompleted(lesson.id)).length;
		const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
		
		return { completed, total, percentage };
	};

	const getModuleCourseTests = (m) => m?.course_tests || m?.courseTests || [];
	const getLessonCourseTests = (l) => l?.course_tests || l?.courseTests || [];
	const getProgressModule = (moduleId) =>
		progress?.modules?.find((x) => Number(x.id) === Number(moduleId));
	const getLessonTestProgress = (moduleId, lessonId, testId) => {
		const mod = getProgressModule(moduleId);
		const les = mod?.lessons?.find((x) => Number(x.id) === Number(lessonId));
		return les?.tests?.find((t) => Number(t.test_id) === Number(testId));
	};
	const getModuleTestProgress = (moduleId, testId) => {
		const mod = getProgressModule(moduleId);
		return mod?.tests?.find((t) => Number(t.test_id) === Number(testId));
	};
	const getCourseLevelTestProgress = (testId) =>
		progress?.course_level_tests?.find((t) => Number(t.test_id) === Number(testId));

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
					const response = await courseProgressService.updateLessonProgress(selectedLessonId, {
						milestone,
						milestone_reached: milestone,
						progress_percentage: milestone,
						completed: milestone >= 100,
					});

					if (cancelled) return;

					if (response?.completed || response?.auto_completed || milestone >= 100) {
						setIsCompleted(true);
						if (user?.id) {
							try {
								const progressData = await courseProgressService.getCourseProgress(courseId);
								if (!cancelled) setProgress(progressData);
							} catch (progressErr) {
								console.log('Could not refresh progress');
							}
						}
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
	}, [selectedLessonId, reachedMilestones, courseId, user?.id]);

	// Auto-complete on scroll
	const handleAutoComplete = useCallback(async () => {
		if (isCompleting || isCompleted || !selectedLessonId) return;
		
		try {
			setIsCompleting(true);
			await lessonsService.complete(selectedLessonId);
			setIsCompleted(true);
			showToast('Lecția a fost marcată automat ca completată!', 'success');
			
			// Refresh progress
			if (user?.id) {
				try {
					const progressData = await courseProgressService.getCourseProgress(courseId);
					setProgress(progressData);
				} catch (err) {
					console.log('Could not refresh progress');
				}
			}
		} catch (err) {
			console.error('Error completing lesson:', err);
		} finally {
			setIsCompleting(false);
		}
	}, [selectedLessonId, isCompleting, isCompleted, courseId, user?.id, showToast]);

	// Auto-complete on scroll effect - only for the lesson we're actually viewing
	useEffect(() => {
		if (!currentLesson || isCompleted || isCompleting) return;
		// Must match: avoid completing the wrong lesson when switching (selectedLessonId updates before currentLesson)
		if (currentLesson.id !== selectedLessonId) return;

	
		const checkCompletion = () => {
			if (isCompleted || isCompleting) return;
			if (currentLesson?.id !== selectedLessonId) return;

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
		
		const checkInitial = setTimeout(() => {
			checkCompletion();
		}, 500);

		if (contentRef.current) {
			checkCompletion();
		}

		return () => {
			window.removeEventListener('scroll', throttledScroll);
			clearTimeout(checkInitial);
		};
	}, [currentLesson, selectedLessonId, isCompleted, isCompleting, reachedMilestones]);

	const handleNextLesson = () => {
		let foundCurrent = false;
		for (const module of modules) {
			const sortedLessons = (module.lessons || []).sort((a, b) => (a.order || 0) - (b.order || 0));
			for (const lesson of sortedLessons) {
				if (foundCurrent) {
					handleLessonClick(lesson.id);
					return;
				}
				if (Number(lesson.id) === Number(selectedLessonId)) {
					foundCurrent = true;
				}
			}
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
			if (selectedLessonId && !isCompleted) {
				await lessonsService.complete(selectedLessonId);
				setIsCompleted(true);
			}
			const p = await courseProgressService.getCourseProgress(courseId);
			setProgress(p);
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
			<div className="lessons-page-modern">
				<div className="lessons-page-loading">
					<div className="lessons-page-spinner"></div>
					<p>Se încarcă cursul...</p>
				</div>
			</div>
		);
	}

	if (error || !course) {
		return (
			<div className="lessons-page-modern">
				<div className="lessons-page-error">
					<div className="lessons-page-error-icon">⚠️</div>
					<h2>Eroare</h2>
					<p>{error || 'Cursul nu a fost găsit'}</p>
					<button
						className="lessons-page-btn lessons-page-btn-primary"
						onClick={() => navigate('/courses')}
					>
						Înapoi la cursuri
					</button>
				</div>
			</div>
		);
	}

	const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0);
	const nextLessonTarget = selectedLessonId ? getNextLessonIdAfter(modules, selectedLessonId) : undefined;
	const isLastLessonInCourse = nextLessonTarget === null;

	return (
		<div className={`lessons-page-modern lessons-page-player-layout ${sidebarOpen ? 'lessons-page-sidebar-open' : ''}`}>
			<CourseCongratulationsModal
				open={showCourseCongrats}
				courseTitle={course?.title}
				onClose={handleCongratsClose}
			/>
			{/* Mobile overlay when sidebar open */}
			{sidebarOpen && (
				<div 
					className="lessons-page-sidebar-overlay" 
					onClick={() => setSidebarOpen(false)}
					aria-hidden="true"
				/>
			)}
			{/* Sidebar - Lessons Menu */}
			<aside className="lessons-page-sidebar">
				<div className="lessons-page-sidebar-header">
					<div className="lessons-page-sidebar-header-actions">
						<button 
							className="lessons-page-sidebar-back-btn"
							onClick={() => navigate(-1)}
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M19 12H5M12 19l-7-7 7-7"/>
							</svg>
							<span>Înapoi</span>
						</button>
						<button 
							className="lessons-page-sidebar-close-btn"
							onClick={() => setSidebarOpen(false)}
							aria-label="Închide meniul"
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M18 6L6 18M6 6l12 12"/>
							</svg>
						</button>
					</div>
					<h2 className="lessons-page-sidebar-title">{course.title}</h2>
					{progress && (
						<div className="lessons-page-sidebar-progress">
							<div className="lessons-page-sidebar-progress-bar">
								<div 
									className="lessons-page-sidebar-progress-fill" 
									style={{ width: `${progress.progress_percentage || 0}%` }}
								></div>
							</div>
							<span className="lessons-page-sidebar-progress-text">
								{progress.progress_percentage || 0}% completat
							</span>
						</div>
					)}
				</div>

				<div className="lessons-page-sidebar-content">
					{modules.length > 0 ? (
						<div className="lessons-page-sidebar-modules">
							{modules.map((module, moduleIndex) => {
								const isModuleExpanded = expandedModules.has(module.id);
								const moduleProgress = getModuleProgress(module);
								const sortedLessons = (module.lessons || []).sort((a, b) => (a.order || 0) - (b.order || 0));
								const isActive = selectedLessonId && sortedLessons.some(l => l.id === selectedLessonId);
								
								return (
									<div key={module.id} className={`lessons-page-sidebar-module ${isActive ? 'active' : ''}`}>
										<button
											type="button"
											className={`lessons-page-sidebar-module-header ${isModuleExpanded ? 'expanded' : ''}`}
											onClick={() => toggleModule(module.id)}
										>
											<div className="lessons-page-sidebar-module-info">
												<span className="lessons-page-sidebar-module-number">
													{module.isRootLessonGroup ? '•' : moduleIndex + 1}
												</span>
												<span className="lessons-page-sidebar-module-title">
													{module.isRootLessonGroup ? 'Lecții fără modul' : module.title}
												</span>
											</div>
											<svg 
												className={`lessons-page-sidebar-module-arrow ${isModuleExpanded ? 'expanded' : ''}`}
												width="16" 
												height="16" 
												viewBox="0 0 24 24" 
												fill="none" 
												stroke="currentColor" 
												strokeWidth="2"
											>
												<path d="M6 9l6 6 6-6"/>
											</svg>
										</button>

										{isModuleExpanded && (
											<div className="lessons-page-sidebar-lessons">
												{sortedLessons.map((lesson, lessonIndex) => {
													const isCompleted = isLessonCompleted(lesson.id);
													const isActive = selectedLessonId === lesson.id;
													const lessonTests = getLessonCourseTests(lesson);

													return (
														<Fragment key={lesson.id}>
															<button
																type="button"
																className={`lessons-page-sidebar-lesson ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
																onClick={() => handleLessonClick(lesson.id)}
															>
																<div className="lessons-page-sidebar-lesson-icon">
																	{isCompleted ? (
																		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
																			<path d="M20 6L9 17l-5-5"/>
																		</svg>
																	) : (
																		<span>{lessonIndex + 1}</span>
																	)}
																</div>
																<span className="lessons-page-sidebar-lesson-title">{lesson.title}</span>
															</button>
															{lessonTests.map((ct) => {
																const testId = ct.test_id ?? ct.test?.id;
																if (!testId) return null;
																const tp = getLessonTestProgress(module.id, lesson.id, testId);
																const passed = Boolean(tp?.passed);
																return (
																	<button
																		key={`lesson-${lesson.id}-test-${testId}`}
																		type="button"
																		className={`lessons-page-sidebar-lesson lessons-page-sidebar-test lessons-page-sidebar-nested-test ${passed ? 'completed' : ''}`}
																		onClick={() => navigate(`/courses/${courseId}/exams/${testId}`)}
																	>
																		<div className="lessons-page-sidebar-lesson-icon">{passed ? '✓' : '📝'}</div>
																		<span className="lessons-page-sidebar-lesson-title">
																			{ct.test?.title || 'Test'}
																			{ct.required ? ' *' : ''}
																		</span>
																	</button>
																);
															})}
														</Fragment>
													);
												})}
												{/* Module-level tests (API: course_tests snake_case) */}
												{getModuleCourseTests(module).map((ct) => {
													const testId = ct.test_id ?? ct.test?.id;
													if (!testId) return null;
													const tp = getModuleTestProgress(module.id, testId);
													const passed = Boolean(tp?.passed);
													return (
														<button
															key={`mod-test-${testId}`}
															type="button"
															className={`lessons-page-sidebar-lesson lessons-page-sidebar-test ${passed ? 'completed' : ''}`}
															onClick={() => navigate(`/courses/${courseId}/exams/${testId}`)}
														>
															<div className="lessons-page-sidebar-lesson-icon">{passed ? '✓' : '📝'}</div>
															<span className="lessons-page-sidebar-lesson-title">
																{ct.test?.title || 'Test'}
																{ct.required ? ' *' : ''}
															</span>
														</button>
													);
												})}
											</div>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="lessons-page-sidebar-empty">
							<p>Nu există lecții disponibile</p>
						</div>
					)}
					{/* Course-level tests */}
					{Array.isArray(course?.exams) && course.exams.filter((e) => !e.module_id).length > 0 && (
						<div className="lessons-page-sidebar-tests-section">
							<div className="lessons-page-sidebar-tests-header">Teste la nivel de curs</div>
							<p className="lessons-page-sidebar-tests-hint">Legate de acest curs (nu examene independente)</p>
							{course.exams.filter((e) => !e.module_id).map((exam) => {
								const tp = getCourseLevelTestProgress(exam.id);
								const passed = Boolean(tp?.passed);
								return (
									<button
										key={exam.id}
										type="button"
										className={`lessons-page-sidebar-lesson lessons-page-sidebar-test ${passed ? 'completed' : ''}`}
										onClick={() => navigate(`/courses/${courseId}/exams/${exam.id}`)}
									>
										<div className="lessons-page-sidebar-lesson-icon">{passed ? '✓' : '📝'}</div>
										<span className="lessons-page-sidebar-lesson-title">
											{exam.title || 'Test'}
											{exam.required ? ' *' : ''}
										</span>
									</button>
								);
							})}
						</div>
					)}
				</div>
			</aside>

			{/* Main Content - Lesson Viewer */}
			<main className="lessons-page-main-content">
				{/* Mobile: toggle sidebar button */}
				<button
					type="button"
					className="lessons-page-sidebar-toggle"
					onClick={() => setSidebarOpen(true)}
					aria-label="Deschide meniul lecțiilor"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<line x1="3" y1="6" x2="21" y2="6"/>
						<line x1="3" y1="12" x2="21" y2="12"/>
						<line x1="3" y1="18" x2="21" y2="18"/>
					</svg>
					<span>Lecții</span>
				</button>
				{currentLessonLoading ? (
					<div className="lessons-page-lesson-loading">
						<div className="lessons-page-spinner"></div>
						<p>Se încarcă lecția...</p>
					</div>
				) : currentLesson ? (
					<div className="lessons-page-lesson-viewer">
						{/* Lesson Header */}
						<div className="lessons-page-lesson-header">
							<h1 className="lessons-page-lesson-viewer-title">{currentLesson.title}</h1>
							{currentLesson.description && (
								<p className="lessons-page-lesson-viewer-description">{currentLesson.description}</p>
							)}
							<div className="lessons-page-lesson-viewer-meta">
								{isCompleted && (
									<div className="lessons-page-lesson-completed-badge">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M20 6L9 17l-5-5"/>
										</svg>
										<span>Completată</span>
									</div>
								)}
							</div>
						</div>

						{/* Lesson Content */}
						<div className="lessons-page-lesson-body" ref={contentRef}>
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
								const blocks = Array.isArray(currentLesson.content_blocks) ? currentLesson.content_blocks : Array.isArray(currentLesson.contentBlocks) ? currentLesson.contentBlocks : [];
								const hasBlocks = blocks.length > 0;
								const hasLegacyContent = currentLesson.content && currentLesson.content.trim().length > 0;

								if (hasBlocks) {
									return (
										<div className="lessons-page-lesson-blocks">
											<LessonBlocksPreview blocks={blocks} variant="student" />
										</div>
									);
								}
								if (hasLegacyContent) {
									return (
										<div
											className="lessons-page-lesson-content-text"
											dangerouslySetInnerHTML={{ __html: normalizeRichTextMediaHtml(currentLesson.content) }}
										/>
									);
								}
								return (
									<div className="lessons-page-empty-content">
										<div className="lessons-page-empty-icon">
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

						{/* Lesson Actions */}
						<div className="lessons-page-lesson-actions">
							<button
								className="lessons-page-btn lessons-page-btn-secondary"
								type="button"
								disabled={finalizingCourse}
								onClick={isLastLessonInCourse ? handleFinalizeCourse : handleNextLesson}
								style={{ background: '#FFEE00', color: '#000', borderColor: '#FFEE00' }}
							>
								{isLastLessonInCourse ? (
									finalizingCourse ? (
										<span>Se procesează…</span>
									) : (
										<>
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M20 6L9 17l-5-5"/>
											</svg>
											<span>Finalizează</span>
										</>
									)
								) : (
									<>
										<span>Următoarea lecție</span>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M5 12h14M12 5l7 7-7 7"/>
										</svg>
									</>
								)}
							</button>
						</div>
					</div>
				) : (
					<div className="lessons-page-no-lesson">
						<div className="lessons-page-empty-icon">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
							</svg>
						</div>
						<h3>Selectează o lecție</h3>
						<p>Selectează o lecție din meniul din stânga pentru a începe.</p>
					</div>
				)}
			</main>
		</div>
	);
};

export default LessonsPage;
