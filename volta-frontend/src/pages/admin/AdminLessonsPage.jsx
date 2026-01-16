import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { coursesService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';

const AdminLessonsPage = () => {
	const { success: showSuccess, error: showError } = useToast();
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
			logger.error('Error saving lesson:', err);
			showError('Eroare la salvarea lecției: ' + (err.response?.data?.message || err.message));
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
			logger.error('Error deleting lesson:', err);
			showError('Eroare la ștergerea lecției: ' + (err.response?.data?.message || err.message));
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="admin-loading-state">
					<div className="admin-loading-spinner"></div>
					<p>Se încarcă lecțiile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="admin-page-title">Gestionare Lecții</h1>
					<p className="admin-page-subtitle">Gestionează toate lecțiile din platformă</p>
				</div>
				<div className="admin-page-header-actions">
					<button
						className="admin-btn admin-btn-primary"
						onClick={() => {
							setEditingLesson(null);
							setFormData({ course_id: '', title: '', content: '', order: 0 });
							setShowModal(true);
						}}
					>
						<span className="admin-btn-icon">+</span>
						Adaugă Lecție
					</button>
				</div>
			</div>

			{error && (
				<div className="admin-error-message">
					<strong>Eroare:</strong> {error}
				</div>
			)}

			{lessons.length > 0 ? (
				<div className="admin-grid">
					{lessons.map((lesson) => (
						<div
							key={lesson.id}
							className="admin-card"
						>
							<div className="admin-card-body">
								{/* Header with icon */}
								<div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
									<div style={{ 
										width: '56px', 
										height: '56px', 
										borderRadius: 'var(--radius-xl)', 
										background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))', 
										display: 'flex', 
										alignItems: 'center', 
										justifyContent: 'center',
										fontSize: '28px',
										flexShrink: 0,
										boxShadow: 'var(--shadow-md)'
									}}>
										📚
									</div>
									<div style={{ flex: 1, minWidth: 0 }}>
										<h3 className="admin-card-title" style={{ marginBottom: 'var(--space-2)' }}>
											{lesson.title}
										</h3>
										<div className="admin-card-description" style={{ 
											fontSize: 'var(--font-size-sm)', 
											display: 'flex',
											alignItems: 'center',
											gap: 'var(--space-2)',
											flexWrap: 'wrap'
										}}>
											<span>📚 <strong>{lesson.course?.title || 'N/A'}</strong></span>
											<span>•</span>
											<span>🔢 Ordine: <strong>{lesson.order || 0}</strong></span>
										</div>
									</div>
								</div>

								{lesson.content && (
									<p className="admin-card-description" style={{ marginBottom: 'var(--space-4)' }}>
										{lesson.content.substring(0, 150)}{lesson.content.length > 150 ? '...' : ''}
									</p>
								)}

								<div className="admin-card-actions">
									<button
										className="admin-btn admin-btn-sm admin-btn-secondary"
										onClick={() => handleEdit(lesson)}
									>
										<span className="admin-btn-icon">✏️</span>
										<span>Editează</span>
									</button>
									<button
										className="admin-btn admin-btn-sm admin-btn-danger"
										onClick={() => handleDelete(lesson.id)}
									>
										<span className="admin-btn-icon">🗑️</span>
										<span>Șterge</span>
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="admin-empty-state">
					<div className="admin-empty-state-icon">📚</div>
					<div className="admin-empty-state-title">Nu există lecții</div>
					<div className="admin-empty-state-description">
						Începe prin a crea prima lecție
					</div>
					<button
						className="admin-btn admin-btn-primary"
						onClick={() => {
							setEditingLesson(null);
							setFormData({ course_id: '', title: '', content: '', order: 0 });
							setShowModal(true);
						}}
					>
						<span className="admin-btn-icon">+</span>
						Adaugă Lecție
					</button>
				</div>
			)}

			{showModal && (
				<div
					className="admin-team-modal-overlay"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowModal(false);
						}
					}}
				>
					<div className="admin-team-modal" onClick={(e) => e.stopPropagation()}>
						<div className="admin-team-modal-header">
							<h2 className="admin-team-modal-title">
								{editingLesson ? 'Editează Lecție' : 'Adaugă Lecție Nouă'}
							</h2>
							<button
								type="button"
								className="admin-team-modal-close"
								onClick={() => setShowModal(false)}
								title="Închide"
							>
								×
							</button>
						</div>
						<div className="admin-team-modal-body">
							<form onSubmit={handleSubmit} className="admin-form">
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
								<div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
									<button
										type="button"
										className="admin-btn admin-btn-secondary"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="admin-btn admin-btn-primary">
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

