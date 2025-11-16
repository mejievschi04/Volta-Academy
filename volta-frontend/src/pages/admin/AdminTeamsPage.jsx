import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';
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
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{teams.length > 0 ? (
				<div className="admin-grid">
					{teams.map((team) => (
						<div
							key={team.id}
							className="va-card admin-card"
						>
							<div className="admin-card-body">
								<h3 className="admin-card-title">👥 {team.name}</h3>
								<p className="admin-card-description">
									{team.description || 'Fără descriere'}
								</p>
								<div className="admin-card-info">
									<div style={{ marginBottom: '0.5rem' }}>👤 <strong>{team.owner?.name || 'N/A'}</strong></div>
									<div style={{ marginBottom: '0.5rem' }}>👥 <strong>{team.users?.length || 0}</strong> membri</div>
									<div>📚 <strong>{team.courses?.length || 0}</strong> cursuri</div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm"
										onClick={() => {
											setSelectedTeam(team);
											setShowUsersModal(true);
										}}
									>
										Membri
									</button>
									<button
										className="va-btn va-btn-sm"
										onClick={() => {
											setSelectedTeam(team);
											setShowCoursesModal(true);
										}}
									>
										Cursuri
									</button>
									<button
										className="va-btn va-btn-sm"
										onClick={() => handleEdit(team)}
									>
										Editează
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(team.id)}
									>
										Șterge
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body">
						<p className="va-muted">Nu există echipe</p>
					</div>
				</div>
			)}

			{/* Team Form Modal */}
			{showModal && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowModal(false)}
				>
					<div
						className="va-card"
						style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header">
							<h2>{editingTeam ? 'Editează Echipă' : 'Adaugă Echipă Nouă'}</h2>
						</div>
						<div className="va-card-body">
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
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: 'rgba(0,0,0,0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 1000,
			}}
			onClick={onClose}
		>
			<div
				className="va-card"
				style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="va-card-header">
					<h2>Gestionează Membri - {team.name}</h2>
				</div>
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Selectează Membri</label>
							<div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--va-border)', borderRadius: '8px', padding: '1rem' }}>
								{users.map((user) => (
									<label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
										<span>{user.name} ({user.email}) - {user.role}</span>
									</label>
								))}
							</div>
						</div>
						<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: 'rgba(0,0,0,0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 1000,
			}}
			onClick={onClose}
		>
			<div
				className="va-card"
				style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="va-card-header">
					<h2>Atribuie Cursuri - {team.name}</h2>
				</div>
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Selectează Cursuri</label>
							<div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--va-border)', borderRadius: '8px', padding: '1rem' }}>
								{courses.map((course) => (
									<label key={course.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
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
										<span>{course.title}</span>
									</label>
								))}
							</div>
						</div>
						<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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

