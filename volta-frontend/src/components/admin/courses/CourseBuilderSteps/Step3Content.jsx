import React, { useState } from 'react';
import { adminService } from '../../../../services/api';
import RichTextEditor from '../../../RichTextEditor';
import { useAutoSave } from '../../../../hooks/useAutoSave';

const CourseBuilderStep3 = ({ courseId, data, onUpdate, errors }) => {
	const [editingLesson, setEditingLesson] = useState(null);
	const [aiHelperVisible, setAiHelperVisible] = useState(false);
	const [aiHelperType, setAiHelperType] = useState(null); // 'outline', 'quiz', 'summary'
	const modules = data.modules || [];

	// Auto-save lesson content
	const autoSaveLesson = async (lessonData) => {
		if (!courseId || !lessonData.id || lessonData.id.toString().startsWith('temp-')) {
			return; // Skip auto-save for temporary lessons
		}

		try {
			await adminService.updateLesson(lessonData.id, {
				content: lessonData.content,
				title: lessonData.title,
				description: lessonData.description,
			});
		} catch (err) {
			console.error('Auto-save error:', err);
		}
	};

	// AI Helper functions (placeholders for future implementation)
	const handleAIHelper = async (type, lessonData) => {
		setAiHelperType(type);
		setAiHelperVisible(true);
		
		// Placeholder for AI integration
		// In the future, this would call an AI service
		console.log(`AI Helper: ${type} for lesson ${lessonData.id}`);
		
		// Simulate AI response (replace with actual API call)
		setTimeout(() => {
			let aiContent = '';
			switch (type) {
				case 'outline':
					aiContent = '<h2>Plan de Lecție</h2><ul><li>Introducere</li><li>Concepte principale</li><li>Exemple practice</li><li>Rezumat</li></ul>';
					break;
				case 'quiz':
					aiContent = '<h2>Întrebări Quiz</h2><ol><li>Întrebare 1?</li><li>Întrebare 2?</li></ol>';
					break;
				case 'summary':
					aiContent = '<p>Rezumat generat automat...</p>';
					break;
			}
			
			if (aiContent) {
				setEditingLesson({
					...editingLesson,
					content: (editingLesson.content || '') + '\n\n' + aiContent,
				});
			}
			setAiHelperVisible(false);
		}, 1000);
	};

	const handleEditLesson = (moduleId, lesson) => {
		setEditingLesson({
			...lesson,
			moduleId: moduleId,
			content_type: lesson.content_type || lesson.type || 'text',
		});
	};

	const handleSaveLesson = async (lessonData) => {
		if (!lessonData.title?.trim()) {
			alert('Titlul lecției este obligatoriu');
			return;
		}

		try {
			// Prepare data for API
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
					if (m.id === lessonData.moduleId) {
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
					if (m.id === lessonData.moduleId) {
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
			setEditingLesson(null);
		} catch (err) {
			console.error('Error updating lesson:', err);
			alert('Eroare la actualizarea lecției: ' + (err.response?.data?.message || err.message));
		}
	};

	if (modules.length === 0) {
		return (
			<div className="admin-course-builder-step-content">
				<h2>Conținut Lecții</h2>
				<div className="admin-course-builder-info-box">
					<p>💡 Adaugă mai întâi module și lecții în pasul anterior.</p>
				</div>
			</div>
		);
	}

	const allLessons = modules.flatMap(m => (m.lessons || []).map(l => ({ ...l, moduleId: m.id, moduleTitle: m.title })));

	if (allLessons.length === 0) {
		return (
			<div className="admin-course-builder-step-content">
				<h2>Conținut Lecții</h2>
				<div className="admin-course-builder-info-box">
					<p>💡 Adaugă lecții în modulele create în pasul anterior.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-course-builder-step-content">
			<h2>Conținut Lecții</h2>
			<p className="admin-course-builder-step-description">
				Editează conținutul fiecărei lecții cu editorul WYSIWYG. Modificările se salvează automat.
			</p>

			<div className="admin-course-builder-content-list">
				{modules.map((module) => (
					<div key={module.id} className="admin-course-builder-content-module">
						<h3 className="admin-course-builder-content-module-title">
							{module.title}
						</h3>
						{module.lessons && module.lessons.length > 0 ? (
							<div className="admin-course-builder-content-lessons">
								{module.lessons.map((lesson) => {
									const isEditing = editingLesson?.id === lesson.id;
									return (
										<div key={lesson.id} className={`admin-course-builder-content-lesson ${isEditing ? 'editing' : ''}`}>
											{isEditing ? (
												<div className="admin-form-card">
													<div className="admin-form-card-header">
														<h4>✏️ Editează Lecție</h4>
														<button
															className="admin-btn-icon admin-btn-icon-sm"
															onClick={() => setEditingLesson(null)}
															title="Închide"
														>
															×
														</button>
													</div>

													{/* Title */}
													<div className="admin-form-group">
														<label className="admin-form-label">
															Titlu Lecție <span className="admin-form-required">*</span>
														</label>
														<input
															type="text"
															className="admin-form-input"
															value={editingLesson.title || ''}
															onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
															placeholder="Ex: Introducere în React Hooks"
														/>
													</div>

													{/* Description */}
													<div className="admin-form-group">
														<label className="admin-form-label">Descriere</label>
														<textarea
															className="admin-form-textarea"
															value={editingLesson.description || ''}
															onChange={(e) => setEditingLesson({ ...editingLesson, description: e.target.value })}
															placeholder="Descriere lecție..."
															rows={3}
														/>
													</div>

													{/* Content Type and Duration */}
													<div className="admin-form-row">
														<div className="admin-form-group">
															<label className="admin-form-label">Tip Conținut</label>
															<select
																className="admin-form-select"
																value={editingLesson.content_type || 'text'}
																onChange={(e) => setEditingLesson({ ...editingLesson, content_type: e.target.value })}
															>
																<option value="text">Text</option>
																<option value="video">Video</option>
																<option value="pdf">PDF</option>
																<option value="free">Lecție Gratuită</option>
															</select>
														</div>
														<div className="admin-form-group">
															<label className="admin-form-label">Durată (minute)</label>
															<input
																type="number"
																className="admin-form-input"
																value={editingLesson.duration_minutes || ''}
																onChange={(e) => setEditingLesson({ ...editingLesson, duration_minutes: parseInt(e.target.value) || null })}
																placeholder="Ex: 15"
																min="1"
															/>
														</div>
													</div>

													{/* Content based on type */}
													{editingLesson.content_type === 'text' && (
														<div className="admin-form-group">
															<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
																<label className="admin-form-label">Conținut Text</label>
																<div style={{ display: 'flex', gap: '0.5rem' }}>
																	<button
																		type="button"
																		className="admin-btn admin-btn-sm admin-btn-secondary"
																		onClick={() => handleAIHelper('outline', editingLesson)}
																		title="Generează plan de lecție cu AI"
																	>
																		🤖 Plan Lecție
																	</button>
																	<button
																		type="button"
																		className="admin-btn admin-btn-sm admin-btn-secondary"
																		onClick={() => handleAIHelper('summary', editingLesson)}
																		title="Generează rezumat cu AI"
																	>
																		🤖 Rezumat
																	</button>
																</div>
															</div>
															<RichTextEditor
																value={editingLesson.content || ''}
																onChange={(content) => {
																	const updated = { ...editingLesson, content };
																	setEditingLesson(updated);
																	// Auto-save after 2 seconds
																	setTimeout(() => {
																		if (courseId && updated.id && !updated.id.toString().startsWith('temp-')) {
																			autoSaveLesson(updated);
																		}
																	}, 2000);
																}}
																placeholder="Scrie conținutul lecției aici..."
																style={{ minHeight: '400px' }}
															/>
															<div className="admin-input-hint" style={{ marginTop: '0.5rem' }}>
																💾 Modificările se salvează automat
															</div>
														</div>
													)}

													{editingLesson.content_type === 'video' && (
														<div className="admin-form-group">
															<label className="admin-form-label">URL Video</label>
															<input
																type="url"
																className="admin-form-input"
																value={editingLesson.video_url || ''}
																onChange={(e) => setEditingLesson({ ...editingLesson, video_url: e.target.value })}
																placeholder="https://youtube.com/watch?v=... sau https://vimeo.com/..."
															/>
															<div className="admin-input-hint">
																Suportă YouTube, Vimeo și alte platforme video. Poți și încărca direct din editor.
															</div>
															{/* Also allow content editor for video lessons */}
															<div style={{ marginTop: '1rem' }}>
																<label className="admin-form-label">Conținut Suplimentar (opțional)</label>
																<RichTextEditor
																	value={editingLesson.content || ''}
																	onChange={(content) => {
																		const updated = { ...editingLesson, content };
																		setEditingLesson(updated);
																	}}
																	placeholder="Note, resurse suplimentare, link-uri..."
																	style={{ minHeight: '200px' }}
																/>
															</div>
														</div>
													)}

													{editingLesson.content_type === 'pdf' && (
														<div className="admin-form-group">
															<label className="admin-form-label">URL PDF sau Încarcă PDF</label>
															<input
																type="url"
																className="admin-form-input"
																value={editingLesson.pdf_url || ''}
																onChange={(e) => setEditingLesson({ ...editingLesson, pdf_url: e.target.value })}
																placeholder="https://example.com/document.pdf"
																style={{ marginBottom: '0.5rem' }}
															/>
															<div className="admin-input-hint" style={{ marginBottom: '1rem' }}>
																Link către documentul PDF sau folosește editorul pentru a încărca PDF direct
															</div>
															<RichTextEditor
																value={editingLesson.content || ''}
																onChange={(content) => {
																	const updated = { ...editingLesson, content };
																	setEditingLesson(updated);
																}}
																placeholder="Folosește butonul 📄 pentru a încărca PDF sau adaugă link-uri și resurse..."
																style={{ minHeight: '200px' }}
															/>
														</div>
													)}

													{editingLesson.content_type === 'quiz' && (
														<div className="admin-form-group">
															<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
																<label className="admin-form-label">Întrebări Quiz</label>
																<button
																	type="button"
																	className="admin-btn admin-btn-sm admin-btn-secondary"
																	onClick={() => handleAIHelper('quiz', editingLesson)}
																	title="Generează întrebări quiz cu AI"
																>
																	🤖 Generează Întrebări
																</button>
															</div>
															<RichTextEditor
																value={editingLesson.content || ''}
																onChange={(content) => {
																	const updated = { ...editingLesson, content };
																	setEditingLesson(updated);
																}}
																placeholder="Scrie întrebările quiz aici sau folosește AI pentru a genera..."
																style={{ minHeight: '300px' }}
															/>
														</div>
													)}

													{/* Options */}
													<div className="admin-form-row">
														<div className="admin-form-group">
															<label className="admin-form-checkbox">
																<input
																	type="checkbox"
																	checked={editingLesson.is_preview || false}
																	onChange={(e) => setEditingLesson({ ...editingLesson, is_preview: e.target.checked })}
																/>
																<span>Lecție gratuită (preview)</span>
															</label>
														</div>
														<div className="admin-form-group">
															<label className="admin-form-checkbox">
																<input
																	type="checkbox"
																	checked={editingLesson.is_locked || false}
																	onChange={(e) => setEditingLesson({ ...editingLesson, is_locked: e.target.checked })}
																/>
																<span>Lecție blocată</span>
															</label>
														</div>
													</div>

													{/* Actions */}
													<div className="admin-form-actions">
														<button
															className="admin-btn admin-btn-primary"
															onClick={() => handleSaveLesson(editingLesson)}
														>
															💾 Salvează Modificările
														</button>
														<button
															className="admin-btn admin-btn-secondary"
															onClick={() => setEditingLesson(null)}
														>
															Anulează
														</button>
													</div>
												</div>
											) : (
												<>
													<div className="admin-course-builder-content-lesson-info">
														<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
															<span className="admin-course-builder-content-lesson-title">
																{lesson.title}
															</span>
															{lesson.description && (
																<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
																	{lesson.description}
																</span>
															)}
															<div className="admin-course-builder-content-lesson-meta">
																<span>{lesson.content_type || lesson.type || 'text'}</span>
																{lesson.duration_minutes && <span>• {lesson.duration_minutes} min</span>}
																{lesson.is_preview && <span>• Preview</span>}
																{lesson.is_locked && <span>• 🔒 Blocată</span>}
															</div>
														</div>
													</div>
													<button
														className="admin-btn admin-btn-sm admin-btn-primary"
														onClick={() => handleEditLesson(module.id, lesson)}
													>
														✏️ Editează Conținut
													</button>
												</>
											)}
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
				))}
			</div>
		</div>
	);
};

export default CourseBuilderStep3;
