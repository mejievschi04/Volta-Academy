import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseCoverSrc } from '../utils/imageUrl';
import { coursesService, courseProgressService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import '../styles/course-detail-modern.css';

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
			courseTests: [],
			isRootLessonGroup: true,
		},
		...sortedModules,
	];
};

const CourseDetailPage = () => {
	const { courseId } = useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { showToast } = useToast();
	
	const [course, setCourse] = useState(null);
	const [modules, setModules] = useState([]);
	const [progress, setProgress] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isEnrolled, setIsEnrolled] = useState(false);

	useEffect(() => {
		if (courseId) {
			fetchCourseData();
		}
	}, [courseId]);

	const fetchCourseData = async () => {
		try {
			setLoading(true);
			setError(null);
			
			const courseData = await coursesService.getById(courseId);
			setCourse(courseData);
			
			setModules(normalizeCourseModules(courseData));
			
			// Check if user is enrolled and fetch progress
			if (user?.id) {
				try {
					const progressData = await courseProgressService.getCourseProgress(courseId);
					setProgress(progressData);
					setIsEnrolled(true);
				} catch (err) {
					// User is not enrolled
					setIsEnrolled(false);
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

	const handleEnroll = async () => {
		try {
			const response = await courseProgressService.enrollCourse(courseId);
			setIsEnrolled(true);
			setProgress(response?.progress || null);
			showToast(response?.message || 'Te-ai inscris la curs cu succes!', 'success');
		} catch (err) {
			console.error('Error enrolling:', err);
			const message = err?.response?.data?.message || err?.message || 'Eroare la inscrierea la curs';
			showToast(message, 'error');
		}
	};

	const handleStartCourse = () => {
		if (isEnrolled) {
			navigate(`/courses/${courseId}`);
		} else {
			handleEnroll();
		}
	};

	const handleShareCourse = useCallback(async () => {
		const url = typeof window !== 'undefined' ? window.location.href : '';
		const title = course?.title || 'Curs';
		try {
			if (typeof navigator !== 'undefined' && navigator.share) {
				await navigator.share({ title, text: title, url });
				showToast('Conținut partajat.', 'success');
				return;
			}
		} catch (e) {
			if (e && e.name === 'AbortError') return;
		}
		try {
			await navigator.clipboard.writeText(url);
			showToast('Link copiat în clipboard!', 'success');
		} catch {
			showToast('Nu am putut copia linkul.', 'error');
		}
	}, [course?.title, showToast]);

	if (loading) {
		return (
			<div className="course-detail-page">
				<div className="course-detail-loading">
					<div className="va-spinner va-spinner-lg"></div>
					<p>Se încarcă cursul...</p>
				</div>
			</div>
		);
	}

	const getModuleAssessmentRows = (module) => module?.courseTests || module?.course_tests || [];

	if (error || !course) {
		return (
			<div className="course-detail-page">
				<div className="va-empty-state" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
					<p style={{ color: 'var(--color-error)', marginBottom: 'var(--space-4)' }}>{error || 'Cursul nu a fost găsit'}</p>
					<button className="lms-btn-primary" onClick={() => navigate('/courses')}>
						← Înapoi la Cursuri
					</button>
				</div>
			</div>
		);
	}

	const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length || 0), 0);
	const realModulesCount = Array.isArray(course?.modules) ? course.modules.length : 0;
	// Include both module-level and course-level tests (course.exams from API)
	const totalTests = course?.exams?.length ?? modules.reduce((sum, module) => sum + (module.courseTests?.length || 0), 0);
	const detailCoverSrc = courseCoverSrc(course);

	return (
		<div className="course-detail-page">
			{/* Hero Section */}
			<div className="course-detail-hero">
				<div className="course-detail-hero-background">
					{detailCoverSrc && (
						<img src={detailCoverSrc} alt={course.title} className="course-detail-hero-image" loading="lazy" decoding="async" />
					)}
					<div className="course-detail-hero-overlay"></div>
				</div>
				
				<div className="course-detail-hero-content">
					<button 
						className="course-detail-back-btn"
						onClick={() => navigate(-1)}
					>
						← Înapoi
					</button>
					
					<div className="course-detail-hero-main">
						<div className="course-detail-hero-left">
							{/* Status Badge - only draft (published courses don't need a badge) */}
							{course.status && course.status !== 'published' && (
								<div className="course-detail-status-badge">
									{course.status === 'draft' && <span className="course-status-badge draft">Ciornă</span>}
								</div>
							)}
							
							{/* Title */}
							<h1 className="course-detail-title">{course.title}</h1>
							
							{/* Short Description */}
							{course.short_description && (
								<p className="course-detail-subtitle">{course.short_description}</p>
							)}
							
							{/* Meta Info */}
							<div className="course-detail-meta">
								{course.teacher && (
									<div className="course-detail-meta-item">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
											<circle cx="12" cy="7" r="4"/>
										</svg>
										<span>{course.teacher.name || course.teacher.email}</span>
									</div>
								)}
								
								<div className="course-detail-meta-item">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M4 19.5C4 18.6716 4.67157 18 5.5 18H20M4 19.5C4 20.3284 4.67157 21 5.5 21H20M4 19.5V4.5C4 3.67157 4.67157 3 5.5 3H20V18M20 18V21M9 7H15M9 11H15M9 15H12"/>
									</svg>
									<span>{realModulesCount} {realModulesCount === 1 ? 'modul' : 'module'}</span>
								</div>
								
								<div className="course-detail-meta-item">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
										<line x1="16" y1="13" x2="8" y2="13"/>
										<line x1="16" y1="17" x2="8" y2="17"/>
										<polyline points="10 9 9 9 8 9"/>
									</svg>
									<span>{totalLessons} {totalLessons === 1 ? 'lecție' : 'lecții'}</span>
								</div>
								
								{course.level && (
									<div className="course-detail-meta-item">
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
										</svg>
										<span>{course.level.charAt(0).toUpperCase() + course.level.slice(1)}</span>
									</div>
								)}
							</div>
							
							{/* Progress (if enrolled) */}
							{isEnrolled && progress && (
								<div className="course-detail-progress">
									<div className="course-detail-progress-header">
										<span>Progres</span>
										<span>{progress.progress_percentage || 0}%</span>
									</div>
									<div className="course-detail-progress-bar">
										<div 
											className="course-detail-progress-fill" 
											style={{ width: `${progress.progress_percentage || 0}%` }}
										></div>
									</div>
								</div>
							)}
							
							{/* Action Buttons */}
							<div className="course-detail-actions">
								{isEnrolled ? (
									<button 
										className="lms-btn-primary course-detail-action-btn"
										onClick={handleStartCourse}
									>
										{progress && (progress.progress_percentage >= 100 || progress.course_complete)
											? 'Vezi cursul'
											: progress && progress.progress_percentage > 0
												? 'Continuă cursul'
												: 'Începe cursul'}
									</button>
								) : (
									<button 
										className="lms-btn-primary course-detail-action-btn"
										onClick={handleEnroll}
									>
										Înscrie-te la curs
									</button>
								)}
								
								<button 
									type="button"
									className="lms-btn-secondary course-detail-action-btn"
									onClick={handleShareCourse}
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
										<polyline points="16 6 12 2 8 6"/>
										<line x1="12" y1="2" x2="12" y2="15"/>
									</svg>
									Distribuie
								</button>
							</div>
						</div>
						
						{/* Thumbnail */}
						<div className="course-detail-hero-right">
							{detailCoverSrc ? (
								<img src={detailCoverSrc} alt={course.title} className="course-detail-thumbnail" loading="lazy" decoding="async" />
							) : (
								<div className="course-detail-thumbnail-placeholder">
									<span>📚</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="course-detail-content">
				<div className="course-detail-content-main">
					{/* Description */}
					{course.description && (
						<div className="course-detail-section">
							<h2 className="course-detail-section-title">Despre curs</h2>
							<div className="course-detail-description">
								{course.description.split('\n').map((paragraph, index) => (
									<p key={index}>{paragraph}</p>
								))}
							</div>
						</div>
					)}

					{/* Curriculum */}
					{modules.length > 0 && (
						<div className="course-detail-section">
							<h2 className="course-detail-section-title">Curriculum</h2>
							<div className="course-detail-curriculum">
								{modules.map((module, moduleIndex) => {
									const moduleTests = getModuleAssessmentRows(module);
									return (
									<div key={module.id} className="course-detail-module">
										<div className="course-detail-module-header">
											<div className="course-detail-module-info">
												<span className="course-detail-module-number">
													{module.isRootLessonGroup ? 'Lecții' : `Modul ${moduleIndex + 1}`}
												</span>
												<h3 className="course-detail-module-title">{module.title}</h3>
												{module.description && (
													<p className="course-detail-module-description">{module.description}</p>
												)}
											</div>
											<div className="course-detail-module-stats">
												<span>{module.lessons?.length || 0} {module.lessons?.length === 1 ? 'lecție' : 'lecții'}</span>
												{moduleTests.length > 0 && (
													<span>
														• {moduleTests.length}{' '}
														{moduleTests.length === 1 ? 'test' : 'teste'}
													</span>
												)}
											</div>
										</div>
										
										{/* Lessons */}
										{module.lessons && module.lessons.length > 0 && (
											<div className="course-detail-lessons">
												{module.lessons.map((lesson, lessonIndex) => (
													<div key={lesson.id} className="course-detail-lesson">
														<div className="course-detail-lesson-number">{lessonIndex + 1}</div>
														<div className="course-detail-lesson-content">
															<h4 className="course-detail-lesson-title">{lesson.title}</h4>
															{lesson.description && (
																<p className="course-detail-lesson-description">{lesson.description}</p>
															)}
														</div>
													</div>
												))}
											</div>
										)}
										
										{/* Tests (module-level: CourseTest + examene legacy pe modul) */}
										{moduleTests.length > 0 && (
											<div className="course-detail-tests">
												{moduleTests.map((ct) => (
													<div key={ct.id || ct.test_id} className="course-detail-test va-card-shell va-card-shell--interactive">
														<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
															<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"/>
														</svg>
														<span className="course-detail-test-title">{ct.test?.title || 'Test'}</span>
														<svg className="course-detail-test-action" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
															<path d="M5 12h14M12 5l7 7-7 7" />
														</svg>
													</div>
												))}
											</div>
										)}
									</div>
									);
								})}
								{/* Course-level tests (scope=course, not in any module) */}
								{Array.isArray(course?.exams) && course.exams.filter((e) => !e.module_id).length > 0 && (
									<div className="course-detail-module course-detail-module-tests">
										<div className="course-detail-module-header">
											<div className="course-detail-module-info">
												<span className="course-detail-module-number">Evaluări</span>
												<h3 className="course-detail-module-title">Examene și teste</h3>
												<p className="course-detail-module-tests-lead">
													Parcurgerea lecțiilor este cursul; acestea sunt verificări separate (nu un „curs în curs”).
												</p>
											</div>
										</div>
										<div className="course-detail-tests">
											{course.exams.filter((e) => !e.module_id).map((exam) => (
												<div key={exam.id} className="course-detail-test va-card-shell va-card-shell--interactive">
													<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"/>
													</svg>
													<span className="course-detail-test-title">{exam.title || 'Test'}</span>
													<svg className="course-detail-test-action" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
														<path d="M5 12h14M12 5l7 7-7 7" />
													</svg>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Sidebar */}
				<div className="course-detail-sidebar">
					{/* Course Info Card */}
					<div className="course-detail-info-card">
						<h3 className="course-detail-info-card-title">Informații curs</h3>
						<div className="course-detail-info-list">
							<div className="course-detail-info-item">
								<span className="course-detail-info-label">Instructor</span>
								<span className="course-detail-info-value">
									{course.teacher?.name || course.teacher?.email || 'N/A'}
								</span>
							</div>
							
							<div className="course-detail-info-item">
								<span className="course-detail-info-label">Nivel</span>
								<span className="course-detail-info-value">
									{course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : 'N/A'}
								</span>
							</div>
							
							<div className="course-detail-info-item">
								<span className="course-detail-info-label">Module</span>
								<span className="course-detail-info-value">{modules.length}</span>
							</div>
							
							<div className="course-detail-info-item">
								<span className="course-detail-info-label">Lecții</span>
								<span className="course-detail-info-value">{totalLessons}</span>
							</div>
							
							{totalTests > 0 && (
								<div className="course-detail-info-item">
									<span className="course-detail-info-label">Teste</span>
									<span className="course-detail-info-value">{totalTests}</span>
								</div>
							)}
							
							{course.reward_points && (
								<div className="course-detail-info-item">
									<span className="course-detail-info-label">Puncte</span>
									<span className="course-detail-info-value">{course.reward_points}</span>
								</div>
							)}
						</div>
					</div>

					{/* Enroll/Start Button (sticky) */}
					<div className="course-detail-sidebar-actions">
						{isEnrolled ? (
							<button 
								className="lms-btn-primary course-detail-sidebar-btn"
								onClick={handleStartCourse}
							>
								{progress && (progress.progress_percentage >= 100 || progress.course_complete)
									? 'Vezi cursul'
									: progress && progress.progress_percentage > 0
										? 'Continuă cursul'
										: 'Începe cursul'}
							</button>
						) : (
							<button 
								className="lms-btn-primary course-detail-sidebar-btn"
								onClick={handleEnroll}
							>
								Înscrie-te la curs
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseDetailPage;
