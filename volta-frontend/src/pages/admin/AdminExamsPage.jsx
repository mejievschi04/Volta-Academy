import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';
import { coursesService } from '../../services/api';

const AdminExamsPage = () => {
	const [exams, setExams] = useState([]);
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingExam, setEditingExam] = useState(null);
	const [formData, setFormData] = useState({
		course_id: '',
		title: '',
		max_score: 100,
	});

	useEffect(() => {
		fetchExams();
		fetchCourses();
	}, []);

	const fetchExams = async () => {
		try {
			setLoading(true);
			const data = await adminService.getExams();
			setExams(data);
		} catch (err) {
			console.error('Error fetching exams:', err);
			setError('Nu s-au putut încărca testele');
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
			if (editingExam) {
				await adminService.updateExam(editingExam.id, formData);
			} else {
				await adminService.createExam(formData);
			}

			setShowModal(false);
			setEditingExam(null);
			setFormData({ course_id: '', title: '', max_score: 100 });
			fetchExams();
		} catch (err) {
			console.error('Error saving exam:', err);
			alert('Eroare la salvarea testului');
		}
	};

	const handleEdit = (exam) => {
		setEditingExam(exam);
		setFormData({
			course_id: exam.course_id,
			title: exam.title,
			max_score: exam.max_score || 100,
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi acest test?')) return;

		try {
			await adminService.deleteExam(id);
			fetchExams();
		} catch (err) {
			console.error('Error deleting exam:', err);
			alert('Eroare la ștergerea testului');
		}
	};

	if (loading) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Teste</h1>
					<p className="va-muted admin-page-subtitle">Gestionează toate testele din platformă</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingExam(null);
						setFormData({ course_id: '', title: '', max_score: 100 });
						setShowModal(true);
					}}
				>
					+ Adaugă Test
				</button>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{exams.length > 0 ? (
				<div className="admin-grid">
					{exams.map((exam) => (
						<div
							key={exam.id}
							className="va-card admin-card"
						>
							<div className="admin-card-body">
								<h3 className="admin-card-title">{exam.title}</h3>
								<div className="admin-card-info" style={{ flex: 1 }}>
									<div style={{ marginBottom: '0.5rem' }}>📚 <strong>{exam.course_title || 'N/A'}</strong></div>
									<div>📊 Scor: <strong>{exam.max_score || 100}</strong></div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm"
										onClick={() => handleEdit(exam)}
									>
										Editează
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(exam.id)}
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
						<p className="va-muted">Nu există teste</p>
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
							<h2>{editingExam ? 'Editează Test' : 'Adaugă Test Nou'}</h2>
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
									<label className="va-form-label">Scor Maxim</label>
									<input
										type="number"
										className="va-form-input"
										value={formData.max_score}
										onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 100 })}
										min="1"
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

export default AdminExamsPage;

