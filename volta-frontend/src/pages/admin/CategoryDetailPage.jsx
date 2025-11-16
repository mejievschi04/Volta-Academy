import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const CategoryDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const [category, setCategory] = useState(null);
	const [courses, setCourses] = useState([]);
	const [lessons, setLessons] = useState([]);
	const [exams, setExams] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState('courses'); // 'courses', 'lessons', 'exams'
	const [showCourseModal, setShowCourseModal] = useState(false);
	const [editingItem, setEditingItem] = useState(null);

	// Form data
	const [courseFormData, setCourseFormData] = useState({
		title: '',
		description: '',
		teacher_id: '',
		reward_points: 0,
		image: null,
	});


	useEffect(() => {
		fetchCategory();
		fetchCourses();
		fetchLessons();
		fetchExams();
	}, [id]);

	const fetchCategory = async () => {
		try {
			const data = await adminService.getCategory(id);
			setCategory(data);
		} catch (err) {
			console.error('Error fetching category:', err);
			setError('Nu s-a putut încărca compartimentul');
		}
	};

	const fetchCourses = async () => {
		try {
			const allCourses = await adminService.getCourses();
			const categoryCourses = allCourses.filter(c => c.category_id == id);
			setCourses(categoryCourses);
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const fetchLessons = async () => {
		try {
			const allLessons = await adminService.getLessons();
			// Filter lessons by courses in this category
			const categoryCourseIds = courses.map(c => c.id);
			const categoryLessons = allLessons.filter(l => categoryCourseIds.includes(l.course_id));
			setLessons(categoryLessons);
		} catch (err) {
			console.error('Error fetching lessons:', err);
		}
	};

	const fetchExams = async () => {
		try {
			const allExams = await adminService.getExams();
			// Filter exams by courses in this category
			const categoryCourseIds = courses.map(c => c.id);
			const categoryExams = allExams.filter(e => categoryCourseIds.includes(e.course_id));
			setExams(categoryExams);
		} catch (err) {
			console.error('Error fetching exams:', err);
		}
	};

	useEffect(() => {
		if (courses.length > 0) {
			fetchLessons();
			fetchExams();
		}
	}, [courses]);

	useEffect(() => {
		setLoading(false);
	}, [category, courses, lessons, exams]);

	const handleCreateCourse = async (e) => {
		e.preventDefault();
		try {
			const formDataToSend = new FormData();
			formDataToSend.append('title', courseFormData.title);
			formDataToSend.append('description', courseFormData.description);
			formDataToSend.append('category_id', id);
			if (courseFormData.teacher_id) formDataToSend.append('teacher_id', courseFormData.teacher_id);
			formDataToSend.append('reward_points', courseFormData.reward_points);
			if (courseFormData.image) formDataToSend.append('image', courseFormData.image);

			if (editingItem) {
				// Update existing course
				await adminService.updateCourse(editingItem.id, formDataToSend);
			} else {
				// Create new course
				await adminService.createCourse(formDataToSend);
			}

			setShowCourseModal(false);
			setEditingItem(null);
			setCourseFormData({ title: '', description: '', teacher_id: '', reward_points: 0, image: null });
			fetchCourses();
		} catch (err) {
			console.error('Error saving course:', err);
			alert('Eroare la salvarea cursului');
		}
	};

	const handleEditCourse = async (courseId) => {
		try {
			const course = await adminService.getCourse(courseId);
			setEditingItem(course);
			setCourseFormData({
				title: course.title || '',
				description: course.description || '',
				teacher_id: course.teacher_id || '',
				reward_points: course.reward_points || 0,
				image: null, // Don't set image when editing
			});
			setShowCourseModal(true);
		} catch (err) {
			console.error('Error fetching course:', err);
			alert('Eroare la încărcarea cursului');
		}
	};

	const handleDeleteCourse = async (courseId) => {
		if (!confirm('Sigur dorești să ștergi acest curs? Această acțiune va șterge și toate lecțiile și testele asociate.')) return;

		try {
			await adminService.deleteCourse(courseId);
			fetchCourses();
		} catch (err) {
			console.error('Error deleting course:', err);
			alert('Eroare la ștergerea cursului');
		}
	};


	const handleDeleteLesson = async (lessonId) => {
		if (!confirm('Sigur dorești să ștergi această lecție?')) return;
		try {
			await adminService.deleteLesson(lessonId);
			fetchLessons();
		} catch (err) {
			console.error('Error deleting lesson:', err);
			alert('Eroare la ștergerea lecției');
		}
	};

	const handleDeleteExam = async (examId) => {
		if (!confirm('Sigur dorești să ștergi acest test?')) return;
		try {
			await adminService.deleteExam(examId);
			fetchExams();
		} catch (err) {
			console.error('Error deleting exam:', err);
			alert('Eroare la ștergerea testului');
		}
	};

	if (loading) { return null; }

	if (error || !category) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Compartimentul nu a fost găsit'}</p>
				<button className="va-btn" onClick={() => navigate('/admin/courses')}>
					Înapoi la Cursuri
				</button>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<button
						className="va-btn va-btn-sm"
						onClick={() => navigate('/admin/courses')}
						style={{ marginBottom: '1rem' }}
					>
						← Înapoi la Cursuri
					</button>
					<h1 className="va-page-title admin-page-title">
						{category.icon} {category.name}
					</h1>
					<p className="va-muted admin-page-subtitle">{category.description || 'Gestionare compartiment'}</p>
				</div>
			</div>

			{/* Tabs */}
			<div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--va-border)' }}>
				<button
					className="va-btn"
					onClick={() => setActiveTab('courses')}
					style={{
						borderBottom: activeTab === 'courses' ? '2px solid var(--va-primary)' : 'none',
						borderRadius: 0,
					}}
				>
					Cursuri ({courses.length})
				</button>
				<button
					className="va-btn"
					onClick={() => setActiveTab('lessons')}
					style={{
						borderBottom: activeTab === 'lessons' ? '2px solid var(--va-primary)' : 'none',
						borderRadius: 0,
					}}
				>
					Lecții ({lessons.length})
				</button>
				<button
					className="va-btn"
					onClick={() => setActiveTab('exams')}
					style={{
						borderBottom: activeTab === 'exams' ? '2px solid var(--va-primary)' : 'none',
						borderRadius: 0,
					}}
				>
					Teste ({exams.length})
				</button>
			</div>

			{/* Content based on active tab */}
			{activeTab === 'courses' && (
				<>
					<div style={{ marginBottom: '1.5rem' }}>
						<button
							className="va-btn va-btn-primary"
							onClick={() => {
								setEditingItem(null);
								setCourseFormData({ title: '', description: '', teacher_id: '', reward_points: 0, image: null });
								setShowCourseModal(true);
							}}
						>
							+ Adaugă Curs
						</button>
					</div>

					{courses.length > 0 ? (
						<div className="admin-grid">
							{courses.map((course) => (
								<div 
									key={course.id} 
									className="va-card admin-card"
									style={{ cursor: 'pointer' }}
									onClick={() => navigate(`/admin/courses/${course.id}`)}
								>
									<div className="admin-card-body">
										<h3 className="admin-card-title">{course.title}</h3>
										<p className="admin-card-description">
											{course.description?.substring(0, 120)}{course.description?.length > 120 ? '...' : ''}
										</p>
										<div className="admin-card-info">
											<div style={{ marginBottom: '0.5rem' }}>👤 <strong>{course.teacher?.name || 'N/A'}</strong></div>
											<div>📚 <strong>{course.lessons?.length || 0}</strong> lecții</div>
											{course.reward_points > 0 && (
												<div>⭐ <strong>{course.reward_points}</strong> puncte</div>
											)}
										</div>
										<div className="admin-card-actions" onClick={(e) => e.stopPropagation()}>
											<button
												className="va-btn va-btn-sm va-btn-primary"
												onClick={() => navigate(`/admin/courses/${course.id}`)}
											>
												Deschide
											</button>
											<button
												className="va-btn va-btn-sm"
												onClick={() => handleEditCourse(course.id)}
											>
												Editează
											</button>
											<button
												className="va-btn va-btn-sm va-btn-danger"
												onClick={() => handleDeleteCourse(course.id)}
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
								<p className="va-muted">Nu există cursuri în acest compartiment</p>
							</div>
						</div>
					)}
				</>
			)}

			{activeTab === 'lessons' && (
				<>
					<div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--va-surface-2)', borderRadius: '8px' }}>
						<p className="va-muted" style={{ margin: 0 }}>
							💡 <strong>Notă:</strong> Pentru a adăuga lecții, deschide un curs și folosește tabul "Lecții (Module)".
						</p>
					</div>

					{lessons.length > 0 ? (
						<div className="admin-grid">
							{lessons.map((lesson) => (
								<div key={lesson.id} className="va-card admin-card">
									<div className="admin-card-body">
										<h3 className="admin-card-title">{lesson.title}</h3>
										<p className="admin-card-description">
											{lesson.content?.substring(0, 120)}{lesson.content?.length > 120 ? '...' : ''}
										</p>
										<div className="admin-card-info">
											<div>📚 Curs: <strong>{courses.find(c => c.id === lesson.course_id)?.title || 'N/A'}</strong></div>
										</div>
										<div className="admin-card-actions">
											<button 
												className="va-btn va-btn-sm" 
												onClick={() => navigate(`/admin/lessons/${lesson.id}?course_id=${lesson.course_id}&category_id=${id}`)}
											>
												Editează
											</button>
											<button 
												className="va-btn va-btn-sm va-btn-danger" 
												onClick={() => handleDeleteLesson(lesson.id)}
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
								<p className="va-muted">Nu există lecții în acest compartiment</p>
							</div>
						</div>
					)}
				</>
			)}

			{activeTab === 'exams' && (
				<>
					<div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--va-surface-2)', borderRadius: '8px' }}>
						<p className="va-muted" style={{ margin: 0 }}>
							💡 <strong>Notă:</strong> Pentru a adăuga teste, deschide un curs și folosește tabul "Teste".
						</p>
					</div>

					{exams.length > 0 ? (
						<div className="admin-grid">
							{exams.map((exam) => (
								<div key={exam.id} className="va-card admin-card">
									<div className="admin-card-body">
										<h3 className="admin-card-title">{exam.title}</h3>
										<p className="admin-card-description">
											Scor maxim: {exam.max_score || 100} puncte
										</p>
										<div className="admin-card-info">
											<div>📚 Curs: <strong>{courses.find(c => c.id === exam.course_id)?.title || 'N/A'}</strong></div>
										</div>
										<div className="admin-card-actions">
											<button 
												className="va-btn va-btn-sm" 
												onClick={() => navigate(`/admin/exams/${exam.id}?course_id=${exam.course_id}&category_id=${id}`)}
											>
												Editează
											</button>
											<button 
												className="va-btn va-btn-sm va-btn-danger" 
												onClick={() => handleDeleteExam(exam.id)}
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
								<p className="va-muted">Nu există teste în acest compartiment</p>
							</div>
						</div>
					)}
				</>
			)}

			{/* Course Modal */}
			{showCourseModal && (
				<Modal
					title={editingItem ? 'Editează Curs' : 'Adaugă Curs Nou'}
					onClose={() => {
						setShowCourseModal(false);
						setEditingItem(null);
						setCourseFormData({ title: '', description: '', teacher_id: '', reward_points: 0, image: null });
					}}
					onSubmit={handleCreateCourse}
				>
					<CourseForm formData={courseFormData} setFormData={setCourseFormData} />
				</Modal>
			)}

		</div>
	);
};

// Modal Component
const Modal = ({ title, onClose, onSubmit, children }) => (
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
		onClick={onClose}
	>
		<div
			className="va-card"
			style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
			onClick={(e) => e.stopPropagation()}
		>
			<div className="va-card-header">
				<h2>{title}</h2>
			</div>
			<div className="va-card-body">
				<form onSubmit={onSubmit} className="va-stack">
					{children}
					<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
						<button type="button" className="va-btn" onClick={onClose}>
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
);

// Course Form
const CourseForm = ({ formData, setFormData }) => {
	const [teachers, setTeachers] = useState([]);

	useEffect(() => {
		adminService.getTeachers().then(setTeachers).catch(console.error);
	}, []);

	return (
		<>
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
				<label className="va-form-label">Descriere</label>
				<textarea
					className="va-form-input"
					value={formData.description}
					onChange={(e) => setFormData({ ...formData, description: e.target.value })}
					required
					rows={4}
				/>
			</div>
			<div className="va-form-group">
				<label className="va-form-label">Profesor</label>
				<select
					className="va-form-input"
					value={formData.teacher_id}
					onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
				>
					<option value="">Selectează profesor</option>
					{teachers.map((teacher) => (
						<option key={teacher.id} value={teacher.id}>
							{teacher.name}
						</option>
					))}
				</select>
			</div>
			<div className="va-form-group">
				<label className="va-form-label">Puncte Recompensă</label>
				<input
					type="number"
					className="va-form-input"
					value={formData.reward_points}
					onChange={(e) => setFormData({ ...formData, reward_points: parseInt(e.target.value) || 0 })}
					min="0"
				/>
			</div>
			<div className="va-form-group">
				<label className="va-form-label">Imagine</label>
				<input
					type="file"
					accept="image/*"
					onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })}
				/>
			</div>
		</>
	);
};

export default CategoryDetailPage;

