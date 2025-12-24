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

const ModuleCard = ({ module, onEdit, onDelete, onToggleLock, onAddLesson, onAddTest }) => {
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
					<button
						className="admin-btn-icon"
						onClick={() => onToggleLock(module.id)}
						title={module.is_locked ? 'Deblochează' : 'Blochează'}
					>
						{module.is_locked ? '🔓' : '🔒'}
					</button>
					<button className="admin-btn-icon" onClick={() => onAddLesson(module.id)} title="Adaugă lecție">
						➕
					</button>
					<button className="admin-btn-icon" onClick={() => onEdit(module.id)} title="Editează">
						✏️
					</button>
					<button className="admin-btn-icon admin-btn-icon-danger" onClick={() => onDelete(module.id)} title="Șterge">
						🗑️
					</button>
				</div>
			</div>

			{/* Lessons List */}
			{module.lessons && module.lessons.length > 0 && (
				<div className="admin-module-lessons">
					{module.lessons.map((lesson, index) => (
						<LessonItem
							key={lesson.id}
							lesson={lesson}
							moduleId={module.id}
							index={index}
						/>
					))}
				</div>
			)}

		</div>
	);
};

const LessonItem = ({ lesson, moduleId, index }) => {
	return (
		<div className="admin-lesson-item">
			<div className="admin-lesson-item-info">
				<span className="admin-lesson-item-number">{index + 1}.</span>
				<span className="admin-lesson-item-title">{lesson.title}</span>
				{lesson.is_preview && <span className="admin-lesson-preview-badge">Preview</span>}
				{lesson.is_locked && <span className="admin-lesson-lock-badge">🔒</span>}
			</div>
			<div className="admin-lesson-item-meta">
				{lesson.type && <span className="admin-lesson-type">{lesson.type}</span>}
				{lesson.duration_minutes && <span>⏱️ {lesson.duration_minutes} min</span>}
			</div>
		</div>
	);
};

const CourseStructureBuilder = ({
	course,
	modules,
	onReorderModules,
	onEditModule,
	onDeleteModule,
	onToggleModuleLock,
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

		if (active.id !== over?.id) {
			const oldIndex = modules.findIndex((m) => m.id === active.id);
			const newIndex = modules.findIndex((m) => m.id === over.id);

			const newModules = arrayMove(modules, oldIndex, newIndex);
			onReorderModules(newModules.map((m, index) => ({ ...m, order: index })));
		}

		setActiveId(null);
	};

	return (
		<div className="admin-course-structure-builder">
			<div className="admin-course-structure-header">
				<h2>Structură Curs</h2>
				<button className="admin-btn admin-btn-primary" onClick={onAddModule} disabled={loading}>
					+ Adaugă Modul
				</button>
			</div>

			{modules.length === 0 ? (
				<div className="admin-empty-state">
					<div className="admin-empty-state-icon">📚</div>
					<div className="admin-empty-state-title">Nu există module</div>
					<div className="admin-empty-state-description">
						Adaugă primul modul pentru a începe construirea cursului
					</div>
					<button className="admin-btn admin-btn-primary" onClick={onAddModule}>
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
					<SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
						<div className="admin-modules-list">
							{modules.map((module) => (
								<ModuleCard
									key={module.id}
									module={module}
									onEdit={onEditModule}
									onDelete={onDeleteModule}
									onToggleLock={onToggleModuleLock}
									onAddLesson={onAddLesson}
									onAddTest={onAddTest}
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

