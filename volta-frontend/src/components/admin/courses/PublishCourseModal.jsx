import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/api';

const PublishCourseModal = ({ open, onClose, courseId, onPublished }) => {
	const [teams, setTeams] = useState([]);
	const [selectedTeamIds, setSelectedTeamIds] = useState([]);
	const [loading, setLoading] = useState(false);
	const [loadingTeams, setLoadingTeams] = useState(true);

	useEffect(() => {
		if (open) {
			setLoadingTeams(true);
			adminService.getTeams().then((data) => {
				setTeams(Array.isArray(data) ? data : data?.data || []);
				setSelectedTeamIds([]);
			}).catch(() => setTeams([])).finally(() => setLoadingTeams(false));
		}
	}, [open]);

	const handlePublish = async () => {
		setLoading(true);
		try {
			const res = await adminService.builderPublishCourse(courseId, selectedTeamIds);
			onPublished?.(res);
			onClose?.();
		} catch (e) {
			console.error('Publish failed:', e);
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
		<div className="admin-team-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
			<div className="admin-team-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
				<div className="admin-team-modal-header">
					<h2 className="admin-team-modal-title">Publicare curs</h2>
					<button type="button" className="admin-team-modal-close" onClick={onClose}>×</button>
				</div>
				<div className="admin-team-modal-body">
					<p className="admin-page-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
						Poți limita cursul la anumite echipe. Dacă nu selectezi nicio echipă, cursul va fi disponibil pentru toți studenții și vor primi notificare.
					</p>
					<div className="admin-form-group">
						<label className="admin-settings-label">Echipe (opțional)</label>
						{loadingTeams ? (
							<p style={{ color: 'var(--text-tertiary)' }}>Se încarcă echipele...</p>
						) : teams.length === 0 ? (
							<p style={{ color: 'var(--text-tertiary)' }}>Nu există echipe. Cursul va fi pentru toți studenții.</p>
						) : (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
								{teams.map((t) => (
									<label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
										<input
											type="checkbox"
											checked={selectedTeamIds.includes(t.id)}
											onChange={() => toggleTeam(t.id)}
										/>
										<span>{t.name}</span>
									</label>
								))}
							</div>
						)}
					</div>
					<div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)', justifyContent: 'flex-end' }}>
						<button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
							Anulare
						</button>
						<button
							type="button"
							className="admin-btn admin-btn-primary"
							onClick={handlePublish}
							disabled={loading}
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
