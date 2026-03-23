import React, { useRef, useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';
import { extractPdfTextAsHtml } from '../utils/pdfTextExtractor';
import './RichTextEditor.css';

/** Paletă culori pentru text/fundal - o singură sursă pentru afișare corectă */
const RTE_COLOR_PALETTE = [
	'#ffee00', '#ffcc00', '#ffd700', '#ffff00',
	'#ffffff', '#cccccc', '#999999', '#666666', '#000000',
	'#ff6b6b', '#ff5252', '#ff1744', '#d32f2f',
	'#4ade80', '#22c55e', '#10b981', '#059669',
	'#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8',
	'#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9',
	'#f472b6', '#ec4899', '#db2777', '#be185d',
];

const RichTextEditor = ({ value, onChange, onBlur, placeholder, style }) => {
	const { warning: showWarning, error: showError } = useToast();
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
		const editor = editorRef.current;
		if (!editor) return;

		const html = e.clipboardData.getData('text/html');
		const text = e.clipboardData.getData('text/plain');
		const contentToInsert = html || text;
		if (!contentToInsert) return;

		const insertAsHtml = Boolean(html);
		const selection = window.getSelection();

		const insertAtSelection = () => {
			if (!selection || selection.rangeCount === 0) return false;
			const range = selection.getRangeAt(0);
			if (!(editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer)) {
				return false;
			}

			range.deleteContents();
			if (insertAsHtml) {
				const fragment = document.createRange().createContextualFragment(contentToInsert);
				const lastNode = fragment.lastChild;
				range.insertNode(fragment);
				if (lastNode) {
					range.setStartAfter(lastNode);
					range.collapse(true);
				}
			} else {
				range.insertNode(document.createTextNode(contentToInsert));
				range.collapse(false);
			}
			selection.removeAllRanges();
			selection.addRange(range);
			return true;
		};

		if (!insertAtSelection()) {
			editor.focus();
			if (insertAsHtml) {
				document.execCommand('insertHTML', false, contentToInsert);
			} else {
				document.execCommand('insertText', false, contentToInsert);
			}
		}

		// Declanșează actualizarea stării (fără asta, paste-ul nu se salvează)
		const newValue = editor.innerHTML;
		setInternalValue(newValue);
		if (onChange) onChange(newValue);
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
				showWarning('Te rugăm să selectezi un fișier PDF!');
				return;
			}
			if (file.size > 10 * 1024 * 1024) { // 10MB limit
				showWarning('Fișierul PDF este prea mare! Maxim 10MB.');
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
			const html = await extractPdfTextAsHtml(pdfFile);

			// Inserare ca text (paragrafe) în editor, nu ca link sau fișier
			const selection = window.getSelection();
			if (selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const editor = editorRef.current;
				if (editor && (editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer)) {
					const fragment = document.createRange().createContextualFragment(html);
					range.deleteContents();
					range.insertNode(fragment);
					range.collapse(false);
				} else {
					if (editorRef.current) {
						editorRef.current.innerHTML += html;
					}
				}
			} else {
				if (editorRef.current) {
					editorRef.current.innerHTML += html;
				}
			}

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
		} catch (error) {
			logger.error('Error extracting PDF text:', error);
			showError(error?.message || 'Eroare la extragerea textului din PDF. Încearcă un alt fișier.');
		} finally {
			setUploadingPdf(false);
		}
	};

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
				{/* Stil paragraf: titlu, antet, paragraf normal */}
				<div className="rte-toolbar-group rte-toolbar-group-labeled">
					<span className="rte-toolbar-label" id="rte-format-label">Stil:</span>
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
						title="Alege stilul paragrafului: titlu principal, titlu (antet), subtitlu sau paragraf normal"
						aria-labelledby="rte-format-label"
					>
						<option value="">Paragraf / Titlu</option>
						<option value="h1">Titlu principal (cel mai mare)</option>
						<option value="h2">Titlu (antet)</option>
						<option value="h3">Subtitlu</option>
						<option value="h4">Subtițior</option>
						<option value="p">Paragraf normal</option>
					</select>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Text: aldine, italic, etc. */}
				<div className="rte-toolbar-group rte-toolbar-group-labeled">
					<span className="rte-toolbar-label" id="rte-text-label">Text:</span>
					<ToolbarButton
						onClick={() => execCommand('bold')}
						icon={<strong>B</strong>}
						title="Aldin (text gros)"
					/>
					<ToolbarButton
						onClick={() => execCommand('italic')}
						icon={<em>I</em>}
						title="Italic (text înclinat)"
					/>
					<ToolbarButton
						onClick={() => execCommand('underline')}
						icon={<u>U</u>}
						title="Subliniat"
					/>
					<ToolbarButton
						onClick={() => execCommand('strikeThrough')}
						icon={<span style={{ textDecoration: 'line-through' }}>S</span>}
						title="Tăiat (text barat)"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Liste și aliniere */}
				<div className="rte-toolbar-group rte-toolbar-group-labeled">
					<span className="rte-toolbar-label" id="rte-list-label">Liste:</span>
					<ToolbarButton
						onClick={() => execCommand('insertUnorderedList')}
						icon="•"
						title="Listă cu puncte (bullet)"
					/>
					<ToolbarButton
						onClick={() => execCommand('insertOrderedList')}
						icon="1."
						title="Listă numerotată (1, 2, 3…)"
					/>
					<ToolbarButton
						onClick={() => execCommand('outdent')}
						icon="←"
						title="Micșorează alinierea (indent stânga)"
					/>
					<ToolbarButton
						onClick={() => execCommand('indent')}
						icon="→"
						title="Mărește alinierea (indent dreapta)"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Aliniere text */}
				<div className="rte-toolbar-group rte-toolbar-group-labeled">
					<span className="rte-toolbar-label" id="rte-align-label">Aliniere:</span>
					<ToolbarButton
						onClick={() => execCommand('justifyLeft')}
						icon="L"
						title="Aliniere la stânga"
					/>
					<ToolbarButton
						onClick={() => execCommand('justifyCenter')}
						icon="C"
						title="Aliniere la centru"
					/>
					<ToolbarButton
						onClick={() => execCommand('justifyRight')}
						icon="R"
						title="Aliniere la dreapta"
					/>
					<ToolbarButton
						onClick={() => execCommand('justifyFull')}
						icon="J"
						title="Aliniere pe toată lățimea (justificat)"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Citat, link, culori */}
				<div className="rte-toolbar-group rte-toolbar-group-labeled">
					<span className="rte-toolbar-label">Mai mult:</span>
					<ToolbarButton
						onClick={() => execCommand('formatBlock', 'blockquote')}
						icon="❝"
						title="Citat (bloc evidențiat)"
					/>
					<ToolbarButton
						onClick={() => setShowLinkDialog(true)}
						icon="🔗"
						title="Inserare link (legătură)"
					/>
					<ToolbarButton
						onClick={() => {
							setColorType('foreground');
							setShowColorPicker(true);
						}}
						icon="🎨"
						title="Culoare text"
					/>
					<ToolbarButton
						onClick={() => {
							setColorType('background');
							setShowColorPicker(true);
						}}
						icon="🖌️"
						title="Culoare fundal"
					/>
					<ToolbarButton
						onClick={() => execCommand('removeFormat')}
						icon="🧹"
						title="Șterge formatare (revine la text simplu)"
					/>
				</div>

				<div className="rte-toolbar-separator" />

				{/* Media */}
				<div className="rte-toolbar-group rte-toolbar-group-labeled">
					<span className="rte-toolbar-label">Media:</span>
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
						title="Inserare imagine (URL)"
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
						title="Inserare video (YouTube, Vimeo)"
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
						title="Inserare cod (bloc monospace)"
					/>
					<ToolbarButton
						onClick={() => {
							setShowPdfUpload(true);
							if (fileInputRef.current) {
								fileInputRef.current.click();
							}
						}}
						icon="📄"
						title="Încarcă și inserează PDF"
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
					palette={RTE_COLOR_PALETTE}
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
const ColorPickerModal = ({ palette = RTE_COLOR_PALETTE, selectedColor, onColorSelect, onClose, type }) => {
	const [customColor, setCustomColor] = useState(selectedColor || '#ffee00');

	useEffect(() => {
		setCustomColor(selectedColor || '#ffee00');
	}, [selectedColor]);

	const colors = Array.isArray(palette) && palette.length > 0 ? palette : RTE_COLOR_PALETTE;

	return (
		<div
			className="rte-modal-overlay"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-labelledby="rte-color-picker-title"
		>
			<div
				className="rte-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="rte-modal-header">
					<h3 id="rte-color-picker-title" className="rte-modal-title">
						{type === 'foreground' ? '🎨 Culoare text' : '🖌️ Culoare fundal'}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rte-modal-close"
						aria-label="Închide"
					>
						×
					</button>
				</div>

				<div className="rte-modal-body">
					{/* Paletă culori - grid cu clase CSS pentru încărcare corectă */}
					<div style={{ marginBottom: '1.5rem' }}>
						<label className="rte-color-palette-label">
							Paletă de culori
						</label>
						{/* div cu role="button" ca să nu se aplice stilurile globale de pe button */}
						<style>{colors.map((hex, i) => 
							`.rte-color-palette-grid .rte-color-swatch.rte-swatch-idx-${i} { background-color: ${hex} !important; background: ${hex} !important; }`
						).join('\n')}</style>
						<div className="rte-color-palette-grid">
							{colors.map((hex, i) => (
								<div
									key={`${hex}-${i}`}
									role="button"
									tabIndex={0}
									className={`rte-color-swatch rte-swatch-idx-${i} ${selectedColor === hex ? 'is-selected' : ''}`}
									onClick={() => onColorSelect(hex)}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onColorSelect(hex); } }}
									title={hex}
									aria-label={`Culoare ${hex}`}
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
							placeholder="https://… sau domeniu.extensie"
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
							💡 Poți introduce un URL complet (https://…) sau doar domeniul.
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
								Maxim 10MB · Textul din PDF va fi extras și inserat ca conținut în lecție
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
									<span>Extrage text și inserează</span>
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

