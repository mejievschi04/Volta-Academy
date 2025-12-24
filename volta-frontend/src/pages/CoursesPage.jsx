import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesService, dashboardService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const CoursesPage = () => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const fetchingRef = useRef(false);
	const progressFetchingRef = useRef(false);
	
	// Filter and sort states
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('all'); // all, in-progress, completed, not-started
	const [sortBy, setSortBy] = useState('recent'); // recent, alphabetical, progress, duration
	const [courseProgress, setCourseProgress] = useState({});

	// Debug loading/data state in console to trace stuck spinner issues
	useEffect(() => {
		console.log('[CoursesPage] loading:', loading, 'courses:', courses.length, 'error:', error);
	}, [loading, courses, error]);

	useEffect(() => {
		// Prevent multiple fetches
		if (fetchingRef.current) return;
		
		const fetchCourses = async () => {
			if (fetchingRef.current) return;
			fetchingRef.current = true;
			
			try {
				setLoading(true);
				const data = await coursesService.getAll();
				
				console.log('[CoursesPage] Received data from API:', data);
				console.log('[CoursesPage] Data type:', typeof data);
				console.log('[CoursesPage] Is array:', Array.isArray(data));
				console.log('[CoursesPage] Data length:', data?.length);
				
				// Always update state - React handles unmounted component warnings
				console.log('[CoursesPage] Setting courses:', data);
				setCourses(data || []);
				setLoading(false);
			} catch (err) {
				console.error('Error fetching courses:', err);
				setError('Nu s-au putut încărca cursurile');
				setLoading(false);
			} finally {
				fetchingRef.current = false;
			}
		};
		
		fetchCourses();
	}, []); // Empty dependency array - fetch only once on mount

	// Fetch progress separately when user becomes available (if not already fetched)
	useEffect(() => {
		if (!user?.id || !courses.length || progressFetchingRef.current || Object.keys(courseProgress).length > 0) return;
		
		const fetchProgress = async () => {
			progressFetchingRef.current = true;
			
			try {
				const progressPromises = courses.map(course =>
					dashboardService.getProgress(course.id, user.id)
						.then(progress => ({ courseId: course.id, progress }))
						.catch(() => ({ courseId: course.id, progress: null }))
				);
				
				const progressResults = await Promise.all(progressPromises);
				const progressMap = {};
				progressResults.forEach(({ courseId, progress }) => {
					progressMap[courseId] = progress;
				});
				
				// Always update state - React handles unmounted component warnings
				setCourseProgress(progressMap);
			} catch (err) {
				console.error('Error fetching progress:', err);
			} finally {
				progressFetchingRef.current = false;
			}
		};
		
		fetchProgress();
	}, [user?.id, courses.length]); // Only when user.id or courses change

	// Calculate course status and progress
	const getCourseStatus = (course) => {
		// Course is completed if completed_at is set (when exam is passed)
		// Check if completed_at exists and is not empty/null
		if (course.completed_at && course.completed_at !== null && course.completed_at !== undefined && course.completed_at !== '') {
			return 'completed';
		}
		
		const progress = courseProgress[course.id];
		if (!progress || !progress.progress_percentage) {
			return 'not-started';
		}
		const progressPercentage = progress.progress_percentage || 0;
		
		if (progressPercentage > 0) return 'in-progress';
		return 'not-started';
	};

	const getCourseProgressPercentage = (course) => {
		const progress = courseProgress[course.id];
		return progress?.progress_percentage || 0;
	};

	// Filter and sort courses
	const filteredAndSortedCourses = useMemo(() => {
		let filteredCourses = [...courses];
		
		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filteredCourses = filteredCourses.filter(course => 
				course.title?.toLowerCase().includes(query) ||
				course.description?.toLowerCase().includes(query)
			);
		}
		
		// Status filter
		if (statusFilter !== 'all') {
			filteredCourses = filteredCourses.filter(course => getCourseStatus(course) === statusFilter);
		}
		
		// Sort
		filteredCourses.sort((a, b) => {
			switch (sortBy) {
				case 'alphabetical':
					return (a.title || '').localeCompare(b.title || '');
				case 'progress':
					return getCourseProgressPercentage(b) - getCourseProgressPercentage(a);
				case 'duration':
					const aDuration = a.total_duration_minutes || 0;
					const bDuration = b.total_duration_minutes || 0;
					return aDuration - bDuration;
				case 'recent':
				default:
					// Sort by ID descending (assuming higher ID = more recent)
					return (b.id || 0) - (a.id || 0);
			}
		});
		
		return filteredCourses;
	}, [courses, searchQuery, statusFilter, sortBy, courseProgress]);

	if (loading) {
		return (
			<div className="courses-page">
				<div className="courses-loading">
					<p>Se încarcă...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="courses-page">
				<div className="courses-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error}</p>
				</div>
			</div>
		);
	}

	// Show courses directly
	return (
		<div className="courses-page">
			<div className="courses-page-header">
				<h1 className="courses-page-title">
					Cursuri
				</h1>
				<p className="courses-page-subtitle">
					Explorează toate cursurile disponibile
				</p>
			</div>

			{/* Filters and Search */}
			<div className="va-courses-filters">
				<div className="va-search-bar">
					<input
						type="text"
						placeholder="Caută cursuri..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<div className="va-filter-buttons">
					<button
						className={`va-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
						onClick={() => setStatusFilter('all')}
					>
						Toate
					</button>
					<button
						className={`va-filter-btn ${statusFilter === 'in-progress' ? 'active' : ''}`}
						onClick={() => setStatusFilter('in-progress')}
					>
						În progres
					</button>
					<button
						className={`va-filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
						onClick={() => setStatusFilter('completed')}
					>
						Finalizate
					</button>
					<button
						className={`va-filter-btn ${statusFilter === 'not-started' ? 'active' : ''}`}
						onClick={() => setStatusFilter('not-started')}
					>
						Neîncepute
					</button>
				</div>
				<div className="va-sort-dropdown">
					<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
						<option value="recent">Recente</option>
						<option value="alphabetical">Alfabetic</option>
						<option value="progress">Progres</option>
						<option value="duration">Durată</option>
					</select>
				</div>
			</div>

			{/* Courses Grid */}
			{filteredAndSortedCourses.length > 0 ? (
				<div className="va-courses-grid-rectangular">
					{filteredAndSortedCourses.map((course) => {
						const status = getCourseStatus(course);
						const progressPercentage = getCourseProgressPercentage(course);
						const totalModules = course.modules_count || course.modules?.length || 0;
							
							return (
								<button
									key={course.id}
									type="button"
									onClick={() => navigate(`/courses/${course.id}`)}
									className="va-course-card-rectangular"
								>
									{/* Left side - Content */}
									<div className="va-course-card-content">
									{/* Status Badge */}
									<div className="va-course-card-badge-container">
										{status === 'completed' && (
											<span className="course-status-badge completed">✓ Finalizat</span>
										)}
										{status === 'in-progress' && (
											<span className="course-status-badge in-progress">⏸ În progres</span>
										)}
										{status === 'not-started' && (
											<span className="course-status-badge not-started">🆕 Nou</span>
										)}
									</div>

									{/* Title */}
									<h3 className="va-course-card-title-rectangular">
										{course.title}
									</h3>

									{/* Description */}
									{course.description && (
										<p className="va-course-card-description-rectangular">
											{course.description}
										</p>
									)}

									{/* Meta Info */}
									<div className="va-course-meta-rectangular">
										<div className="course-meta-item">
											<span>📖</span>
											<span>{totalModules} {totalModules === 1 ? 'modul' : 'module'}</span>
										</div>
										{status !== 'not-started' && (
											<div className="course-meta-item progress">
												<span>📊</span>
												<span>{progressPercentage}% completat</span>
											</div>
										)}
									</div>
									</div>

									{/* Right side - Image */}
									<div className="va-course-card-image">
										{course.image_url ? (
											<img src={course.image_url} alt={course.title} />
										) : (
											<div className="va-course-card-image-placeholder">
												<span>📚</span>
											</div>
										)}
									</div>
								</button>
							);
						})}
					</div>
				) : (
					<div className="courses-empty-state">
						{searchQuery || statusFilter !== 'all' 
							? 'Nu s-au găsit cursuri care să corespundă filtrelor.' 
							: 'Nu există cursuri disponibile.'}
					</div>
				)}
		</div>
	);
};

export default CoursesPage;
