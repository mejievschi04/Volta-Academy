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

const typeLabel = (type) => {
	switch (type) {
		case 'text':
			return 'Text';
		case 'video':
			return 'Video';
		case 'embed':
			return 'Embed';
		case 'file':
			return 'Fișier';
		case 'audio':
			return 'Audio';
		case 'link':
			return 'Link';
		default:
			return type || 'Block';
	}
};

const typeIcon = (type) => {
	switch (type) {
		case 'text':
			return '📝';
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

const SortableBlockRow = ({ block, isSelected, onSelect }) => {
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
			className="admin-card"
			onClick={() => onSelect(block.id)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') onSelect(block.id);
			}}
		>
			<div className="admin-card-body" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
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
						{block.source ? block.source : 'Fără conținut'}
					</div>
				</div>
			</div>
		</div>
	);
};

const ContentBlockList = ({ blocks, selectedBlockId, onSelectBlock, onReorderBlocks, disabled }) => {
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
			<div className="lms-empty-state">
				<div className="lms-empty-icon">🧱</div>
				<div className="lms-empty-title">Nu există content blocks</div>
				<div className="lms-empty-description">Adaugă primul block pentru a începe.</div>
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
						/>
					))}
				</SortableContext>
			</DndContext>
			{activeId ? null : null}
		</div>
	);
};

export default ContentBlockList;

