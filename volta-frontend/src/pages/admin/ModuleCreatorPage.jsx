import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';

const ModuleCreatorPage = () => {
	const { id } = useParams(); // module ID if editing
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const courseId = searchParams.get('course_id');

	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState({});
	const [formData, setFormData] = useState({
		course_id: courseId || '',
		title: '',
		description: '',
		order: 0,
		status: 'draft',
		is_locked: false,
		unlock_after_module_id: null,
		unlock_after_lesson_id: null,
		estimated_duration_minutes: null,
	});

	useEffect(() => {
		// Require course_id to create/edit modules
		if (!courseId && !id) {
			alert('Trebuie să selectezi un curs pentru a crea un modul!');
			navigate('/admin/courses');
			return;
		}
		
		// Only fetch module if id exists and is not "new"
		if (id && id !== 'new') {
			fetchModule();
		} else if (courseId) {
			// Set course_id if provided via URL
			setFormData(prev => ({ ...prev, course_id: courseId }));
		}
	}, [id, courseId]);

	const fetchModule = async () => {
		try {
			setLoading(true);
			const module = await adminService.getModule(id);
			setFormData({
				course_id: module.course_id,
				title: module.title || '',
				description: module.description || '',
				order: module.order || 0,
				status: module.status || 'draft',
				is_locked: module.is_locked || false,
				unlock_after_module_id: module.unlock_after_module_id || null,
				unlock_after_lesson_id: module.unlock_after_lesson_id || null,
				estimated_duration_minutes: module.estimated_duration_minutes || null,
			});
		} catch (err) {
			console.error('Error fetching module:', err);
			alert('Eroare la încărcarea modulului');
		} finally {
			setLoading(false);
		}
	};

	// Validate form
	const validate = () => {
		const newErrors = {};
		if (!formData.course_id) {
			newErrors.course_id = 'Trebuie să selectezi un curs';
		}
		if (!formData.title || formData.title.trim().length < 3) {
			newErrors.title = 'Titlul trebuie să aibă minim 3 caractere';
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		
		// Validate before submit
		if (!validate()) {
			alert('Te rugăm să completezi toate câmpurile obligatorii corect!');
			return;
		}
		
		try {
			setLoading(true);
			if (id && id !== 'new') {
				await adminService.updateModule(id, formData);
				alert('Modul actualizat cu succes!');
			} else {
				await adminService.createModule(formData);
				alert('Modul creat cu succes!');
			}
			
			// Navigate back to course detail page
			if (formData.course_id) {
				navigate(`/admin/courses/${formData.course_id}`);
			} else {
				navigate('/admin/courses');
			}
		} catch (err) {
			console.error('Error saving module:', err);
			alert('Eroare la salvarea modulului: ' + (err.response?.data?.message || err.message || 'Eroare necunoscută'));
		} finally {
			setLoading(false);
		}
	};

	if (loading && id && id !== 'new') {
		return (
			<div className="admin-module-creator-page">
				<div className="admin-loading-state">
					<p>Se încarcă...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-module-creator-page">
			<div className="admin-module-creator-container">
				<div className="admin-page-header">
					<div>
						<h1 className="admin-page-title">
							{id && id !== 'new' ? 'Editează Modul' : 'Creează Modul Nou'}
						</h1>
						<p className="admin-page-subtitle">
							Completează informațiile pentru {id && id !== 'new' ? 'actualizarea' : 'crearea'} modulului
						</p>
					</div>
					<button 
						className="admin-btn admin-btn-secondary" 
						onClick={() => {
							if (formData.course_id) {
								navigate(`/admin/courses/${formData.course_id}`);
							} else {
								navigate('/admin/courses');
							}
						}}
					>
						← Înapoi
					</button>
				</div>

				<form onSubmit={handleSubmit} className="admin-form">

					<div className="admin-form-group">
						<label className="admin-label">
							Titlu Modul <span className="admin-form-required">*</span>
						</label>
						<input
							type="text"
							className={`admin-form-input ${errors.title ? 'error' : ''}`}
							value={formData.title}
							onChange={(e) => setFormData({ ...formData, title: e.target.value })}
							placeholder="Ex: Introducere în React"
							maxLength={255}
						/>
						{errors.title && (
							<p className="admin-form-error">{errors.title}</p>
						)}
					</div>

					<div className="admin-form-group">
						<label className="admin-label">
							Descriere
						</label>
						<textarea
							className="admin-form-textarea"
							value={formData.description}
							onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							placeholder="Descrierea modulului (opțional)"
							rows={4}
						/>
					</div>

					<div className="admin-form-group">
						<label className="admin-label">
							Ordine
						</label>
						<input
							type="number"
							className="admin-form-input"
							value={formData.order}
							onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
							placeholder="0"
							min={0}
						/>
						<p className="admin-form-help-text">
							Ordinea în care modulul va apărea în curs (0 = primul)
						</p>
					</div>

					<div className="admin-form-actions">
						<button
							type="button"
							className="admin-btn admin-btn-secondary"
							onClick={() => {
								if (formData.course_id) {
									navigate(`/admin/courses/${formData.course_id}`);
								} else {
									navigate('/admin/courses');
								}
							}}
						>
							Anulează
						</button>
						<button
							type="submit"
							className="admin-btn admin-btn-primary"
							disabled={loading}
						>
							{loading ? 'Se salvează...' : (id && id !== 'new' ? 'Actualizează Modul' : 'Creează Modul')}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default ModuleCreatorPage;

