import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import ConfirmModal from '../../../components/common/ConfirmModal';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import ContentBlockList from './ContentBlockList';
import ContentBlockEditor from './ContentBlockEditor';

const debounceMs = 900;

const BLOCK_TYPES = [
	{ id: 'text', label: 'Text' },
	{ id: 'video', label: 'Video' },
	{ id: 'image', label: 'Imagine' },
	{ id: 'gallery', label: 'Galerie' },
	{ id: 'pdf', label: 'PDF (conținut)' },
	{ id: 'file', label: 'Fișier' },
	{ id: 'link', label: 'Legătură' },
	{ id: 'embed', label: 'Încorporare' },
];

const TEMPLATE_OPTIONS = [
	{ id: 'lesson_skeleton', label: 'Schelet lecție (Intro + Video + Checklist + Resurse)' },
	{ id: 'onboarding_skeleton', label: 'Schelet onboarding' },
	{ id: 'compliance_skeleton', label: 'Schelet conformitate' },
	{ id: 'section_intro', label: 'Introducere' },
	{ id: 'key_takeaways', label: 'Puncte cheie' },
	{ id: 'checklist', label: 'Checklist' },
	{ id: 'resources', label: 'Resurse' },
	{ id: 'video_embed', label: 'Video (YouTube)' },
	{ id: 'pdf_embed', label: 'PDF (afișat în lecție)' },
	{ id: 'download_file', label: 'Fișier (descărcare)' },
];

const ContentBlocksPanel = ({ courseId, lesson, onRefresh }) => {
	const { showToast } = useToast();

	const blocks = useMemo(() => {
		// Laravel relation name is `contentBlocks` but serialized as `content_blocks`
		return Array.isArray(lesson?.content_blocks) ? lesson.content_blocks : Array.isArray(lesson?.contentBlocks) ? lesson.contentBlocks : [];
	}, [lesson]);

	const [selectedBlockId, setSelectedBlockId] = useState(blocks[0]?.id || null);
	const [draft, setDraft] = useState(null);
	const [saveStatus, setSaveStatus] = useState(null);
	const [deleteConfirmBlockId, setDeleteConfirmBlockId] = useState(null);
	const [deleteBlockLoading, setDeleteBlockLoading] = useState(false);
	const [addDropdownOpen, setAddDropdownOpen] = useState(false);

	const pendingPatchRef = useRef(null);
	const debounceRef = useRef(null);
	const addDropdownRef = useRef(null);

	useEffect(() => {
		const onOutside = (e) => {
			if (addDropdownRef.current && !addDropdownRef.current.contains(e.target)) setAddDropdownOpen(false);
		};
		if (addDropdownOpen) {
			document.addEventListener('click', onOutside);
			return () => document.removeEventListener('click', onOutside);
		}
	}, [addDropdownOpen]);

	useEffect(() => {
		// Reset selection when lesson changes
		setSelectedBlockId(blocks[0]?.id || null);
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

			// Escape: închide meniul Adaugă bloc dacă e deschis
			if (e.key === 'Escape') {
				if (addDropdownOpen) {
					e.preventDefault();
					setAddDropdownOpen(false);
				}
				return;
			}

			// Ctrl+Shift+A: deschide/închide meniul Adaugă bloc
			if (e.ctrlKey && e.shiftKey && e.key === 'A') {
				e.preventDefault();
				setAddDropdownOpen((o) => !o);
				return;
			}

			// Alt+↑/↓: reordonează blocul selectat
			if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				if (!selectedBlockId) return;
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
	}, [blocks, selectedBlockId, addDropdownOpen]);

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
			pdf_embed: {
				type: 'pdf',
				source: 'https://.../document.pdf',
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

	const handleDeleteBlockClick = (blockId) => {
		setDeleteConfirmBlockId(blockId);
	};

	const handleDeleteBlock = async (blockId) => {
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

	const handleConfirmDeleteBlock = async () => {
		if (!deleteConfirmBlockId) return;
		setDeleteBlockLoading(true);
		try {
			await handleDeleteBlock(deleteConfirmBlockId);
			setDeleteConfirmBlockId(null);
		} finally {
			setDeleteBlockLoading(false);
		}
	};

	const blockTypeLabel = useCallback((type) => BLOCK_TYPES.find((t) => t.id === type)?.label || type || 'Bloc', []);

	return (
		<div className="admin-course-builder-content-blocks">
			<header className="admin-course-builder-content-blocks-header">
				<div className="admin-course-builder-content-blocks-head">
					<h3 className="admin-course-builder-content-blocks-title">Conținut lecție</h3>
					<p className="admin-course-builder-content-blocks-hint">
						Adaugă blocuri → selectează un bloc → editează. Poți reordona prin drag.
					</p>
					<p className="admin-course-builder-content-blocks-shortcuts" title="Scurtături tastatură">
						<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> adaugă bloc · <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> reordonează · <kbd>Esc</kbd> închide meniul
					</p>
				</div>
				<div className="admin-course-builder-content-blocks-toolbar">
					<div className="admin-course-builder-add-dropdown-wrap" ref={addDropdownRef}>
						<button
							type="button"
							className="admin-course-builder-add-block-btn"
							onClick={() => setAddDropdownOpen((o) => !o)}
							aria-expanded={addDropdownOpen}
							aria-haspopup="true"
							title="Adaugă bloc de conținut (Ctrl+Shift+A)"
						>
							+ Adaugă bloc
						</button>
						{addDropdownOpen && (
							<div className="admin-course-builder-add-dropdown">
								<div className="admin-course-builder-add-dropdown-section">
									<span className="admin-course-builder-add-dropdown-section-title">Tip bloc</span>
									{BLOCK_TYPES.map((t) => (
										<button
											key={t.id}
											type="button"
											className="admin-course-builder-add-dropdown-item"
											onClick={() => {
												handleAddBlock(t.id);
												setAddDropdownOpen(false);
											}}
											title={`Adaugă bloc ${t.label}`}
										>
											{t.label}
										</button>
									))}
								</div>
								<div className="admin-course-builder-add-dropdown-section">
									<span className="admin-course-builder-add-dropdown-section-title">Șabloane</span>
									{TEMPLATE_OPTIONS.map((t) => (
										<button
											key={t.id}
											type="button"
											className="admin-course-builder-add-dropdown-item"
											onClick={() => {
												handleAddTemplate(t.id);
												setAddDropdownOpen(false);
											}}
											title={`Șablon: ${t.label}`}
										>
											{t.label}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
					<span title="Salvare automată la câteva secunde după editare">
						<AutoSaveIndicator status={saveStatus} />
					</span>
				</div>
			</header>

			<div className="admin-course-builder-content-grid">
				<div className="admin-course-builder-blocks-list-wrap">
					<ContentBlockList
						blocks={blocks}
						selectedBlockId={selectedBlockId}
						onSelectBlock={setSelectedBlockId}
						onReorderBlocks={handleReorder}
						onDeleteBlock={handleDeleteBlockClick}
						onAddBlock={handleAddBlock}
					/>
				</div>
				<div className="admin-course-builder-editor-wrap">
					{draft ? (
						<>
							<div className="admin-course-builder-editor-toolbar">
								<span className="admin-course-builder-editor-toolbar-badge">
									Bloc: {blockTypeLabel(draft.type)}
								</span>
								<button
									type="button"
									className="admin-course-builder-editor-delete-btn"
									onClick={() => handleDeleteBlockClick(draft.id)}
									title="Șterge acest bloc din lecție"
								>
									Șterge bloc
								</button>
							</div>
							<ContentBlockEditor courseId={courseId} block={draft} onChange={scheduleSave} />
						</>
					) : (
						<div className="admin-course-builder-editor-empty">
							<p className="admin-course-builder-editor-empty-text">Selectează un bloc din listă sau adaugă unul nou.</p>
							<p className="admin-course-builder-editor-empty-hint">Blocul selectat se editează aici; modificările se salvează automat.</p>
						</div>
					)}
				</div>
			</div>

			<ConfirmModal
				open={!!deleteConfirmBlockId}
				onClose={() => setDeleteConfirmBlockId(null)}
				onConfirm={handleConfirmDeleteBlock}
				title="Șterge content block"
				message="Ștergi acest content block?"
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteBlockLoading}
			/>
		</div>
	);
};

export default ContentBlocksPanel;

