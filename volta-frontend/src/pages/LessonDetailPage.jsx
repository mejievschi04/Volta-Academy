import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { lessonsService, coursesService, dashboardService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const LessonDetailPage = () => {
	const { courseId, lessonId } = useParams();
	const { user } = useAuth();
	const [lesson, setLesson] = useState(null);
	const [course, setCourse] = useState(null);
	const [progress, setProgress] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [completed, setCompleted] = useState(false);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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
					user ? dashboardService.getProgress(courseId, user.id).catch(() => null) : null
				]);
				setLesson(lessonData);
				setCourse(courseData);
				setProgress(progressData);
				
				// Automatically mark lesson as completed when viewed
				try {
					await lessonsService.complete(lessonId);
					setCompleted(true);
				} catch (err) {
					console.error('Error completing lesson:', err);
				}
			} catch (err) {
				console.error('Error fetching data:', err);
				setError('Lecția nu a fost găsită');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [lessonId, courseId, user]);

	// Get all lessons (modules) from course
	const allLessons = useMemo(() => {
		if (!course) return [];
		return (course.lessons || []).sort((a, b) => (a.order || 0) - (b.order || 0));
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
			gap: '2rem',
			maxWidth: '1600px',
			margin: '0 auto',
			padding: isMobile ? '1rem' : '2rem',
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
										
										return (
											<Link
												key={l.id}
												to={`/courses/${courseId}/lessons/${l.id}`}
												style={{
													display: 'flex',
													alignItems: 'center',
													gap: '0.75rem',
													padding: '0.875rem 1rem',
													background: isCurrent 
														? 'linear-gradient(135deg, rgba(255,238,0,0.15), rgba(255,238,0,0.1))'
														: 'rgba(255,255,255,0.03)',
													border: `1px solid ${isCurrent ? 'rgba(255,238,0,0.4)' : 'rgba(255,238,0,0.15)'}`,
													borderRadius: '12px',
													textDecoration: 'none',
													color: 'var(--va-text)',
													transition: 'all 0.2s ease',
													position: 'relative',
													opacity: 1,
													cursor: 'pointer',
													pointerEvents: 'auto'
												}}
												onMouseEnter={(e) => {
													if (!isCurrent) {
														e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))';
														e.currentTarget.style.borderColor = 'rgba(255,238,0,0.3)';
														e.currentTarget.style.transform = 'translateX(4px)';
													}
												}}
												onMouseLeave={(e) => {
													if (!isCurrent) {
														e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
														e.currentTarget.style.borderColor = 'rgba(255,238,0,0.15)';
														e.currentTarget.style.transform = 'translateX(0)';
													}
												}}
											>
												<div style={{
													width: '32px',
													height: '32px',
													borderRadius: '8px',
													background: isCompleted
														? 'linear-gradient(135deg, #ffee00, #ffd700)'
														: isCurrent
															? 'rgba(255,238,0,0.2)'
															: 'rgba(255,238,0,0.1)',
													border: isCurrent ? '2px solid rgba(255,238,0,0.4)' : '1px solid rgba(255,238,0,0.2)',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													fontSize: '0.85rem',
													fontWeight: 700,
													color: isCompleted ? '#000' : 'var(--va-primary)',
													flexShrink: 0
												}}>
													{isCompleted ? '✓' : index + 1}
												</div>
												<div style={{ flex: 1, minWidth: 0 }}>
													<div style={{
														fontSize: '0.9rem',
														fontWeight: isCurrent ? 700 : 600,
														marginBottom: '0.25rem',
														color: isCurrent ? 'var(--va-primary)' : 'var(--va-text)',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap'
													}}>
														{l.title || `Modul ${index + 1}`}
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

			{/* Main Content */}
			<div className="va-stack" style={{ flex: 1, maxWidth: sidebarOpen && !isMobile ? 'calc(100% - 360px)' : '100%', minWidth: 0 }}>
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
						{course?.title || 'Curs'}
					</Link>
					<span style={{ color: 'var(--va-muted)', fontSize: '1.2rem' }}>/</span>
					<span style={{ color: 'var(--va-primary)', fontWeight: 600 }}>
						{lesson.title || `Modul ${currentLessonIndex + 1}`}
					</span>
				</div>

				{completed && (
					<div style={{
						background: 'linear-gradient(135deg, rgba(255,238,0,0.15), rgba(255,238,0,0.1))',
						border: '1px solid rgba(255,238,0,0.35)',
						borderRadius: '16px',
						padding: '1.25rem 1.5rem',
						marginBottom: '2rem',
						display: 'flex',
						alignItems: 'center',
						gap: '1rem',
						boxShadow: '0 4px 16px rgba(255,238,0,0.15)'
					}}>
						<div style={{
							width: '40px',
							height: '40px',
							borderRadius: '12px',
							background: 'linear-gradient(135deg, #ffee00, #ffd700)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '1.5rem',
							color: '#000',
							fontWeight: 700,
							boxShadow: '0 4px 12px rgba(255,238,0,0.3)'
						}}>
							✓
						</div>
						<div>
							<div style={{ color: 'var(--va-primary)', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
								Modul completat!
							</div>
							<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem' }}>
								Ai finalizat cu succes acest modul
							</div>
						</div>
					</div>
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
			
				{lesson.video_url && (
					<div style={{
						marginBottom: '2.5rem',
						borderRadius: '20px',
						overflow: 'hidden',
						boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
						border: '1px solid rgba(255,238,0,0.2)'
					}}>
						<video 
							controls 
							style={{ width: '100%', maxHeight: '600px', display: 'block' }}
							src={lesson.video_url}
						>
							Browser-ul tău nu suportă tag-ul video.
						</video>
					</div>
				)}
			
				<div className="va-prose" style={{
					background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
					border: '1px solid rgba(255,238,0,0.25)',
					borderRadius: '20px',
					padding: '2.5rem',
					lineHeight: 1.9,
					color: 'var(--va-text)',
					boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset',
					fontSize: '1.05rem'
				}}>
					<div style={{ whiteSpace: 'pre-wrap' }}>{lesson.content}</div>
				</div>

				{lesson.resources && lesson.resources.length > 0 && (
					<div style={{
						background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
						border: '1px solid rgba(255,238,0,0.25)',
						borderRadius: '20px',
						padding: '2rem',
						marginTop: '2.5rem',
						boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.1) inset'
					}}>
						<h3 style={{
							color: 'var(--va-text)',
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
							{lesson.resources.map((resource, idx) => (
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
										border: '1px solid rgba(255,238,0,0.18)',
										borderRadius: '16px',
										textDecoration: 'none',
										color: 'var(--va-text)',
										transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
										position: 'relative',
										overflow: 'hidden'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))';
										e.currentTarget.style.borderColor = 'rgba(255,238,0,0.35)';
										e.currentTarget.style.transform = 'translateX(6px)';
										e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,238,0,0.15)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
										e.currentTarget.style.borderColor = 'rgba(255,238,0,0.18)';
										e.currentTarget.style.transform = 'translateX(0)';
										e.currentTarget.style.boxShadow = 'none';
									}}
								>
									<div style={{
										width: '44px',
										height: '44px',
										borderRadius: '12px',
										background: 'rgba(255,238,0,0.12)',
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
											<div style={{ color: 'var(--va-muted)', fontSize: '0.85rem' }}>
												{typeof resource.url === 'string' ? resource.url : 'Link resursă'}
											</div>
										)}
									</div>
									<span style={{ color: 'var(--va-muted)', fontSize: '1.2rem' }}>→</span>
								</a>
							))}
						</div>
					</div>
				)}

				<div className="va-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
						{currentLessonIndex > 0 && (
							<Link 
								to={`/courses/${courseId}/lessons/${allLessons[currentLessonIndex - 1].id}`}
								className="va-btn va-btn-secondary"
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '0.5rem',
									padding: '0.875rem 1.75rem',
									borderRadius: '12px',
									fontWeight: 600,
									transition: 'all 0.3s ease'
								}}
							>
								<span>←</span>
								<span>Modulul anterior</span>
							</Link>
						)}
						{currentLessonIndex < allLessons.length - 1 && (
							<Link 
								to={`/courses/${courseId}/lessons/${allLessons[currentLessonIndex + 1].id}`}
								className="va-btn va-btn-primary"
								style={{
									color: '#000000',
									display: 'inline-flex',
									alignItems: 'center',
									gap: '0.5rem',
									padding: '0.875rem 1.75rem',
									borderRadius: '12px',
									fontWeight: 600,
									background: 'linear-gradient(135deg, #ffee00, #ffd700)',
									boxShadow: '0 4px 16px rgba(255,238,0,0.3)',
									transition: 'all 0.3s ease'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.transform = 'translateY(-2px)';
									e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,238,0,0.4)';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,238,0,0.3)';
								}}
							>
								<span>Modulul următor</span>
								<span>→</span>
							</Link>
						)}
						{currentLessonIndex === allLessons.length - 1 && (
							<Link 
								to={`/courses/${courseId}/quiz`}
								className="va-btn va-btn-primary"
								style={{
									color: '#000000',
									display: 'inline-flex',
									alignItems: 'center',
									gap: '0.5rem',
									padding: '0.875rem 1.75rem',
									borderRadius: '12px',
									fontWeight: 600,
									background: 'linear-gradient(135deg, #ffee00, #ffd700)',
									boxShadow: '0 4px 16px rgba(255,238,0,0.3)',
									transition: 'all 0.3s ease'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.transform = 'translateY(-2px)';
									e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,238,0,0.4)';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,238,0,0.3)';
								}}
							>
								<span>📝</span>
								<span>Mergi la test final</span>
							</Link>
						)}
					</div>
					<Link 
						to={`/courses/${courseId}`}
						className="va-btn va-btn-secondary"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.5rem',
							padding: '0.875rem 1.75rem',
							borderRadius: '12px',
							fontWeight: 600,
							transition: 'all 0.3s ease'
						}}
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

