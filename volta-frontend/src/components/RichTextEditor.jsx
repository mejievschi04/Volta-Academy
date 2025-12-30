import React, { useRef, useEffect, useState } from 'react';

const RichTextEditor = ({ value, onChange, onBlur, placeholder, style }) => {
	const editorRef = useRef(null);
	const [isFocused, setIsFocused] = useState(false);
	const [internalValue, setInternalValue] = useState(value || '');
	const [showColorPicker, setShowColorPicker] = useState(false);
	const [showLinkDialog, setShowLinkDialog] = useState(false);
	const [showPdfUpload, setShowPdfUpload] = useState(false);
	const [colorType, setColorType] = useState('foreground'); // 'foreground' or 'background'
	const [linkUrl, setLinkUrl] = useState('');
	const [selectedColor, setSelectedColor] = useState('#ffee00');
	const [pdfFile, setPdfFile] = useState(null);
	const [pdfFileName, setPdfFileName] = useState('');
	const [uploadingPdf, setUploadingPdf] = useState(false);
	const fileInputRef = useRef(null);

	// Initialize editor content
	useEffect(() => {
		if (editorRef.current && !editorRef.current.innerHTML && value) {
			editorRef.current.innerHTML = value;
			setInternalValue(value);
		}
	}, []);

	// Update editor when value prop changes externally
	useEffect(() => {
		if (value !== undefined && value !== internalValue && editorRef.current) {
			const currentContent = editorRef.current.innerHTML;
			if (currentContent !== value) {
				editorRef.current.innerHTML = value || '';
				setInternalValue(value || '');
			}
		}
	}, [value]);

	const handleInput = (e) => {
		const newValue = e.target.innerHTML;
		setInternalValue(newValue);
		if (onChange) {
			onChange(newValue);
		}
	};

	const handlePaste = (e) => {
		e.preventDefault();
		const text = e.clipboardData.getData('text/plain');
		const selection = window.getSelection();
		if (selection.rangeCount > 0) {
			selection.deleteContents();
			selection.getRangeAt(0).insertNode(document.createTextNode(text));
		}
	};

	const execCommand = (command, value = null) => {
		document.execCommand(command, false, value);
		editorRef.current?.focus();
		// Trigger input event to update value
		if (editorRef.current) {
			const event = new Event('input', { bubbles: true });
			editorRef.current.dispatchEvent(event);
		}
	};

	const handleColorSelect = (color) => {
		setSelectedColor(color);
		if (colorType === 'foreground') {
			execCommand('foreColor', color);
		} else {
			execCommand('backColor', color);
		}
		setShowColorPicker(false);
	};

	const handleLinkInsert = () => {
		if (linkUrl.trim()) {
			let url = linkUrl.trim();
			if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
				url = 'https://' + url;
			}
			execCommand('createLink', url);
			setLinkUrl('');
			setShowLinkDialog(false);
		}
	};

	const handlePdfSelect = (e) => {
		const file = e.target.files[0];
		if (file) {
			if (file.type !== 'application/pdf') {
				alert('Te rugăm să selectezi un fișier PDF!');
				return;
			}
			if (file.size > 10 * 1024 * 1024) { // 10MB limit
				alert('Fișierul PDF este prea mare! Maxim 10MB.');
				return;
			}
			setPdfFile(file);
			setPdfFileName(file.name);
		}
	};

	const handlePdfUpload = async () => {
		if (!pdfFile) return;

		setUploadingPdf(true);
		try {
			// Create a data URL for the PDF
			const reader = new FileReader();
			reader.onload = (e) => {
				const dataUrl = e.target.result;
				
				// Insert PDF link into editor
				const pdfLink = `<div style="margin: 1.5rem 0; padding: 1rem; background: rgba(255,238,0,0.1); border: 1px solid rgba(255,238,0,0.3); border-radius: 12px;">
					<a href="${dataUrl}" target="_blank" style="display: flex; align-items: center; gap: 0.75rem; color: #ffee00; text-decoration: none; font-weight: 600;">
						<span style="font-size: 1.5rem;">📄</span>
						<span>${pdfFileName}</span>
						<span style="font-size: 0.85rem; opacity: 0.7;">(Deschide PDF)</span>
					</a>
				</div>`;
				
				// Insert at cursor position or append
				const selection = window.getSelection();
				if (selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const div = document.createElement('div');
					div.innerHTML = pdfLink;
					range.insertNode(div);
				} else {
					// Append to end
					if (editorRef.current) {
						editorRef.current.innerHTML += pdfLink;
					}
				}
				
				// Trigger change event
				if (editorRef.current) {
					const event = new Event('input', { bubbles: true });
					editorRef.current.dispatchEvent(event);
				}

				setPdfFile(null);
				setPdfFileName('');
				setShowPdfUpload(false);
				if (fileInputRef.current) {
					fileInputRef.current.value = '';
				}
			};
			reader.readAsDataURL(pdfFile);
		} catch (error) {
			console.error('Error uploading PDF:', error);
			alert('Eroare la încărcarea PDF-ului');
		} finally {
			setUploadingPdf(false);
		}
	};

	// Predefined colors
	const colorPalette = [
		'#ffee00', '#ffcc00', '#ffd700', '#ffff00',
		'#ffffff', '#cccccc', '#999999', '#666666', '#000000',
		'#ff6b6b', '#ff5252', '#ff1744', '#d32f2f',
		'#4ade80', '#22c55e', '#10b981', '#059669',
		'#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8',
		'#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9',
		'#f472b6', '#ec4899', '#db2777', '#be185d',
	];

	const ToolbarButton = ({ onClick, icon, title, active = false }) => (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`rte-toolbar-btn ${active ? 'active' : ''}`}
		>
			{icon}
		</button>
	);

	return (
		<div className="rte-container" style={style}>
			{/* Toolbar */}
			<div className="rte-toolbar">
				{/* Text Formatting */}
				<div className="rte-toolbar-group">
					<ToolbarButton
						onClick={() => execCommand('bold')}
						icon={<strong>B</strong>}
						title="Bold"
					/>
					<ToolbarButton
						onClick={() => execCommand('italic')}
						icon={<em>I</em>}
						title="Italic"
					/>
					<ToolbarButton
						onClick={() => execCommand('underline')}
						icon={<u>U</u>}
						title="Underline"
					/>
					<ToolbarButton
						onClick={() => execCommand('strikeThrough')}
						icon={<span style={{ textDecoration: 'line-through' }}>S</span>}
						title="Strikethrough"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Headings */}
				<div className="rte-toolbar-group">
					<select
						className="rte-toolbar-select"
						onChange={(e) => {
							if (e.target.value === '') {
								execCommand('formatBlock', 'div');
							} else {
								execCommand('formatBlock', e.target.value);
							}
							e.target.value = '';
						}}
						title="Heading"
					>
						<option value="">Format</option>
						<option value="h1">Heading 1</option>
						<option value="h2">Heading 2</option>
						<option value="h3">Heading 3</option>
						<option value="h4">Heading 4</option>
						<option value="p">Paragraph</option>
					</select>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Lists */}
				<div className="rte-toolbar-group">
					<ToolbarButton
						onClick={() => execCommand('insertUnorderedList')}
						icon="• List"
						title="Bullet List"
					/>
					<ToolbarButton
						onClick={() => execCommand('insertOrderedList')}
						icon="1. List"
						title="Numbered List"
					/>
					<ToolbarButton
						onClick={() => execCommand('outdent')}
						icon="←"
						title="Decrease Indent"
					/>
					<ToolbarButton
						onClick={() => execCommand('indent')}
						icon="→"
						title="Increase Indent"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Alignment */}
				<div className="rte-toolbar-group">
					<ToolbarButton
						onClick={() => execCommand('justifyLeft')}
						icon="⬅"
						title="Align Left"
					/>
					<ToolbarButton
						onClick={() => execCommand('justifyCenter')}
						icon="⬌"
						title="Align Center"
					/>
					<ToolbarButton
						onClick={() => execCommand('justifyRight')}
						icon="➡"
						title="Align Right"
					/>
					<ToolbarButton
						onClick={() => execCommand('justifyFull')}
						icon="⬌⬌"
						title="Justify"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Other */}
				<div className="rte-toolbar-group">
					<ToolbarButton
						onClick={() => execCommand('formatBlock', 'blockquote')}
						icon="❝"
						title="Quote"
					/>
					<ToolbarButton
						onClick={() => setShowLinkDialog(true)}
						icon="🔗"
						title="Insert Link"
					/>
					<ToolbarButton
						onClick={() => {
							setColorType('foreground');
							setShowColorPicker(true);
						}}
						icon="🎨"
						title="Text Color"
					/>
					<ToolbarButton
						onClick={() => {
							setColorType('background');
							setShowColorPicker(true);
						}}
						icon="🖌️"
						title="Background Color"
					/>
					<ToolbarButton
						onClick={() => execCommand('removeFormat')}
						icon="🧹"
						title="Clear Formatting"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Media & Content */}
				<div className="rte-toolbar-group">
					<ToolbarButton
						onClick={() => {
							const url = prompt('Introdu URL-ul imaginii:');
							if (url && url.trim()) {
								const img = document.createElement('img');
								img.src = url.trim();
								img.style.maxWidth = '100%';
								img.style.height = 'auto';
								img.style.borderRadius = '8px';
								img.style.margin = '1rem 0';
								
								const selection = window.getSelection();
								if (selection.rangeCount > 0) {
									const range = selection.getRangeAt(0);
									range.insertNode(img);
								} else {
									editorRef.current?.appendChild(img);
								}
								
								if (editorRef.current) {
									const event = new Event('input', { bubbles: true });
									editorRef.current.dispatchEvent(event);
								}
							}
						}}
						icon="🖼️"
						title="Inserare Imagine"
					/>
					<ToolbarButton
						onClick={() => {
							const url = prompt('Introdu URL-ul video (YouTube, Vimeo, etc.):');
							if (url && url.trim()) {
								let embedUrl = url.trim();
								
								// YouTube
								if (embedUrl.includes('youtube.com/watch') || embedUrl.includes('youtu.be/')) {
									const videoId = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
									if (videoId) {
										embedUrl = `https://www.youtube.com/embed/${videoId}`;
									}
								}
								// Vimeo
								else if (embedUrl.includes('vimeo.com/')) {
									const videoId = embedUrl.match(/vimeo\.com\/(\d+)/)?.[1];
									if (videoId) {
										embedUrl = `https://player.vimeo.com/video/${videoId}`;
									}
								}
								
								const iframe = document.createElement('iframe');
								iframe.src = embedUrl;
								iframe.style.width = '100%';
								iframe.style.height = '400px';
								iframe.style.border = 'none';
								iframe.style.borderRadius = '8px';
								iframe.style.margin = '1rem 0';
								iframe.allowFullscreen = true;
								
								const container = document.createElement('div');
								container.style.margin = '1rem 0';
								container.appendChild(iframe);
								
								const selection = window.getSelection();
								if (selection.rangeCount > 0) {
									const range = selection.getRangeAt(0);
									range.insertNode(container);
								} else {
									editorRef.current?.appendChild(container);
								}
								
								if (editorRef.current) {
									const event = new Event('input', { bubbles: true });
									editorRef.current.dispatchEvent(event);
								}
							}
						}}
						icon="🎥"
						title="Inserare Video"
					/>
					<ToolbarButton
						onClick={() => {
							const code = prompt('Introdu codul:');
							if (code && code.trim()) {
								const pre = document.createElement('pre');
								pre.style.background = 'rgba(0, 0, 0, 0.3)';
								pre.style.padding = '1rem';
								pre.style.borderRadius = '8px';
								pre.style.overflow = 'auto';
								pre.style.margin = '1rem 0';
								pre.style.border = '1px solid rgba(9, 168, 107, 0.2)';
								
								const codeEl = document.createElement('code');
								codeEl.textContent = code.trim();
								codeEl.style.color = '#09A86B';
								codeEl.style.fontFamily = 'monospace';
								codeEl.style.fontSize = '0.9rem';
								pre.appendChild(codeEl);
								
								const selection = window.getSelection();
								if (selection.rangeCount > 0) {
									const range = selection.getRangeAt(0);
									range.insertNode(pre);
								} else {
									editorRef.current?.appendChild(pre);
								}
								
								if (editorRef.current) {
									const event = new Event('input', { bubbles: true });
									editorRef.current.dispatchEvent(event);
								}
							}
						}}
						icon="💻"
						title="Inserare Cod"
					/>
					<ToolbarButton
						onClick={() => {
							setShowPdfUpload(true);
							if (fileInputRef.current) {
								fileInputRef.current.click();
							}
						}}
						icon="📄"
						title="Încarcă PDF"
					/>
				</div>
			</div>

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept="application/pdf"
				onChange={handlePdfSelect}
				style={{ display: 'none' }}
			/>

			{/* Editor */}
			<div
				ref={editorRef}
				contentEditable
				className={`rte-editor ${isFocused ? 'focused' : ''}`}
				onInput={handleInput}
				onPaste={handlePaste}
				onFocus={() => setIsFocused(true)}
				onBlur={(e) => {
					setIsFocused(false);
					if (onBlur) onBlur(e);
				}}
				data-placeholder={placeholder}
				suppressContentEditableWarning
			/>

			{/* Color Picker Modal */}
			{showColorPicker && (
				<ColorPickerModal
					selectedColor={selectedColor}
					onColorSelect={handleColorSelect}
					onClose={() => setShowColorPicker(false)}
					type={colorType}
				/>
			)}

			{/* Link Dialog Modal */}
			{showLinkDialog && (
				<LinkDialogModal
					linkUrl={linkUrl}
					setLinkUrl={setLinkUrl}
					onInsert={handleLinkInsert}
					onClose={() => {
						setShowLinkDialog(false);
						setLinkUrl('');
					}}
				/>
			)}

			{/* PDF Upload Modal */}
			{showPdfUpload && (
				<PdfUploadModal
					pdfFile={pdfFile}
					pdfFileName={pdfFileName}
					uploadingPdf={uploadingPdf}
					onFileSelect={() => fileInputRef.current?.click()}
					onUpload={handlePdfUpload}
					onClose={() => {
						setShowPdfUpload(false);
						setPdfFile(null);
						setPdfFileName('');
						if (fileInputRef.current) {
							fileInputRef.current.value = '';
						}
					}}
				/>
			)}
		</div>
	);
};

// Color Picker Modal Component
const ColorPickerModal = ({ selectedColor, onColorSelect, onClose, type }) => {
	const [customColor, setCustomColor] = useState(selectedColor);

	return (
		<div
			className="rte-modal-overlay"
			onClick={onClose}
		>
			<div
				className="rte-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="rte-modal-header">
					<h3 style={{
						margin: 0,
						background: 'linear-gradient(135deg, #ffffff, #ffee00)',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						backgroundClip: 'text',
						fontSize: '1.25rem',
						fontWeight: 700,
					}}>
						{type === 'foreground' ? '🎨 Culoare Text' : '🖌️ Culoare Fundal'}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rte-modal-close"
					>
						×
					</button>
				</div>

				<div className="rte-modal-body">
					{/* Color Palette */}
					<div style={{ marginBottom: '1.5rem' }}>
						<label style={{
							display: 'block',
							marginBottom: '0.75rem',
							color: 'rgba(255,255,255,0.7)',
							fontSize: '0.9rem',
							fontWeight: 600,
						}}>
							Paletă de culori
						</label>
						<div style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(8, 1fr)',
							gap: '0.5rem',
						}}>
							{['#ffee00', '#ffcc00', '#ffd700', '#ffff00', '#ffffff', '#cccccc', '#999999', '#666666', '#000000',
								'#ff6b6b', '#ff5252', '#ff1744', '#d32f2f', '#4ade80', '#22c55e', '#10b981', '#059669',
								'#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9',
								'#f472b6', '#ec4899', '#db2777', '#be185d'].map((color) => (
								<button
									key={color}
									type="button"
									onClick={() => onColorSelect(color)}
									style={{
										width: '100%',
										aspectRatio: '1',
										background: color,
										border: selectedColor === color ? '3px solid #ffee00' : '2px solid rgba(255,255,255,0.2)',
										borderRadius: '8px',
										cursor: 'pointer',
										transition: 'all 0.2s ease',
										boxShadow: selectedColor === color ? '0 0 12px rgba(255,238,0,0.5)' : 'none',
									}}
									onMouseEnter={(e) => {
										if (selectedColor !== color) {
											e.currentTarget.style.transform = 'scale(1.1)';
											e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
										}
									}}
									onMouseLeave={(e) => {
										if (selectedColor !== color) {
											e.currentTarget.style.transform = 'scale(1)';
											e.currentTarget.style.boxShadow = 'none';
										}
									}}
									title={color}
								/>
							))}
						</div>
					</div>

					{/* Custom Color Input */}
					<div>
						<label style={{
							display: 'block',
							marginBottom: '0.75rem',
							color: 'rgba(255,255,255,0.7)',
							fontSize: '0.9rem',
							fontWeight: 600,
						}}>
							Culoare personalizată
						</label>
						<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
							<input
								type="color"
								value={customColor}
								onChange={(e) => setCustomColor(e.target.value)}
								style={{
									width: '60px',
									height: '40px',
									border: '1px solid rgba(255,238,0,0.3)',
									borderRadius: '8px',
									cursor: 'pointer',
									background: 'transparent',
								}}
							/>
							<input
								type="text"
								value={customColor}
								onChange={(e) => setCustomColor(e.target.value)}
								placeholder="#ffee00"
								style={{
									flex: 1,
									padding: '0.75rem',
									background: 'rgba(255,255,255,0.05)',
									border: '1px solid rgba(255,238,0,0.2)',
									borderRadius: '10px',
									color: '#fff',
									fontSize: '0.95rem',
								}}
							/>
							<button
								type="button"
								onClick={() => onColorSelect(customColor)}
								style={{
									padding: '0.75rem 1.5rem',
									background: 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))',
									border: '1px solid rgba(255,238,0,0.4)',
									borderRadius: '10px',
									color: '#ffee00',
									fontWeight: 700,
									cursor: 'pointer',
									transition: 'all 0.3s ease',
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.3), rgba(255,238,0,0.2))';
									e.currentTarget.style.transform = 'translateY(-2px)';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))';
									e.currentTarget.style.transform = 'translateY(0)';
								}}
							>
								Aplică
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

// Link Dialog Modal Component
const LinkDialogModal = ({ linkUrl, setLinkUrl, onInsert, onClose }) => {
	return (
		<div
			className="rte-modal-overlay"
			onClick={onClose}
		>
			<div
				className="rte-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="rte-modal-header">
					<h3 style={{
						margin: 0,
						background: 'linear-gradient(135deg, #ffffff, #ffee00)',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						backgroundClip: 'text',
						fontSize: '1.25rem',
						fontWeight: 700,
					}}>
						🔗 Inserare Link
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rte-modal-close"
					>
						×
					</button>
				</div>

				<div className="rte-modal-body">
					<div>
						<label style={{
							display: 'block',
							marginBottom: '0.75rem',
							color: 'rgba(255,255,255,0.7)',
							fontSize: '0.9rem',
							fontWeight: 600,
						}}>
							URL
						</label>
						<input
							type="text"
							value={linkUrl}
							onChange={(e) => setLinkUrl(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									onInsert();
								}
							}}
							placeholder="https://example.com sau example.com"
							autoFocus
							style={{
								width: '100%',
								padding: '1rem',
								background: 'rgba(255,255,255,0.05)',
								border: '1px solid rgba(255,238,0,0.2)',
								borderRadius: '12px',
								color: '#fff',
								fontSize: '1rem',
								transition: 'all 0.3s ease',
							}}
							onFocus={(e) => {
								e.target.style.borderColor = 'rgba(255,238,0,0.4)';
								e.target.style.background = 'rgba(255,255,255,0.08)';
							}}
							onBlur={(e) => {
								e.target.style.borderColor = 'rgba(255,238,0,0.2)';
								e.target.style.background = 'rgba(255,255,255,0.05)';
							}}
						/>
						<div style={{
							marginTop: '0.5rem',
							color: 'rgba(255,255,255,0.6)',
							fontSize: '0.85rem',
						}}>
							💡 Poți introduce URL complet (https://...) sau doar domeniul (example.com)
						</div>
					</div>

					<div style={{
						display: 'flex',
						gap: '1rem',
						justifyContent: 'flex-end',
						marginTop: '1.5rem',
					}}>
						<button
							type="button"
							onClick={onClose}
							style={{
								padding: '0.75rem 1.5rem',
								background: 'rgba(255,255,255,0.05)',
								border: '1px solid rgba(255,255,255,0.15)',
								borderRadius: '10px',
								color: '#fff',
								fontWeight: 600,
								cursor: 'pointer',
								transition: 'all 0.3s ease',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
								e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
								e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
							}}
						>
							Anulează
						</button>
						<button
							type="button"
							onClick={onInsert}
							disabled={!linkUrl.trim()}
							style={{
								padding: '0.75rem 1.5rem',
								background: linkUrl.trim()
									? 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))'
									: 'rgba(255,255,255,0.05)',
								border: linkUrl.trim()
									? '1px solid rgba(255,238,0,0.4)'
									: '1px solid rgba(255,255,255,0.1)',
								borderRadius: '10px',
								color: linkUrl.trim() ? '#ffee00' : 'rgba(255,255,255,0.5)',
								fontWeight: 700,
								cursor: linkUrl.trim() ? 'pointer' : 'not-allowed',
								transition: 'all 0.3s ease',
							}}
							onMouseEnter={(e) => {
								if (linkUrl.trim()) {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.3), rgba(255,238,0,0.2))';
									e.currentTarget.style.borderColor = 'rgba(255,238,0,0.5)';
									e.currentTarget.style.transform = 'translateY(-2px)';
								}
							}}
							onMouseLeave={(e) => {
								if (linkUrl.trim()) {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))';
									e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
									e.currentTarget.style.transform = 'translateY(0)';
								}
							}}
						>
							Inserare
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

// PDF Upload Modal Component
const PdfUploadModal = ({ pdfFile, pdfFileName, uploadingPdf, onFileSelect, onUpload, onClose }) => {
	return (
		<div
			className="rte-modal-overlay"
			onClick={onClose}
		>
			<div
				className="rte-modal"
				onClick={(e) => e.stopPropagation()}
				style={{ maxWidth: '600px' }}
			>
				<div className="rte-modal-header">
					<h3 style={{
						margin: 0,
						background: 'linear-gradient(135deg, #ffffff, #ffee00)',
						WebkitBackgroundClip: 'text',
						WebkitTextFillColor: 'transparent',
						backgroundClip: 'text',
						fontSize: '1.25rem',
						fontWeight: 700,
					}}>
						📄 Încarcă PDF
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rte-modal-close"
					>
						×
					</button>
				</div>

				<div className="rte-modal-body">
					{/* File Selection Area */}
					{!pdfFile ? (
						<div
							onClick={onFileSelect}
							style={{
								border: '2px dashed rgba(255,238,0,0.3)',
								borderRadius: '16px',
								padding: '3rem 2rem',
								textAlign: 'center',
								cursor: 'pointer',
								transition: 'all 0.3s ease',
								background: 'rgba(255,238,0,0.05)',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.borderColor = 'rgba(255,238,0,0.5)';
								e.currentTarget.style.background = 'rgba(255,238,0,0.1)';
								e.currentTarget.style.transform = 'translateY(-2px)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.borderColor = 'rgba(255,238,0,0.3)';
								e.currentTarget.style.background = 'rgba(255,238,0,0.05)';
								e.currentTarget.style.transform = 'translateY(0)';
							}}
						>
							<div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
							<div style={{
								color: '#ffee00',
								fontSize: '1.1rem',
								fontWeight: 700,
								marginBottom: '0.5rem',
							}}>
								Click pentru a selecta PDF
							</div>
							<div style={{
								color: 'rgba(255,255,255,0.6)',
								fontSize: '0.9rem',
							}}>
								Maxim 10MB
							</div>
						</div>
					) : (
						<div style={{
							padding: '1.5rem',
							background: 'rgba(255,238,0,0.1)',
							border: '1px solid rgba(255,238,0,0.3)',
							borderRadius: '16px',
							marginBottom: '1.5rem',
						}}>
							<div style={{
								display: 'flex',
								alignItems: 'center',
								gap: '1rem',
								marginBottom: '1rem',
							}}>
								<div style={{ fontSize: '2.5rem' }}>📄</div>
								<div style={{ flex: 1 }}>
									<div style={{
										color: '#ffee00',
										fontWeight: 700,
										marginBottom: '0.25rem',
									}}>
										{pdfFileName}
									</div>
									<div style={{
										color: 'rgba(255,255,255,0.6)',
										fontSize: '0.85rem',
									}}>
										{(pdfFile.size / 1024 / 1024).toFixed(2)} MB
									</div>
								</div>
								<button
									type="button"
									onClick={onFileSelect}
									style={{
										padding: '0.5rem 1rem',
										background: 'rgba(255,255,255,0.05)',
										border: '1px solid rgba(255,255,255,0.15)',
										borderRadius: '8px',
										color: '#fff',
										cursor: 'pointer',
										fontSize: '0.85rem',
										transition: 'all 0.3s ease',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
										e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
										e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
									}}
								>
									Schimbă
								</button>
							</div>
						</div>
					)}

					<div style={{
						display: 'flex',
						gap: '1rem',
						justifyContent: 'flex-end',
					}}>
						<button
							type="button"
							onClick={onClose}
							style={{
								padding: '0.75rem 1.5rem',
								background: 'rgba(255,255,255,0.05)',
								border: '1px solid rgba(255,255,255,0.15)',
								borderRadius: '10px',
								color: '#fff',
								fontWeight: 600,
								cursor: 'pointer',
								transition: 'all 0.3s ease',
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
								e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
								e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
							}}
						>
							Anulează
						</button>
						<button
							type="button"
							onClick={onUpload}
							disabled={!pdfFile || uploadingPdf}
							style={{
								padding: '0.75rem 1.5rem',
								background: pdfFile && !uploadingPdf
									? 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))'
									: 'rgba(255,255,255,0.05)',
								border: pdfFile && !uploadingPdf
									? '1px solid rgba(255,238,0,0.4)'
									: '1px solid rgba(255,255,255,0.1)',
								borderRadius: '10px',
								color: pdfFile && !uploadingPdf ? '#ffee00' : 'rgba(255,255,255,0.5)',
								fontWeight: 700,
								cursor: pdfFile && !uploadingPdf ? 'pointer' : 'not-allowed',
								transition: 'all 0.3s ease',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '0.5rem',
							}}
							onMouseEnter={(e) => {
								if (pdfFile && !uploadingPdf) {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.3), rgba(255,238,0,0.2))';
									e.currentTarget.style.borderColor = 'rgba(255,238,0,0.5)';
									e.currentTarget.style.transform = 'translateY(-2px)';
								}
							}}
							onMouseLeave={(e) => {
								if (pdfFile && !uploadingPdf) {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.2), rgba(255,238,0,0.15))';
									e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
									e.currentTarget.style.transform = 'translateY(0)';
								}
							}}
						>
							{uploadingPdf ? (
								<>
									<span>⏳</span>
									<span>Se încarcă...</span>
								</>
							) : (
								<>
									<span>✅</span>
									<span>Inserare PDF</span>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default RichTextEditor;

