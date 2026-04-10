import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import BuildCourseModal from '../../components/admin/courses/BuildCourseModal';
import AICourseChat from '../../components/admin/ai/AICourseChat';
import { courseCoverSrc } from '../../utils/imageUrl';
import { useAuth } from '../../contexts/AuthContext';
import './AdminCoursesPage.css';

const AdminCoursesPage = () => {
	const { canMutateInAdminArea } = useAuth();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const courseMapId = searchParams.get('course_map_id');
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState(null);
	const [search, setSearch] = useState('');
	const [showCreateMenu, setShowCreateMenu] = useState(false);
	const [showBuildModal, setShowBuildModal] = useState(false);
	const [showAiCourseChat, setShowAiCourseChat] = useState(false);
	const createMenuRef = useRef(null);

	const fetchCourses = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await adminService.getCourses({
				search: search || undefined,
				sort: 'recent',
				course_map_id: courseMapId || undefined,
			});
			setCourses(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Eroare încărcare cursuri:', err);
			setError('Nu s-au putut încărca cursurile');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchCourses();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [courseMapId]);

	useEffect(() => {
		const handleOutsideClick = (event) => {
			if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
				setShowCreateMenu(false);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	const handleBuildSubmit = async ({ title, description, image, pdfFile }) => {
		setCreating(true);
		try {
			let payload;
			if (image || pdfFile) {
				const formData = new FormData();
				formData.append('title', title);
				formData.append('description', description);
				formData.append('status', 'draft');
				formData.append('level', 'beginner');
				formData.append('visibility', 'public');
				formData.append('sequential_unlock', '1');
				formData.append('min_test_score', '70');
				formData.append('has_certificate', '0');
				formData.append('access_type', 'free');
				formData.append('enrollment_type', 'open');
				if (image) formData.append('image', image);
				if (pdfFile) formData.append('pdf_file', pdfFile);
				payload = formData;
			} else {
				payload = {
					title,
					description,
					status: 'draft',
					level: 'beginner',
					visibility: 'public',
					sequential_unlock: true,
					min_test_score: 70,
					has_certificate: false,
					access_type: 'free',
					enrollment_type: 'open',
				};
			}
			const result = await adminService.createCourse(payload);
			const courseId = result?.course?.id;
			if (courseId) {
				setShowBuildModal(false);
				navigate(`/admin/courses/${courseId}/builder`);
			}
		} catch (err) {
			console.error('Error creating course:', err);
		} finally {
			setCreating(false);
		}
	};

	const handleAiCourseGenerated = (course) => {
		if (course?.id) {
			setShowAiCourseChat(false);
			fetchCourses();
			navigate(`/admin/courses/${course.id}/builder`);
		}
	};

	const filteredCourses = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return courses;
		return courses.filter((course) => (course.title || '').toLowerCase().includes(query));
	}, [courses, search]);

	if (error) {
		return (
			<div className="admin-container">
				<div className="lms-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error}</p>
					<button className="lms-btn-primary" onClick={fetchCourses}>
						Încearcă din nou
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container admin-courses-clean-page">
					{showBuildModal && canMutateInAdminArea && (
						<BuildCourseModal
							onClose={() => { setShowBuildModal(false); }}
							onSubmit={handleBuildSubmit}
							loading={creating}
						/>
					)}
					{showAiCourseChat && canMutateInAdminArea && (
						<div className="ai-chat-modal-overlay" onClick={() => setShowAiCourseChat(false)}>
							<div className="ai-chat-modal" onClick={(e) => e.stopPropagation()}>
								<AICourseChat
									onCourseGenerated={handleAiCourseGenerated}
									onClose={() => setShowAiCourseChat(false)}
								/>
							</div>
						</div>
					)}
			<header className="admin-courses-clean-header">
				<div>
					<h1>Cursuri</h1>
					<p>Creează și administrează conținutul academiei într-un mod simplu.</p>
				</div>
				<div className="admin-courses-clean-right">
					{canMutateInAdminArea && (
					<div className="admin-courses-create-wrap" ref={createMenuRef}>
						<button className="admin-courses-create-btn" onClick={() => setShowCreateMenu((prev) => !prev)}>
							+ Creează curs
						</button>
						{showCreateMenu && (
							<div className="admin-courses-create-menu">
								<button onClick={() => { setShowCreateMenu(false); navigate('/admin/courses/new'); }}>
									Curs nou
								</button>
								<button onClick={() => { setShowCreateMenu(false); setShowAiCourseChat(true); }}>
									Curs cu Volt
								</button>
							</div>
						)}
					</div>
					)}
					<div className="admin-courses-top-links">
						{courseMapId && (
							<button onClick={() => setSearchParams({ tab: 'courses', view: 'maps' })}>
								← Înapoi la mape
							</button>
						)}
						{canMutateInAdminArea && (
						<button onClick={() => navigate('/admin/content?tab=courses&view=maps&new=1')}>
							Creează mapă
						</button>
						)}
					</div>
				</div>
			</header>

			<div className="admin-courses-clean-search">
				<input
					type="text"
					placeholder="Caută curs..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</div>

			{loading ? (
				<div className="admin-courses-clean-loading"><div className="lms-spinner"></div><p>Se încarcă cursurile...</p></div>
			) : filteredCourses.length === 0 ? (
				<div className="admin-courses-clean-empty">
					<p>Nu există cursuri. Creează primul curs.</p>
				</div>
			) : (
				<div className="admin-courses-clean-grid">
					{filteredCourses.map((course) => {
						const coverSrc = courseCoverSrc(course);
						return (
						<article
							key={course.id}
							className="admin-courses-clean-card"
							style={{ '--course-card-accent': course.card_color || 'var(--color-primary)' }}
						>
							<div className="admin-courses-clean-card-media">
								{coverSrc ? (
									<img src={coverSrc} alt={course.title} />
								) : (
									<div className="admin-courses-clean-placeholder">
										Curs
									</div>
								)}
								<div className="admin-courses-clean-overlay">
									<span className={`status ${course.status || 'draft'}`}>{course.status || 'draft'}</span>
								</div>
							</div>
							<div className="admin-courses-clean-card-body">
								<h3>{course.title || 'Curs fără titlu'}</h3>
								<p>{course.modules_count || 0} module • {course.enrollments_count || 0} elevi</p>
								<div className="admin-courses-clean-card-actions">
									<button onClick={() => navigate(`/admin/courses/${course.id}`)}>Deschide</button>
									{canMutateInAdminArea && (
									<button onClick={() => navigate(`/admin/courses/${course.id}/builder`)}>Editează</button>
									)}
								</div>
							</div>
						</article>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default AdminCoursesPage;
