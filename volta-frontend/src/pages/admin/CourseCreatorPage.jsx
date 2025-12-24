import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';

const CourseCreatorPage = () => {
	const { id } = useParams(); // course ID if editing
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);
	const [teachers, setTeachers] = useState([]);
	const [errors, setErrors] = useState({});
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		teacher_id: '',
		image: null,
	});

	useEffect(() => {
		fetchTeachers();
		if (id) {
			fetchCourse();
		}
	}, [id]);

	const fetchTeachers = async () => {
		try {
			const data = await adminService.getTeachers();
			setTeachers(data);
		} catch (err) {
			console.error('Error fetching teachers:', err);
		}
	};

	const fetchCourse = async () => {
		try {
			setLoading(true);
			const course = await adminService.getCourse(id);
			setFormData({
				title: course.title || '',
				description: course.description || '',
				teacher_id: course.teacher_id || '',
				image: null, // Don't load existing image, user can re-upload if needed
			});
		} catch (err) {
			console.error('Error fetching course:', err);
			alert('Eroare la încărcarea cursului');
		} finally {
			setLoading(false);
		}
	};

	// Validate form
	const validate = () => {
		const newErrors = {};
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
			const submitData = new FormData();
			submitData.append('title', formData.title);
			submitData.append('description', formData.description || '');
			if (formData.teacher_id) {
				submitData.append('teacher_id', formData.teacher_id);
			}
			if (formData.image) {
				submitData.append('image', formData.image);
			}

			if (id) {
				await adminService.updateCourse(id, submitData);
				alert('Curs actualizat cu succes!');
			} else {
				await adminService.createCourse(submitData);
				alert('Curs creat cu succes!');
			}
			
			// Navigate back to courses list
			navigate('/admin/courses');
		} catch (err) {
			console.error('Error saving course:', err);
			alert('Eroare la salvarea cursului: ' + (err.response?.data?.message || err.message || 'Eroare necunoscută'));
		} finally {
			setLoading(false);
		}
	};

	if (loading && id) {
		return (
			<div className="admin-container">
				<p>Se încarcă...</p>
			</div>
		);
	}

	return (
		<div className="admin-course-creator-page">
			<div className="admin-course-creator-container">
				<div className="admin-page-header">
					<div>
						<h1 className="admin-page-title">
							{id ? 'Editează Curs' : 'Creează Curs Nou'}
						</h1>
						<p className="admin-page-subtitle">
							Completează informațiile pentru {id ? 'actualizarea' : 'crearea'} cursului
						</p>
					</div>
					<button 
						className="admin-btn admin-btn-secondary" 
						onClick={() => navigate('/admin/courses')}
					>
						← Înapoi
					</button>
				</div>

				<form onSubmit={handleSubmit} className="admin-form">
				<div className="admin-form-group">
					<label className="admin-label">
						Titlu Curs <span>*</span>
					</label>
					<input
						type="text"
						className={`admin-input ${errors.title ? 'admin-input-error' : ''}`}
						value={formData.title}
						onChange={(e) => setFormData({ ...formData, title: e.target.value })}
						placeholder="Ex: Introducere în React"
						maxLength={255}
					/>
					{errors.title && (
						<p className="admin-error-text">{errors.title}</p>
					)}
				</div>

				<div className="admin-form-group">
					<label className="admin-label">
						Descriere
					</label>
					<textarea
						className="admin-input"
						value={formData.description}
						onChange={(e) => setFormData({ ...formData, description: e.target.value })}
						placeholder="Descrierea cursului (opțional)"
						rows={5}
					/>
				</div>

				<div className="admin-form-group">
					<label className="admin-label">
						Profesor
					</label>
					<select
						className="admin-input"
						value={formData.teacher_id}
						onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
					>
						<option value="">Selectează un profesor (opțional)</option>
						{teachers.map((teacher) => (
							<option key={teacher.id} value={teacher.id}>
								{teacher.name} {teacher.email ? `(${teacher.email})` : ''}
							</option>
						))}
					</select>
				</div>

				<div className="admin-form-group">
					<label className="admin-label">
						Imagine Curs
					</label>
					<input
						type="file"
						className="admin-input"
						accept="image/jpeg,image/png,image/jpg,image/gif"
						onChange={(e) => setFormData({ ...formData, image: e.target.files[0] || null })}
					/>
					<p className="admin-input-hint">
						Format acceptat: JPEG, PNG, GIF (max 2MB)
					</p>
				</div>

				<div className="admin-form-actions">
					<button
						type="button"
						className="admin-btn admin-btn-secondary"
						onClick={() => navigate('/admin/courses')}
					>
						Anulează
					</button>
					<button
						type="submit"
						className="admin-btn admin-btn-primary"
						disabled={loading}
					>
						{loading ? 'Se salvează...' : (id ? 'Actualizează Curs' : 'Creează Curs')}
					</button>
				</div>
			</form>
		</div>
	);
};

export default CourseCreatorPage;

