import React, { useState } from 'react';
import TextBlockEditor from './blocks/TextBlockEditor';
import UrlBlockEditor from './blocks/UrlBlockEditor';
import GalleryBlockEditor from './blocks/GalleryBlockEditor';
import MediaUploader from '../media/MediaUploader';
import MediaLibraryModal from '../media/MediaLibraryModal';

const ContentBlockEditor = ({ courseId, block, onChange }) => {
	const [libraryOpen, setLibraryOpen] = useState(false);
	const [libraryType, setLibraryType] = useState(null);

	if (!block) {
		return (
			<div className="lms-empty-state">
				<div className="lms-empty-icon">🧩</div>
				<div className="lms-empty-title">Selectează un block</div>
				<div className="lms-empty-description">Alege un bloc de conținut din listă pentru a-l edita.</div>
			</div>
		);
	}

	switch (block.type) {
		case 'text':
			return <TextBlockEditor value={block.source || ''} onChange={(val) => onChange({ source: val })} />;
		case 'image':
			return (
				<div style={{ display: 'grid', gap: 'var(--space-4)' }}>
					{block.source ? (
						<div className="admin-card">
							<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
								<div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
									Previzualizare
								</div>
								<button
									type="button"
									className="admin-btn admin-btn-secondary"
									onClick={() => window.open(block.source, '_blank', 'noopener,noreferrer')}
									style={{ justifySelf: 'start' }}
								>
									Deschide imaginea
								</button>
								<img
									src={block.source}
									alt=""
									style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid var(--border-primary)' }}
									loading="lazy"
								/>
							</div>
						</div>
					) : null}

					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
						<div className="admin-settings-hint" style={{ margin: 0 }}>
							Încarcă sau alege o imagine existentă din biblioteca media.
						</div>
						<button
							type="button"
							className="admin-btn admin-btn-secondary"
							onClick={() => {
								setLibraryType('image');
								setLibraryOpen(true);
							}}
						>
							Bibliotecă
						</button>
					</div>

					<MediaUploader
						courseId={courseId}
						accept="image/*"
						suggestedType="image"
						onUploaded={(res) =>
							onChange({
								source: res?.url || '',
								metadata: { ...(block.metadata || {}), upload: res || null },
							})
						}
					/>

					<UrlBlockEditor
						label="URL imagine"
						value={block.source || ''}
						placeholder="https://.../image.png"
						onChange={(val) => onChange({ source: val })}
					/>

					<MediaLibraryModal
						open={libraryOpen && libraryType === 'image'}
						onClose={() => setLibraryOpen(false)}
						courseId={courseId}
						type="image"
						onSelect={(url, asset) => {
							onChange({
								source: url || '',
								metadata: { ...(block.metadata || {}), media_asset: asset || null },
							});
							setLibraryOpen(false);
						}}
					/>
				</div>
			);
		case 'gallery':
			return (
				<GalleryBlockEditor courseId={courseId} block={block} onChange={onChange} />
			);
		case 'video':
			return (
				<UrlBlockEditor
					label="URL video"
					value={block.source || ''}
					placeholder="https://www.youtube.com/watch?v=..."
					onChange={(val) => onChange({ source: val })}
				/>
			);
		case 'embed':
			return (
				<UrlBlockEditor
					label="URL încorporare"
					value={block.source || ''}
					placeholder="https://..."
					onChange={(val) => onChange({ source: val })}
				/>
			);
		case 'file':
			return (
				<div style={{ display: 'grid', gap: 'var(--space-4)' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
						<div className="admin-settings-hint" style={{ margin: 0 }}>
							Încarcă sau alege un fișier existent din bibliotecă.
						</div>
						<button
							type="button"
							className="admin-btn admin-btn-secondary"
							onClick={() => {
								setLibraryType('document');
								setLibraryOpen(true);
							}}
						>
							Bibliotecă
						</button>
					</div>
					<MediaUploader
						courseId={courseId}
						accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
						suggestedType="document"
						onUploaded={(res) =>
							onChange({
								source: res?.url || '',
								metadata: { ...(block.metadata || {}), upload: res || null },
							})
						}
					/>
					<UrlBlockEditor
						label="URL fișier"
						value={block.source || ''}
						placeholder="https://.../fisier.pdf"
						onChange={(val) => onChange({ source: val })}
					/>
					<MediaLibraryModal
						open={libraryOpen && libraryType === 'document'}
						onClose={() => setLibraryOpen(false)}
						courseId={courseId}
						type="document"
						onSelect={(url, asset) => {
							onChange({
								source: url || '',
								metadata: { ...(block.metadata || {}), media_asset: asset || null },
							});
							setLibraryOpen(false);
						}}
					/>
				</div>
			);
		case 'audio':
			return (
				<div style={{ display: 'grid', gap: 'var(--space-4)' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
						<div className="admin-settings-hint" style={{ margin: 0 }}>
							Încarcă sau alege un fișier existent din bibliotecă.
						</div>
						<button
							type="button"
							className="admin-btn admin-btn-secondary"
							onClick={() => {
								setLibraryType('audio');
								setLibraryOpen(true);
							}}
						>
							Bibliotecă
						</button>
					</div>
					<MediaUploader
						courseId={courseId}
						accept="audio/*"
						suggestedType="audio"
						onUploaded={(res) =>
							onChange({
								source: res?.url || '',
								metadata: { ...(block.metadata || {}), upload: res || null },
							})
						}
					/>
					<UrlBlockEditor
						label="URL audio"
						value={block.source || ''}
						placeholder="https://.../audio.mp3"
						onChange={(val) => onChange({ source: val })}
					/>
					<MediaLibraryModal
						open={libraryOpen && libraryType === 'audio'}
						onClose={() => setLibraryOpen(false)}
						courseId={courseId}
						type="audio"
						onSelect={(url, asset) => {
							onChange({
								source: url || '',
								metadata: { ...(block.metadata || {}), media_asset: asset || null },
							});
							setLibraryOpen(false);
						}}
					/>
				</div>
			);
		case 'link':
			return (
				<UrlBlockEditor
					label="Legătură"
					value={block.source || ''}
					placeholder="https://..."
					onChange={(val) => onChange({ source: val })}
				/>
			);
		default:
			return (
				<div>
					<label className="admin-settings-label">Conținut (raw)</label>
					<textarea
						className="admin-settings-textarea"
						value={block.source || ''}
						onChange={(e) => onChange({ source: e.target.value })}
						rows={10}
					/>
				</div>
			);
	}
};

export default ContentBlockEditor;

