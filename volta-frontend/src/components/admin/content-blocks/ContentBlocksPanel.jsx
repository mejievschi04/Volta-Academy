import React, { useEffect, useMemo, useRef, useState } from 'react';
import { adminService } from '../../../services/api';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import ContentBlockList from './ContentBlockList';
import ContentBlockEditor from './ContentBlockEditor';

const debounceMs = 900;

const ContentBlocksPanel = ({ courseId, lesson, onRefresh }) => {
	const blocks = useMemo(() => {
		// Laravel relation name is `contentBlocks` but serialized as `content_blocks`
		return Array.isArray(lesson?.content_blocks) ? lesson.content_blocks : Array.isArray(lesson?.contentBlocks) ? lesson.contentBlocks : [];
	}, [lesson]);

	const [selectedBlockId, setSelectedBlockId] = useState(blocks[0]?.id || null);
	const [draft, setDraft] = useState(null);
	const [saveStatus, setSaveStatus] = useState(null);

	const pendingPatchRef = useRef(null);
	const debounceRef = useRef(null);

	useEffect(() => {
		// Reset selection when lesson changes
		setSelectedBlockId(blocks[0]?.id || null);
	}, [lesson?.id]);

	useEffect(() => {
		const selected = blocks.find((b) => b.id === selectedBlockId) || null;
		setDraft(selected ? { ...selected } : null);
	}, [blocks, selectedBlockId]);

	const scheduleSave = (patch) => {
		if (!draft) return;
		const next = { ...draft, ...patch };
		setDraft(next);

		pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...patch };
		setSaveStatus('saving');

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			const pending = pendingPatchRef.current;
			pendingPatchRef.current = null;
			try {
				await adminService.builderUpdateContentBlock(courseId, next.id, pending);
				setSaveStatus('saved');
			} catch (e) {
				console.error('Content block autosave failed:', e);
				setSaveStatus('error');
			}
		}, debounceMs);
	};

	const handleAddBlock = async (type) => {
		try {
			await adminService.builderCreateContentBlock(courseId, lesson.id, {
				type,
				source: '',
				metadata: {},
				visible: true,
			});
			await onRefresh?.();
			setSaveStatus(null);
		} catch (e) {
			console.error('Create content block failed:', e);
			setSaveStatus('error');
		}
	};

	const handleReorder = async (ids) => {
		try {
			setSaveStatus('saving');
			await adminService.builderReorderContentBlocks(courseId, lesson.id, ids);
			setSaveStatus('saved');
			await onRefresh?.();
		} catch (e) {
			console.error('Reorder content blocks failed:', e);
			setSaveStatus('error');
		}
	};

	return (
		<div className="admin-settings-section" style={{ marginTop: 'var(--space-6)' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
				<div>
					<h3 className="admin-settings-section-title">Content blocks</h3>
					<div className="admin-settings-hint">Conținutul lecției este compus din blocuri reordonabile (text, video, file, embed...).</div>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
					<AutoSaveIndicator status={saveStatus} />
					<div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
						<button className="admin-btn admin-btn-secondary" onClick={() => handleAddBlock('text')}>+ Text</button>
						<button className="admin-btn admin-btn-secondary" onClick={() => handleAddBlock('video')}>+ Video</button>
						<button className="admin-btn admin-btn-secondary" onClick={() => handleAddBlock('embed')}>+ Embed</button>
						<button className="admin-btn admin-btn-secondary" onClick={() => handleAddBlock('file')}>+ File</button>
						<button className="admin-btn admin-btn-secondary" onClick={() => handleAddBlock('link')}>+ Link</button>
					</div>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
				<div>
					<ContentBlockList
						blocks={blocks}
						selectedBlockId={selectedBlockId}
						onSelectBlock={setSelectedBlockId}
						onReorderBlocks={handleReorder}
					/>
				</div>
				<div>
					<ContentBlockEditor block={draft} onChange={scheduleSave} />
				</div>
			</div>
		</div>
	);
};

export default ContentBlocksPanel;

