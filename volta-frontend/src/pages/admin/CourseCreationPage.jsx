import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import './CourseCreationPage.css';

/**
 * Creare curs simplificată: un singur pas.
 * Titlu + descriere (opțional imagine/PDF) → Creează → redirect la Builder.
 * Structura, conținutul și quiz-urile se adaugă în Builder.
 */
const CourseCreationPage = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [image, setImage] = useState(null);
	const [pdfFile, setPdfFile] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		const t = title?.trim();
		if (!t) {
			setError('Titlul este obligatoriu.');
			return;
		}

		setLoading(true);
		try {
			let payload;
			if (image || pdfFile) {
				const formData = new FormData();
				formData.append('title', t);
				formData.append('description', description.trim() || '');
				formData.append('status', 'draft');
				if (image) formData.append('image', image);
				if (pdfFile) formData.append('pdf_file', pdfFile);
				payload = formData;
			} else {
				payload = { title: t, description: description.trim() || '', status: 'draft' };
			}
			const result = await adminService.createCourse(payload);
			const courseId = result?.course?.id;
			if (courseId) {
				showToast('Curs creat. Adaugă module și lecții în Builder.', 'success');
				navigate(`/admin/courses/${courseId}/builder`);
			} else {
				setError('Crearea cursului nu a returnat un ID.');
			}
		} catch (err) {
			console.error('Error creating course:', err);
			const msg = err?.response?.data?.message || err?.message || 'Eroare la crearea cursului.';
			setError(msg);
			showToast(msg, 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="admin-container course-creation-simple-page">
			<div className="course-creation-simple-card">
				<header className="course-creation-simple-header">
					<button
						type="button"
						className="course-creation-simple-back"
						onClick={() => navigate('/admin/courses')}
						aria-label="Înapoi la cursuri"
					>
						← Cursuri
					</button>
					<h1 className="course-creation-simple-title">Creează curs nou</h1>
					<p className="course-creation-simple-subtitle">
						Completează titlul și descrierea. După ce creezi cursul, vei fi dus în Builder unde adaugi module, lecții și conținut.
					</p>
				</header>

				<form onSubmit={handleSubmit} className="course-creation-simple-form">
					<div className="course-creation-simple-field">
						<label className="course-creation-simple-label">
							Titlu curs <span className="course-creation-simple-required">*</span>
						</label>
						<input
							type="text"
							placeholder="Titlul cursului"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="course-creation-simple-input"
							autoFocus
							disabled={loading}
						/>
					</div>

					<div className="course-creation-simple-field">
						<label className="course-creation-simple-label">Descriere</label>
						<textarea
							placeholder="Scopul și conținutul cursului (opțional)"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="course-creation-simple-textarea"
							rows={4}
							disabled={loading}
						/>
					</div>

					<div className="course-creation-simple-field">
						<label className="course-creation-simple-label">Imagine curs</label>
						<p className="course-creation-simple-hint">Opțional – imagine reprezentativă</p>
						<input
							type="file"
							accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
							onChange={(e) => setImage(e.target.files?.[0] || null)}
							className="course-creation-simple-file"
							disabled={loading}
						/>
						{image && (
							<div className="course-creation-simple-image-preview">
								<img src={URL.createObjectURL(image)} alt="Preview" />
							</div>
						)}
					</div>

					<div className="course-creation-simple-field">
						<label className="course-creation-simple-label">Fișier PDF (informație brută)</label>
						<p className="course-creation-simple-hint">Opțional – pentru generare conținut ulterior</p>
						<input
							type="file"
							accept=".pdf,application/pdf"
							onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
							className="course-creation-simple-file"
							disabled={loading}
						/>
						{pdfFile && <span className="course-creation-simple-file-name">{pdfFile.name}</span>}
					</div>

					{error && <div className="course-creation-simple-error" role="alert">{error}</div>}

					<div className="course-creation-simple-actions">
						<button
							type="button"
							className="course-creation-simple-btn-secondary"
							onClick={() => navigate('/admin/courses')}
							disabled={loading}
						>
							Anulare
						</button>
						<button
							type="submit"
							className="course-creation-simple-btn-primary"
							disabled={loading}
						>
							{loading ? 'Se creează...' : 'Creează și deschide în Builder'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default CourseCreationPage;
