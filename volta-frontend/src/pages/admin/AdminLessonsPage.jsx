import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';
import { coursesService } from '../../services/api';

const AdminLessonsPage = () => {
	const [lessons, setLessons] = useState([]);
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingLesson, setEditingLesson] = useState(null);
	const [formData, setFormData] = useState({
		course_id: '',
		title: '',
		content: '',
		order: 0,
	});

	useEffect(() => {
		fetchLessons();
		fetchCourses();
	}, []);

	const fetchLessons = async () => {
		try {
			setLoading(true);
			const data = await adminService.getLessons();
			setLessons(data);
		} catch (err) {
			console.error('Error fetching lessons:', err);
			setError('Nu s-au putut încărca lecțiile');
		} finally {
			setLoading(false);
		}
	};

	const fetchCourses = async () => {
		try {
			const data = await coursesService.getAll();
			setCourses(data);
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingLesson) {
				await adminService.updateLesson(editingLesson.id, formData);
			} else {
				await adminService.createLesson(formData);
			}

			setShowModal(false);
			setEditingLesson(null);
			setFormData({ course_id: '', title: '', content: '', order: 0 });
			fetchLessons();
		} catch (err) {
			console.error('Error saving lesson:', err);
			alert('Eroare la salvarea lecției');
		}
	};

	const handleEdit = (lesson) => {
		setEditingLesson(lesson);
		setFormData({
			course_id: lesson.course_id,
			title: lesson.title,
			content: lesson.content,
			order: lesson.order || 0,
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi această lecție?')) return;

		try {
			await adminService.deleteLesson(id);
			fetchLessons();
		} catch (err) {
			console.error('Error deleting lesson:', err);
			alert('Eroare la ștergerea lecției');
		}
	};

	if (loading) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Lecții</h1>
					<p className="va-muted admin-page-subtitle">Gestionează toate lecțiile din platformă</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingLesson(null);
						setFormData({ course_id: '', title: '', content: '', order: 0 });
						setShowModal(true);
					}}
				>
					+ Adaugă Lecție
				</button>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{lessons.length > 0 ? (
				<div className="admin-grid">
					{lessons.map((lesson) => (
						<div
							key={lesson.id}
							className="va-card admin-card"
						>
							<div className="admin-card-body">
								<h3 className="admin-card-title">{lesson.title}</h3>
								<p className="admin-card-description" style={{ minHeight: '80px' }}>
									{lesson.content?.substring(0, 150)}{lesson.content?.length > 150 ? '...' : ''}
								</p>
								<div className="admin-card-info">
									<div style={{ marginBottom: '0.5rem' }}>📚 <strong>{lesson.course?.title || 'N/A'}</strong></div>
									<div>🔢 Ordine: <strong>{lesson.order || 0}</strong></div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm"
										onClick={() => handleEdit(lesson)}
									>
										Editează
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(lesson.id)}
									>
										Șterge
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body">
						<p className="va-muted">Nu există lecții</p>
					</div>
				</div>
			)}

			{showModal && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowModal(false)}
				>
					<div
						className="va-card"
						style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header">
							<h2>{editingLesson ? 'Editează Lecție' : 'Adaugă Lecție Nouă'}</h2>
						</div>
						<div className="va-card-body">
							<form onSubmit={handleSubmit} className="va-stack">
								<div className="va-form-group">
									<label className="va-form-label">Curs</label>
									<select
										className="va-form-input"
										value={formData.course_id}
										onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
										required
									>
										<option value="">Selectează curs</option>
										{courses.map((course) => (
											<option key={course.id} value={course.id}>
												{course.title}
											</option>
										))}
									</select>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Titlu</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.title}
										onChange={(e) => setFormData({ ...formData, title: e.target.value })}
										required
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Conținut</label>
									<textarea
										className="va-form-input"
										value={formData.content}
										onChange={(e) => setFormData({ ...formData, content: e.target.value })}
										required
										rows={8}
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Ordine</label>
									<input
										type="number"
										className="va-form-input"
										value={formData.order}
										onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
										min="0"
									/>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
									<button
										type="button"
										className="va-btn"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="va-btn va-btn-primary">
										Salvează
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminLessonsPage;

