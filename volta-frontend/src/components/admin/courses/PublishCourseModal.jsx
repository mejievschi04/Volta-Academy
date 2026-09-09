import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/api';
import { teamAccent } from '../../../utils/teamAccent';

function normalizeTeams(raw) {
	return Array.isArray(raw) ? raw : raw?.data || [];
}

function extractAssignedUsers(courseData) {
	if (!courseData || typeof courseData !== 'object') return [];
	const users = courseData.assigned_users || courseData.assignedUsers || [];
	return Array.isArray(users) ? users : [];
}

function extractTeamIds(courseData, fallbackCourse) {
	const teams = courseData?.teams || fallbackCourse?.teams || [];
	return (Array.isArray(teams) ? teams : []).map((t) => t.id).filter(Boolean);
}

const PublishCourseModal = ({ open, onClose, course, onPublished, validationReport, onValidate }) => {
	const courseId = course?.id;
	const [teams, setTeams] = useState([]);
	const [selectedTeamIds, setSelectedTeamIds] = useState([]);
	const [assignedUsers, setAssignedUsers] = useState([]);
	const [restoredPreviousSettings, setRestoredPreviousSettings] = useState(false);
	const [catalogOutsideMap, setCatalogOutsideMap] = useState(false);
	const [loading, setLoading] = useState(false);
	const [loadingTeams, setLoadingTeams] = useState(true);
	const [validating, setValidating] = useState(false);
	const [error, setError] = useState(null);
	const [publishErrorReport, setPublishErrorReport] = useState(null);

	const hasErrors = validationReport && !validationReport.ok;
	const errors = Array.isArray(validationReport?.errors) ? validationReport.errors : [];
	const backendErrors = Array.isArray(publishErrorReport?.errors) ? publishErrorReport.errors : [];
	const canPublish = validationReport?.ok && !loading;

	useEffect(() => {
		if (!open || !courseId) return;

		let cancelled = false;
		setError(null);
		setPublishErrorReport(null);
		setLoadingTeams(true);
		setRestoredPreviousSettings(false);

		(async () => {
			try {
				const [teamsData, courseData] = await Promise.all([
					adminService.getTeams(),
					adminService.getCourse(courseId),
				]);
				if (cancelled) return;

				const fullCourse = courseData?.course || courseData;
				const existingTeamIds = extractTeamIds(fullCourse, course);
				const users = extractAssignedUsers(fullCourse);

				setTeams(normalizeTeams(teamsData));
				setSelectedTeamIds(existingTeamIds);
				setAssignedUsers(users);
				setRestoredPreviousSettings(existingTeamIds.length > 0 || users.length > 0);
				setCatalogOutsideMap(Boolean(
					fullCourse?.settings?.catalog_outside_map ?? course?.settings?.catalog_outside_map
				));
			} catch {
				if (cancelled) return;
				setTeams([]);
				setSelectedTeamIds(extractTeamIds(null, course));
				setAssignedUsers([]);
			} finally {
				if (!cancelled) setLoadingTeams(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [open, courseId]);

	const handleValidateClick = async () => {
		if (!onValidate) return;
		setValidating(true);
		try {
			await onValidate();
		} finally {
			setValidating(false);
		}
	};

	const handlePublish = async () => {
		if (!canPublish || !courseId) return;
		setError(null);
		setLoading(true);
		try {
			const res = await adminService.builderPublishCourse(courseId, selectedTeamIds, { catalogOutsideMap });
			onPublished?.(res, { catalogOutsideMap, teamIds: selectedTeamIds });
			onClose?.();
		} catch (e) {
			console.error('Publish failed:', e);
			if (e?.response?.status === 422 && Array.isArray(e?.response?.data?.errors) && e.response.data.errors.length > 0) {
				setPublishErrorReport(e.response.data);
				setError(null);
			} else {
				setPublishErrorReport(null);
				setError(e?.response?.data?.message || e?.message || 'Eroare la publicare. Încearcă din nou.');
			}
		} finally {
			setLoading(false);
		}
	};

	const toggleTeam = (id) => {
		setSelectedTeamIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
		);
	};

	if (!open) return null;

	return (
		<div className="admin-team-modal-overlay publish-course-modal-overlay">
			<div className="admin-team-modal" onClick={(e) => e.stopPropagation()}>
				<div className="admin-team-modal-header">
					<h2 className="admin-team-modal-title">Publicare curs</h2>
					<button type="button" className="admin-team-modal-close" onClick={onClose} aria-label="Închide">×</button>
				</div>
				<div className="admin-team-modal-body">
					{error && (
						<p className="admin-form-error-inline publish-course-error-margin" role="alert">
							{error}
						</p>
					)}

					{publishErrorReport && backendErrors.length > 0 && (
						<div role="alert" className="admin-form-error-inline publish-course-error-block">
							<div className="publish-course-error-block-title">Serverul a respins publicarea: cursul are erori de validare</div>
							<ul className="publish-course-error-list">
								{backendErrors.slice(0, 5).map((err, i) => (
									<li key={i}>{err.message || err}</li>
								))}
								{backendErrors.length > 5 && <li className="publish-course-error-more">... și încă {backendErrors.length - 5} erori</li>}
							</ul>
							<p className="publish-course-error-hint">
								Apasă „Verifică acum” mai sus sau închide și folosește „Verifică” în tab-ul Workflow, remediază erorile, apoi încearcă din nou.
							</p>
						</div>
					)}

					{!validationReport && (
						<div className="admin-form-section publish-course-validate-section">
							<p className="publish-course-validate-text">
								Rulează validarea pentru a verifica că cursul este complet înainte de publicare.
							</p>
							<button
								type="button"
								className="admin-btn admin-btn-secondary"
								onClick={handleValidateClick}
								disabled={validating}
							>
								{validating ? 'Se verifică...' : 'Verifică acum'}
							</button>
						</div>
					)}

					{hasErrors && errors.length > 0 && (
						<div role="alert" className="admin-form-error-inline publish-course-error-block">
							<div className="publish-course-error-block-title">Cursul are erori de validare</div>
							<ul className="publish-course-error-list">
								{errors.slice(0, 5).map((err, i) => (
									<li key={i}>{err.message || err}</li>
								))}
								{errors.length > 5 && <li className="publish-course-error-more">... și încă {errors.length - 5} erori</li>}
							</ul>
							<p className="publish-course-error-hint">
								Închide modalul, apasă „Verifică” în tab-ul Workflow și remediază erorile, apoi încearcă din nou să publici.
							</p>
						</div>
					)}

					{restoredPreviousSettings && !loadingTeams && (
						<div className="publish-course-restored-banner" role="status">
							Setările anterioare de distribuție au fost restaurate. Poți modifica echipele înainte de publicare; elevii atribuiți direct rămân la fel.
						</div>
					)}

					<div className="admin-form-group publish-course-catalog-option">
						<label className="publish-course-team-item publish-course-catalog-option__label">
							<input
								type="checkbox"
								checked={catalogOutsideMap}
								onChange={(e) => setCatalogOutsideMap(e.target.checked)}
							/>
							<span>Publică în catalog, fără mapă</span>
						</label>
						<p className="publish-course-teams-muted publish-course-catalog-option__hint">
							Elevii vor vedea cursul direct pe pagina Cursuri, nu doar într-o mapă. Poți adăuga cursul într-o mapă oricând, separat.
						</p>
					</div>

					<p className="admin-page-subtitle publish-course-subtitle-margin">
						Poți limita cursul la anumite echipe. Dacă nu selectezi nicio echipă, cursul va fi disponibil pentru toți studenții și vor primi notificare.
					</p>
					<div className="admin-form-group">
						<label className="admin-settings-label">Echipe (opțional)</label>
						{loadingTeams ? (
							<p className="publish-course-teams-muted">Se încarcă echipele...</p>
						) : teams.length === 0 ? (
							<p className="publish-course-teams-muted">Nu există echipe. Cursul va fi pentru toți studenții.</p>
						) : (
							<div className="publish-course-teams-list">
								{teams.map((t) => (
									<label key={t.id} className="publish-course-team-item">
										<input
											type="checkbox"
											checked={selectedTeamIds.includes(t.id)}
											onChange={() => toggleTeam(t.id)}
										/>
										<span
											className="publish-course-team-swatch"
											style={{ background: teamAccent(t) }}
											aria-hidden
										/>
										<span>{t.name}</span>
									</label>
								))}
							</div>
						)}
					</div>

					{assignedUsers.length > 0 && (
						<div className="admin-form-group publish-course-assigned-users">
							<label className="admin-settings-label">Elevi atribuiți direct (păstrați)</label>
							<ul className="publish-course-assigned-users-list">
								{assignedUsers.map((user) => (
									<li key={user.id}>
										<strong>{user.name}</strong>
										{user.email ? <span>{user.email}</span> : null}
									</li>
								))}
							</ul>
							<p className="publish-course-teams-muted">
								Atribuirile directe rămân active și după retragerea din publicare. Le poți modifica din pagina de distribuție a cursului.
							</p>
						</div>
					)}

					<div className="publish-course-actions">
						<button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
							Anulare
						</button>
						<button
							type="button"
							className="admin-btn admin-btn-primary"
							onClick={handlePublish}
							disabled={loading || !canPublish || loadingTeams}
							aria-busy={loading}
							title={!validationReport ? 'Rulează mai întâi validarea' : hasErrors ? 'Remediază erorile de validare' : undefined}
						>
							{loading ? 'Se publică...' : 'Publică'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PublishCourseModal;
