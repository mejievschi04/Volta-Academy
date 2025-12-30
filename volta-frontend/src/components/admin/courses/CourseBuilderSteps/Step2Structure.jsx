import React, { useState } from 'react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminService } from '../../../../services/api';

const CourseBuilderStep2 = ({ courseId, data, onUpdate, errors }) => {
	const [modules, setModules] = useState(data.modules || []);
	const [editingModule, setEditingModule] = useState(null);
	const [editingLesson, setEditingLesson] = useState(null);
	const [showAddModule, setShowAddModule] = useState(false);
	const [showAddLesson, setShowAddLesson] = useState(null); // moduleId when showing add lesson form
	const [newModule, setNewModule] = useState({ title: '', description: '', order: modules.length });
	const [newLesson, setNewLesson] = useState({ title: '', description: '', content_type: 'text', is_preview: false, duration_minutes: null });
	const [activeId, setActiveId] = useState(null);
	const [draggingModuleId, setDraggingModuleId] = useState(null);

	// Drag & Drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Update modules when data changes
	React.useEffect(() => {
		setModules(data.modules || []);
	}, [data.modules]);

	// Lesson templates
	const lessonTemplates = {
		video: { content_type: 'video', title: 'Lecție Video', description: 'Lecție cu conținut video' },
		text: { content_type: 'text', title: 'Lecție Text', description: 'Lecție cu conținut text' },
		quiz: { content_type: 'quiz', title: 'Quiz', description: 'Lecție cu întrebări și răspunsuri' },
		assignment: { content_type: 'assignment', title: 'Temă', description: 'Temă de lucru pentru studenți' },
		resource: { content_type: 'resource', title: 'Resursă', description: 'Resurse suplimentare (PDF, link-uri)' },
	};

	const handleUseTemplate = (templateKey) => {
		const template = lessonTemplates[templateKey];
		setNewLesson({
			...newLesson,
			...template,
			title: template.title,
			description: template.description,
		});
	};

	// Drag handlers for modules
	const handleDragStart = (event) => {
		setActiveId(event.active.id);
		setDraggingModuleId(event.active.id);
	};

	const handleDragEnd = async (event) => {
		const { active, over } = event;
		setActiveId(null);
		setDraggingModuleId(null);

		if (active.id !== over?.id) {
			const oldIndex = modules.findIndex((m) => m.id === active.id);
			const newIndex = modules.findIndex((m) => m.id === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				const newModules = arrayMove(modules, oldIndex, newIndex);
				// Update order for each module
				const updatedModules = newModules.map((m, index) => ({ ...m, order: index }));
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });

				// Save order to backend if courseId exists
				if (courseId) {
					try {
						const moduleIds = updatedModules.map(m => m.id).filter(id => !id.toString().startsWith('temp-'));
						if (moduleIds.length > 0) {
							await adminService.reorderModules(courseId, moduleIds);
						}
					} catch (err) {
						console.error('Error reordering modules:', err);
					}
				}
			}
		}
	};

	// Duplicate module
	const handleDuplicateModule = (module) => {
		const duplicated = {
			...module,
			id: `temp-${Date.now()}`,
			title: `${module.title} (Copie)`,
			order: modules.length,
			lessons: (module.lessons || []).map(l => ({
				...l,
				id: `temp-lesson-${Date.now()}-${Math.random()}`,
			})),
		};
		const updatedModules = [...modules, duplicated];
		setModules(updatedModules);
		onUpdate({ modules: updatedModules });
	};

	const handleAddModule = async () => {
		if (!newModule.title.trim()) {
			alert('Titlul modulului este obligatoriu');
			return;
		}

		try {
			// If courseId exists, create module via API
			if (courseId) {
				const moduleData = {
					...newModule,
					course_id: courseId,
					order: modules.length,
				};
				const created = await adminService.createModule(moduleData);
				const updatedModules = [...modules, created.module || created];
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });
			} else {
				// If no courseId, create temporary module in state
				const tempModule = {
					id: `temp-${Date.now()}`,
					title: newModule.title,
					description: newModule.description || '',
					order: modules.length,
					lessons: [],
					is_locked: false,
					status: 'draft',
				};
				const updatedModules = [...modules, tempModule];
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });
			}

			setNewModule({ title: '', description: '', order: modules.length + 1 });
			setShowAddModule(false);
		} catch (err) {
			console.error('Error creating module:', err);
			alert('Eroare la crearea modulului: ' + (err.response?.data?.message || err.message));
		}
	};

	const handleEditModule = (module) => {
		setEditingModule(module);
	};

	const handleSaveModule = async (moduleData) => {
		try {
			if (courseId && moduleData.id && !moduleData.id.toString().startsWith('temp-')) {
				// Update existing module via API
				const updated = await adminService.updateModule(moduleData.id, moduleData);
				const updatedModules = modules.map(m => m.id === moduleData.id ? (updated.module || updated) : m);
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });
			} else {
				// Update temporary module in state
				const updatedModules = modules.map(m => m.id === moduleData.id ? { ...m, ...moduleData } : m);
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });
			}
			setEditingModule(null);
		} catch (err) {
			console.error('Error updating module:', err);
			alert('Eroare la actualizarea modulului: ' + (err.response?.data?.message || err.message));
		}
	};

	const handleDeleteModule = async (moduleId) => {
		if (!confirm('Ești sigur că vrei să ștergi acest modul?')) return;

		try {
			if (courseId && !moduleId.toString().startsWith('temp-')) {
				await adminService.deleteModule(moduleId);
			}
			const updatedModules = modules.filter(m => m.id !== moduleId);
			setModules(updatedModules);
			onUpdate({ modules: updatedModules });
		} catch (err) {
			console.error('Error deleting module:', err);
			alert('Eroare la ștergerea modulului: ' + (err.response?.data?.message || err.message));
		}
	};

	const handleAddLesson = async (moduleId) => {
		const module = modules.find(m => m.id === moduleId);
		if (!module) return;

		if (!newLesson.title.trim()) {
			alert('Titlul lecției este obligatoriu');
			return;
		}

		try {
			if (courseId && !moduleId.toString().startsWith('temp-')) {
				const lessonData = {
					title: newLesson.title.trim(),
					content: newLesson.description || newLesson.title.trim(), // Backend requires 'content' field
					description: newLesson.description || '',
					module_id: moduleId,
					course_id: courseId, // Backend requires 'course_id' field
					order: (module.lessons || []).length,
					content_type: newLesson.content_type || 'text',
					is_preview: newLesson.is_preview || false,
					duration_minutes: newLesson.duration_minutes || null,
				};
				const created = await adminService.createLesson(lessonData);
				const updatedModules = modules.map(m => {
					if (m.id === moduleId) {
						return {
							...m,
							lessons: [...(m.lessons || []), created.lesson || created],
						};
					}
					return m;
				});
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });
			} else {
				// Temporary lesson
				const tempLesson = {
					id: `temp-lesson-${Date.now()}`,
					title: newLesson.title.trim(),
					description: newLesson.description || '',
					module_id: moduleId,
					order: (module.lessons || []).length,
					content_type: newLesson.content_type || 'text',
					is_preview: newLesson.is_preview || false,
					duration_minutes: newLesson.duration_minutes || null,
				};
				const updatedModules = modules.map(m => {
					if (m.id === moduleId) {
						return {
							...m,
							lessons: [...(m.lessons || []), tempLesson],
						};
					}
					return m;
				});
				setModules(updatedModules);
				onUpdate({ modules: updatedModules });
			}
			
			// Reset form
			setNewLesson({ title: '', description: '', content_type: 'text', is_preview: false, duration_minutes: null });
			setShowAddLesson(null);
		} catch (err) {
			console.error('Error creating lesson:', err);
			alert('Eroare la crearea lecției: ' + (err.response?.data?.message || err.message));
		}
	};

	const handleDeleteLesson = async (moduleId, lessonId) => {
		if (!confirm('Ești sigur că vrei să ștergi această lecție?')) return;

		try {
			if (courseId && !lessonId.toString().startsWith('temp-')) {
				await adminService.deleteLesson(lessonId);
			}
			const updatedModules = modules.map(m => {
				if (m.id === moduleId) {
					return {
						...m,
						lessons: (m.lessons || []).filter(l => l.id !== lessonId),
					};
				}
				return m;
			});
			setModules(updatedModules);
			onUpdate({ modules: updatedModules });
		} catch (err) {
			console.error('Error deleting lesson:', err);
			alert('Eroare la ștergerea lecției: ' + (err.response?.data?.message || err.message));
		}
	};

	// Sortable Module Component - renders full module with drag & drop
	const SortableModule = ({ module, index }) => {
		const {
			attributes,
			listeners,
			setNodeRef,
			transform,
			transition,
			isDragging,
		} = useSortable({ id: module.id });

		const style = {
			transform: CSS.Transform.toString(transform),
			transition,
			opacity: isDragging ? 0.5 : 1,
		};

		return (
			<div
				ref={setNodeRef}
				style={style}
				className={`admin-module-card ${isDragging ? 'dragging' : ''}`}
			>
				<div className="admin-module-card-header">
					<div className="admin-module-card-drag-handle" {...attributes} {...listeners} title="Trage pentru a reordona">
						⋮⋮
					</div>
					<div className="admin-module-card-info">
						<h4 className="admin-module-card-title">
							{editingModule?.id === module.id ? (
								<input
									type="text"
									className="admin-form-input"
									value={editingModule.title}
									onChange={(e) => setEditingModule({ ...editingModule, title: e.target.value })}
									style={{ width: '100%' }}
								/>
							) : (
								<>
									{module.title}
									{module.is_locked && <span className="admin-module-lock-badge">🔒</span>}
								</>
							)}
						</h4>
						{editingModule?.id === module.id ? (
							<textarea
								className="admin-form-textarea"
								value={editingModule.description || ''}
								onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value })}
								placeholder="Descriere modul..."
								rows={2}
								style={{ marginTop: '0.5rem' }}
							/>
						) : (
							module.description && (
								<p className="admin-module-card-description">{module.description}</p>
							)
						)}
					</div>
					<div className="admin-module-card-actions">
						{editingModule?.id === module.id ? (
							<>
								<button
									className="admin-btn admin-btn-sm admin-btn-primary"
									onClick={() => handleSaveModule(editingModule)}
								>
									Salvează
								</button>
								<button
									className="admin-btn admin-btn-sm admin-btn-secondary"
									onClick={() => setEditingModule(null)}
								>
									Anulează
								</button>
							</>
						) : (
							<>
								<button
									className="admin-btn admin-btn-sm admin-btn-secondary"
									onClick={() => handleEditModule(module)}
								>
									Editează
								</button>
								<button
									className="admin-btn admin-btn-sm admin-btn-secondary"
									onClick={() => handleDuplicateModule(module)}
									title="Duplică modul"
								>
									📋 Duplică
								</button>
								<button
									className="admin-btn admin-btn-sm admin-btn-danger"
									onClick={() => handleDeleteModule(module.id)}
								>
									🗑️ Șterge
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Structură</h2>
			<p className="admin-course-builder-step-description">
				Organizează cursul în module și lecții. Testele se atașează în pasul "Evaluare & Progres". Trage și plasează pentru a reordona.
			</p>

			{errors.modules && (
				<div className="admin-form-error-message">
					{errors.modules}
				</div>
			)}

			{/* Add Module Form */}
			{showAddModule ? (
				<div className="admin-form-card" style={{ marginBottom: '1.5rem' }}>
					<h3>Adaugă Modul Nou</h3>
					<div className="admin-form-group">
						<label className="admin-form-label">
							Titlu Modul <span className="admin-form-required">*</span>
						</label>
						<input
							type="text"
							className="admin-form-input"
							value={newModule.title}
							onChange={(e) => setNewModule({ ...newModule, title: e.target.value })}
							placeholder="Ex: Introducere în React"
						/>
					</div>
					<div className="admin-form-group">
						<label className="admin-form-label">Descriere</label>
						<textarea
							className="admin-form-textarea"
							value={newModule.description}
							onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
							placeholder="Descriere modul..."
							rows={3}
						/>
					</div>
					<div className="admin-form-actions">
						<button
							className="admin-btn admin-btn-primary"
							onClick={handleAddModule}
						>
							Adaugă Modul
						</button>
						<button
							className="admin-btn admin-btn-secondary"
							onClick={() => {
								setShowAddModule(false);
								setNewModule({ title: '', description: '', order: modules.length });
							}}
						>
							Anulează
						</button>
					</div>
				</div>
			) : (
				<button
					className="admin-btn admin-btn-primary"
					onClick={() => setShowAddModule(true)}
					style={{ marginBottom: '1.5rem' }}
				>
					+ Adaugă Modul
				</button>
			)}

			{/* Modules List with Drag & Drop */}
			{modules.length === 0 ? (
				<div className="admin-course-builder-info-box">
					<p>💡 <strong>Nu există module.</strong> Adaugă cel puțin un modul pentru a continua.</p>
				</div>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					<SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
						<div className="admin-modules-list">
							{modules.map((module, index) => (
								<div key={module.id || index} style={{ marginBottom: '1.5rem' }}>
									<SortableModule module={module} index={index} />
									{/* Lessons */}
									<div className="admin-module-content">
								<div className="admin-module-section">
									<div className="admin-module-section-header">
										<h5>Lecții ({(module.lessons || []).length})</h5>
										{showAddLesson !== module.id ? (
											<button
												className="admin-btn admin-btn-sm admin-btn-primary"
												onClick={() => {
													setShowAddLesson(module.id);
													setNewLesson({ title: '', description: '', content_type: 'text', is_preview: false, duration_minutes: null });
												}}
											>
												+ Adaugă Lecție
											</button>
										) : null}
									</div>
									
									{/* Add Lesson Form */}
									{showAddLesson === module.id && (
										<div className="admin-form-card" style={{ marginBottom: '1rem' }}>
											<h4 style={{ marginBottom: '1rem', fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>Adaugă Lecție Nouă</h4>
											
											{/* Lesson Templates */}
											<div className="admin-lesson-templates" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
												{Object.keys(lessonTemplates).map(templateKey => (
													<button
														key={templateKey}
														type="button"
														className="admin-btn admin-btn-sm admin-btn-secondary"
														onClick={() => handleUseTemplate(templateKey)}
														title={`Folosește template: ${lessonTemplates[templateKey].title}`}
													>
														{templateKey === 'video' && '🎥'}
														{templateKey === 'text' && '📝'}
														{templateKey === 'quiz' && '❓'}
														{templateKey === 'assignment' && '📋'}
														{templateKey === 'resource' && '📎'}
														{lessonTemplates[templateKey].title}
													</button>
												))}
											</div>
											<div className="admin-form-group">
												<label className="admin-form-label">
													Titlu Lecție <span className="admin-form-required">*</span>
												</label>
												<input
													type="text"
													className="admin-form-input"
													value={newLesson.title}
													onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
													placeholder="Ex: Introducere în React Hooks"
												/>
											</div>
											<div className="admin-form-group">
												<label className="admin-form-label">Descriere</label>
												<textarea
													className="admin-form-textarea"
													value={newLesson.description}
													onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })}
													placeholder="Descriere lecție..."
													rows={2}
												/>
											</div>
											<div className="admin-form-row">
												<div className="admin-form-group">
													<label className="admin-form-label">Tip Conținut</label>
													<select
														className="admin-form-select"
														value={newLesson.content_type}
														onChange={(e) => setNewLesson({ ...newLesson, content_type: e.target.value })}
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
														value={newLesson.duration_minutes || ''}
														onChange={(e) => setNewLesson({ ...newLesson, duration_minutes: parseInt(e.target.value) || null })}
														placeholder="Ex: 15"
														min="1"
													/>
												</div>
											</div>
											<div className="admin-form-group">
												<label className="admin-form-checkbox">
													<input
														type="checkbox"
														checked={newLesson.is_preview}
														onChange={(e) => setNewLesson({ ...newLesson, is_preview: e.target.checked })}
													/>
													<span>Lecție gratuită (preview)</span>
												</label>
											</div>
											<div className="admin-form-actions">
												<button
													className="admin-btn admin-btn-primary"
													onClick={() => handleAddLesson(module.id)}
												>
													Adaugă Lecție
												</button>
												<button
													className="admin-btn admin-btn-secondary"
													onClick={() => {
														setShowAddLesson(null);
														setNewLesson({ title: '', description: '', content_type: 'text', is_preview: false, duration_minutes: null });
													}}
												>
													Anulează
												</button>
											</div>
										</div>
									)}

									{(module.lessons || []).length === 0 && showAddLesson !== module.id ? (
										<p className="admin-module-empty">Nu există lecții</p>
									) : (
										<ul className="admin-module-items-list">
											{(module.lessons || []).map((lesson, lessonIndex) => (
												<li key={lesson.id || lessonIndex} className="admin-module-item">
													<div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
														<span style={{ fontWeight: 'var(--font-weight-semibold)' }}>📚 {lesson.title}</span>
														{lesson.description && (
															<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
																{lesson.description}
															</span>
														)}
														<div style={{ display: 'flex', gap: '0.5rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
															<span>{lesson.content_type || 'text'}</span>
															{lesson.duration_minutes && <span>• {lesson.duration_minutes} min</span>}
															{lesson.is_preview && <span>• Preview</span>}
														</div>
													</div>
													<button
														className="admin-btn admin-btn-sm admin-btn-danger"
														onClick={() => handleDeleteLesson(module.id, lesson.id)}
													>
														Șterge
													</button>
												</li>
											))}
										</ul>
									)}
								</div>

								{/* Info about tests */}
								<div className="admin-module-section">
									<div className="admin-info-box" style={{ marginTop: '1rem', padding: '1rem' }}>
										<p style={{ margin: 0, fontSize: '0.875rem' }}>
											💡 <strong>Teste:</strong> Testele se creează separat în <strong>Test Builder</strong> și se atașează la curs în pasul <strong>"Evaluare & Progres"</strong>.
										</p>
									</div>
								</div>
							</div>
						</div>
					))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</div>
	);
};

export default CourseBuilderStep2;
