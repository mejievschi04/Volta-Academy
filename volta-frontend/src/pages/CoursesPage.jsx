import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesService, dashboardService } from '../services/api';
import { toImageUrl } from '../utils/imageUrl';
import { useAuth } from '../contexts/AuthContext';
import './CoursesPage.css';

/**
 * Modern Courses Page for Creators
 * Pagină modernă pentru creatori/instructori să gestioneze cursurile
 */
const CoursesPage = () => {
	const navigate = useNavigate();
	const { user, loading: authLoading } = useAuth();
	
	// Check if user is admin/instructor
	const isAdmin = user?.role === 'admin' || user?.role === 'instructor';
	
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const fetchingRef = useRef(false);
	
	// View and filter states
	const [viewMode, setViewMode] = useState('grid');
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [sortBy, setSortBy] = useState('recent');
	
	// Fetch courses
	useEffect(() => {
		if (fetchingRef.current || authLoading) return;
		
		const fetchCourses = async () => {
			if (fetchingRef.current) return;
			fetchingRef.current = true;
			
			try {
				setLoading(true);
				setError(null);
				
				const data = await coursesService.getAll();
				const fetchedCourses = Array.isArray(data) ? data : [];
				setCourses(fetchedCourses);
			} catch (err) {
				console.error('Error fetching courses:', err);
				setError('Nu s-au putut încărca cursurile');
			} finally {
				setLoading(false);
				fetchingRef.current = false;
			}
		};
		
		fetchCourses();
	}, [authLoading]);
	
	// Filter and sort courses
	const filteredAndSortedCourses = useMemo(() => {
		let filtered = [...courses];
		
		// For students, only show published courses
		if (!isAdmin) {
			filtered = filtered.filter(course => course.status === 'published');
		}
		
		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(course => 
				course.title?.toLowerCase().includes(query) ||
				course.description?.toLowerCase().includes(query) ||
				course.short_description?.toLowerCase().includes(query)
			);
		}
		
		// Status filter (only for admins)
		if (isAdmin && statusFilter !== 'all') {
			filtered = filtered.filter(course => {
				const status = course.status || 'draft';
				if (statusFilter === 'published') return status === 'published';
				if (statusFilter === 'draft') return status === 'draft';
				if (statusFilter === 'archived') return status === 'archived';
				return true;
			});
		}
		
		// Sort
		filtered.sort((a, b) => {
			switch (sortBy) {
				case 'alphabetical':
					return (a.title || '').localeCompare(b.title || '');
				case 'update-date':
					const aDate = new Date(a.updated_at || a.created_at || 0);
					const bDate = new Date(b.updated_at || b.created_at || 0);
					return bDate - aDate;
				case 'recent':
				default:
					return (b.id || 0) - (a.id || 0);
			}
		});
		
		return filtered;
	}, [courses, searchQuery, statusFilter, sortBy, isAdmin]);
	
	const getStatusBadge = (status) => {
		const badges = {
			published: { label: 'Publicat', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
			draft: { label: 'Ciornă', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
			archived: { label: 'Arhivat', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
		};
		return badges[status] || badges.draft;
	};
	
	if (loading || authLoading) {
		return (
			<div className="courses-page-modern">
				<div className="courses-page-loading">
					<div className="courses-page-spinner"></div>
					<p>Se încarcă cursurile...</p>
				</div>
			</div>
		);
	}
	
	if (error) {
		return (
			<div className="courses-page-modern">
				<div className="courses-page-error">
					<div className="courses-page-error-icon">⚠️</div>
					<h2>Eroare</h2>
					<p>{error}</p>
					<button
						className="courses-page-btn courses-page-btn-primary"
						onClick={() => window.location.reload()}
					>
						Încearcă din nou
					</button>
				</div>
			</div>
		);
	}
	
	return (
		<div className="courses-page-modern">
			{/* Hero Header */}
			<div className="courses-page-hero">
				<div className="courses-page-hero-content">
					<div className="courses-page-hero-text">
						<h1 className="courses-page-hero-title">
							{isAdmin ? 'Cursurile mele' : 'Cursuri Disponibile'}
						</h1>
						<p className="courses-page-hero-subtitle">
							{isAdmin 
								? 'Gestionează și creează cursuri pentru instruirea personalului'
								: 'Explorează și înscrie-te la cursuri pentru dezvoltarea profesională'}
						</p>
					</div>
					{isAdmin && (
						<button
							className="courses-page-create-btn"
							onClick={() => navigate('/admin/courses/new')}
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 5v14M5 12h14"/>
							</svg>
							<span>Creează Curs Nou</span>
						</button>
					)}
				</div>
			</div>
			
			{/* Search and Filters Bar */}
			<div className="courses-page-toolbar">
				<div className="courses-page-search-wrapper">
					<svg className="courses-page-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="11" cy="11" r="8"/>
						<path d="m21 21-4.35-4.35"/>
					</svg>
					<input
						type="text"
						className="courses-page-search-input"
						placeholder="Caută cursuri..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					{searchQuery && (
						<button
							className="courses-page-search-clear"
							onClick={() => setSearchQuery('')}
						>
							×
						</button>
					)}
				</div>
				
				<div className="courses-page-toolbar-right">
					{/* Status Filters - Only for admins */}
					{isAdmin && (
						<div className="courses-page-filters">
							<button
								className={`courses-page-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
								onClick={() => setStatusFilter('all')}
							>
								Toate
							</button>
							<button
								className={`courses-page-filter-chip ${statusFilter === 'published' ? 'active' : ''}`}
								onClick={() => setStatusFilter('published')}
							>
								Publicate
							</button>
							<button
								className={`courses-page-filter-chip ${statusFilter === 'draft' ? 'active' : ''}`}
								onClick={() => setStatusFilter('draft')}
							>
								Ciornă
							</button>
							<button
								className={`courses-page-filter-chip ${statusFilter === 'archived' ? 'active' : ''}`}
								onClick={() => setStatusFilter('archived')}
							>
								Arhivate
							</button>
						</div>
					)}
					
					{/* View Toggle */}
					<div className="courses-page-view-toggle">
						<button
							className={`courses-page-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
							onClick={() => setViewMode('grid')}
							title="Vizualizare grilă"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<rect x="3" y="3" width="7" height="7"/>
								<rect x="14" y="3" width="7" height="7"/>
								<rect x="3" y="14" width="7" height="7"/>
								<rect x="14" y="14" width="7" height="7"/>
							</svg>
						</button>
						<button
							className={`courses-page-view-btn ${viewMode === 'list' ? 'active' : ''}`}
							onClick={() => setViewMode('list')}
							title="Vizualizare listă"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<line x1="8" y1="6" x2="21" y2="6"/>
								<line x1="8" y1="12" x2="21" y2="12"/>
								<line x1="8" y1="18" x2="21" y2="18"/>
								<line x1="3" y1="6" x2="3.01" y2="6"/>
								<line x1="3" y1="12" x2="3.01" y2="12"/>
								<line x1="3" y1="18" x2="3.01" y2="18"/>
							</svg>
						</button>
					</div>
					
					{/* Sort */}
					<select
						className="courses-page-sort-select"
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value)}
					>
						<option value="recent">Recente</option>
						<option value="alphabetical">Alfabetic</option>
						<option value="update-date">Ultima actualizare</option>
					</select>
				</div>
			</div>
			
			{/* Courses Grid/List */}
			<div className="courses-page-content">
				{filteredAndSortedCourses.length > 0 ? (
					<div className={viewMode === 'grid' ? 'courses-page-grid' : 'courses-page-list'}>
						{filteredAndSortedCourses.map((course) => {
							const statusBadge = getStatusBadge(course.status || 'draft');
							const totalModules = course.modules_count || course.modules?.length || 0;
							const totalLessons = course.lessons_count || 0;
							
							// Determine navigation path based on user role
							const coursePath = isAdmin 
								? `/admin/courses/${course.id}` 
								: `/courses/${course.id}/detail`;
							
							return (
								<div
									key={course.id}
									className={`courses-page-card ${viewMode === 'list' ? 'list-view' : ''}`}
									onClick={() => navigate(coursePath)}
								>
									{/* Folder tab (visual) - rendered via CSS ::before */}
									{/* Thumbnail / content area (grey box) */}
									<div className="courses-page-card-thumbnail">
										{course.image_url ? (
											<img src={toImageUrl(course.image_url)} alt={course.title} loading="lazy" decoding="async" />
										) : (
											<div className="courses-page-card-placeholder">
												<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
													<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
												</svg>
											</div>
										)}
										{isAdmin && (
											<div className="courses-page-card-overlay">
												<button
													className="courses-page-card-edit-btn"
													onClick={(e) => {
														e.stopPropagation();
														navigate(`/admin/courses/${course.id}`);
													}}
												>
												<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
													<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
													<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
												</svg>
											</button>
										</div>
										)}
									</div>
									
									{/* Content */}
									<div className="courses-page-card-content">
										{/* Status Badge - Only for admins */}
										{isAdmin && (
											<div className="courses-page-card-status">
												<span
													className="courses-page-status-badge"
													style={{
														backgroundColor: statusBadge.bg,
														color: statusBadge.color,
														borderColor: statusBadge.color
													}}
												>
													{statusBadge.label}
												</span>
											</div>
										)}
										
										{/* Title */}
										<h3 className="courses-page-card-title">{course.title}</h3>
										
										{/* Description */}
										{course.short_description && (
											<p className="courses-page-card-description">
												{course.short_description}
											</p>
										)}
										
										{/* Meta Info */}
										<div className="courses-page-card-meta">
											{totalModules > 0 && (
												<span className="courses-page-card-meta-item">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
														<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
													</svg>
													{totalModules} {totalModules === 1 ? 'modul' : 'module'}
												</span>
											)}
											{totalLessons > 0 && (
												<span className="courses-page-card-meta-item">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
														<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
													</svg>
													{totalLessons} {totalLessons === 1 ? 'lecție' : 'lecții'}
												</span>
											)}
											{course.updated_at && (
												<span className="courses-page-card-meta-item">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
														<circle cx="12" cy="12" r="10"/>
														<path d="M12 6v6l4 2"/>
													</svg>
													{new Date(course.updated_at).toLocaleDateString('ro-RO')}
												</span>
											)}
										</div>
									</div>
									{/* Plus / action in colț (design tip dosar) */}
									<div className="courses-page-card-corner-action" onClick={(e) => { e.stopPropagation(); navigate(coursePath); }} title={isAdmin ? 'Deschide curs' : 'Vezi curs'} aria-label={isAdmin ? 'Deschide curs' : 'Vezi curs'}>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="courses-page-empty">
						<div className="courses-page-empty-icon">
							<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
							</svg>
						</div>
						<h3 className="courses-page-empty-title">
							{searchQuery || statusFilter !== 'all' ? 'Nu s-au găsit cursuri' : 'Nu ai cursuri încă'}
						</h3>
						<p className="courses-page-empty-text">
							{searchQuery || statusFilter !== 'all' ? (
								'Încearcă să modifici filtrele sau termenii de căutare.'
							) : (
								'Începe să creezi primul tău curs pentru instruirea personalului.'
							)}
						</p>
						{searchQuery || statusFilter !== 'all' ? (
							<button
								className="courses-page-btn courses-page-btn-secondary"
								onClick={() => {
									setSearchQuery('');
									setStatusFilter('all');
								}}
							>
								Resetează filtrele
							</button>
						) : (
							isAdmin && (
								<button
									className="courses-page-btn courses-page-btn-primary"
									onClick={() => navigate('/admin/courses/new')}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M12 5v14M5 12h14"/>
									</svg>
									<span>Creează primul curs</span>
								</button>
							)
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default CoursesPage;
