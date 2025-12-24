import React, { useState } from 'react';

const CoursesHeader = ({
	searchQuery,
	onSearchChange,
	filters,
	onFilterChange,
	sortBy,
	onSortChange,
	onCreateCourse,
	selectedCount,
	onBulkAction,
	loading,
	viewMode = 'grid',
	onViewModeChange
}) => {
	const [showFilters, setShowFilters] = useState(false);

	return (
		<div className="admin-courses-header">
			<div className="admin-courses-header-top">
				<div className="admin-courses-header-left">
					<h1 className="admin-courses-title">Gestionare Cursuri</h1>
					<p className="admin-courses-subtitle">
						{selectedCount > 0 ? `${selectedCount} cursuri selectate` : 'Gestionează și monitorizează cursurile'}
					</p>
				</div>
				<div className="admin-courses-header-right">
					<button
						className="admin-btn admin-btn-primary admin-btn-create"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							console.log('Create Course button clicked', { loading, onCreateCourse: !!onCreateCourse });
							if (!loading && onCreateCourse) {
								onCreateCourse();
							} else {
								console.warn('Button click ignored:', { loading, hasHandler: !!onCreateCourse });
							}
						}}
						disabled={loading}
						type="button"
						style={{ 
							cursor: loading ? 'not-allowed' : 'pointer',
							opacity: loading ? 0.5 : 1,
							position: 'relative',
							zIndex: 100
						}}
					>
						<span className="admin-btn-icon">+</span>
						Create Course
					</button>
				</div>
			</div>

			{/* Search and Quick Filters */}
			<div className="admin-courses-toolbar">
				<div className="admin-courses-search">
					<span className="admin-search-icon">🔍</span>
					<input
						type="text"
						placeholder="Caută după titlu, instructor..."
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						className="admin-search-input"
					/>
					{searchQuery && (
						<button
							className="admin-search-clear"
							onClick={() => onSearchChange('')}
							aria-label="Clear search"
						>
							×
						</button>
					)}
				</div>

				<div className="admin-courses-actions">
					{/* View Mode Toggle */}
					{onViewModeChange && (
						<div className="admin-view-mode-toggle">
							<button
								className={`admin-view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
								onClick={() => onViewModeChange('grid')}
								title="Vizualizare Grid"
							>
								⊞
							</button>
							<button
								className={`admin-view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
								onClick={() => onViewModeChange('table')}
								title="Vizualizare Tabel"
							>
								☰
							</button>
						</div>
					)}

					<button
						className={`admin-btn admin-btn-filter ${showFilters ? 'active' : ''}`}
						onClick={() => setShowFilters(!showFilters)}
					>
						<span className="admin-btn-icon">⚙️</span>
						Filtre
						{filters.activeCount > 0 && (
							<span className="admin-filter-badge">{filters.activeCount}</span>
						)}
					</button>

					<div className="admin-sort-selector">
						<select
							value={sortBy}
							onChange={(e) => onSortChange(e.target.value)}
							className="admin-sort-select"
						>
							<option value="enrollments">Sortare: Înscrieri</option>
							<option value="revenue">Sortare: Venit</option>
							<option value="completion_rate">Sortare: Finalizare</option>
							<option value="rating">Sortare: Rating</option>
							<option value="updated_at">Sortare: Ultima actualizare</option>
							<option value="created_at">Sortare: Data creării</option>
						</select>
					</div>
				</div>
			</div>

			{/* Expanded Filters */}
			{showFilters && (
				<div className="admin-courses-filters">
					<div className="admin-filter-group">
						<label className="admin-filter-label">Status</label>
						<div className="admin-filter-buttons">
							{['all', 'published', 'draft', 'archived'].map(status => (
								<button
									key={status}
									className={`admin-filter-btn ${filters.status === status ? 'active' : ''}`}
									onClick={() => onFilterChange('status', status)}
								>
									{status === 'all' ? 'Toate' : 
									 status === 'published' ? 'Publicate' :
									 status === 'draft' ? 'Draft' : 'Arhivate'}
								</button>
							))}
						</div>
					</div>


					<div className="admin-filter-group">
						<label className="admin-filter-label">Instructor</label>
						<select
							value={filters.instructor || 'all'}
							onChange={(e) => onFilterChange('instructor', e.target.value)}
							className="admin-filter-select"
						>
							<option value="all">Toți instructorii</option>
							{filters.instructors?.map(inst => (
								<option key={inst.id} value={inst.id}>{inst.name}</option>
							))}
						</select>
					</div>

					<div className="admin-filter-group">
						<label className="admin-filter-label">Nivel</label>
						<select
							value={filters.level || 'all'}
							onChange={(e) => onFilterChange('level', e.target.value)}
							className="admin-filter-select"
						>
							<option value="all">Toate nivelurile</option>
							<option value="beginner">Începător</option>
							<option value="intermediate">Intermediar</option>
							<option value="advanced">Avansat</option>
						</select>
					</div>

					<button
						className="admin-btn admin-btn-secondary admin-btn-clear-filters"
						onClick={() => {
							onFilterChange('status', 'all');
							onFilterChange('instructor', 'all');
							onFilterChange('level', 'all');
						}}
					>
						Resetează filtrele
					</button>
				</div>
			)}

			{/* Bulk Actions Bar */}
			{selectedCount > 0 && (
				<div className="admin-bulk-actions-bar">
					<div className="admin-bulk-actions-info">
						<strong>{selectedCount}</strong> cursuri selectate
					</div>
					<div className="admin-bulk-actions-buttons">
						<button
							className="admin-btn admin-btn-bulk"
							onClick={() => onBulkAction('publish')}
						>
							Publish
						</button>
						<button
							className="admin-btn admin-btn-bulk"
							onClick={() => onBulkAction('archive')}
						>
							Archive
						</button>
						<button
							className="admin-btn admin-btn-bulk admin-btn-bulk-danger"
							onClick={() => onBulkAction('disable')}
						>
							Disable
						</button>
						<button
							className="admin-btn admin-btn-bulk admin-btn-bulk-danger"
							onClick={() => onBulkAction('delete')}
						>
							🗑️ Șterge
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default CoursesHeader;

