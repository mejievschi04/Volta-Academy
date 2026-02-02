import React from 'react';
import RichTextEditor from '../../../RichTextEditor';

const TextBlockEditor = ({ value, onChange }) => {
	return (
		<div>
			<label className="admin-settings-label">Conținut</label>
			<RichTextEditor value={value || ''} onChange={onChange} placeholder="Scrie conținutul lecției..." />
		</div>
	);
};

export default TextBlockEditor;

