import React, { useEffect, useMemo, useState } from 'react';
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { DragGripIcon } from '../common/DragGripIcon';
import './StructuredQuestionRenderer.css';

const sequenceToStrings = (value) => {
	if (!Array.isArray(value)) return null;
	return value.map((item) => String(item));
};

function SortableOrderItem({ id, text, disabled, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
	const stopDrag = (event) => event.stopPropagation();
	return (
		<div
			ref={setNodeRef}
			className={`student-exam-order-item${isDragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button
				type="button"
				{...attributes}
				{...listeners}
				disabled={disabled}
				aria-label={`Trage „${text}”`}
				className="student-exam-order-handle"
			>
				<DragGripIcon size={16} />
			</button>
			<span className="student-exam-order-text" {...(disabled ? {} : listeners)}>{text}</span>
			<div className="student-exam-order-moves">
				<button
					type="button"
					className="student-exam-order-move"
					aria-label={`Mută „${text}” în sus`}
					disabled={disabled || !canMoveUp}
					onPointerDown={stopDrag}
					onClick={onMoveUp}
				>
					<CaretUp size={18} weight="bold" aria-hidden />
				</button>
				<button
					type="button"
					className="student-exam-order-move"
					aria-label={`Mută „${text}” în jos`}
					disabled={disabled || !canMoveDown}
					onPointerDown={stopDrag}
					onClick={onMoveDown}
				>
					<CaretDown size={18} weight="bold" aria-hidden />
				</button>
			</div>
		</div>
	);
}

function OrderingQuestion({ question, value, onChange, disabled }) {
	const items = question.ordering?.items || [];
	const itemMap = useMemo(() => new Map(items.map((item) => [String(item.id), item])), [items]);
	const defaultOrder = useMemo(() => items.map((item) => String(item.id)), [items]);
	const currentOrder = sequenceToStrings(value) || defaultOrder;
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const orderedItems = currentOrder
		.map((id) => itemMap.get(String(id)))
		.filter(Boolean);

	useEffect(() => {
		if (!items.length) return;
		if (!Array.isArray(value) || value.length !== items.length) {
			onChange(defaultOrder);
		}
	}, [defaultOrder, items.length, onChange, value]);

	const handleDragEnd = ({ active, over }) => {
		if (!over || active.id === over.id) return;
		const oldIndex = currentOrder.indexOf(String(active.id));
		const newIndex = currentOrder.indexOf(String(over.id));
		if (oldIndex < 0 || newIndex < 0) return;
		const next = arrayMove(currentOrder, oldIndex, newIndex);
		onChange(next);
	};

	if (!items.length) {
		return (
			<div className="student-exam-structured-empty">
				Nu există elemente pentru ordonare.
			</div>
		);
	}

	return (
		<div className="student-exam-ordering">
			<div className="student-exam-structured-hint">
				Trage elementul sau folosește săgețile ca să schimbi ordinea.
			</div>
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
				<SortableContext items={currentOrder} strategy={verticalListSortingStrategy}>
					<div className="student-exam-ordering-list">
						{orderedItems.map((item, index) => (
							<SortableOrderItem
								key={item.id}
								id={String(item.id)}
								text={item.text}
								disabled={disabled}
								canMoveUp={index > 0}
								canMoveDown={index < orderedItems.length - 1}
								onMoveUp={() => {
									if (index === 0) return;
									onChange(arrayMove(currentOrder, index, index - 1));
								}}
								onMoveDown={() => {
									if (index >= orderedItems.length - 1) return;
									onChange(arrayMove(currentOrder, index, index + 1));
								}}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}

/** Răspunsurile alese pe rânduri (id-uri din dreapta), câte unul pentru fiecare element din stânga. */
function useMatchingAnswers(value, rowCount, onChange) {
	const current = useMemo(() => {
		const next = Array.isArray(value) ? value.slice(0, rowCount) : [];
		while (next.length < rowCount) next.push(null);
		return next;
	}, [value, rowCount]);

	// un răspuns stă pe un singur rând: dacă e ales în alt rând, se mută aici
	const assign = (rowIndex, optionId) => {
		const next = current.map((item) => (optionId != null && String(item) === String(optionId) ? null : item));
		next[rowIndex] = optionId == null || optionId === '' ? null : String(optionId);
		onChange(next);
	};

	return { current, assign };
}

function MatchingQuestion({ question, value, onChange, disabled }) {
	const leftItems = question.matching?.leftItems || [];
	const rightItems = question.matching?.rightItems || [];
	const { current, assign } = useMatchingAnswers(value, leftItems.length, onChange);

	if (!leftItems.length || !rightItems.length) {
		return (
			<div className="student-exam-structured-empty">
				Nu există perechi suficiente pentru potrivire.
			</div>
		);
	}

	const rowOf = (optionId) => current.findIndex((item) => String(item) === String(optionId));

	return (
		<>
			<div className="student-exam-structured-hint">
				Alege pentru fiecare element răspunsul potrivit.
			</div>
			<ol className="student-exam-matching">
				{leftItems.map((item, idx) => {
					const selectId = `matching-${question.id}-${idx}`;
					const selected = current[idx] ?? '';
					return (
						<li key={item.id} className={`student-exam-matching-row${selected ? ' is-filled' : ''}`}>
							<label className="student-exam-matching-prompt" htmlFor={selectId}>{item.text}</label>
							<select
								id={selectId}
								className="student-exam-matching-select"
								value={selected}
								onChange={(e) => assign(idx, e.target.value)}
								disabled={disabled}
							>
								<option value="">Alege răspunsul…</option>
								{rightItems.map((opt) => {
									const usedAt = rowOf(opt.id);
									const elsewhere = usedAt !== -1 && usedAt !== idx;
									return (
										<option key={opt.id} value={String(opt.id)}>
											{elsewhere ? `${opt.text} (ales la „${leftItems[usedAt]?.text}”)` : opt.text}
										</option>
									);
								})}
							</select>
						</li>
					);
				})}
			</ol>
		</>
	);
}

function ImageMatchingQuestion({ question, value, onChange, disabled }) {
	const data = question.imageMatching || {};
	const leftItems = data.leftItems || [];
	const rightItems = data.rightItems || [];
	const { current, assign } = useMatchingAnswers(value, leftItems.length, onChange);
	const [activeRow, setActiveRow] = useState(null);

	if (!leftItems.length || !rightItems.length) return <div className="student-exam-structured-empty">Nu există suficiente perechi denumire–imagine.</div>;

	const firstEmptyRow = current.findIndex((item) => item == null);
	const targetRow = activeRow ?? (firstEmptyRow === -1 ? null : firstEmptyRow);
	const assigned = new Set(current.filter((item) => item != null).map(String));

	const pickImage = (optionId) => {
		if (targetRow == null) return;
		assign(targetRow, optionId);
		setActiveRow(null);
	};

	return (
		<>
			<div className="student-exam-structured-hint">
				Atinge o denumire, apoi imaginea potrivită. Atinge din nou o imagine aleasă ca s-o scoți.
			</div>
			<ol className="student-exam-matching">
				{leftItems.map((item, index) => {
					const selected = rightItems.find((option) => String(option.id) === String(current[index]));
					const isTarget = targetRow === index;
					return (
						<li key={item.id} className={`student-exam-matching-row${selected ? ' is-filled' : ''}`}>
							<div className="student-exam-matching-prompt">{item.text}</div>
							<button
								type="button"
								className={`student-exam-matching-slot${selected ? ' is-filled' : ''}${isTarget ? ' is-active' : ''}`}
								onClick={() => (selected ? assign(index, null) : setActiveRow(index))}
								aria-pressed={isTarget}
								aria-label={selected ? `Scoate imaginea de la ${item.text}` : `Alege imaginea pentru ${item.text}`}
								disabled={disabled}
							>
								{selected ? (
									<img src={selected.image_url} alt={selected.alt || item.text} className="student-exam-image-matching-image" />
								) : (
									<span className="student-exam-matching-placeholder">{isTarget ? 'Alege o imagine de mai jos' : 'Atinge pentru a alege'}</span>
								)}
							</button>
						</li>
					);
				})}
			</ol>
			<div className="student-exam-matching-pool">
				<div className="student-exam-matching-pool-title">Imagini disponibile</div>
				<div className="student-exam-image-matching-pool">
					{rightItems.filter((item) => !assigned.has(String(item.id))).map((item) => (
						<button
							key={item.id}
							type="button"
							className="student-exam-matching-chip"
							onClick={() => pickImage(item.id)}
							disabled={disabled || targetRow == null}
						>
							<img src={item.image_url} alt={item.alt || 'Imagine de asociat'} className="student-exam-image-matching-image" />
						</button>
					))}
					{assigned.size >= rightItems.length ? <span className="student-exam-matching-pool-empty">Toate imaginile sunt alese.</span> : null}
				</div>
			</div>
		</>
	);
}

const StructuredQuestionRenderer = ({ question, value, onChange, disabled = false }) => {
	if (question?.type === 'matching' && question?.matching) {
		return <MatchingQuestion question={question} value={value} onChange={onChange} disabled={disabled} />;
	}
	if (question?.type === 'image_matching' && question?.imageMatching) {
		return <ImageMatchingQuestion question={question} value={value} onChange={onChange} disabled={disabled} />;
	}

	if (question?.type === 'ordering' && question?.ordering) {
		return <OrderingQuestion question={question} value={value} onChange={onChange} disabled={disabled} />;
	}

	return null;
};

export default StructuredQuestionRenderer;
