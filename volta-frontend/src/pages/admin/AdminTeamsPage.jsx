import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { coursesService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';

const AdminTeamsPage = () => {
	const { canMutateInAdminArea } = useAuth();
	const { success: showSuccess, error: showError } = useToast();
	const [teams, setTeams] = useState([]);
	const [users, setUsers] = useState([]);
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [showUsersModal, setShowUsersModal] = useState(false);
	const [showCoursesModal, setShowCoursesModal] = useState(false);
	const [editingTeam, setEditingTeam] = useState(null);
	const [selectedTeam, setSelectedTeam] = useState(null);
	const [deleteConfirmTeamId, setDeleteConfirmTeamId] = useState(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		owner_id: '',
	});

	useEffect(() => {
		fetchTeams();
		fetchUsers();
		fetchCourses();
	}, []);

	const fetchTeams = async () => {
		try {
			setLoading(true);
			const data = await adminService.getTeams();
			setTeams(data);
		} catch (err) {
			console.error('Error fetching teams:', err);
			setError('Nu s-au putut încărca echipele');
		} finally {
			setLoading(false);
		}
	};

	const fetchUsers = async () => {
		try {
			const data = await adminService.getUsers();
			setUsers(data);
		} catch (err) {
			console.error('Error fetching users:', err);
		}
	};

	const fetchCourses = async () => {
		try {
			const data = await coursesService.getAll();
			setCourses(data);
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingTeam) {
				await adminService.updateTeam(editingTeam.id, formData);
			} else {
				await adminService.createTeam(formData);
			}

			setShowModal(false);
			setEditingTeam(null);
			setFormData({ name: '', description: '', owner_id: '' });
			fetchTeams();
			showSuccess('Echipă salvată cu succes!');
		} catch (err) {
			logger.error('Error saving team:', err);
			showError('Eroare la salvarea echipei: ' + (err.response?.data?.message || err.message));
		}
	};

	const handleEdit = (team) => {
		setEditingTeam(team);
		setFormData({
			name: team.name,
			description: team.description || '',
			owner_id: team.owner_id || '',
		});
		setShowModal(true);
	};

	const handleDeleteClick = (id) => {
		setDeleteConfirmTeamId(id);
	};

	const handleConfirmDeleteTeam = async () => {
		if (!deleteConfirmTeamId) return;
		setDeleteLoading(true);
		try {
			await adminService.deleteTeam(deleteConfirmTeamId);
			setDeleteConfirmTeamId(null);
			fetchTeams();
			showSuccess('Echipă ștearsă cu succes!');
		} catch (err) {
			logger.error('Error deleting team:', err);
			showError('Eroare la ștergerea echipei: ' + (err.response?.data?.message || err.message));
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleAttachUsers = async (userIds) => {
		try {
			await adminService.attachUsersToTeam(selectedTeam.id, userIds);
			setShowUsersModal(false);
			setSelectedTeam(null);
			fetchTeams();
			showSuccess('Utilizatori atașați cu succes!');
		} catch (err) {
			logger.error('Error attaching users:', err);
			showError('Eroare la atașarea utilizatorilor: ' + (err.response?.data?.message || err.message));
		}
	};

	const handleAttachCourses = async (courseIds) => {
		try {
			await adminService.attachCoursesToTeam(selectedTeam.id, courseIds);
			setShowCoursesModal(false);
			setSelectedTeam(null);
			fetchTeams();
			showSuccess('Cursuri atașate cu succes!');
		} catch (err) {
			logger.error('Error attaching courses:', err);
			showError('Eroare la atașarea cursurilor: ' + (err.response?.data?.message || err.message));
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Gestionare Echipe</h1>
					<p className="admin-page-subtitle">Gestionează echipele și atribuie-le cursuri</p>
				</div>
				{canMutateInAdminArea && (
				<button
					className="lms-btn-primary"
					onClick={() => {
						setEditingTeam(null);
						setFormData({ name: '', description: '', owner_id: '' });
						setShowModal(true);
					}}
				>
					+ Adaugă Echipă
				</button>
				)}
			</div>

			{error && (
				<div className="lms-error-message">
					{error}
				</div>
			)}

			{teams.length > 0 ? (
				<div className="admin-grid admin-teams-page-grid">
					{teams.map((team) => (
						<div key={team.id} className="admin-card admin-team-card-compact">
							<div className="admin-card-body">
								{/* Header with icon and actions */}
								<div className="admin-team-card-compact__header">
									<div className="admin-team-card-compact__header-main">
										<div className="admin-team-card-compact__avatar" aria-hidden>
											👥
										</div>
										<div className="admin-team-card-compact__title-wrap">
											<h3 className="admin-card-title admin-team-card-compact__title">
												{team.name}
											</h3>
										</div>
									</div>
									{/* Action icons */}
									{canMutateInAdminArea && (
									<div className="admin-team-card-compact__header-actions">
										<button
											className="admin-btn admin-btn-sm admin-btn-ghost admin-team-card-compact__icon-btn"
											onClick={() => handleEdit(team)}
											title="Editează echipă"
											type="button"
										>
											✏️
										</button>
										<button
											className="admin-btn admin-btn-sm admin-btn-danger admin-team-card-compact__icon-btn"
											onClick={() => handleDeleteClick(team.id)}
											title="Șterge echipă"
											type="button"
										>
											🗑️
										</button>
									</div>
									)}
								</div>
								
								{team.description && (
									<p className="admin-card-description admin-team-card-compact__description">
										{team.description}
									</p>
								)}

								{team.owner && (
									<div className="admin-card-info admin-team-card-compact__owner">
										<span>Responsabil:</span>
										<strong className="admin-team-card-compact__owner-name">{team.owner.name}</strong>
									</div>
								)}

								{/* Stats */}
								<div className="admin-team-card-compact__stats">
									<div className="admin-team-card-compact__stat-cell">
										<div className="admin-team-card-compact__stat-value">
											{team.users?.length || 0}
										</div>
										<div className="admin-team-card-compact__stat-label">
											Membri
										</div>
									</div>
									<div className="admin-team-card-compact__stat-cell">
										<div className="admin-team-card-compact__stat-value">
											{team.courses?.length || 0}
										</div>
										<div className="admin-team-card-compact__stat-label">
											Cursuri
										</div>
									</div>
								</div>

								{/* Actions */}
								{canMutateInAdminArea && (
								<div className="admin-card-actions">
									<button
										className="admin-btn admin-btn-sm admin-btn-secondary"
										onClick={() => {
											setSelectedTeam(team);
											setShowUsersModal(true);
										}}
									>
										<span className="admin-btn-icon">👥</span>
										<span>Membri</span>
									</button>
									<button
										className="admin-btn admin-btn-sm admin-btn-secondary"
										onClick={() => {
											setSelectedTeam(team);
											setShowCoursesModal(true);
										}}
									>
										<span className="admin-btn-icon">📚</span>
										<span>Cursuri</span>
									</button>
								</div>
								)}
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="lms-empty-state">
					<div className="lms-empty-icon">👥</div>
					<h3 className="lms-empty-title">Nu există echipe</h3>
					<p className="lms-empty-description">
						Începe prin a crea prima echipă
					</p>
					{canMutateInAdminArea && (
					<button
						className="lms-btn-primary"
						onClick={() => {
							setEditingTeam(null);
							setFormData({ name: '', description: '', owner_id: '' });
							setShowModal(true);
						}}
					>
						+ Adaugă Echipă
					</button>
					)}
				</div>
			)}

			{/* Team Form Modal */}
			{showModal && canMutateInAdminArea && (
				<div className="admin-team-modal-overlay" onClick={(e) => {
					if (e.target === e.currentTarget) {
						setShowModal(false);
					}
				}}>
					<div className="admin-team-modal" onClick={(e) => e.stopPropagation()}>
						<div className="admin-team-modal-header">
							<h2 className="admin-team-modal-title">{editingTeam ? 'Editează Echipă' : 'Adaugă Echipă Nouă'}</h2>
							<button
								type="button"
								className="admin-team-modal-close"
								onClick={() => setShowModal(false)}
								title="Închide"
							>
								×
							</button>
						</div>
						<div className="admin-team-modal-body">
							<form onSubmit={handleSubmit} className="admin-team-modal-form">
								<div className="admin-form-group">
									<label className="admin-form-label">Nume</label>
									<input
										type="text"
										className="admin-form-input"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
									/>
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">Descriere</label>
									<textarea
										className="admin-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										rows={4}
									/>
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">Responsabil</label>
									<select
										className="admin-form-input"
										value={formData.owner_id}
										onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
										required
									>
										<option value="">Selectează responsabil</option>
										{users.map((user) => (
											<option key={user.id} value={user.id}>
												{user.name} ({user.email})
											</option>
										))}
									</select>
								</div>
								<div className="admin-team-modal-footer">
									<button
										type="button"
										className="lms-btn-secondary"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="lms-btn-primary">
										Salvează
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* Users Modal */}
			{showUsersModal && selectedTeam && (
				<TeamUsersModal
					team={selectedTeam}
					users={users}
					onClose={() => {
						setShowUsersModal(false);
						setSelectedTeam(null);
					}}
					onSave={handleAttachUsers}
				/>
			)}

			{/* Courses Modal */}
			{showCoursesModal && selectedTeam && (
				<TeamCoursesModal
					team={selectedTeam}
					courses={courses}
					onClose={() => {
						setShowCoursesModal(false);
						setSelectedTeam(null);
					}}
					onSave={handleAttachCourses}
				/>
			)}

			<ConfirmModal
				open={!!deleteConfirmTeamId}
				onClose={() => setDeleteConfirmTeamId(null)}
				onConfirm={handleConfirmDeleteTeam}
				title="Șterge echipă"
				message="Sigur dorești să ștergi această echipă?"
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteLoading}
			/>
		</div>
	);
};

const TeamUsersModal = ({ team, users, onClose, onSave }) => {
	const [selectedUserIds, setSelectedUserIds] = useState(team.users?.map(u => u.id) || []);

	const handleSubmit = (e) => {
		e.preventDefault();
		onSave(selectedUserIds);
	};

	return (
		<div className="admin-team-modal-overlay" onClick={(e) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		}}>
			<div className="admin-team-modal" onClick={(e) => e.stopPropagation()}>
				<div className="admin-team-modal-header">
					<h2 className="admin-team-modal-title">Gestionează Membri - {team.name}</h2>
					<button
						type="button"
						className="admin-team-modal-close"
						onClick={onClose}
						title="Închide"
					>
						×
					</button>
				</div>
				<div className="admin-team-modal-body">
					<form onSubmit={handleSubmit} className="admin-team-modal-form">
						<div className="admin-form-group">
							<label className="admin-form-label">Selectează Membri</label>
							<div className="admin-team-modal-list">
								{users.map((user) => (
									<label 
										key={user.id}
										className={`admin-team-modal-list-item ${selectedUserIds.includes(user.id) ? 'selected' : ''}`}
									>
										<input
											type="checkbox"
											checked={selectedUserIds.includes(user.id)}
											onChange={(e) => {
												if (e.target.checked) {
													setSelectedUserIds([...selectedUserIds, user.id]);
												} else {
													setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
												}
											}}
										/>
										<div className="admin-team-modal-list-item-content">
											<div className={`admin-team-modal-list-item-label ${selectedUserIds.includes(user.id) ? 'selected' : ''}`}>
												{user.name}
											</div>
											<div className="admin-team-modal-list-item-sublabel">
												{user.email} • {user.role}
											</div>
										</div>
									</label>
								))}
							</div>
						</div>
						<div className="admin-team-modal-footer">
							<button type="button" className="lms-btn-secondary" onClick={onClose}>
								Anulează
							</button>
							<button type="submit" className="lms-btn-primary">
								Salvează
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

const TeamCoursesModal = ({ team, courses, onClose, onSave }) => {
	const [selectedCourseIds, setSelectedCourseIds] = useState(team.courses?.map(c => c.id) || []);

	const handleSubmit = (e) => {
		e.preventDefault();
		onSave(selectedCourseIds);
	};

	return (
		<div className="admin-team-modal-overlay" onClick={(e) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		}}>
			<div className="admin-team-modal" onClick={(e) => e.stopPropagation()}>
				<div className="admin-team-modal-header">
					<h2 className="admin-team-modal-title">Atribuie Cursuri - {team.name}</h2>
					<button
						type="button"
						className="admin-team-modal-close"
						onClick={onClose}
						title="Închide"
					>
						×
					</button>
				</div>
				<div className="admin-team-modal-body">
					<form onSubmit={handleSubmit} className="admin-team-modal-form">
						<div className="admin-form-group">
							<label className="admin-form-label">Selectează Cursuri</label>
							<div className="admin-team-modal-list">
								{courses.map((course) => (
									<label 
										key={course.id}
										className={`admin-team-modal-list-item ${selectedCourseIds.includes(course.id) ? 'selected' : ''}`}
									>
										<input
											type="checkbox"
											checked={selectedCourseIds.includes(course.id)}
											onChange={(e) => {
												if (e.target.checked) {
													setSelectedCourseIds([...selectedCourseIds, course.id]);
												} else {
													setSelectedCourseIds(selectedCourseIds.filter(id => id !== course.id));
												}
											}}
										/>
										<div className={`admin-team-modal-list-item-label ${selectedCourseIds.includes(course.id) ? 'selected' : ''}`}>
											{course.title}
										</div>
									</label>
								))}
							</div>
						</div>
						<div className="admin-team-modal-footer">
							<button type="button" className="lms-btn-secondary" onClick={onClose}>
								Anulează
							</button>
							<button type="submit" className="lms-btn-primary">
								Salvează
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

export default AdminTeamsPage;

