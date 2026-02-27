import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const AdminCourseMapsPage = ({ embedded, onOpenMap }) => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [maps, setMaps] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [editingMap, setEditingMap] = useState(null);
	const [managingMap, setManagingMap] = useState(null);
	const [allCourses, setAllCourses] = useState([]);
	const [formName, setFormName] = useState('');
	const [formDescription, setFormDescription] = useState('');
	const [addCourseIds, setAddCourseIds] = useState([]);

	const fetchMaps = useCallback(async () => {
		try {
			setLoading(true);
			const res = await adminService.getCourseMaps({ search: searchQuery || undefined, per_page: 100 });
			const list = res?.data ?? (Array.isArray(res) ? res : []);
			setMaps(Array.isArray(list) ? list : []);
		} catch (err) {
			console.error('Error fetching course maps:', err);
			showToast('Nu s-au putut încărca mapele de curs', 'error');
			setMaps([]);
		} finally {
			setLoading(false);
		}
	}, [searchQuery, showToast]);

	useEffect(() => {
		fetchMaps();
	}, [fetchMaps]);

	const fetchCourses = useCallback(async () => {
		try {
			const data = await adminService.getCourses({ per_page: 500 });
			setAllCourses(Array.isArray(data) ? data : (data?.data ?? []));
		} catch (e) {
			setAllCourses([]);
		}
	}, []);

	const openCreate = () => {
		setEditingMap(null);
		setFormName('');
		setFormDescription('');
		setShowCreateModal(true);
	};

	const openEdit = async (map) => {
		try {
			const full = await adminService.getCourseMap(map.id);
			setEditingMap(full);
			setFormName(full.name || '');
			setFormDescription(full.description || '');
			setAddCourseIds([]);
			fetchCourses();
			setShowCreateModal(true);
		} catch (err) {
			showToast('Nu s-a putut încărca mapa', 'error');
		}
	};

	const saveMap = async () => {
		const name = (formName || '').trim();
		if (!name) {
			showToast('Numele mapei este obligatoriu', 'error');
			return;
		}
		try {
			if (editingMap) {
				await adminService.updateCourseMap(editingMap.id, { name, description: formDescription || null });
				showToast('Mapa a fost actualizată', 'success');
			} else {
				await adminService.createCourseMap({ name, description: formDescription || null });
				showToast('Mapa a fost creată', 'success');
			}
			setShowCreateModal(false);
			fetchMaps();
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la salvare', 'error');
		}
	};

	const deleteMap = async (map) => {
		if (!window.confirm(`Ștergi mapa „${map.name}”? Cursurile nu sunt șterse, doar gruparea.`)) return;
		try {
			await adminService.deleteCourseMap(map.id);
			showToast('Mapa a fost ștearsă', 'success');
			if (managingMap?.id === map.id) setManagingMap(null);
			fetchMaps();
		} catch (err) {
			showToast('Eroare la ștergere', 'error');
		}
	};

	const openManage = async (map) => {
		try {
			const full = await adminService.getCourseMap(map.id);
			setManagingMap(full);
			setAddCourseIds([]);
			fetchCourses();
		} catch (err) {
			showToast('Nu s-a putut încărca mapa', 'error');
		}
	};

	const addCoursesToMap = async (fromEditModal = false) => {
		const mapContext = fromEditModal ? editingMap : managingMap;
		if (!mapContext || addCourseIds.length === 0) return;
		try {
			await adminService.attachCoursesToMap(mapContext.id, addCourseIds);
			showToast('Cursurile au fost adăugate', 'success');
			setAddCourseIds([]);
			const updated = await adminService.getCourseMap(mapContext.id);
			if (fromEditModal) setEditingMap(updated);
			else setManagingMap(updated);
			fetchMaps();
		} catch (err) {
			showToast('Eroare la adăugare cursuri', 'error');
		}
	};

	const removeCourseFromMap = async (courseId, fromEditModal = false) => {
		const mapContext = fromEditModal ? editingMap : managingMap;
		if (!mapContext) return;
		try {
			await adminService.detachCourseFromMap(mapContext.id, courseId);
			const updated = await adminService.getCourseMap(mapContext.id);
			if (fromEditModal) setEditingMap(updated);
			else setManagingMap(updated);
			fetchMaps();
		} catch (err) {
			showToast('Eroare la scoaterea cursului', 'error');
		}
	};

	const inMapIds = (managingMap?.courses || []).map((c) => c.id);
	const availableCourses = allCourses.filter((c) => !inMapIds.includes(c.id));
	const editMapCourseIds = (editingMap?.courses || []).map((c) => c.id);
	const availableCoursesForEdit = allCourses.filter((c) => !editMapCourseIds.includes(c.id));

	return (
		<div className="admin-container">
			<div className="admin-courses-page-header">
				<div className="admin-courses-header-content">
					<div className="admin-courses-header-text">
						<h1 className="admin-courses-title">Mape curs</h1>
						<p className="admin-courses-subtitle">
							Grupează cursuri în mape (foldere) pentru organizare
						</p>
					</div>
					<div className="admin-courses-header-actions">
						<button type="button" className="admin-btn-create-course" onClick={openCreate}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 5V19M5 12H19" strokeLinecap="round"/>
							</svg>
							Creează mapă
						</button>
					</div>
				</div>
				<div className="admin-courses-toolbar">
					<div className="admin-courses-search-wrapper">
						<div className="admin-courses-search">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="11" cy="11" r="8"/>
								<path d="m21 21-4.35-4.35"/>
							</svg>
							<input
								type="text"
								placeholder="Caută mape..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="admin-courses-search-input"
							/>
						</div>
					</div>
				</div>
			</div>

			{loading && maps.length === 0 ? (
				<div className="admin-courses-loading">
					<div className="va-spinner va-spinner-lg"></div>
					<p>Se încarcă mapele...</p>
				</div>
			) : maps.length === 0 ? (
				<div className="lms-empty-state">
					<p>Nu există mape de curs. Creează una pentru a grupa cursuri.</p>
					<button type="button" className="lms-btn-primary" onClick={openCreate}>
						+ Creează prima mapă
					</button>
				</div>
			) : (
				<div className="admin-courses-grid">
					<div className="admin-courses-grid-container">
						{maps.map((map) => (
							<div
								key={map.id}
								className="admin-course-card admin-course-card-map"
								onClick={() => onOpenMap && onOpenMap(map)}
								role={onOpenMap ? 'button' : undefined}
								tabIndex={onOpenMap ? 0 : undefined}
								onKeyDown={onOpenMap ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenMap(map); } } : undefined}
								style={onOpenMap ? { cursor: 'pointer' } : undefined}
							>
								{/* X roșu – dreapta sus, șterge mapa (span ca să nu se aplice stiluri globale pe button) */}
								<span
									role="button"
									tabIndex={0}
									className="admin-course-map-delete-btn"
									onClick={(e) => { e.stopPropagation(); deleteMap(map); }}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deleteMap(map); } }}
									aria-label="Șterge mapa"
									style={{
										position: 'absolute',
										top: 12,
										right: 12,
										zIndex: 10,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										width: 36,
										height: 36,
										padding: 0,
										background: '#c62828',
										border: '2px solid #b71c1c',
										borderRadius: 6,
										color: '#fff',
										boxShadow: 'none',
										cursor: 'pointer',
									}}
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</span>
								{/* Edit – stânga jos, doar icon, aceeași dimensiune ca ștergere */}
								<button
									type="button"
									className="admin-course-map-edit-btn"
									onClick={(e) => { e.stopPropagation(); openEdit(map); }}
									aria-label="Editează mapa"
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
								</button>
								<div className="admin-course-map-grey">
									<span className="admin-course-map-icon" aria-hidden>📁</span>
									<span className="admin-course-status-badge admin-course-map-name" style={{ backgroundColor: 'transparent', color: '#1a1a1a' }}>
										{map.name || '—'}
									</span>
									{map.description && (
										<p className="admin-course-card-description">
											{map.description.length > 120 ? map.description.slice(0, 120) + '...' : map.description}
										</p>
									)}
								</div>
								{/* Buton + – creează curs în mapa */}
								<span
									role="button"
									tabIndex={0}
									className="admin-course-map-plus-btn"
									onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/new?map_id=${map.id}`); }}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/admin/courses/new?map_id=${map.id}`); } }}
									aria-label="Creează curs în mapa"
									style={{
										position: 'absolute',
										bottom: 16,
										right: 16,
										zIndex: 5,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										width: 36,
										height: 36,
										padding: 0,
										background: '#FFEE00',
										backgroundColor: '#FFEE00',
										border: '2px solid rgba(45, 45, 45, 0.4)',
										borderRadius: 6,
										color: '#1a1a1a',
										boxShadow: 'none',
										cursor: 'pointer',
									}}
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Create/Edit modal */}
			{showCreateModal && (
				<div className="admin-modal-overlay" onClick={() => setShowCreateModal(false)}>
					<div className={`admin-modal ${editingMap ? 'admin-modal-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
						<h2 className="admin-modal-title">{editingMap ? 'Editează mapa' : 'Mapă nouă'}</h2>
						<div className="admin-modal-body">
							<label className="admin-form-label">Nume</label>
							<input
								type="text"
								className="admin-form-input"
								value={formName}
								onChange={(e) => setFormName(e.target.value)}
								placeholder="ex: Cursuri programare"
							/>
							<label className="admin-form-label">Descriere (opțional)</label>
							<textarea
								className="admin-form-input"
								value={formDescription}
								onChange={(e) => setFormDescription(e.target.value)}
								placeholder="Descriere scurtă..."
								rows={3}
							/>
							{/* La editare: secțiune cursuri în mapă */}
							{editingMap && (
								<>
									<label className="admin-form-label" style={{ marginTop: 'var(--space-4)' }}>Cursuri în mapă</label>
									<div className="admin-course-map-courses-list" style={{ marginBottom: 'var(--space-2)' }}>
										{(editingMap.courses || []).length === 0 ? (
											<p className="admin-text-muted">Niciun curs în această mapă. Adaugă cursuri mai jos.</p>
										) : (
											<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
												{(editingMap.courses || []).map((c) => (
													<li
														key={c.id}
														style={{
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'space-between',
															padding: 'var(--space-2) 0',
															borderBottom: '1px solid var(--border-color)',
														}}
													>
														<span>{c.title}</span>
														<button
															type="button"
															className="admin-course-card-action-btn va-btn-danger"
															onClick={() => removeCourseFromMap(c.id, true)}
														>
															Scoate
														</button>
													</li>
												))}
											</ul>
										)}
									</div>
									<label className="admin-form-label">Adaugă cursuri la mapă</label>
									<select
										multiple
										className="admin-form-input"
										value={addCourseIds.map(String)}
										onChange={(e) => {
											const opts = e.target.selectedOptions;
											setAddCourseIds(Array.from(opts).map((o) => parseInt(o.value, 10)));
										}}
										style={{ minHeight: 100 }}
									>
										{availableCoursesForEdit.map((c) => (
											<option key={c.id} value={c.id}>{c.title}</option>
										))}
									</select>
									<p className="admin-text-muted" style={{ marginTop: 4, fontSize: 'var(--font-size-sm)' }}>
										Ține Ctrl/Cmd pentru selecție multiplă.
									</p>
									<button
										type="button"
										className="lms-btn-primary"
										style={{ marginTop: 'var(--space-2)' }}
										onClick={() => addCoursesToMap(true)}
										disabled={addCourseIds.length === 0}
									>
										Adaugă cursurile selectate
									</button>
								</>
							)}
						</div>
						<div className="admin-modal-actions">
							<button type="button" className="lms-btn-secondary" onClick={() => setShowCreateModal(false)}>
								Anulare
							</button>
							<button type="button" className="lms-btn-primary" onClick={saveMap}>
								{editingMap ? 'Salvează' : 'Creează'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Manage courses modal */}
			{managingMap && (
				<div className="admin-modal-overlay" onClick={() => setManagingMap(null)}>
					<div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
						<h2 className="admin-modal-title">Cursuri în „{managingMap.name}”</h2>
						<div className="admin-modal-body">
							<div className="admin-course-map-courses-list" style={{ marginBottom: 'var(--space-4)' }}>
								{(managingMap.courses || []).length === 0 ? (
									<p className="admin-text-muted">Niciun curs în această mapă. Adaugă cursuri mai jos.</p>
								) : (
									<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
										{(managingMap.courses || []).map((c) => (
											<li
												key={c.id}
												style={{
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'space-between',
													padding: 'var(--space-2) 0',
													borderBottom: '1px solid var(--border-color)',
												}}
											>
												<span>{c.title}</span>
												<button
													type="button"
													className="admin-course-card-action-btn va-btn-danger"
													onClick={() => removeCourseFromMap(c.id)}
												>
													Scoate
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
							<label className="admin-form-label">Adaugă cursuri</label>
							<select
								multiple
								className="admin-form-input"
								value={addCourseIds.map(String)}
								onChange={(e) => {
									const opts = e.target.selectedOptions;
									setAddCourseIds(Array.from(opts).map((o) => parseInt(o.value, 10)));
								}}
								style={{ minHeight: 120 }}
							>
								{availableCourses.map((c) => (
									<option key={c.id} value={c.id}>{c.title}</option>
								))}
							</select>
							<p className="admin-text-muted" style={{ marginTop: 4, fontSize: 'var(--font-size-sm)' }}>
								Ține Ctrl/Cmd pentru selecție multiplă.
							</p>
							<button
								type="button"
								className="lms-btn-primary"
								style={{ marginTop: 'var(--space-2)' }}
								onClick={addCoursesToMap}
								disabled={addCourseIds.length === 0}
							>
								Adaugă cursurile selectate
							</button>
						</div>
						<div className="admin-modal-actions">
							<button type="button" className="lms-btn-primary" onClick={() => setManagingMap(null)}>
								Închide
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminCourseMapsPage;
