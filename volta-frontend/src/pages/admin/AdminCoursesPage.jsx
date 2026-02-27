import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import CoursesHeader from '../../components/admin/courses/CoursesHeader';
import CourseListItem from '../../components/admin/courses/CourseListItem';
import BuildCourseModal from '../../components/admin/courses/BuildCourseModal';
import VoltInstructor from '../../components/admin/VoltInstructor';
import AdminCourseMapsPage from './AdminCourseMapsPage';

const AdminCoursesPage = ({ embedded }) => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [creatingCourse, setCreatingCourse] = useState(false);
	const [error, setError] = useState(null);

	// Sub-view: mape (listă mape) | courses (listă cursuri). Curs = alcătuit din mape; în mape sunt cursurile.
	const [coursesView, setCoursesView] = useState(() => {
		const view = searchParams.get('view');
		if (view === 'courses') return 'courses';
		return 'maps'; // implicit: mape (curs = mape, în mape sunt cursurile)
	});
	const [selectedMap, setSelectedMap] = useState(() => {
		const mapId = searchParams.get('map');
		if (mapId) return { id: parseInt(mapId, 10), name: '' };
		return null;
	});
	
	// Filters and search
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		status: 'all',
		activeCount: 0
	});
	const [sortBy, setSortBy] = useState('recent');
	const [viewMode, setViewMode] = useState('grid');
	
	// Selection
	const [selectedCourses, setSelectedCourses] = useState(new Set());

	// Sync URL with view (when embedded)
	useEffect(() => {
		if (!embedded) return;
		const next = new URLSearchParams(searchParams);
		if (coursesView === 'maps') {
			next.set('view', 'maps');
			next.delete('map');
		} else {
			next.set('view', 'courses');
			if (selectedMap?.id) next.set('map', String(selectedMap.id));
			else next.delete('map');
		}
		setSearchParams(next, { replace: true });
	}, [embedded, coursesView, selectedMap?.id]);

	// Fetch courses (optional filter by course_map_id)
	const fetchCourses = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			
			const params = {
				search: searchQuery || undefined,
				status: filters.status !== 'all' ? filters.status : undefined,
				sort: sortBy
			};
			if (selectedMap?.id) params.course_map_id = selectedMap.id;
			
			const data = await adminService.getCourses(params);
			setCourses(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching courses:', err);
			setError('Nu s-au putut încărca cursurile');
		} finally {
			setLoading(false);
		}
	}, [searchQuery, filters, sortBy, selectedMap?.id]);

	useEffect(() => {
		fetchCourses();
	}, [fetchCourses]);

	// Calculate active filters count
	useEffect(() => {
		let count = 0;
		if (filters.status !== 'all') count++;
		setFilters(prev => ({ ...prev, activeCount: count }));
	}, [filters.status]);

	// Handle filter change
	const handleFilterChange = (key, value) => {
		setFilters(prev => ({ ...prev, [key]: value }));
	};

	// Handle course selection
	const handleSelectCourse = (courseId, selected) => {
		setSelectedCourses(prev => {
			const newSet = new Set(prev);
			if (selected) {
				newSet.add(courseId);
			} else {
				newSet.delete(courseId);
			}
			return newSet;
		});
	};

	// Handle bulk actions
	const handleBulkAction = async (action) => {
		if (selectedCourses.size === 0) return;
		
		try {
			await adminService.courseBulkAction(Array.from(selectedCourses), action);
			setSelectedCourses(new Set());
			fetchCourses();
		} catch (err) {
			console.error('Error performing bulk action:', err);
			alert('Eroare la executarea acțiunii');
		}
	};

	// Handle quick actions
	const handleQuickAction = async (courseId, action) => {
		try {
			await adminService.courseQuickAction(courseId, action);
			fetchCourses();
		} catch (err) {
			console.error('Error performing quick action:', err);
			alert('Eroare la executarea acțiunii');
		}
	};

	// Deschide modalul Creează curs
	const [showBuildModal, setShowBuildModal] = useState(false);
	const [voltTitle, setVoltTitle] = useState('');
	const [voltDescription, setVoltDescription] = useState('');
	const [voltPdfFile, setVoltPdfFile] = useState(null);

	const handleCreateCourse = (voltData) => {
		if (voltData?.answers) {
			setVoltTitle(voltData.answers[0] || '');
			const [desc, mod, lec, det, fis] = voltData.answers.slice(1);
			const parts = [desc].filter(Boolean);
			if (mod) parts.push(`Module: ${mod}`);
			if (lec) parts.push(`Lecții/modul: ${lec}`);
			if (det) parts.push(`Nivel detaliu: ${det}`);
			if (fis) parts.push(`Fișier brut: ${fis}`);
			setVoltDescription(parts.join('\n\n'));
			setVoltPdfFile(voltData.pdfFile || null);
		} else {
			setVoltTitle('');
			setVoltDescription(voltData?.chatData || '');
			setVoltPdfFile(null);
		}
		setShowBuildModal(true);
	};

	const handleBuildSubmit = async ({ title, description, image, pdfFile }) => {
		setCreatingCourse(true);
		try {
			let payload;
			if (image || pdfFile) {
				const formData = new FormData();
				formData.append('title', title);
				formData.append('description', description);
				formData.append('status', 'draft');
				if (image) formData.append('image', image);
				if (pdfFile) formData.append('pdf_file', pdfFile);
				payload = formData;
			} else {
				payload = { title, description, status: 'draft' };
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
			setCreatingCourse(false);
		}
	};

	// Filtered courses
	const filteredCourses = useMemo(() => {
		return courses;
	}, [courses]);

	const openMapCourses = (map) => {
		setSelectedMap({ id: map.id, name: map.name });
		setCoursesView('courses');
	};

	const goToMaps = () => {
		setSelectedMap(null);
		setCoursesView('maps');
	};

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

	// View Mape: listă mape; în mape sunt cursuri; click pe mapă → view Cursuri filtrat
	if (coursesView === 'maps') {
		return (
			<div className="admin-container">
				<AdminCourseMapsPage
					embedded
					onOpenMap={openMapCourses}
				/>
			</div>
		);
	}

	return (
		<div className="admin-container">
			{showBuildModal && (
				<BuildCourseModal
					onClose={() => { setShowBuildModal(false); setVoltTitle(''); setVoltDescription(''); setVoltPdfFile(null); }}
					onSubmit={handleBuildSubmit}
					loading={creatingCourse}
					initialTitle={voltTitle}
					initialDescription={voltDescription}
					initialPdfFile={voltPdfFile}
				/>
			)}
			<CoursesHeader
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				filters={filters}
				onFilterChange={handleFilterChange}
				sortBy={sortBy}
				onSortChange={setSortBy}
				onCreateCourse={handleCreateCourse}
				selectedCount={selectedCourses.size}
				onBulkAction={handleBulkAction}
				loading={loading || creatingCourse}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
			/>

			{loading && courses.length === 0 ? (
				<div className="admin-courses-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă cursurile...</p>
				</div>
			) : filteredCourses.length === 0 ? (
				<div className="lms-empty-state">
					<p>
						{selectedMap
							? 'Nu există cursuri în această mapă. Adaugă cursuri din „Gestionează cursuri” pe mapa respectivă.'
							: 'Nu există cursuri disponibile.'}
					</p>
					{!selectedMap && (
						<button className="lms-btn-primary" onClick={handleCreateCourse}>
							+ Creează primul curs
						</button>
					)}
					{selectedMap && (
						<button type="button" className="lms-btn-secondary" onClick={goToMaps}>
							Înapoi la mape
						</button>
					)}
				</div>
			) : (
				<div className={viewMode === 'grid' ? 'admin-courses-grid' : 'admin-courses-table'}>
					{viewMode === 'grid' ? (
						<div className="admin-courses-grid-container">
							{filteredCourses.map(course => (
								<CourseListItem
									key={course.id}
									course={course}
									selected={selectedCourses.has(course.id)}
									onSelect={handleSelectCourse}
									onQuickAction={handleQuickAction}
									loading={loading}
									viewMode={viewMode}
									onPreview={() => {
										sessionStorage.setItem('studentPreviewFromAdmin', 'true');
										navigate(`/courses/${course.id}/detail`);
									}}
								/>
							))}
						</div>
					) : (
						<div className="admin-courses-table-container">
							<div className="admin-courses-table-header">
								<div className="admin-course-table-checkbox"></div>
								<div className="admin-course-table-thumbnail-header">Imagine</div>
								<div className="admin-course-table-info-header">Curs</div>
								<div className="admin-course-table-metrics-header">Metrici</div>
								<div className="admin-course-table-actions-header">Acțiuni</div>
							</div>
							{filteredCourses.map(course => (
								<CourseListItem
									key={course.id}
									course={course}
									selected={selectedCourses.has(course.id)}
									onSelect={handleSelectCourse}
									onQuickAction={handleQuickAction}
									loading={loading}
									viewMode={viewMode}
									onPreview={() => {
										sessionStorage.setItem('studentPreviewFromAdmin', 'true');
										navigate(`/courses/${course.id}/detail`);
									}}
								/>
							))}
						</div>
					)}
				</div>
			)}

			<VoltInstructor
				questions={[
					'Ce titlu vrei pentru curs?',
					'Descrie pe scurt conținutul și scopul cursului.',
					'Câte module vrei să aibă cursul?',
					'Câte lecții aproximativ per modul?',
					'Cât de desfășurată să fie informația? (pe scurt / mediu / detaliat)',
					'Încarcă un fișier PDF cu informația brută (opțional)',
				]}
				pdfUploadQuestionIndex={5}
				actions={[
					{ label: '+ Curs nou', onClick: handleCreateCourse, primary: true },
				]}
			/>
		</div>
	);
};

export default AdminCoursesPage;
