import React, { useState } from 'react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	useDroppable,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const toModuleKey = (id) => `module:${id}`;
const toLessonKey = (id) => `lesson:${id}`;
const toModuleContainerKey = (id) => `module-container:${id}`;

const parseDndId = (rawId) => {
	if (typeof rawId !== 'string') return { kind: 'unknown', id: rawId };
	const [kind, idStr] = rawId.split(':');
	const id = Number(idStr);
	return { kind, id: Number.isFinite(id) ? id : rawId };
};

const ModuleCard = ({
	module,
	onEdit,
	onDelete,
	onToggleLock,
	onToggleStatus,
	onAddLesson,
	onAddTest,
	onReorderLessons,
	onMoveLesson,
	onToggleLessonStatus,
	onToggleLessonPreview,
	onSelectLesson,
}) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: toModuleKey(module.id) });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const { setNodeRef: setDroppableRef, isOver } = useDroppable({
		id: toModuleContainerKey(module.id),
	});

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`admin-module-card ${module.is_locked ? 'locked' : ''} ${module.status === 'draft' ? 'draft' : ''}`}
		>
			<div className="admin-module-card-header">
				<div className="admin-module-card-drag-handle" {...attributes} {...listeners}>
					⋮⋮
				</div>
				<div className="admin-module-card-info">
					<h4 className="admin-module-card-title">
						{module.title}
						{module.is_locked && <span className="admin-module-lock-badge">🔒</span>}
						{module.status === 'draft' && <span className="admin-module-draft-badge">Draft</span>}
					</h4>
					<div className="admin-module-card-meta">
						<span>📖 {module.lessons?.length || 0} lecții</span>
						{module.estimated_duration_minutes && (
							<span>⏱️ {module.estimated_duration_minutes} min</span>
						)}
						{module.completion_percentage !== undefined && (
							<span>✅ {module.completion_percentage}% finalizare</span>
						)}
					</div>
				</div>
				<div className="admin-module-card-actions">
					{onToggleStatus && (
						<button
							className="lms-btn-icon"
							onClick={() => onToggleStatus(module.id, module.status === 'published' ? 'draft' : 'published')}
							title={module.status === 'published' ? 'Treci în Draft' : 'Publică modul'}
						>
							{module.status === 'published' ? '🟢' : '⚪'}
						</button>
					)}
					<button
						className="lms-btn-icon"
						onClick={() => onToggleLock(module.id)}
						title={module.is_locked ? 'Deblochează' : 'Blochează'}
					>
						{module.is_locked ? '🔓' : '🔒'}
					</button>
					<button className="lms-btn-icon" onClick={() => onAddLesson(module.id)} title="Adaugă lecție">
						➕
					</button>
					<button className="lms-btn-icon" onClick={() => onEdit(module.id)} title="Editează">
						✏️
					</button>
					<button className="lms-btn-icon va-btn-danger" onClick={() => onDelete(module.id)} title="Șterge">
						🗑️
					</button>
				</div>
			</div>

			{/* Lessons List */}
			<div
				ref={setDroppableRef}
				className={`admin-module-lessons ${isOver ? 'is-over' : ''}`}
				style={isOver ? { outline: '2px dashed var(--border-secondary)', outlineOffset: '2px', borderRadius: 'var(--radius-md)' } : undefined}
			>
				{module.lessons && module.lessons.length > 0 ? (
					<SortableContext
						items={module.lessons.map((l) => toLessonKey(l.id))}
						strategy={verticalListSortingStrategy}
					>
						{module.lessons.map((lesson, index) => (
							<LessonItem
								key={lesson.id}
								lesson={lesson}
								moduleId={module.id}
								index={index}
								onToggleLessonStatus={onToggleLessonStatus}
								onToggleLessonPreview={onToggleLessonPreview}
								onSelectLesson={onSelectLesson}
							/>
						))}
					</SortableContext>
				) : (
					<div className="admin-lesson-item" style={{ opacity: 0.7 }}>
						<div className="admin-lesson-item-info">
							<span className="admin-lesson-item-title">Nu există lecții</span>
						</div>
					</div>
				)}
			</div>

		</div>
	);
};

const LessonItem = ({ lesson, moduleId, index, onToggleLessonStatus, onToggleLessonPreview, onSelectLesson }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: toLessonKey(lesson.id) });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.6 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} className="admin-lesson-item">
			<div className="admin-lesson-item-info">
				<span className="admin-module-card-drag-handle" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
					⋮⋮
				</span>
				<span className="admin-lesson-item-number">{index + 1}.</span>
				<button
					type="button"
					className="admin-lesson-item-title"
					style={{ background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
					onClick={() => onSelectLesson?.(lesson.id)}
					title="Selectează lecția"
				>
					{lesson.title}
				</button>
				{lesson.is_preview && <span className="admin-lesson-preview-badge">Preview</span>}
				{lesson.is_locked && <span className="admin-lesson-lock-badge">🔒</span>}
			</div>
			<div className="admin-lesson-item-meta">
				{lesson.type && <span className="admin-lesson-type">{lesson.type}</span>}
				{lesson.duration_minutes && <span>⏱️ {lesson.duration_minutes} min</span>}
				{onToggleLessonPreview && (
					<button
						type="button"
						className="lms-btn-icon"
						onClick={() => onToggleLessonPreview(lesson.id, !lesson.is_preview)}
						title={lesson.is_preview ? 'Dezactivează preview' : 'Activează preview'}
					>
						{lesson.is_preview ? '👁️' : '👁️‍🗨️'}
					</button>
				)}
				{onToggleLessonStatus && (
					<button
						type="button"
						className="lms-btn-icon"
						onClick={() => onToggleLessonStatus(lesson.id, lesson.status === 'published' ? 'draft' : 'published')}
						title={lesson.status === 'published' ? 'Treci în Draft' : 'Publică lecția'}
					>
						{lesson.status === 'published' ? '🟢' : '⚪'}
					</button>
				)}
			</div>
		</div>
	);
};

const CourseStructureBuilder = ({
	course,
	modules,
	onReorderModules,
	onReorderLessons,
	onMoveLesson,
	onEditModule,
	onDeleteModule,
	onToggleModuleLock,
	onToggleModuleStatus,
	onToggleLessonStatus,
	onToggleLessonPreview,
	onSelectLesson,
	onAddModule,
	onAddLesson,
	onAddTest,
	loading,
}) => {
	const [activeId, setActiveId] = useState(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragStart = (event) => {
		setActiveId(event.active.id);
	};

	const handleDragEnd = (event) => {
		const { active, over } = event;

		if (!over?.id || active.id === over.id) {
			setActiveId(null);
			return;
		}

		const activeParsed = parseDndId(active.id);
		const overParsed = parseDndId(over.id);

		// MODULE DnD
		if (activeParsed.kind === 'module' && overParsed.kind === 'module') {
			const oldIndex = modules.findIndex((m) => m.id === activeParsed.id);
			const newIndex = modules.findIndex((m) => m.id === overParsed.id);
			if (oldIndex !== -1 && newIndex !== -1) {
				const newModules = arrayMove(modules, oldIndex, newIndex);
				onReorderModules(newModules.map((m, index) => ({ ...m, order: index })));
			}
			setActiveId(null);
			return;
		}

		// LESSON DnD (within/between modules)
		if (activeParsed.kind === 'lesson') {
			const lessonId = activeParsed.id;
			const sourceModule = modules.find((m) => (m.lessons || []).some((l) => l.id === lessonId));
			if (!sourceModule) {
				setActiveId(null);
				return;
			}

			let targetModule = null;
			let targetLessonId = null;
			if (overParsed.kind === 'lesson') {
				targetLessonId = overParsed.id;
				targetModule = modules.find((m) => (m.lessons || []).some((l) => l.id === targetLessonId)) || null;
			} else if (overParsed.kind === 'module-container') {
				targetModule = modules.find((m) => m.id === overParsed.id) || null;
			} else if (overParsed.kind === 'module') {
				targetModule = modules.find((m) => m.id === overParsed.id) || null;
			}

			if (!targetModule) {
				setActiveId(null);
				return;
			}

			const sourceLessons = [...(sourceModule.lessons || [])];
			const fromIndex = sourceLessons.findIndex((l) => l.id === lessonId);
			if (fromIndex === -1) {
				setActiveId(null);
				return;
			}

			// Remove from source
			sourceLessons.splice(fromIndex, 1);

			const targetLessons = sourceModule.id === targetModule.id ? sourceLessons : [...(targetModule.lessons || [])];

			let toIndex = targetLessons.length;
			if (targetLessonId) {
				const idx = targetLessons.findIndex((l) => l.id === targetLessonId);
				if (idx !== -1) toIndex = idx;
			}

			targetLessons.splice(toIndex, 0, (sourceModule.lessons || []).find((l) => l.id === lessonId));

			if (sourceModule.id === targetModule.id) {
				onReorderLessons?.(sourceModule.id, targetLessons.map((l) => l.id));
			} else {
				// Reorder both modules and move lesson
				onMoveLesson?.(lessonId, targetModule.id, toIndex);
				onReorderLessons?.(sourceModule.id, sourceLessons.map((l) => l.id));
			}
		}

		setActiveId(null);
	};

	return (
		<div className="admin-course-structure-builder">
			<div className="admin-course-structure-header">
				<h2>Structură Curs</h2>
				<button className="lms-btn-primary" onClick={onAddModule} disabled={loading}>
					+ Adaugă Modul
				</button>
			</div>

			{modules.length === 0 ? (
				<div className="lms-empty-state">
					<div className="lms-empty-icon">📚</div>
					<div className="lms-empty-title">Nu există module</div>
					<div className="lms-empty-description">
						Adaugă primul modul pentru a începe construirea cursului
					</div>
					<button className="lms-btn-primary" onClick={onAddModule}>
						+ Adaugă Modul
					</button>
				</div>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					<SortableContext items={modules.map((m) => toModuleKey(m.id))} strategy={verticalListSortingStrategy}>
						<div className="admin-modules-list">
							{modules.map((module) => (
								<ModuleCard
									key={module.id}
									module={module}
									onEdit={onEditModule}
									onDelete={onDeleteModule}
									onToggleLock={onToggleModuleLock}
									onToggleStatus={onToggleModuleStatus}
									onAddLesson={onAddLesson}
									onAddTest={onAddTest}
									onReorderLessons={onReorderLessons}
									onMoveLesson={onMoveLesson}
									onToggleLessonStatus={onToggleLessonStatus}
									onToggleLessonPreview={onToggleLessonPreview}
									onSelectLesson={onSelectLesson}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</div>
	);
};

export default CourseStructureBuilder;

