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

const blockPreviewText = (block) => {
	if (block.type === 'gallery') {
		const imgs = Array.isArray(block.metadata?.images) ? block.metadata.images : [];
		return imgs.length > 0 ? `${imgs.length} imagini` : 'Fără imagini';
	}
	return block.source ? block.source : 'Fără conținut';
};

const typeLabel = (type) => {
	switch (type) {
		case 'text':
			return 'Text';
		case 'image':
			return 'Imagine';
		case 'gallery':
			return 'Galerie';
		case 'video':
			return 'Video';
		case 'embed':
			return 'Încorporare';
		case 'file':
			return 'Fișier';
		case 'audio':
			return 'Audio';
		case 'link':
			return 'Legătură';
		default:
			return type || 'Bloc';
	}
};

const typeIcon = (type) => {
	switch (type) {
		case 'text':
			return '📝';
		case 'image':
			return '🖼️';
		case 'gallery':
			return '🖼️📷';
		case 'video':
			return '🎬';
		case 'embed':
			return '🧩';
		case 'file':
			return '📎';
		case 'audio':
			return '🎧';
		case 'link':
			return '🔗';
		default:
			return '⬛';
	}
};

const SortableBlockRow = ({ block, isSelected, onSelect, onDelete }) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: block.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.6 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`admin-course-builder-block-card ${isSelected ? 'is-selected' : ''}`}
			onClick={() => onSelect(block.id)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onSelect(block.id);
			}}
		>
			<div className="admin-course-builder-block-card-body">
				<div
					className="admin-module-card-drag-handle"
					{...attributes}
					{...listeners}
					style={{ cursor: 'grab', userSelect: 'none' }}
					title="Trage pentru reordonare"
				>
					⋮⋮
				</div>
				<div style={{ fontSize: '20px' }}>{typeIcon(block.type)}</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
						<div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
							{typeLabel(block.type)}
						</div>
						{isSelected && (
							<span
								style={{
									fontSize: 'var(--font-size-xs)',
									color: 'var(--text-secondary)',
									border: '1px solid var(--border-primary)',
									padding: '2px 6px',
									borderRadius: '999px',
								}}
							>
								Selectat
							</span>
						)}
					</div>
					<div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{blockPreviewText(block)}
					</div>
				</div>
				{onDelete && (
					<button
						type="button"
						className="lms-btn-icon va-btn-danger admin-block-delete-btn"
						title="Șterge"
						onClick={(e) => {
							e.stopPropagation();
							onDelete(block.id);
						}}
					>
						🗑️
					</button>
				)}
			</div>
		</div>
	);
};

const ContentBlockList = ({ blocks, selectedBlockId, onSelectBlock, onReorderBlocks, onDeleteBlock, disabled }) => {
	const [activeId, setActiveId] = useState(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const handleDragStart = (event) => {
		setActiveId(event.active.id);
	};

	const handleDragEnd = (event) => {
		const { active, over } = event;
		setActiveId(null);

		if (!over?.id || active.id === over.id) return;
		const oldIndex = blocks.findIndex((b) => b.id === active.id);
		const newIndex = blocks.findIndex((b) => b.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const next = arrayMove(blocks, oldIndex, newIndex);
		onReorderBlocks?.(next.map((b) => b.id));
	};

	if (!blocks || blocks.length === 0) {
		return (
			<div className="admin-course-builder-blocks-empty">
				<div className="admin-course-builder-blocks-empty-icon">🧱</div>
				<div className="admin-course-builder-blocks-empty-title">Nu există blocuri de conținut</div>
				<div className="admin-course-builder-blocks-empty-desc">Adaugă primul block pentru a începe.</div>
			</div>
		);
	}

	return (
		<div className="admin-course-builder-blocks-list">
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
					{blocks.map((block) => (
						<SortableBlockRow
							key={block.id}
							block={block}
							isSelected={block.id === selectedBlockId}
							onSelect={disabled ? () => {} : onSelectBlock}
							onDelete={disabled ? null : onDeleteBlock}
						/>
					))}
				</SortableContext>
			</DndContext>
			{activeId ? null : null}
		</div>
	);
};

export default ContentBlockList;

