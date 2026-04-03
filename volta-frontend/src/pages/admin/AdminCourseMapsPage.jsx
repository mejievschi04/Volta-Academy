import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';

const COURSE_MAP_ACCENT_COLORS = [
	'#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f43f5e', '#0ea5e9'
];

const AdminCourseMapsPage = ({ embedded, onOpenMap, autoOpenCreate = false }) => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const { canMutateInAdminArea } = useAuth();
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
	const [deleteConfirmMap, setDeleteConfirmMap] = useState(null);
	const [deleteLoading, setDeleteLoading] = useState(false);

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

	useEffect(() => {
		if (autoOpenCreate && canMutateInAdminArea) {
			openCreate();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoOpenCreate, canMutateInAdminArea]);

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
		if (!map) return;
		setDeleteLoading(true);
		try {
			await adminService.deleteCourseMap(map.id);
			showToast('Mapa a fost ștearsă', 'success');
			setDeleteConfirmMap(null);
			if (managingMap?.id === map.id) setManagingMap(null);
			fetchMaps();
		} catch (err) {
			showToast(err?.response?.data?.message || 'Eroare la ștergere', 'error');
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleConfirmDeleteMap = () => {
		if (deleteConfirmMap) deleteMap(deleteConfirmMap);
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

	const handleOpenMapCourses = (map) => {
		if (onOpenMap) {
			onOpenMap(map);
			return;
		}
		navigate(`/admin/content?tab=courses&course_map_id=${map.id}`);
	};

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
					{canMutateInAdminArea && (
					<div className="admin-courses-header-actions">
						<button type="button" className="admin-btn-create-course" onClick={openCreate}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M12 5V19M5 12H19" strokeLinecap="round"/>
							</svg>
							Creează mapă
						</button>
					</div>
					)}
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
								aria-label="Caută mape de curs"
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
					{canMutateInAdminArea && (
					<button type="button" className="lms-btn-primary" onClick={openCreate}>
						+ Creează prima mapă
					</button>
					)}
				</div>
			) : (
				<div className="admin-courses-grid admin-courses-grid-maps">
					<div className="admin-courses-grid-container admin-courses-grid-container-maps">
						{maps.map((map, index) => {
							const accentColor = COURSE_MAP_ACCENT_COLORS[index % COURSE_MAP_ACCENT_COLORS.length];
							const courseCount = map.courses_count ?? map.courses?.length ?? 0;
							const summary = map.description || `${courseCount} cursuri`;
							return (
								<div
									key={map.id}
									className="admin-course-card admin-course-card-map"
									onClick={() => handleOpenMapCourses(map)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenMapCourses(map); } }}
									style={{ cursor: 'pointer' }}
								>
									{canMutateInAdminArea && (
									<span
										role="button"
										tabIndex={0}
										className="admin-course-map-delete-btn"
onClick={(e) => { e.stopPropagation(); setDeleteConfirmMap(map); }}
																		onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDeleteConfirmMap(map); } }}
										aria-label="Șterge mapa"
									>
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
									</span>
									)}
									<div className="admin-course-map-body">
										<div className="admin-course-map-icon-wrap" style={{ '--map-accent': accentColor }}>
											<svg className="admin-course-map-icon-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
												<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
												<line x1="12" y1="11" x2="12" y2="17"/>
												<line x1="9" y1="14" x2="15" y2="14"/>
											</svg>
										</div>
										<div className="admin-course-map-content">
											<h3 className="admin-course-map-title">{map.name || '—'}</h3>
											<p className="admin-course-map-summary">{map.description && map.description.length > 120 ? map.description.slice(0, 120) + '...' : summary}</p>
											<div className="admin-course-map-footer">
												<span className="admin-course-map-cta-label">Deschide</span>
												<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 12h14M12 5l7 7-7 7"/></svg>
												{canMutateInAdminArea && (
												<div className="admin-course-map-footer-actions" onClick={(e) => e.stopPropagation()}>
													<button type="button" className="admin-course-map-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(map); }} aria-label="Editează mapa">
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
													</button>
													<button type="button" className="admin-course-map-plus-btn" onClick={(e) => { e.stopPropagation(); navigate(`/admin/courses/new?map_id=${map.id}`); }} aria-label="Creează curs în mapa">
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
													</button>
												</div>
												)}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Create/Edit modal – standard LMS: secțiuni clare, selector cursuri cu checkbox */}
			{showCreateModal && canMutateInAdminArea && (
				<div className="admin-modal-overlay" onClick={() => setShowCreateModal(false)}>
					<div className={`admin-modal admin-modal-create ${editingMap ? 'admin-modal-lg' : ''}`} onClick={(e) => e.stopPropagation()}>
						<h2 className="admin-modal-title">{editingMap ? 'Editează mapa' : 'Mapă nouă'}</h2>
						<div className="admin-modal-body">
							<section className="admin-form-section">
								<h3 className="admin-form-section-title">Informații de bază</h3>
								<label className="admin-form-label" htmlFor="course-map-name">Nume</label>
								<input
									id="course-map-name"
									type="text"
									className="admin-form-input"
									value={formName}
									onChange={(e) => setFormName(e.target.value)}
									placeholder="Titlul hărții de cursuri"
									aria-required="true"
								/>
								<label className="admin-form-label" htmlFor="course-map-desc">Descriere (opțional)</label>
								<textarea
									id="course-map-desc"
									className="admin-form-input"
									value={formDescription}
									onChange={(e) => setFormDescription(e.target.value)}
									placeholder="Descriere scurtă pentru studenți..."
									rows={3}
								/>
								<p className="admin-form-hint">Cursurile din mapă vor apărea grupat pentru studenți.</p>
							</section>

							{editingMap && (
								<section className="admin-form-section" aria-label="Cursuri în mapă">
									<h3 className="admin-form-section-title">Cursuri în mapă</h3>
									<div className="admin-course-map-courses-list">
										{(editingMap.courses || []).length === 0 ? (
											<p className="admin-text-muted">Niciun curs în această mapă. Selectează cursuri mai jos și apasă Adaugă.</p>
										) : (
											<ul className="admin-course-map-current-list">
												{(editingMap.courses || []).map((c) => (
													<li key={c.id} className="admin-course-map-current-item">
														<span>{c.title}</span>
														<button
															type="button"
															className="admin-course-map-remove-btn"
															onClick={() => removeCourseFromMap(c.id, true)}
															aria-label={`Scoate ${c.title} din mapă`}
														>
															Scoate
														</button>
													</li>
												))}
											</ul>
										)}
									</div>
									<label className="admin-form-label">Adaugă cursuri la mapă</label>
									<div className="admin-course-map-picker" role="group" aria-label="Selectează cursuri de adăugat">
										{availableCoursesForEdit.length === 0 ? (
											<p className="admin-text-muted">Toate cursurile sunt deja în mapă sau nu există cursuri disponibile.</p>
										) : (
											<ul className="admin-course-map-checkbox-list">
												{availableCoursesForEdit.map((c) => (
													<li key={c.id} className="admin-course-map-checkbox-item">
														<label className="admin-checkbox-label">
															<input
																type="checkbox"
																checked={addCourseIds.includes(c.id)}
																onChange={(e) => {
																	if (e.target.checked) {
																		setAddCourseIds((prev) => [...prev, c.id]);
																	} else {
																		setAddCourseIds((prev) => prev.filter((id) => id !== c.id));
																	}
																}}
															/>
															<span>{c.title}</span>
														</label>
													</li>
												))}
											</ul>
										)}
									</div>
									<button
										type="button"
										className="lms-btn-primary lms-btn-sm"
										onClick={() => addCoursesToMap(true)}
										disabled={addCourseIds.length === 0}
									>
										Adaugă cursurile selectate {addCourseIds.length > 0 && `(${addCourseIds.length})`}
									</button>
								</section>
							)}
						</div>
						<div className="admin-modal-actions">
							<button type="button" className="lms-btn-secondary" onClick={() => setShowCreateModal(false)}>
								Anulare
							</button>
							<button type="button" className="lms-btn-primary" onClick={saveMap} disabled={!formName?.trim()}>
								{editingMap ? 'Salvează' : 'Creează'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Manage courses modal */}
			{managingMap && canMutateInAdminArea && (
				<div className="admin-modal-overlay" onClick={() => setManagingMap(null)}>
					<div className="admin-modal admin-modal-create admin-modal-lg" onClick={(e) => e.stopPropagation()}>
						<h2 className="admin-modal-title">Cursuri în „{managingMap.name}”</h2>
						<div className="admin-modal-body">
							<section className="admin-form-section" aria-label="Cursuri în mapă">
								<h3 className="admin-form-section-title">Cursuri curente</h3>
								<div className="admin-course-map-courses-list">
									{(managingMap.courses || []).length === 0 ? (
										<p className="admin-text-muted">Niciun curs în această mapă. Selectează cursuri mai jos și apasă Adaugă.</p>
									) : (
										<ul className="admin-course-map-current-list">
											{(managingMap.courses || []).map((c) => (
												<li key={c.id} className="admin-course-map-current-item">
													<span>{c.title}</span>
													<button
														type="button"
														className="admin-course-map-remove-btn"
														onClick={() => removeCourseFromMap(c.id)}
														aria-label={`Scoate ${c.title} din mapă`}
													>
														Scoate
													</button>
												</li>
											))}
										</ul>
									)}
								</div>
								<label className="admin-form-label">Adaugă cursuri</label>
								<div className="admin-course-map-picker" role="group" aria-label="Selectează cursuri de adăugat">
									{availableCourses.length === 0 ? (
										<p className="admin-text-muted">Toate cursurile sunt deja în mapă.</p>
									) : (
										<ul className="admin-course-map-checkbox-list">
											{availableCourses.map((c) => (
												<li key={c.id} className="admin-course-map-checkbox-item">
													<label className="admin-checkbox-label">
														<input
															type="checkbox"
															checked={addCourseIds.includes(c.id)}
															onChange={(e) => {
																if (e.target.checked) {
																	setAddCourseIds((prev) => [...prev, c.id]);
																} else {
																	setAddCourseIds((prev) => prev.filter((id) => id !== c.id));
																}
															}}
														/>
														<span>{c.title}</span>
													</label>
												</li>
											))}
										</ul>
									)}
								</div>
								<button
									type="button"
									className="lms-btn-primary lms-btn-sm"
									onClick={addCoursesToMap}
									disabled={addCourseIds.length === 0}
								>
									Adaugă cursurile selectate {addCourseIds.length > 0 && `(${addCourseIds.length})`}
								</button>
							</section>
						</div>
						<div className="admin-modal-actions">
							<button type="button" className="lms-btn-primary" onClick={() => setManagingMap(null)}>
								Închide
							</button>
						</div>
					</div>
				</div>
			)}

			<ConfirmModal
				open={!!deleteConfirmMap}
				onClose={() => setDeleteConfirmMap(null)}
				onConfirm={handleConfirmDeleteMap}
				title="Șterge mapa"
				message={deleteConfirmMap ? `Ștergi mapa „${deleteConfirmMap.name}”? Cursurile nu sunt șterse, doar gruparea.` : ''}
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteLoading}
			/>
		</div>
	);
};

export default AdminCourseMapsPage;
