import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import CoursesHeader from '../../components/admin/courses/CoursesHeader';
import CourseListItem from '../../components/admin/courses/CourseListItem';
import CourseInsights from '../../components/admin/courses/CourseInsights';

const AdminCoursesPage = () => {
	const navigate = useNavigate();
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedCourses, setSelectedCourses] = useState(new Set());
	const [actionLoading, setActionLoading] = useState(null);

	// Filters and search
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		status: 'all',
		instructor: 'all',
		level: 'all',
		instructors: [],
		activeCount: 0,
	});
	const [sortBy, setSortBy] = useState('updated_at');
	const [viewMode, setViewMode] = useState('grid');

	// Insights
	const [insights, setInsights] = useState([]);

	// Load data on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Fetch all data in parallel
				const [coursesData, instructorsData, insightsData] = await Promise.all([
					adminService.getCourses({}),
					adminService.getTeachers(),
					adminService.getCourseInsights(),
				]);

				setCourses(Array.isArray(coursesData) ? coursesData : []);
				setFilters(prev => ({
					...prev,
					instructors: Array.isArray(instructorsData) ? instructorsData : [],
				}));
				setInsights(Array.isArray(insightsData) ? insightsData : []);
			} catch (err) {
				console.error('Error loading data:', err);
				setError('Nu s-au putut încărca datele: ' + (err.response?.data?.message || err.message));
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	// Calculate active filter count
	useEffect(() => {
		let count = 0;
		if (filters.status !== 'all') count++;
		if (filters.instructor !== 'all') count++;
		if (filters.level !== 'all') count++;
		setFilters(prev => ({ ...prev, activeCount: count }));
	}, [filters.status, filters.instructor, filters.level]);

	const handleFilterChange = (key, value) => {
		setFilters(prev => ({ ...prev, [key]: value }));
	};

	const handleSelectCourse = (courseId, checked) => {
		setSelectedCourses(prev => {
			const newSet = new Set(prev);
			if (checked) {
				newSet.add(courseId);
			} else {
				newSet.delete(courseId);
			}
			return newSet;
		});
	};

	const handleSelectAll = (checked) => {
		if (checked) {
			setSelectedCourses(new Set(courses.map(c => c.id)));
		} else {
			setSelectedCourses(new Set());
		}
	};

	const handleQuickAction = async (courseId, action) => {
		if (action === 'delete') {
			const course = courses.find(c => c.id === courseId);
			const courseTitle = course?.title || 'acest curs';
			
			if (!confirm(`Sigur dorești să ștergi complet cursul "${courseTitle}"?\n\nAceastă acțiune este ireversibilă!`)) {
				return;
			}
			
			if (!confirm(`ATENȚIE! Ești sigur că vrei să ștergi definitiv cursul "${courseTitle}"?`)) {
				return;
			}
		}

		setActionLoading(courseId);
		try {
			if (action === 'delete') {
				await adminService.deleteCourse(courseId);
				alert('Curs șters cu succes!');
			} else {
				await adminService.courseQuickAction(courseId, action);
			}
			// Reload data
			const coursesData = await adminService.getCourses({});
			setCourses(Array.isArray(coursesData) ? coursesData : []);
			const insightsData = await adminService.getCourseInsights();
			setInsights(Array.isArray(insightsData) ? insightsData : []);
		} catch (err) {
			console.error(`Error ${action} course:`, err);
			alert(`Eroare la ${action}: ${err.response?.data?.message || err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleBulkAction = async (action) => {
		if (selectedCourses.size === 0) return;
		
		if (action === 'delete') {
			if (!confirm(`ATENȚIE! Ești sigur că vrei să ștergi definitiv ${selectedCourses.size} cursuri?`)) {
				return;
			}
		} else {
			if (!confirm(`Sigur dorești să ${action} ${selectedCourses.size} cursuri?`)) {
				return;
			}
		}

		setActionLoading('bulk');
		try {
			if (action === 'delete') {
				const courseIds = Array.from(selectedCourses);
				for (const courseId of courseIds) {
					await adminService.deleteCourse(courseId);
				}
				alert(`${courseIds.length} cursuri șterse cu succes!`);
			} else {
				await adminService.courseBulkAction(Array.from(selectedCourses), action);
			}
			setSelectedCourses(new Set());
			// Reload data
			const coursesData = await adminService.getCourses({});
			setCourses(Array.isArray(coursesData) ? coursesData : []);
			const insightsData = await adminService.getCourseInsights();
			setInsights(Array.isArray(insightsData) ? insightsData : []);
		} catch (err) {
			console.error(`Error bulk ${action}:`, err);
			alert(`Eroare la ${action} în masă: ${err.response?.data?.message || err.message}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleViewCourse = (courseId) => {
		navigate(`/admin/courses/${courseId}`);
	};

	const handlePreview = (courseId) => {
		window.open(`/courses/${courseId}`, '_blank');
	};

	const handleCreateCourse = () => {
		navigate('/admin/courses/new');
	};

	// Filter and sort courses
	const filteredAndSortedCourses = courses.filter(course => {
		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			if (!course.title?.toLowerCase().includes(query) && 
				!course.description?.toLowerCase().includes(query)) {
				return false;
			}
		}

		// Status filter
		if (filters.status !== 'all' && course.status !== filters.status) {
			return false;
		}


		// Instructor filter
		if (filters.instructor !== 'all' && course.teacher_id?.toString() !== filters.instructor) {
			return false;
		}

		// Level filter
		if (filters.level !== 'all' && course.level !== filters.level) {
			return false;
		}

		return true;
	}).sort((a, b) => {
		switch (sortBy) {
			case 'title':
				return (a.title || '').localeCompare(b.title || '');
			case 'created_at':
				return new Date(b.created_at || 0) - new Date(a.created_at || 0);
			case 'updated_at':
			default:
				return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
		}
	});

	return (
		<div className="admin-courses-page">
			<div className="admin-courses-container">
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
					loading={loading}
					viewMode={viewMode}
					onViewModeChange={setViewMode}
				/>

				{error && (
					<div className="admin-error-message">
						<strong>Eroare:</strong> {error}
					</div>
				)}

				{/* Insights Section */}
				{insights.length > 0 && (
					<CourseInsights
						insights={insights}
						onViewCourse={handleViewCourse}
					/>
				)}

				{/* Courses List */}
				<div className={`admin-courses-list-container ${viewMode === 'grid' ? 'grid-view' : 'table-view'}`}>
					{loading ? (
						<div className="admin-loading-state">
							<div className="admin-loading-spinner"></div>
							<p>Se încarcă cursurile...</p>
						</div>
					) : filteredAndSortedCourses.length > 0 ? (
						<>
							{/* Select All */}
							<div className="admin-courses-list-header">
								<label className="admin-select-all">
									<input
										type="checkbox"
										checked={selectedCourses.size === filteredAndSortedCourses.length && filteredAndSortedCourses.length > 0}
										onChange={(e) => handleSelectAll(e.target.checked)}
									/>
									<span>Selectează toate ({filteredAndSortedCourses.length})</span>
								</label>
							</div>

							<div className={`admin-courses-${viewMode}`}>
								{filteredAndSortedCourses.map((course) => (
									<CourseListItem
										key={course.id}
										course={course}
										selected={selectedCourses.has(course.id)}
										onSelect={handleSelectCourse}
										onQuickAction={handleQuickAction}
										loading={actionLoading === course.id}
										viewMode={viewMode}
										onPreview={() => handlePreview(course.id)}
									/>
								))}
							</div>
						</>
					) : (
						<div className="admin-empty-state">
							<div className="admin-empty-state-icon">📚</div>
							<div className="admin-empty-state-title">Nu există cursuri</div>
							<div className="admin-empty-state-description">
								{searchQuery || filters.activeCount > 0
									? 'Încearcă să modifici filtrele sau căutarea'
									: 'Creează primul curs pentru a începe'}
							</div>
							{!searchQuery && filters.activeCount === 0 && (
								<button
									className="admin-btn admin-btn-primary"
									onClick={() => navigate('/admin/courses/new')}
								>
									+ Create Course
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default AdminCoursesPage;
