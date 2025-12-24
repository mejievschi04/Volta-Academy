import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import CourseOverview from '../../components/admin/courses/CourseOverview';
import CourseStructureBuilder from '../../components/admin/courses/CourseStructureBuilder';

const AdminCourseDetailPage = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const [course, setCourse] = useState(null);
	const [modules, setModules] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'structure'
	const [actionLoading, setActionLoading] = useState(null);

	useEffect(() => {
		fetchCourseData();
	}, [id]);

	// Reload data when page becomes visible (user returns from creating test/lesson)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				fetchCourseData();
			}
		};

		const handleFocus = () => {
			fetchCourseData();
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
		};
	}, [id]);

	const fetchCourseData = async () => {
		try {
			setLoading(true);
			setError(null);
			const courseData = await adminService.getCourse(id);
			setCourse(courseData);
			// Use modules from courseData (which includes tests) instead of separate API call
			// Sort modules by order
			const modulesList = (courseData.modules || []).sort((a, b) => (a.order || 0) - (b.order || 0));
			setModules(modulesList);
			console.log('[AdminCourseDetailPage] Loaded modules:', modulesList.map(m => ({
				id: m.id,
				title: m.title,
				lessons_count: m.lessons?.length || 0,
			})));
			console.log('[AdminCourseDetailPage] Full courseData:', {
				course_id: courseData.id,
				modules_count: courseData.modules?.length || 0,
			});
		} catch (err) {
			console.error('Error fetching course data:', err);
			setError('Nu s-a putut încărca cursul');
		} finally {
			setLoading(false);
		}
	};

	const handleQuickAction = async (action) => {
		// Special handling for delete action
		if (action === 'delete') {
			if (!confirm(`Sigur dorești să ștergi complet cursul "${course.title}"?\n\nAceastă acțiune este ireversibilă și va șterge:\n- Toate modulele\n- Toate lecțiile\n- Toate legăturile cu testele\n- Toate înscrierile\n- Toate progresele\n\nAceastă acțiune NU poate fi anulată!`)) {
				return;
			}
			
			// Double confirmation for delete
			if (!confirm(`ATENȚIE! Ești sigur că vrei să ștergi definitiv cursul "${course.title}"?\n\nApasă OK doar dacă ești 100% sigur!`)) {
				return;
			}
		}
		
		setActionLoading(action);
		try {
			if (action === 'delete') {
				await adminService.deleteCourse(id);
				alert('Curs șters cu succes!');
				navigate('/admin/courses');
			} else {
				await adminService.courseQuickAction(id, action);
				await fetchCourseData();
			}
		} catch (err) {
			console.error(`Error ${action} course:`, err);
			alert(`Eroare la ${action}: ${err.response?.data?.message || err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleReorderModules = async (reorderedModules) => {
		try {
			await adminService.reorderModules(id, reorderedModules.map(m => m.id));
			setModules(reorderedModules);
		} catch (err) {
			console.error('Error reordering modules:', err);
			alert('Eroare la reordonare: ' + (err.response?.data?.message || err.message));
			await fetchCourseData(); // Revert on error
		}
	};

	const handleEditModule = (moduleId) => {
		navigate(`/admin/modules/${moduleId}?course_id=${id}`);
	};

	const handleDeleteModule = async (moduleId) => {
		if (!confirm('Sigur dorești să ștergi acest modul? Această acțiune este ireversibilă.')) {
			return;
		}

		setActionLoading(`delete-module-${moduleId}`);
		try {
			await adminService.deleteModule(moduleId);
			await fetchCourseData();
		} catch (err) {
			console.error('Error deleting module:', err);
			alert('Eroare la ștergerea modulului: ' + (err.response?.data?.message || err.message));
		} finally {
			setActionLoading(null);
		}
	};

	const handleToggleModuleLock = async (moduleId) => {
		setActionLoading(`toggle-lock-${moduleId}`);
		try {
			await adminService.toggleModuleLock(moduleId);
			await fetchCourseData();
		} catch (err) {
			console.error('Error toggling module lock:', err);
			alert('Eroare: ' + (err.response?.data?.message || err.message));
		} finally {
			setActionLoading(null);
		}
	};

	const handleAddModule = () => {
		navigate(`/admin/modules/new?course_id=${id}`);
	};

	const handleAddLesson = (moduleId) => {
		navigate(`/admin/lessons/new?module_id=${moduleId}&course_id=${id}`);
	};

	const handleAddTest = () => {
		// Navigate to Test Builder - tests are standalone and attached in Step4Tests
		navigate('/admin/tests/new/builder');
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="admin-loading-state">
					<div className="admin-loading-spinner"></div>
					<p>Se încarcă cursul...</p>
				</div>
			</div>
		);
	}

	if (error || !course) {
		return (
			<div className="admin-container">
				<div className="admin-error-message">
					<strong>Eroare:</strong> {error || 'Cursul nu a fost găsit'}
				</div>
				<button className="admin-btn" onClick={() => navigate('/admin/courses')}>
					Înapoi la Cursuri
				</button>
			</div>
		);
	}

	return (
		<div className="admin-course-detail-page">
			<div className="admin-course-detail-container">
				{/* Header */}
				<div className="admin-course-detail-header">
					<div className="admin-course-detail-header-left">
						<button
							className="admin-btn admin-btn-back"
							onClick={() => navigate('/admin/courses')}
						>
							← Înapoi
						</button>
						<div className="admin-course-detail-title-section">
							<h1 className="admin-course-detail-title">{course.title}</h1>
							<p className="admin-course-detail-subtitle">
								{course.short_description || course.description || 'Gestionare curs'}
							</p>
						</div>
					</div>
					<div className="admin-course-detail-header-right">
						<button
							className="admin-btn admin-btn-secondary"
							onClick={() => navigate(`/admin/courses/${id}/builder`)}
						>
							✏️ Editează Curs
						</button>
					</div>
				</div>

				{/* Tabs */}
				<div className="admin-course-detail-tabs">
					<button
						className={`admin-course-detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
						onClick={() => setActiveTab('overview')}
					>
						📊 Overview
					</button>
					<button
						className={`admin-course-detail-tab ${activeTab === 'structure' ? 'active' : ''}`}
						onClick={() => setActiveTab('structure')}
					>
						🏗️ Structură
					</button>
				</div>

				{/* Content */}
				<div className="admin-course-detail-content">
					{activeTab === 'overview' && (
						<CourseOverview
							course={course}
							onQuickAction={handleQuickAction}
						/>
					)}

					{activeTab === 'structure' && (
						<CourseStructureBuilder
							course={course}
							modules={modules}
							onReorderModules={handleReorderModules}
							onEditModule={handleEditModule}
							onDeleteModule={handleDeleteModule}
							onToggleModuleLock={handleToggleModuleLock}
							onAddModule={handleAddModule}
							onAddLesson={handleAddLesson}
							onAddTest={handleAddTest}
							loading={actionLoading !== null}
						/>
					)}
				</div>
			</div>
		</div>
	);
};

export default AdminCourseDetailPage;
