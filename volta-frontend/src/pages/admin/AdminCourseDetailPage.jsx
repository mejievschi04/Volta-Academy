import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const AdminCourseDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const [course, setCourse] = useState(null);
	const [lessons, setLessons] = useState([]);
	const [exams, setExams] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState('lessons'); // 'lessons', 'exams'

	useEffect(() => {
		fetchCourse();
		fetchLessons();
		fetchExams();
	}, [id]);

	const fetchCourse = async () => {
		try {
			setLoading(true);
			const data = await adminService.getCourse(id);
			setCourse(data);
		} catch (err) {
			console.error('Error fetching course:', err);
			setError('Nu s-a putut încărca cursul');
		} finally {
			setLoading(false);
		}
	};

	const fetchLessons = async () => {
		try {
			const data = await adminService.getLessons(id);
			setLessons(data);
		} catch (err) {
			console.error('Error fetching lessons:', err);
		}
	};

	const fetchExams = async () => {
		try {
			const data = await adminService.getExams();
			const courseExams = data.filter(e => e.course_id == id);
			setExams(courseExams);
		} catch (err) {
			console.error('Error fetching exams:', err);
		}
	};


	const handleEditLesson = (lesson) => {
		// Navigate to lesson creator page with course_id
		navigate(`/admin/lessons/${lesson.id}?course_id=${id}`);
	};

	const handleEditExam = async (examId) => {
		// Navigate to exam creator page with course_id
		navigate(`/admin/exams/${examId}?course_id=${id}`);
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

	if (error || !course) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Cursul nu a fost găsit'}</p>
				<button className="va-btn" onClick={() => navigate(-1)}>
					Înapoi
				</button>
			</div>
		);
	}

	// Get category ID from course for navigation
	const categoryId = course.category_id;

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<button
						className="va-btn va-btn-sm"
						onClick={() => navigate(categoryId ? `/admin/categories/${categoryId}` : '/admin/courses')}
						style={{ marginBottom: '1rem' }}
					>
						← Înapoi
					</button>
					<h1 className="va-page-title admin-page-title">{course.title}</h1>
					<p className="va-muted admin-page-subtitle">{course.description || 'Gestionare curs'}</p>
					<div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
						{course.teacher && (
							<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
								👤 Profesor: <strong>{course.teacher.name}</strong>
							</div>
						)}
						<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
							📚 Lecții: <strong>{lessons.length}</strong>
						</div>
						<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
							📝 Teste: <strong>{exams.length}</strong>
						</div>
						{course.reward_points > 0 && (
							<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
								⭐ Puncte: <strong>{course.reward_points}</strong>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--va-border)' }}>
				<button
					className="va-btn"
					onClick={() => setActiveTab('lessons')}
					style={{
						borderBottom: activeTab === 'lessons' ? '2px solid var(--va-primary)' : 'none',
						borderRadius: 0,
					}}
				>
					📚 Lecții (Module) ({lessons.length})
				</button>
				<button
					className="va-btn"
					onClick={() => setActiveTab('exams')}
					style={{
						borderBottom: activeTab === 'exams' ? '2px solid var(--va-primary)' : 'none',
						borderRadius: 0,
					}}
				>
					📝 Teste ({exams.length})
				</button>
			</div>

			{/* Lessons Tab */}
			{activeTab === 'lessons' && (
				<>
					<div style={{ marginBottom: '1.5rem' }}>
						<button
							className="va-btn va-btn-primary"
							onClick={() => {
								// Navigate to lesson creator page with course_id
								navigate(`/admin/lessons?course_id=${id}`);
							}}
						>
							+ Adaugă Lecție (Modul)
						</button>
					</div>

					{lessons.length > 0 ? (
						<div className="admin-grid">
							{lessons
								.sort((a, b) => (a.order || 0) - (b.order || 0))
								.map((lesson) => (
									<div key={lesson.id} className="va-card admin-card">
										<div className="admin-card-body">
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
												<h3 className="admin-card-title">{lesson.title}</h3>
												<span style={{ fontSize: '0.75rem', color: 'var(--va-muted)', padding: '0.25rem 0.5rem', background: 'var(--va-surface-2)', borderRadius: '4px' }}>
													#{lesson.order || 0}
												</span>
											</div>
											<p className="admin-card-description">
												{lesson.content?.substring(0, 150)}{lesson.content?.length > 150 ? '...' : ''}
											</p>
											<div className="admin-card-actions">
												<button
													className="va-btn va-btn-sm"
													onClick={() => handleEditLesson(lesson)}
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
								<p className="va-muted">Nu există lecții în acest curs. Adaugă prima lecție!</p>
							</div>
						</div>
					)}
				</>
			)}

			{/* Exams Tab */}
			{activeTab === 'exams' && (
				<>
					<div style={{ marginBottom: '1.5rem' }}>
						<button
							className="va-btn va-btn-primary"
							onClick={() => {
								// Navigate to exam creator page with course_id
								navigate(`/admin/exams?course_id=${id}`);
							}}
						>
							+ Adaugă Test
						</button>
					</div>

					{exams.length > 0 ? (
						<div className="admin-grid">
							{exams.map((exam) => (
								<div key={exam.id} className="va-card admin-card">
									<div className="admin-card-body">
										<h3 className="admin-card-title">{exam.title}</h3>
										<p className="admin-card-description">
											{exam.description?.substring(0, 150) || 'Fără descriere'}
											{exam.description?.length > 150 ? '...' : ''}
										</p>
										<div className="admin-card-info">
											<div>❓ <strong>{exam.questions?.length || 0}</strong> întrebări</div>
											{exam.max_score && (
												<div>⭐ <strong>{exam.max_score}</strong> puncte maxime</div>
											)}
										</div>
										<div className="admin-card-actions">
											<button
												className="va-btn va-btn-sm"
												onClick={() => handleEditExam(exam.id)}
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
								<p className="va-muted">Nu există teste în acest curs. Adaugă primul test!</p>
							</div>
						</div>
					)}
				</>
			)}

		</div>
	);
};

export default AdminCourseDetailPage;

