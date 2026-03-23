import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService, coursesService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import CourseOverview from '../../components/admin/courses/CourseOverview';
import '../../styles/admin-course-detail-modern.css';

const AdminCourseDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { showToast } = useToast();
	
	const [course, setCourse] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);

	useEffect(() => {
		if (id) {
			fetchCourseData();
		}
	}, [id]);

	const fetchCourseData = async () => {
		try {
			setLoading(true);
			setError(null);
			
			// Try to get course from adminService first, fallback to coursesService
			let courseData;
			try {
				// Try admin service getCourse method
				courseData = await adminService.getCourse(id);
				// Handle response format
				if (courseData && courseData.data) {
					courseData = courseData.data;
				}
			} catch (err) {
				console.warn('Admin service failed, trying courses service:', err);
				// Fallback to coursesService
				try {
					courseData = await coursesService.getById(id);
				} catch (err2) {
					console.error('Both services failed:', err2);
					throw err2;
				}
			}
			
			if (!courseData) {
				throw new Error('Cursul nu a fost găsit');
			}
			
			setCourse(courseData);
		} catch (err) {
			console.error('Error fetching course:', err);
			setError(err.message || 'Nu s-a putut încărca cursul');
			showToast('Eroare la încărcarea cursului', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleQuickAction = async (action) => {
		if (!course) return;

		try {
			switch (action) {
				case 'publish':
					await adminService.updateCourse(course.id, { status: 'published' });
					showToast('Cursul a fost publicat cu succes', 'success');
					fetchCourseData();
					break;
				case 'unpublish':
					await adminService.updateCourse(course.id, { status: 'draft' });
					showToast('Cursul a fost retras din publicare', 'success');
					fetchCourseData();
					break;
				case 'delete':
					setShowDeleteConfirm(true);
					break;
				case 'preview':
					// Navigate to student course detail page - full student experience
					sessionStorage.setItem('studentPreviewFromAdmin', 'true');
					navigate(`/courses/${course.id}/detail`);
					break;
				default:
					console.warn('Unknown action:', action);
			}
		} catch (err) {
			console.error('Error performing action:', err);
			showToast('Eroare la efectuarea acțiunii', 'error');
		}
	};

	const handleConfirmDeleteCourse = async () => {
		if (!course) return;
		setDeleteLoading(true);
		try {
			await adminService.deleteCourse(course.id);
			showToast('Cursul a fost șters cu succes', 'success');
			setShowDeleteConfirm(false);
			navigate('/admin/courses');
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la ștergere', 'error');
		} finally {
			setDeleteLoading(false);
		}
	};

	if (loading) {
		return (
			<div style={{ 
				padding: 'var(--space-8)', 
				display: 'flex', 
				flexDirection: 'column', 
				alignItems: 'center', 
				justifyContent: 'center',
				minHeight: '60vh',
				gap: 'var(--space-4)'
			}}>
				<div className="va-spinner va-spinner-lg"></div>
				<p style={{ color: 'var(--text-secondary)' }}>Se încarcă cursul...</p>
			</div>
		);
	}

	if (error || !course) {
		return (
			<div style={{ 
				padding: 'var(--space-8)', 
				display: 'flex', 
				flexDirection: 'column', 
				alignItems: 'center', 
				justifyContent: 'center',
				minHeight: '60vh',
				gap: 'var(--space-4)'
			}}>
				<p style={{ color: 'var(--color-error)', marginBottom: 'var(--space-4)' }}>
					{error || 'Cursul nu a fost găsit'}
				</p>
				<button className="lms-btn-primary" onClick={() => navigate('/admin/courses')}>
					← Înapoi la Cursuri
				</button>
			</div>
		);
	}

	return (
		<div className="admin-course-detail-page">
			{/* Header */}
			<div className="admin-course-detail-header">
				<button 
					className="admin-course-detail-back-btn"
					onClick={() => navigate('/admin/courses')}
				>
					← Înapoi
				</button>
				<button
					className="lms-btn-secondary"
					onClick={() => navigate(`/admin/courses/${id}/builder`)}
					style={{ marginLeft: 'var(--space-3)' }}
				>
					🛠 Builder
				</button>
				<h1 className="admin-course-detail-title">
					{course.title}
				</h1>
			</div>

			{/* Course Overview */}
			<CourseOverview course={course} onQuickAction={handleQuickAction} />

			<ConfirmModal
				open={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={handleConfirmDeleteCourse}
				title="Șterge curs"
				message="Ești sigur că vrei să ștergi acest curs? Această acțiune este ireversibilă."
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteLoading}
			/>
		</div>
	);
};

export default AdminCourseDetailPage;
