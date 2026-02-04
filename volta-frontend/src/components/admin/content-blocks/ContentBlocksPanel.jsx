import React, { useEffect, useMemo, useRef, useState } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import ContentBlockList from './ContentBlockList';
import ContentBlockEditor from './ContentBlockEditor';
import LessonBlocksPreview from './LessonBlocksPreview';

const debounceMs = 900;

const ContentBlocksPanel = ({ courseId, lesson, onRefresh }) => {
	const { showToast } = useToast();

	const blocks = useMemo(() => {
		// Laravel relation name is `contentBlocks` but serialized as `content_blocks`
		return Array.isArray(lesson?.content_blocks) ? lesson.content_blocks : Array.isArray(lesson?.contentBlocks) ? lesson.contentBlocks : [];
	}, [lesson]);

	const [selectedBlockId, setSelectedBlockId] = useState(blocks[0]?.id || null);
	const [draft, setDraft] = useState(null);
	const [saveStatus, setSaveStatus] = useState(null);
	const [rightTab, setRightTab] = useState('edit'); // edit | preview

	const pendingPatchRef = useRef(null);
	const debounceRef = useRef(null);

	useEffect(() => {
		// Reset selection when lesson changes
		setSelectedBlockId(blocks[0]?.id || null);
		setRightTab('edit');
	}, [lesson?.id]);

	useEffect(() => {
		const selected = blocks.find((b) => b.id === selectedBlockId) || null;
		setDraft(selected ? { ...selected } : null);
	}, [blocks, selectedBlockId]);

	useEffect(() => {
		const isTypingTarget = (target) => {
			if (!target) return false;
			if (target.isContentEditable) return true;
			const tag = (target.tagName || '').toLowerCase();
			return tag === 'input' || tag === 'textarea' || tag === 'select';
		};

		const onKeyDown = (e) => {
			if (isTypingTarget(e.target)) return;

			const meta = e.metaKey || e.ctrlKey;

			// Toggle preview
			if (meta && e.key === 'Enter') {
				e.preventDefault();
				setRightTab((t) => (t === 'preview' ? 'edit' : 'preview'));
				return;
			}

			// Duplicate selected block
			if (meta && (e.key === 'd' || e.key === 'D')) {
				if (!selectedBlockId || rightTab === 'preview') return;
				e.preventDefault();
				handleDuplicateBlock(selectedBlockId);
				return;
			}

			// Reorder selected block
			if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				if (!selectedBlockId || rightTab === 'preview') return;
				e.preventDefault();
				const ids = blocks.map((b) => b.id);
				const from = ids.findIndex((id) => id === selectedBlockId);
				if (from === -1) return;
				const to = e.key === 'ArrowUp' ? from - 1 : from + 1;
				if (to < 0 || to >= ids.length) return;
				const next = [...ids];
				const [moved] = next.splice(from, 1);
				next.splice(to, 0, moved);
				handleReorder(next);
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [blocks, rightTab, selectedBlockId]);

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
			const msg = e?.response?.data?.message || e?.message || 'Eroare la crearea content block.';
			showToast(msg, 'error');
		}
	};

	const handleAddTemplate = async (templateId) => {
		const templates = {
			lesson_skeleton: {
				blocks: [
					{ type: 'text', source: `<h2>Introducere</h2><p>Ce va învăța cursantul în această lecție?</p>` },
					{ type: 'video', source: 'https://www.youtube.com/watch?v=' },
					{ type: 'text', source: `<h3>Checklist</h3><ul><li>✅ Pas 1</li><li>✅ Pas 2</li><li>✅ Pas 3</li></ul>` },
					{ type: 'text', source: `<h3>Resurse</h3><ul><li><a href="https://">Link 1</a></li><li><a href="https://">Link 2</a></li></ul>` },
				],
			},
			onboarding_skeleton: {
				blocks: [
					{ type: 'text', source: `<h2>Bine ați venit</h2><p>Context + obiective pentru onboarding.</p>` },
					{ type: 'text', source: `<h3>Ce trebuie să știi</h3><ul><li>Politici</li><li>Tooling</li><li>Contacte</li></ul>` },
					{ type: 'video', source: 'https://www.youtube.com/watch?v=' },
					{ type: 'text', source: `<h3>Pașii următori</h3><ol><li>Pas 1</li><li>Pas 2</li><li>Pas 3</li></ol>` },
				],
			},
			compliance_skeleton: {
				blocks: [
					{ type: 'text', source: `<h2>Conformitate</h2><p>Reguli + scop + ce se evaluează.</p>` },
					{ type: 'file', source: 'https://.../policy.pdf' },
					{ type: 'text', source: `<h3>Checklist</h3><ul><li>✅ Am citit documentul</li><li>✅ Am înțeles regulile</li></ul>` },
					{ type: 'link', source: 'https://...' },
				],
			},
			section_intro: {
				type: 'text',
				source: `<h2>Introducere</h2><p>Scrie aici un scurt context pentru lecție.</p>`,
			},
			key_takeaways: {
				type: 'text',
				source: `<h3>Puncte cheie</h3><ul><li>Ideea #1</li><li>Ideea #2</li><li>Ideea #3</li></ul>`,
			},
			checklist: {
				type: 'text',
				source: `<h3>Checklist</h3><ul><li>✅ Pas 1</li><li>✅ Pas 2</li><li>✅ Pas 3</li></ul>`,
			},
			resources: {
				type: 'text',
				source: `<h3>Resurse</h3><ul><li><a href="https://">Link 1</a></li><li><a href="https://">Link 2</a></li></ul>`,
			},
			video_embed: {
				type: 'video',
				source: 'https://www.youtube.com/watch?v=',
			},
			download_file: {
				type: 'file',
				source: 'https://.../fisier.pdf',
			},
		};

		const tpl = templates[templateId];
		if (!tpl) return;

		try {
			setSaveStatus('saving');

			if (Array.isArray(tpl.blocks) && tpl.blocks.length > 0) {
				let lastId = null;
				for (const b of tpl.blocks) {
					const res = await adminService.builderCreateContentBlock(courseId, lesson.id, {
						type: b.type,
						source: b.source ?? '',
						metadata: b.metadata || {},
						visible: b.visible ?? true,
					});
					lastId = res?.content_block?.id || lastId;
				}
				await onRefresh?.();
				if (lastId) setSelectedBlockId(lastId);
				setRightTab('edit');
				setSaveStatus('saved');
				return;
			}

			await adminService.builderCreateContentBlock(courseId, lesson.id, {
				type: tpl.type,
				source: tpl.source,
				metadata: tpl.metadata || {},
				visible: true,
			});
			await onRefresh?.();
			setSaveStatus('saved');
		} catch (e) {
			console.error('Create template block failed:', e);
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

	const handleDeleteBlock = async (blockId) => {
		if (!window.confirm('Ștergi acest content block?')) return;
		try {
			setSaveStatus('saving');
			const nextSelection = (() => {
				const idx = blocks.findIndex((b) => b.id === blockId);
				if (idx === -1) return selectedBlockId;
				if (selectedBlockId !== blockId) return selectedBlockId;
				return blocks[idx + 1]?.id || blocks[idx - 1]?.id || null;
			})();

			await adminService.builderDeleteContentBlock(courseId, blockId);
			setSelectedBlockId(nextSelection);
			setDraft(null);
			await onRefresh?.();
			setSaveStatus('saved');
		} catch (e) {
			console.error('Delete content block failed:', e);
			setSaveStatus('error');
		}
	};

	const handleDuplicateBlock = async (blockId) => {
		const original = blocks.find((b) => b.id === blockId);
		if (!original) return;

		try {
			setSaveStatus('saving');
			const res = await adminService.builderCreateContentBlock(courseId, lesson.id, {
				type: original.type,
				source: original.source || '',
				metadata: original.metadata || {},
				language: original.language || null,
				visible: original.visible !== undefined ? !!original.visible : true,
			});

			const newId = res?.content_block?.id;
			if (newId) {
				const ids = blocks.map((b) => b.id);
				const at = ids.findIndex((id) => id === blockId);
				if (at !== -1) {
					const nextIds = [...ids];
					nextIds.splice(at + 1, 0, newId);
					await adminService.builderReorderContentBlocks(courseId, lesson.id, nextIds);
				}
				setSelectedBlockId(newId);
			}

			await onRefresh?.();
			setSaveStatus('saved');
		} catch (e) {
			console.error('Duplicate content block failed:', e);
			setSaveStatus('error');
		}
	};

	const handleDuplicateAs = async (blockId, targetType) => {
		const original = blocks.find((b) => b.id === blockId);
		if (!original) return;

		const normalizeSource = () => {
			const src = original.source || '';
			if (targetType === 'text') {
				if (!src) return '';
				if (original.type === 'text') return src;
				// wrap link-ish sources into a text paragraph
				return `<p><a href="${src}" target="_blank" rel="noreferrer">${src}</a></p>`;
			}

			// URL-based blocks
			if (['video', 'embed', 'file', 'audio', 'link'].includes(targetType)) {
				// keep URL if it looks like one
				if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) return src;
				return '';
			}

			// image: use source URL or first gallery image
			if (targetType === 'image') {
				if (original.type === 'gallery') {
					const imgs = Array.isArray(original.metadata?.images) ? original.metadata.images : [];
					return imgs[0]?.url || '';
				}
				return src;
			}

			// gallery: source empty, metadata.images preserved by original.metadata
			if (targetType === 'gallery') return '';

			return src;
		};

		try {
			setSaveStatus('saving');
			const meta = original.metadata || {};
			// For gallery, ensure we have images (from image block: wrap single image)
			const metadata =
				targetType === 'gallery' && original.type === 'image' && original.source
					? { images: [{ url: original.source, alt: '', caption: '' }] }
					: meta;

			const res = await adminService.builderCreateContentBlock(courseId, lesson.id, {
				type: targetType,
				source: normalizeSource(),
				metadata,
				language: original.language || null,
				visible: original.visible !== undefined ? !!original.visible : true,
			});

			const newId = res?.content_block?.id;
			if (newId) {
				const ids = blocks.map((b) => b.id);
				const at = ids.findIndex((id) => id === blockId);
				if (at !== -1) {
					const nextIds = [...ids];
					nextIds.splice(at + 1, 0, newId);
					await adminService.builderReorderContentBlocks(courseId, lesson.id, nextIds);
				}
				setSelectedBlockId(newId);
			}

			await onRefresh?.();
			setSaveStatus('saved');
		} catch (e) {
			console.error('Duplicate-as content block failed:', e);
			setSaveStatus('error');
		}
	};

	return (
		<div className="admin-course-builder-content-blocks">
			<div className="admin-course-builder-content-blocks-header">
				<div>
					<h3 className="admin-course-builder-content-blocks-title">Blocuri de conținut</h3>
					<p className="admin-course-builder-content-blocks-hint">Conținutul lecției este compus din blocuri reordonabile (text, video, file, embed...).</p>
				</div>
				<div className="admin-course-builder-content-blocks-toolbar">
					<AutoSaveIndicator status={saveStatus} />
					<div className="admin-course-builder-add-buttons">
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('text')}>+ Text</button>
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('video')}>+ Video</button>
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('embed')}>+ Încorporare</button>
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('image')}>+ Imagine</button>
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('gallery')}>+ Galerie</button>
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('file')}>+ Fișier</button>
						<button className="admin-course-builder-add-btn" onClick={() => handleAddBlock('link')}>+ Legătură</button>
						<select
							className="admin-course-builder-select"
							value=""
							onChange={(e) => {
								const v = e.target.value;
								if (v) handleAddTemplate(v);
							}}
						>
							<option value="">+ Șablon…</option>
							<option value="lesson_skeleton">Lot: Schelet lecție (Intro + Video + Checklist + Resurse)</option>
							<option value="onboarding_skeleton">Lot: Onboarding (Bun venit + ce trebuie să știi + video + pași următori)</option>
							<option value="compliance_skeleton">Lot: Conformitate (Fișier politică + checklist + link)</option>
							<option value="section_intro">Secțiune: Introducere</option>
							<option value="key_takeaways">Secțiune: Puncte cheie</option>
							<option value="checklist">Secțiune: Checklist</option>
							<option value="resources">Secțiune: Resurse</option>
							<option value="video_embed">Bloc: Video (YouTube)</option>
							<option value="download_file">Bloc: Fișier (descărcare)</option>
						</select>
						<select
							className="admin-course-builder-select admin-course-builder-select-sm"
							value=""
							disabled={!draft || rightTab === 'preview'}
							onChange={(e) => {
								const v = e.target.value;
								if (v && draft?.id) handleDuplicateAs(draft.id, v);
							}}
							title={!draft ? 'Selectează un block pentru duplicare' : 'Duplică block-ul selectat și convertește tipul'}
						>
							<option value="">⧉ Duplică ca…</option>
							<option value="text">Text</option>
							<option value="video">Video</option>
							<option value="embed">Încorporare</option>
							<option value="image">Imagine</option>
							<option value="gallery">Galerie</option>
							<option value="file">Fișier</option>
							<option value="link">Legătură</option>
							<option value="audio">Audio</option>
						</select>
						<button
							className="admin-course-builder-preview-toggle"
							onClick={() => setRightTab((t) => (t === 'preview' ? 'edit' : 'preview'))}
						>
							{rightTab === 'preview' ? '✏️ Editare' : '👁️ Preview lecție'}
						</button>
					</div>
				</div>
			</div>

			<div className="admin-course-builder-content-grid">
				<div className="admin-course-builder-blocks-list-wrap">
					<ContentBlockList
						blocks={blocks}
						selectedBlockId={selectedBlockId}
						onSelectBlock={setSelectedBlockId}
						onReorderBlocks={handleReorder}
						onDeleteBlock={handleDeleteBlock}
						disabled={rightTab === 'preview'}
					/>
				</div>
				<div className="admin-course-builder-editor-wrap">
					{rightTab === 'preview' ? (
						<LessonBlocksPreview
							blocks={blocks.map((b) => (draft && b.id === draft.id ? { ...b, ...draft } : b))}
						/>
					) : (
						<ContentBlockEditor courseId={courseId} block={draft} onChange={scheduleSave} />
					)}
				</div>
			</div>
		</div>
	);
};

export default ContentBlocksPanel;

