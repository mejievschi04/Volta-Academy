import React, { useState, useEffect } from 'react';
import './BuildCourseModal.css';

/**
 * Modal pentru creare curs - titlu, imagine, descriere
 * După submit → redirect la Builder
 */
const BuildCourseModal = ({ onClose, onSubmit, loading, initialTitle = '', initialDescription = '', initialPdfFile = null }) => {
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

	return (
		<div className="build-course-modal-backdrop" onClick={onClose}>
			<div className="build-course-modal" onClick={(e) => e.stopPropagation()}>
				<div className="build-course-modal-header">
					<h2>Creează curs nou</h2>
					<p className="build-course-modal-subtitle">
						Completează informațiile de bază, apoi continuă în Builder
					</p>
					<button
						type="button"
						className="build-course-modal-close"
						onClick={onClose}
						aria-label="Închide"
					>
						×
					</button>
				</div>

				<form onSubmit={handleSubmit} className="build-course-modal-form">
					<div className="build-course-modal-field">
						<label className="build-course-modal-label">
							Titlu <span className="build-course-modal-required">*</span>
						</label>
						<input
							type="text"
							placeholder="ex: Produse Electrotehnice - Baze"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="build-course-modal-input"
							autoFocus
						/>
					</div>

					<div className="build-course-modal-field">
						<label className="build-course-modal-label">Descriere</label>
						<textarea
							placeholder="Descrie conținutul și scopul cursului..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="build-course-modal-textarea"
							rows={4}
						/>
					</div>

					<div className="build-course-modal-field">
						<label className="build-course-modal-label">Imagine curs</label>
						<p className="build-course-modal-hint">Imagine reprezentativă (opțional)</p>
						<input
							type="file"
							accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
							onChange={(e) => {
								const file = e.target.files?.[0];
								setImage(file || null);
							}}
							className="build-course-modal-file"
						/>
						{image && (
							<div className="build-course-modal-preview">
								<img
									src={URL.createObjectURL(image)}
									alt="Previzualizare"
									loading="lazy"
								/>
							</div>
						)}
					</div>

					<div className="build-course-modal-field">
						<label className="build-course-modal-label">Fișier PDF cu informația brută</label>
						<p className="build-course-modal-hint">Opțional – conținut pentru generare curs</p>
						<input
							type="file"
							accept=".pdf,application/pdf"
							onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
							className="build-course-modal-file"
						/>
						{pdfFile && (
							<p className="build-course-modal-hint" style={{ marginTop: 'var(--space-2)', color: 'var(--color-primary)' }}>
								📄 {pdfFile.name}
							</p>
						)}
					</div>

					{error && (
						<div className="build-course-modal-error">{error}</div>
					)}

					<div className="build-course-modal-actions">
						<button
							type="button"
							className="build-course-modal-btn build-course-modal-btn-secondary"
							onClick={onClose}
						>
							Anulează
						</button>
						<button
							type="submit"
							className="build-course-modal-btn build-course-modal-btn-primary"
							disabled={loading}
						>
							{loading ? 'Se creează...' : 'Continuă la Builder'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default BuildCourseModal;
