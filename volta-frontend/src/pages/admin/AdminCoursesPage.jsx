import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import CoursesHeader from '../../components/admin/courses/CoursesHeader';
import CourseListItem from '../../components/admin/courses/CourseListItem';

const AdminCoursesPage = () => {
	const navigate = useNavigate();
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	
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

	// Fetch courses
	const fetchCourses = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			
			const params = {
				search: searchQuery || undefined,
				status: filters.status !== 'all' ? filters.status : undefined,
				sort: sortBy
			};
			
			const data = await adminService.getCourses(params);
			setCourses(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching courses:', err);
			setError('Nu s-au putut încărca cursurile');
		} finally {
			setLoading(false);
		}
	}, [searchQuery, filters, sortBy]);

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

	// Handle course creation
	const handleCreateCourse = () => {
		navigate('/admin/courses/new');
	};

	// Filtered courses
	const filteredCourses = useMemo(() => {
		return courses;
	}, [courses]);

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
		<div className="admin-container">
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

			{loading && courses.length === 0 ? (
				<div className="admin-courses-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă cursurile...</p>
				</div>
			) : filteredCourses.length === 0 ? (
				<div className="lms-empty-state">
					<p>Nu există cursuri disponibile.</p>
					<button className="lms-btn-primary" onClick={handleCreateCourse}>
						+ Creează primul curs
					</button>
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
									onPreview={() => navigate(`/admin/courses/${course.id}/preview`)}
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
									onPreview={() => navigate(`/admin/courses/${course.id}/preview`)}
								/>
							))}
						</div>
					)}
				</div>
			)}

		</div>
	);
};

export default AdminCoursesPage;
