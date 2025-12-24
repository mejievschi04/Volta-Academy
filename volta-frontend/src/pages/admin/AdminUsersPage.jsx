import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';

const AdminUsersPage = () => {
	const navigate = useNavigate();
	const [users, setUsers] = useState([]);
	const [teams, setTeams] = useState([]);
	const [filteredUsers, setFilteredUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingUser, setEditingUser] = useState(null);
	const [sortBy, setSortBy] = useState('role'); // 'role', 'name', 'email'
	const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
	const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'admin', 'student'
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		password: '',
		role: 'student',
		bio: '',
		team_id: '',
	});

	useEffect(() => {
		fetchInitialData();
	}, []);

	const fetchInitialData = async () => {
		await Promise.all([fetchUsers(), fetchTeams()]);
	};

	useEffect(() => {
		applyFiltersAndSort();
	}, [users, sortBy, sortOrder, roleFilter]);

	const fetchUsers = async () => {
		try {
			setLoading(true);
			const data = await adminService.getUsers();
			// Include all users including admins
			setUsers(data);
		} catch (err) {
			console.error('Error fetching users:', err);
			setError('Nu s-au putut încărca utilizatorii');
		} finally {
			setLoading(false);
		}
	};

	const fetchTeams = async () => {
		try {
			const data = await adminService.getTeams();
			setTeams(Array.isArray(data) ? data : (data.data || []));
		} catch (err) {
			console.error('Error fetching teams:', err);
		}
	};

	const applyFiltersAndSort = () => {
		let filtered = [...users];

		// Filter by role
		if (roleFilter !== 'all') {
			filtered = filtered.filter(user => user.role === roleFilter);
		}

		// Sort
		filtered.sort((a, b) => {
			let aValue, bValue;

			switch (sortBy) {
				case 'team':
					// Use first team name alphabetically or empty string if none
					aValue = Array.isArray(a.teams) && a.teams.length > 0
						? [...a.teams].map(t => (t?.name || '').toLowerCase()).sort()[0] || ''
						: '';
					bValue = Array.isArray(b.teams) && b.teams.length > 0
						? [...b.teams].map(t => (t?.name || '').toLowerCase()).sort()[0] || ''
						: '';
					break;
				case 'role':
					aValue = a.role;
					bValue = b.role;
					break;
				case 'name':
					aValue = a.name.toLowerCase();
					bValue = b.name.toLowerCase();
					break;
				case 'email':
					aValue = a.email.toLowerCase();
					bValue = b.email.toLowerCase();
					break;
				default:
					return 0;
			}

			if (sortOrder === 'asc') {
				return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
			} else {
				return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
			}
		});

		setFilteredUsers(filtered);
	};

	const handleSort = (field) => {
		if (sortBy === field) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
		} else {
			setSortBy(field);
			setSortOrder('asc');
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			const dataToSend = { ...formData };
			if (!dataToSend.password || dataToSend.password === '') {
				delete dataToSend.password;
			}

			if (editingUser) {
				// Do not change team on update in this flow
				delete dataToSend.team_id;
				await adminService.updateUser(editingUser.id, dataToSend);
			} else {
				// Parola nu este obligatorie - va fi setată automat la "volta2025" în backend
				await adminService.createUser(dataToSend);
			}

			setShowModal(false);
			setEditingUser(null);
			setFormData({ name: '', email: '', password: '', role: 'student', bio: '', team_id: '' });
			fetchUsers();
		} catch (err) {
			console.error('Error saving user:', err);
			alert('Eroare la salvarea utilizatorului');
		}
	};

	const handleEdit = (user) => {
		setEditingUser(user);
		setFormData({
			name: user.name,
			email: user.email,
			password: '',
			role: user.role,
			bio: user.bio || '',
			team_id: (Array.isArray(user.teams) && user.teams[0]?.id) || '',
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi acest utilizator?')) return;

		try {
			await adminService.deleteUser(id);
			fetchUsers();
		} catch (err) {
			console.error('Error deleting user:', err);
			alert('Eroare la ștergerea utilizatorului');
		}
	};

	const getCompletionColor = (percentage) => {
		if (percentage >= 80) return '#10b981'; // Verde
		if (percentage >= 50) return '#f59e0b'; // Galben
		return '#ef4444'; // Roșu
	};

	const getRoleLabel = (role) => {
		const roles = {
			admin: 'Administrator',
			student: 'Utilizator',
		};
		return roles[role] || 'Utilizator';
	};

	if (loading) { return null; }

	return (
		<div className="admin-container admin-container--wide">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Utilizatori</h1>
					<p className="va-muted admin-page-subtitle">Gestionează toți utilizatorii din platformă</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingUser(null);
						setFormData({ name: '', email: '', password: '', role: 'student', bio: '' });
						setShowModal(true);
					}}
				>
					+ Adaugă Utilizator
				</button>
			</div>

			{error && (
				<div className="va-auth-error" style={{ marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{/* Filters */}
			<div className="admin-users-filters">
				<div className="admin-users-filter-group">
					<label className="admin-users-filter-label">Filtrează după rol:</label>
					<select
						className="va-form-input admin-events-filter"
						value={roleFilter}
						onChange={(e) => setRoleFilter(e.target.value)}
					>
						<option value="all">Toate</option>
						<option value="student">Utilizatori</option>
						<option value="admin">Administratori</option>
					</select>
				</div>
			</div>

			{/* Table */}
			<div className="admin-users-table-wrapper">
				<table className="admin-users-table">
					<thead>
						<tr>
							<th className={`sortable ${sortBy === 'name' ? (sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`} onClick={() => handleSort('name')}>
								Utilizator
							</th>
							<th className={`sortable ${sortBy === 'email' ? (sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`} onClick={() => handleSort('email')}>
								Email
							</th>
							<th className={`sortable ${sortBy === 'role' ? (sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`} onClick={() => handleSort('role')}>
								Rol
							</th>
							<th className={`sortable ${sortBy === 'team' ? (sortOrder === 'asc' ? 'sort-asc' : 'sort-desc') : ''}`} onClick={() => handleSort('team')}>
								Echipă
							</th>
							<th>Cursuri Finalizate</th>
							<th>Procentaj</th>
							<th className="admin-users-table-cell-center">Acțiuni</th>
						</tr>
					</thead>
					<tbody>
						{filteredUsers.length > 0 ? (
							filteredUsers.map((user) => {
								const isAdmin = user.role === 'admin';
								const totalCourses = user.total_courses || 0;
								const completedCourses = user.completed_courses || 0;
								const percentage = user.completion_percentage || 0;
								const progressClass = percentage >= 80 ? 'high' : percentage >= 50 ? 'medium' : 'low';
								const initials = user.name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
								
								return (
									<tr
										key={user.id}
										onClick={() => navigate(`/admin/users/${user.id}/profile`)}
									>
										<td>
											<div className="admin-users-table-cell-user">
												<div className="admin-users-table-avatar">
													{user.avatar ? (
														<img src={user.avatar} alt={user.name} />
													) : (
														initials
													)}
												</div>
												<div>
													<div className="admin-users-table-cell-name">{user.name}</div>
													{user.bio && (
														<div className="admin-users-table-cell-bio">
															{user.bio.substring(0, 50)}{user.bio.length > 50 ? '...' : ''}
														</div>
													)}
												</div>
											</div>
										</td>
										<td className="admin-users-table-cell-email">{user.email}</td>
										<td>
											<span className={`admin-users-role-badge ${user.role}`}>
												{getRoleLabel(user.role)}
											</span>
										</td>
										<td>
											{Array.isArray(user.teams) && user.teams.length > 0
												? user.teams.map(t => t?.name).filter(Boolean).join(', ')
												: '-'}
										</td>
										<td>
											{isAdmin ? (
												<span style={{ color: 'rgba(var(--color-light-rgb), 0.65)' }}>-</span>
											) : (
												<span style={{ color: getCompletionColor(percentage), fontWeight: 600 }}>
													{completedCourses}/{totalCourses}
												</span>
											)}
										</td>
										<td>
											{isAdmin ? (
												<span style={{ color: 'rgba(var(--color-light-rgb), 0.65)' }}>-</span>
											) : (
												<div className="admin-users-progress-container">
													<div className="admin-users-progress-bar">
														<div
															className={`admin-users-progress-fill ${progressClass}`}
															style={{ width: `${percentage}%` }}
														/>
													</div>
													<span className={`admin-users-progress-text ${progressClass}`}>
														{percentage}%
													</span>
												</div>
											)}
										</td>
										<td className="admin-users-table-cell-center">
											<div className="admin-users-actions" onClick={(e) => e.stopPropagation()}>
												<button
													className="va-btn va-btn-sm"
													onClick={(e) => {
														e.stopPropagation();
														handleEdit(user);
													}}
												>
													Editează
												</button>
												<button
													className="va-btn va-btn-sm va-btn-danger"
													onClick={(e) => {
														e.stopPropagation();
														handleDelete(user.id);
													}}
												>
													Șterge
												</button>
											</div>
										</td>
									</tr>
								);
							})
						) : (
							<tr>
								<td colSpan="7" className="admin-users-empty">
									<div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
									<h3 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>Nu există utilizatori</h3>
									<p style={{ margin: 0, color: 'rgba(var(--color-light-rgb), 0.5)' }}>
										Nu există utilizatori care să corespundă filtrelor selectate.
									</p>
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Modal */}
			{showModal && (
				<div className="admin-users-modal-overlay" onClick={(e) => {
					if (e.target === e.currentTarget) {
						setShowModal(false);
					}
				}}>
					<div className="admin-users-modal" onClick={(e) => e.stopPropagation()}>
						<div className="admin-users-modal-header">
							<h2 className="admin-users-modal-title">{editingUser ? 'Editează Utilizator' : 'Adaugă Utilizator Nou'}</h2>
							<button
								type="button"
								className="admin-users-modal-close"
								onClick={() => setShowModal(false)}
								title="Închide"
							>
								×
							</button>
						</div>
						<div className="admin-users-modal-body">
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
									<label className="va-form-label">Echipă</label>
									<select
										className="va-form-input"
										value={formData.team_id}
										onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
									>
										<option value="">Fără echipă</option>
										{teams.map(team => (
											<option key={team.id} value={team.id}>{team.name}</option>
										))}
									</select>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Email</label>
									<input
										type="email"
										className="va-form-input"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										required
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">
										Parolă {!editingUser ? <span style={{ color: 'var(--va-muted)', fontWeight: 'normal' }}>(opțională)</span> : '(lasă gol pentru a nu schimba)'}
									</label>
									<input
										type="password"
										className="va-form-input"
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										placeholder={!editingUser ? 'Lasă gol pentru parola implicită: volta2025' : 'Lasă gol pentru a păstra parola actuală'}
										minLength={formData.password ? 6 : undefined}
									/>
									{!editingUser && (
										<p style={{ fontSize: '0.75rem', color: 'var(--va-muted)', marginTop: '0.25rem' }}>
											Dacă nu specifici o parolă, utilizatorul va primi automat parola: <strong>volta2025</strong> și va trebui să o schimbe la prima autentificare.
										</p>
									)}
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Rol</label>
									<select
										className="va-form-input"
										value={formData.role}
										onChange={(e) => setFormData({ ...formData, role: e.target.value })}
										required
									>
										<option value="student">Utilizator</option>
										<option value="admin">Administrator</option>
									</select>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Bio</label>
									<textarea
										className="va-form-input"
										value={formData.bio}
										onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
										rows={3}
									/>
								</div>
								<div className="admin-users-modal-footer">
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
		</div>
	);
};

export default AdminUsersPage;
