import React, { useState, useEffect } from 'react';
import { adminService } from '../../../../services/api';
import { useToast } from '../../../../contexts/ToastContext';
import { logger } from '../../../../utils/logger';
import { handleApiError } from '../../../../utils/errorHandler';
import NoDeadEndFallback from '../../../common/NoDeadEndFallback';
import LessonEditModal from '../LessonEditModal';

const CourseBuilderStep3 = ({ courseId, data, onUpdate, errors }) => {
	const { error: showError } = useToast();
	const [editingLesson, setEditingLesson] = useState(null);
	const [editingModuleId, setEditingModuleId] = useState(null);
	const [showEditModal, setShowEditModal] = useState(false);
	const [editingModuleTitle, setEditingModuleTitle] = useState({}); // { moduleId: title }
	const modules = data.modules || [];

	// Debug: Log modules and lessons
	useEffect(() => {
		logger.debug('Step3Content - Modules:', modules);
		logger.debug('Step3Content - Total lessons:', modules.reduce((sum, m) => sum + (m.lessons?.filter(l => l).length || 0), 0));
		modules.forEach((module, idx) => {
			const validLessons = module.lessons?.filter(l => l) || [];
			logger.debug(`Module ${idx}:`, module.title, 'Lessons:', validLessons.length, validLessons);
		});
	}, [modules]);


	const handleEditLesson = (moduleId, lesson) => {
		if (!lesson) {
			console.error('Cannot edit lesson: lesson is null or undefined');
			return;
		}
		console.log('Editing lesson:', lesson);
		setEditingLesson(lesson);
		setEditingModuleId(moduleId);
		setShowEditModal(true);
	};

	const handleSaveLesson = async (lessonData) => {
		try {
			const updateData = {
				title: lessonData.title.trim(),
				description: lessonData.description || '',
				content_type: lessonData.content_type || 'text',
				content: lessonData.content || '',
				video_url: lessonData.video_url || null,
				pdf_url: lessonData.pdf_url || null,
				duration_minutes: lessonData.duration_minutes || null,
				is_preview: lessonData.is_preview || false,
				is_locked: lessonData.is_locked || false,
			};

			if (courseId && lessonData.id && !lessonData.id.toString().startsWith('temp-')) {
				// Update existing lesson via API
				const updated = await adminService.updateLesson(lessonData.id, updateData);
				const updatedModules = modules.map(m => {
					if (m.id === editingModuleId) {
						return {
							...m,
							lessons: (m.lessons || []).map(l => 
								l.id === lessonData.id ? (updated.lesson || updated) : l
							),
						};
					}
					return m;
				});
				onUpdate({ modules: updatedModules });
			} else {
				// Update temporary lesson in state
				const updatedModules = modules.map(m => {
					if (m.id === editingModuleId) {
						return {
							...m,
							lessons: (m.lessons || []).map(l => 
								l.id === lessonData.id ? { ...l, ...updateData } : l
							),
						};
					}
					return m;
				});
				onUpdate({ modules: updatedModules });
			}
			setShowEditModal(false);
			setEditingLesson(null);
			setEditingModuleId(null);
		} catch (err) {
			const errorMessage = handleApiError(err, 'updateLesson');
			showError('Eroare la actualizarea lecției: ' + errorMessage);
		}
	};

	const handleChangeLessonType = async (moduleId, lessonId, newType) => {
		try {
			console.log('handleChangeLessonType called:', { moduleId, lessonId, newType });
			
			// Find module by exact match
			const moduleIndex = modules.findIndex(m => {
				if (m.id && moduleId) {
					return m.id.toString() === moduleId.toString();
				}
				// If no IDs, match by index from key (e.g., "module-0")
				if (moduleId?.toString().startsWith('module-')) {
					const idx = parseInt(moduleId.toString().split('-')[1]);
					return modules.indexOf(m) === idx;
				}
				return false;
			});
			
			if (moduleIndex === -1) {
				console.error('Module not found:', moduleId);
				return;
			}
			
			const module = modules[moduleIndex];
			
			// Find lesson by exact match - use index from lessonKey if needed
			let lessonIndex = -1;
			
			if (lessonId?.toString().startsWith('lesson-')) {
				// Parse lesson key like "lesson-0-1" to get indices
				const parts = lessonId.toString().split('-');
				if (parts.length >= 3) {
					const expectedModuleIdx = parseInt(parts[1]);
					const expectedLessonIdx = parseInt(parts[2]);
					
					// Verify we're in the right module
					if (moduleIndex === expectedModuleIdx) {
						lessonIndex = expectedLessonIdx;
					}
				}
			} else {
				// Try to find by ID
				lessonIndex = (module.lessons || []).findIndex(l => 
					l && l.id && l.id.toString() === lessonId?.toString()
				);
			}
			
			if (lessonIndex === -1 || !module.lessons || !module.lessons[lessonIndex]) {
				console.error('Lesson not found:', { lessonId, lessonIndex, moduleLessons: module.lessons });
				return;
			}
			
			const lesson = module.lessons[lessonIndex];
			console.log('Found lesson at index:', lessonIndex, lesson);

			const updateData = {
				content_type: newType,
				type: newType, // Also update 'type' field for compatibility
			};

			// Check if lesson has a real ID (not temp)
			const hasRealId = lesson.id && !lesson.id.toString().startsWith('temp-') && courseId;
			
			if (hasRealId) {
				// Update existing lesson via API
				console.log('Updating lesson via API:', lesson.id, updateData);
				const updated = await adminService.updateLesson(lesson.id, updateData);
				const updatedModules = modules.map((m, mIdx) => {
					if (mIdx === moduleIndex) {
						return {
							...m,
							lessons: (m.lessons || []).map((l, lIdx) => 
								lIdx === lessonIndex ? (updated.lesson || updated) : l
							),
						};
					}
					return m;
				});
				onUpdate({ modules: updatedModules });
			} else {
				// Update temporary lesson in state - use exact index matching
				console.log('Updating lesson in state at index:', lessonIndex, updateData);
				const updatedModules = modules.map((m, mIdx) => {
					if (mIdx === moduleIndex) {
						return {
							...m,
							lessons: (m.lessons || []).map((l, lIdx) => 
								lIdx === lessonIndex ? { ...l, ...updateData } : l
							),
						};
					}
					return m;
				});
				console.log('Updated modules:', updatedModules);
				onUpdate({ modules: updatedModules });
			}
		} catch (err) {
			const errorMessage = handleApiError(err, 'updateLessonType');
			showError('Eroare la schimbarea tipului de lecție: ' + errorMessage);
		}
	};

	const handleModuleTitleChange = (moduleId, newTitle) => {
		setEditingModuleTitle(prev => ({
			...prev,
			[moduleId]: newTitle
		}));
	};

	const handleModuleTitleSave = async (moduleId) => {
		const newTitle = editingModuleTitle[moduleId];
		if (!newTitle || !newTitle.trim()) {
			// Reset if empty
			setEditingModuleTitle(prev => {
				const updated = { ...prev };
				delete updated[moduleId];
				return updated;
			});
			return;
		}

		try {
			const module = modules.find(m => m.id === moduleId);
			if (!module) return;

			const updateData = {
				title: newTitle.trim(),
			};

			if (courseId && moduleId && !moduleId.toString().startsWith('temp-')) {
				// Update existing module via API
				const updated = await adminService.updateModule(moduleId, updateData);
				const updatedModules = modules.map(m => 
					m.id === moduleId ? (updated.module || updated) : m
				);
				onUpdate({ modules: updatedModules });
			} else {
				// Update temporary module in state
				const updatedModules = modules.map(m => 
					m.id === moduleId ? { ...m, ...updateData } : m
				);
				onUpdate({ modules: updatedModules });
			}

			// Clear editing state
			setEditingModuleTitle(prev => {
				const updated = { ...prev };
				delete updated[moduleId];
				return updated;
			});
		} catch (err) {
			const errorMessage = handleApiError(err, 'updateModuleTitle');
			showError('Eroare la actualizarea titlului modulului: ' + errorMessage);
		}
	};

	const handleModuleTitleCancel = (moduleId) => {
		setEditingModuleTitle(prev => {
			const updated = { ...prev };
			delete updated[moduleId];
			return updated;
		});
	};

	const lessonTypes = [
		{ id: 'text', label: 'Text', icon: '📝' },
		{ id: 'video', label: 'Video', icon: '🎥' },
		{ id: 'assignment', label: 'Assignment', icon: '✍️' },
		{ id: 'quiz', label: 'Quiz', icon: '❓' },
		{ id: 'live', label: 'Live Session', icon: '🔴' },
		{ id: 'pdf', label: 'PDF', icon: '📄' },
	];


	// Calculate total lessons for display
	const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.filter(l => l).length || 0), 0);
	const allLessons = modules.flatMap(m => (m.lessons || []).filter(l => l).map(l => ({ ...l, moduleId: m.id, moduleTitle: m.title })));

	if (modules.length === 0) {
		return (
			<div className="admin-course-builder-step-content">
				<h2>Conținut Lecții</h2>
				<NoDeadEndFallback
					title="Nu există module"
					description="Adaugă mai întâi module și lecții în pasul anterior pentru a putea edita conținutul."
					icon="📚"
					actions={[
						{
							label: '← Mergi la Structură',
							onClick: () => {
								// This will be handled by parent component
								window.dispatchEvent(new CustomEvent('navigateToStep', { detail: { step: 2 } }));
							},
							variant: 'primary'
						}
					]}
				/>
			</div>
		);
	}

	if (allLessons.length === 0) {
		return (
			<div className="admin-course-builder-step-content">
				<h2>Conținut Lecții</h2>
				<NoDeadEndFallback
					title="Nu există lecții"
					description="Adaugă lecții în modulele create în pasul anterior pentru a putea edita conținutul."
					icon="📝"
					actions={[
						{
							label: '← Mergi la Structură',
							onClick: () => {
								window.dispatchEvent(new CustomEvent('navigateToStep', { detail: { step: 2 } }));
							},
							variant: 'primary'
						}
					]}
				/>
			</div>
		);
	}

	return (
		<div className="admin-course-builder-step-content">
			<h2>Conținut Lecții</h2>
			<p className="admin-course-builder-step-description">
				Editează conținutul fiecărei lecții cu editorul WYSIWYG. Modificările se salvează automat.
				{totalLessons > 0 && (
					<span style={{ marginLeft: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
						({totalLessons} {totalLessons === 1 ? 'lecție' : 'lecții'})
					</span>
				)}
			</p>

			<div className="admin-course-builder-content-list">
				{modules.filter(module => module).map((module, moduleIdx) => {
					// Use module.id if available, otherwise use index
					const moduleKey = module.id || `module-${moduleIdx}`;
					const isEditingTitle = editingModuleTitle[moduleKey] !== undefined;
					const displayTitle = isEditingTitle ? editingModuleTitle[moduleKey] : (module.title || `Modul ${moduleIdx + 1}`);
					
					return (
						<div key={moduleKey} className="admin-course-builder-content-module">
							<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
								{isEditingTitle ? (
									<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
										<input
											type="text"
											className="admin-form-input"
											value={displayTitle}
											onChange={(e) => handleModuleTitleChange(moduleKey, e.target.value)}
											onBlur={() => handleModuleTitleSave(moduleKey)}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													e.target.blur();
													handleModuleTitleSave(moduleKey);
												} else if (e.key === 'Escape') {
													handleModuleTitleCancel(moduleKey);
												}
											}}
											style={{ 
												flex: 1,
												fontSize: 'var(--font-size-lg)',
												fontWeight: 'var(--font-weight-semibold)',
												padding: 'var(--space-2) var(--space-3)',
											}}
											autoFocus
										/>
										<button
											className="admin-btn admin-btn-sm admin-btn-primary"
											onClick={() => handleModuleTitleSave(moduleKey)}
											style={{ flexShrink: 0 }}
										>
											✓
										</button>
										<button
											className="admin-btn admin-btn-sm admin-btn-secondary"
											onClick={() => handleModuleTitleCancel(moduleKey)}
											style={{ flexShrink: 0 }}
										>
											✕
										</button>
									</div>
								) : (
									<>
										<h3 
											className="admin-course-builder-content-module-title"
											style={{ flex: 1, cursor: 'pointer' }}
											onClick={() => handleModuleTitleChange(moduleKey, module.title || `Modul ${moduleIdx + 1}`)}
											title="Click pentru a edita titlul"
										>
											{module.title || `Modul ${moduleIdx + 1}`}
										</h3>
										<button
											className="admin-btn admin-btn-sm admin-btn-secondary"
											onClick={() => handleModuleTitleChange(moduleKey, module.title || `Modul ${moduleIdx + 1}`)}
											style={{ flexShrink: 0 }}
											title="Editează titlul modulului"
										>
											✏️
										</button>
									</>
								)}
							</div>
							{module.lessons && module.lessons.length > 0 ? (
								<div className="admin-course-builder-content-lessons">
									{module.lessons.filter(lesson => lesson).map((lesson, lessonIdx) => {
										if (!lesson) return null;
										// Use lesson.id if available, otherwise use index
										const lessonKey = lesson.id || `lesson-${moduleIdx}-${lessonIdx}`;
										return (
											<div key={lessonKey} className="admin-course-builder-content-lesson">
												<div className="admin-course-builder-content-lesson-info">
													<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
														<span className="admin-course-builder-content-lesson-title">
															{lesson?.title || 'Lecție fără titlu'}
														</span>
														{lesson?.description && (
															<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
																{lesson.description}
															</span>
														)}
														<div className="admin-course-builder-content-lesson-meta">
															<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
																{/* Lesson Type Selector */}
																<select
																	className="admin-form-select"
																	style={{ 
																		minWidth: '140px', 
																		padding: 'var(--space-2) var(--space-3)',
																		fontSize: 'var(--font-size-sm)',
																		borderRadius: 'var(--radius-md)',
																		border: '1.5px solid var(--border-default)',
																		background: 'var(--bg-surface)',
																		color: 'var(--text-primary)',
																		cursor: 'pointer'
																	}}
																	value={lesson?.content_type || lesson?.type || 'text'}
																	onChange={(e) => {
																		if (lesson) {
																			// Use the actual module and lesson objects for identification
																			const actualModuleId = module.id || moduleKey;
																			const actualLessonId = lesson.id || lessonKey;
																			console.log('Changing lesson type:', {
																				actualModuleId,
																				actualLessonId,
																				newType: e.target.value,
																				lesson,
																				module
																			});
																			handleChangeLessonType(
																				actualModuleId, 
																				actualLessonId, 
																				e.target.value
																			);
																		}
																	}}
																>
																	{lessonTypes.map(type => (
																		<option key={type.id} value={type.id}>
																			{type.icon} {type.label}
																		</option>
																	))}
																</select>
																{lesson?.duration_minutes && <span>• {lesson.duration_minutes} min</span>}
																{lesson?.is_preview && <span>• Preview</span>}
																{lesson?.is_locked && <span>• 🔒 Blocată</span>}
															</div>
														</div>
													</div>
												</div>
												<button
													className="admin-btn admin-btn-sm admin-btn-primary"
													onClick={() => {
														if (lesson) {
															handleEditLesson(module.id || moduleKey, lesson);
														}
													}}
												>
													✏️ Editează Conținut
												</button>
											</div>
										);
									})}
								</div>
							) : (
								<p className="admin-course-builder-content-empty">
									Nu există lecții în acest modul
								</p>
							)}
						</div>
					);
				})}
			</div>

			{/* Lesson Edit Modal */}
			{showEditModal && editingLesson && (
				<LessonEditModal
					lesson={editingLesson}
					moduleId={editingModuleId}
					courseId={courseId}
					onClose={() => {
						setShowEditModal(false);
						setEditingLesson(null);
						setEditingModuleId(null);
					}}
					onSave={handleSaveLesson}
					onUpdate={(updatedLesson) => {
						setEditingLesson(updatedLesson);
					}}
				/>
			)}
		</div>
	);
};

export default CourseBuilderStep3;
