import React, { useState } from 'react';

const CoursesHeader = ({
	searchQuery,
	onSearchChange,
	filters,
	onFilterChange,
	sortBy,
	onSortChange,
	onCreateCourse,
	onCreateAICourse,
	selectedCount,
	onBulkAction,
	loading,
	viewMode = 'grid',
	onViewModeChange
}) => {
	const [showFilters, setShowFilters] = useState(false);

	return (
		<>
			{/* Header Section */}
			<div className="admin-courses-page-header">
				<div className="admin-courses-header-content">
					<div className="admin-courses-header-text">
						<h1 className="admin-courses-title">Gestionare Cursuri</h1>
						<p className="admin-courses-subtitle">
							<span className="admin-courses-subtitle-underline">Gestionează</span> și monitorizează cursurile
						</p>
					</div>
					<div className="admin-courses-header-actions">
						<button
							className="lms-btn-primary"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								if (!loading && onCreateCourse) {
									onCreateCourse();
								}
							}}
							disabled={loading}
							type="button"
						>
							<span>+</span>
							Creează Curs
						</button>
					</div>
				</div>

				{/* Search and Filters Bar */}
				<div className="admin-courses-toolbar">
					<div className="admin-courses-search-wrapper">
						<input
							type="text"
							placeholder="Caută după titlu..."
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							className="admin-courses-search-input"
						/>
						{searchQuery && (
							<button
								className="admin-search-clear-btn"
								onClick={() => onSearchChange('')}
								aria-label="Clear search"
							>
								×
							</button>
						)}
					</div>

					<div className="admin-courses-toolbar-actions">
						{/* View Mode Toggle */}
						{onViewModeChange && (
							<div className="admin-view-mode-toggle">
								<button
									className={`admin-view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
									onClick={() => onViewModeChange('grid')}
									title="Vizualizare Grid"
									aria-label="Grid view"
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
										<path d="M0 0h6v6H0V0zm7 0h9v6H7V0zM0 7h6v9H0V7zm7 0h9v9H7V7z"/>
									</svg>
								</button>
								<button
									className={`admin-view-mode-btn ${viewMode === 'list' || viewMode === 'table' ? 'active' : ''}`}
									onClick={() => onViewModeChange(viewMode === 'table' ? 'table' : 'list')}
									title="Vizualizare Listă"
									aria-label="List view"
								>
									<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
										<path d="M0 2h16v2H0V2zm0 5h16v2H0V7zm0 5h16v2H0v-2z"/>
									</svg>
								</button>
							</div>
						)}

						<button
							className={`admin-btn-filter ${showFilters ? 'active' : ''}`}
							onClick={() => setShowFilters(!showFilters)}
							aria-label="Toggle filters"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
								<path d="M2 3h12v1H2V3zm2 4h8v1H4V7zm3 4h2v1H7v-1z"/>
							</svg>
							Filtre
							{filters.activeCount > 0 && (
								<span className="admin-filter-badge">{filters.activeCount}</span>
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Expanded Filters Panel */}
			{showFilters && (
				<div className="admin-courses-filters-panel">
					<div className="admin-filters-content">
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

					</div>

					<button
						className="lms-btn-secondary lms-btn-sm"
						onClick={() => {
							onFilterChange('status', 'all');
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
							className="lms-btn-secondary lms-btn-sm"
							onClick={() => onBulkAction('publish')}
						>
							Publish
						</button>
						<button
							className="lms-btn-secondary lms-btn-sm"
							onClick={() => onBulkAction('archive')}
						>
							Archive
						</button>
						<button
							className="lms-btn-secondary lms-btn-sm va-btn-danger"
							onClick={() => onBulkAction('disable')}
						>
							Disable
						</button>
						<button
							className="lms-btn-secondary lms-btn-sm va-btn-danger"
							onClick={() => onBulkAction('delete')}
						>
							🗑️ Șterge
						</button>
					</div>
				</div>
			)}
		</>
	);
};

export default CoursesHeader;

