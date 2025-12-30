import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { coursesService } from '../../services/api';

const AdminTeamsPage = () => {
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
		} catch (err) {
			console.error('Error saving team:', err);
			alert('Eroare la salvarea echipei');
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

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi această echipă?')) return;

		try {
			await adminService.deleteTeam(id);
			fetchTeams();
		} catch (err) {
			console.error('Error deleting team:', err);
			alert('Eroare la ștergerea echipei');
		}
	};

	const handleAttachUsers = async (userIds) => {
		try {
			await adminService.attachUsersToTeam(selectedTeam.id, userIds);
			setShowUsersModal(false);
			setSelectedTeam(null);
			fetchTeams();
		} catch (err) {
			console.error('Error attaching users:', err);
			alert('Eroare la atașarea utilizatorilor');
		}
	};

	const handleAttachCourses = async (courseIds) => {
		try {
			await adminService.attachCoursesToTeam(selectedTeam.id, courseIds);
			setShowCoursesModal(false);
			setSelectedTeam(null);
			fetchTeams();
		} catch (err) {
			console.error('Error attaching courses:', err);
			alert('Eroare la atașarea cursurilor');
		}
	};

	if (loading) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Echipe</h1>
					<p className="va-muted admin-page-subtitle">Gestionează echipele și atribuie-le cursuri</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingTeam(null);
						setFormData({ name: '', description: '', owner_id: '' });
						setShowModal(true);
					}}
				>
					+ Adaugă Echipă
				</button>
			</div>

			{error && (
				<div className="va-auth-error" style={{ marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{teams.length > 0 ? (
				<div className="admin-teams-grid">
					{teams.map((team) => (
						<div key={team.id} className="admin-team-card">
							{/* Animated background gradient */}
							<div className="admin-team-card-bg-gradient" />
							<div className="admin-team-card-bg-gradient-2" />
							
							{/* Action icons in top right corner */}
							<div className="admin-team-card-actions">
								<button
									className="admin-team-card-action-btn"
									onClick={() => handleEdit(team)}
									title="Editează echipă"
								>
									✏️
								</button>
								<button
									className="admin-team-card-action-btn delete"
									onClick={() => handleDelete(team.id)}
									title="Șterge echipă"
								>
									🗑️
								</button>
							</div>
							
							{/* Header */}
							<div className="admin-team-card-header">
								<div className="admin-team-card-header-content">
									<div className="admin-team-card-icon">
										👥
									</div>
									<div style={{ flex: 1, minWidth: 0 }}>
										<h3 className="admin-team-card-title">
											{team.name}
										</h3>
										{team.owner && (
											<div className="admin-team-card-owner">
												<span className="admin-team-card-owner-dot" />
												<span>Proprietar:</span>
												<strong className="admin-team-card-owner-name">
													{team.owner.name}
												</strong>
											</div>
										)}
									</div>
								</div>
								
								{team.description && (
									<p className="admin-team-card-description">
										{team.description}
									</p>
								)}
							</div>

							{/* Stats */}
							<div className="admin-team-card-stats">
								<div className="admin-team-card-stat">
									<div className="admin-team-card-stat-value">
										{team.users?.length || 0}
									</div>
									<div className="admin-team-card-stat-label">
										Membri
									</div>
								</div>
								<div className="admin-team-card-stat">
									<div className="admin-team-card-stat-value">
										{team.courses?.length || 0}
									</div>
									<div className="admin-team-card-stat-label">
										Cursuri
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="admin-team-card-actions-bottom">
								<button
									className="admin-team-card-action-button"
									onClick={() => {
										setSelectedTeam(team);
										setShowUsersModal(true);
									}}
								>
									👥 Membri
								</button>
								<button
									className="admin-team-card-action-button"
									onClick={() => {
										setSelectedTeam(team);
										setShowCoursesModal(true);
									}}
								>
									📚 Cursuri
								</button>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="admin-teams-empty">
					<div className="admin-teams-empty-icon">
						👥
					</div>
					<h3 className="admin-teams-empty-title">
						Nu există echipe
					</h3>
					<p className="admin-teams-empty-text">
						Începe prin a crea prima echipă
					</p>
				</div>
			)}

			{/* Team Form Modal */}
			{showModal && (
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
							<form onSubmit={handleSubmit} className="va-stack">
								<div className="va-form-group">
									<label className="va-form-label">Nume</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Descriere</label>
									<textarea
										className="va-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										rows={4}
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Proprietar</label>
									<select
										className="va-form-input"
										value={formData.owner_id}
										onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
										required
									>
										<option value="">Selectează proprietar</option>
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
										className="va-btn"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="va-btn va-btn-primary">
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
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Selectează Membri</label>
							<div className="admin-team-modal-list">
								<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
											<div style={{ flex: 1 }}>
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
						</div>
						<div className="admin-team-modal-footer">
							<button type="button" className="va-btn" onClick={onClose}>
								Anulează
							</button>
							<button type="submit" className="va-btn va-btn-primary">
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
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Selectează Cursuri</label>
							<div className="admin-team-modal-list">
								<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
						</div>
						<div className="admin-team-modal-footer">
							<button type="button" className="va-btn" onClick={onClose}>
								Anulează
							</button>
							<button type="submit" className="va-btn va-btn-primary">
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

