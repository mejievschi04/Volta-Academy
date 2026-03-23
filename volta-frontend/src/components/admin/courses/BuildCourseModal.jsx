import React, { useState, useEffect, useCallback } from 'react';
import './BuildCourseModal.css';

/**
 * Modal creare/editare curs: titlu, descriere, imagine, PDF.
 * După submit → redirect la Builder (la creare).
 */
const BuildCourseModal = ({
	onClose,
	onSubmit,
	loading,
	initialTitle = '',
	initialDescription = '',
	initialPdfFile = null,
	mode = 'create', // 'create' | 'edit'
}) => {
	const [title, setTitle] = useState(initialTitle);
	const [description, setDescription] = useState(initialDescription);
	const [image, setImage] = useState(null);
	const [pdfFile, setPdfFile] = useState(initialPdfFile);
	const [error, setError] = useState('');

	useEffect(() => {
		if (initialTitle) setTitle(initialTitle);
		if (initialDescription) setDescription(initialDescription);
		if (initialPdfFile) setPdfFile(initialPdfFile);
	}, [initialTitle, initialDescription, initialPdfFile]);

	const handleSubmit = (e) => {
		e.preventDefault();
		setError('');
		if (!title?.trim()) {
			setError('Titlul este obligatoriu');
			return;
		}
		onSubmit({ title: title.trim(), description: description.trim() || '', image, pdfFile });
	};

	const handleBackdropKeyDown = useCallback(
		(e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		},
		[onClose]
	);

	const isEdit = mode === 'edit';

	return (
		<div
			className="build-course-modal-backdrop"
			onClick={onClose}
			onKeyDown={handleBackdropKeyDown}
			role="dialog"
			aria-modal="true"
			aria-labelledby="build-course-modal-title"
		>
			<div className="build-course-modal" onClick={(e) => e.stopPropagation()}>
				<header className="build-course-modal-header">
					<div className="build-course-modal-header-inner">
						<h2 id="build-course-modal-title" className="build-course-modal-title">
							{isEdit ? 'Editează curs' : 'Creează curs nou'}
						</h2>
						<p className="build-course-modal-subtitle">
							{isEdit
								? 'Modifică informațiile de bază ale cursului.'
								: 'Completează informațiile de bază, apoi continuă în Builder.'}
						</p>
					</div>
					<button
						type="button"
						className="build-course-modal-close"
						onClick={onClose}
						aria-label="Închide"
					>
						×
					</button>
				</header>

				<form onSubmit={handleSubmit} className="build-course-modal-form">
					<section className="build-course-modal-section" aria-labelledby="build-course-section-basic">
						<h3 id="build-course-section-basic" className="build-course-modal-section-title">
							Informații de bază
						</h3>
						<div className="build-course-modal-field">
							<label htmlFor="build-course-modal-title-input" className="build-course-modal-label">
								Titlu <span className="build-course-modal-required" aria-hidden="true">*</span>
							</label>
							<input
								id="build-course-modal-title-input"
								type="text"
								placeholder="Titlul cursului"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="build-course-modal-input"
								autoFocus
								aria-required="true"
								aria-invalid={!!error}
							/>
						</div>
						<div className="build-course-modal-field">
							<label htmlFor="build-course-modal-desc" className="build-course-modal-label">
								Descriere
							</label>
							<textarea
								id="build-course-modal-desc"
								placeholder="Descrie conținutul și scopul cursului..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="build-course-modal-textarea"
								rows={3}
								aria-describedby="build-course-desc-hint"
							/>
							<span id="build-course-desc-hint" className="build-course-modal-hint">
								Opțional. Poți completa mai târziu în Builder.
							</span>
						</div>
					</section>

					<section className="build-course-modal-section" aria-labelledby="build-course-section-files">
						<h3 id="build-course-section-files" className="build-course-modal-section-title">
							Fișiere opționale
						</h3>
						<div className="build-course-modal-files-row">
							<div className="build-course-modal-file-group">
								<label className="build-course-modal-label">Imagine reprezentativă</label>
								<div className="build-course-modal-file-wrap">
									<input
										type="file"
										id="build-course-modal-image"
										accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
										onChange={(e) => setImage(e.target.files?.[0] || null)}
										className="build-course-modal-file"
									/>
									<label htmlFor="build-course-modal-image" className="build-course-modal-file-trigger">
										{image ? image.name : 'Alege imagine'}
									</label>
								</div>
								{image && (
									<div className="build-course-modal-preview">
										<img src={URL.createObjectURL(image)} alt="Previzualizare" loading="lazy" />
									</div>
								)}
							</div>
							<div className="build-course-modal-file-group">
								<label className="build-course-modal-label">PDF (informație brută)</label>
								<div className="build-course-modal-file-wrap">
									<input
										type="file"
										id="build-course-modal-pdf"
										accept=".pdf,application/pdf"
										onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
										className="build-course-modal-file"
									/>
									<label htmlFor="build-course-modal-pdf" className="build-course-modal-file-trigger">
										{pdfFile ? pdfFile.name : 'Alege PDF'}
									</label>
								</div>
							</div>
						</div>
					</section>

					{error && (
						<div className="build-course-modal-error" role="alert">
							{error}
						</div>
					)}

					<footer className="build-course-modal-actions">
						<button type="button" className="build-course-modal-btn build-course-modal-btn-cancel" onClick={onClose}>
							Anulează
						</button>
						<button
							type="submit"
							className="build-course-modal-btn build-course-modal-btn-submit"
							disabled={loading}
						>
							{loading ? 'Se salvează...' : isEdit ? 'Salvează' : 'Creează și deschide în Builder'}
						</button>
					</footer>
				</form>
			</div>
		</div>
	);
};

export default BuildCourseModal;
