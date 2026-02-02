import React from 'react';
import TextBlockEditor from './blocks/TextBlockEditor';
import UrlBlockEditor from './blocks/UrlBlockEditor';

const ContentBlockEditor = ({ block, onChange }) => {
	if (!block) {
		return (
			<div className="lms-empty-state">
				<div className="lms-empty-icon">🧩</div>
				<div className="lms-empty-title">Selectează un block</div>
				<div className="lms-empty-description">Alege un content block din listă pentru a-l edita.</div>
			</div>
		);
	}

	switch (block.type) {
		case 'text':
			return <TextBlockEditor value={block.source || ''} onChange={(val) => onChange({ source: val })} />;
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
					label="URL embed"
					value={block.source || ''}
					placeholder="https://..."
					onChange={(val) => onChange({ source: val })}
				/>
			);
		case 'file':
			return (
				<UrlBlockEditor
					label="URL fișier"
					value={block.source || ''}
					placeholder="https://.../fisier.pdf"
					onChange={(val) => onChange({ source: val })}
				/>
			);
		case 'audio':
			return (
				<UrlBlockEditor
					label="URL audio"
					value={block.source || ''}
					placeholder="https://.../audio.mp3"
					onChange={(val) => onChange({ source: val })}
				/>
			);
		case 'link':
			return (
				<UrlBlockEditor
					label="Link"
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

