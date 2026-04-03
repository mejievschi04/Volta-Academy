import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import './CourseCreationPage.css';

const CourseCreationPage = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const { canMutateInAdminArea } = useAuth();

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [image, setImage] = useState(null);
	const [pdfFile, setPdfFile] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [step, setStep] = useState(1);

	useEffect(() => {
		if (!canMutateInAdminArea) {
			navigate('/admin/content?tab=courses', { replace: true });
		}
	}, [canMutateInAdminArea, navigate]);

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
			const cleanDescription = description.trim();
			let payload;
			if (image || pdfFile) {
				const formData = new FormData();
				formData.append('title', t);
				formData.append('description', cleanDescription || '');
				formData.append('status', 'draft');
				if (image) formData.append('image', image);
				if (pdfFile) formData.append('pdf_file', pdfFile);
				payload = formData;
			} else {
				payload = {
					title: t,
					description: cleanDescription || '',
					status: 'draft',
				};
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

	const handleContinue = () => {
		const t = title?.trim();
		setError('');
		if (!t) {
			setError('Titlul este obligatoriu.');
			return;
		}
		setStep(2);
	};

	if (!canMutateInAdminArea) {
		return null;
	}

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
						Creare pe pași. Definim minimul acum, iar setările le completezi după creare.
					</p>
					<div className="course-creation-steps">
						<span className={step === 1 ? 'active' : ''}>Pas 1: Titlu</span>
						<span className={step === 2 ? 'active' : ''}>Pas 2: Detalii opționale</span>
					</div>
				</header>

				<form onSubmit={handleSubmit} className="course-creation-simple-form">
					{step === 1 && (
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
							<p className="course-creation-simple-hint">După creare poți adăuga lecții și teste.</p>
						</div>
					)}

					{step === 2 && (
						<>
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

							<details className="course-creation-simple-advanced" open>
								<summary>Media opțională</summary>
								<div className="course-creation-simple-field">
									<label className="course-creation-simple-label">Imagine curs</label>
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
									<label className="course-creation-simple-label">Fișier PDF (opțional)</label>
									<input
										type="file"
										accept=".pdf,application/pdf"
										onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
										className="course-creation-simple-file"
										disabled={loading}
									/>
									{pdfFile && <span className="course-creation-simple-file-name">{pdfFile.name}</span>}
								</div>
							</details>
						</>
					)}

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
						{step === 1 ? (
							<>
								<button
									type="button"
									className="course-creation-simple-btn-secondary"
									onClick={handleContinue}
									disabled={loading}
								>
									Continuă
								</button>
								<button
									type="submit"
									className="course-creation-simple-btn-primary"
									disabled={loading}
								>
									{loading ? 'Se creează...' : 'Creează acum'}
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									className="course-creation-simple-btn-secondary"
									onClick={() => setStep(1)}
									disabled={loading}
								>
									Înapoi
								</button>
								<button
									type="submit"
									className="course-creation-simple-btn-primary"
									disabled={loading}
								>
									{loading ? 'Se creează...' : 'Creează și deschide în Builder'}
								</button>
							</>
						)}
					</div>
				</form>
			</div>
		</div>
	);
};

export default CourseCreationPage;
