import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const AdminUsersPage = () => {
	const [users, setUsers] = useState([]);
	const [teams, setTeams] = useState([]);
	const [filteredUsers, setFilteredUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingUser, setEditingUser] = useState(null);
	const [sortBy, setSortBy] = useState('role'); // 'role', 'name', 'email'
	const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
	const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'admin', 'teacher', 'student'
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
			// Filter out admin users
			const nonAdminUsers = data.filter(user => user.role !== 'admin');
			setUsers(nonAdminUsers);
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
			teacher: 'Profesor',
			student: 'Student',
		};
		return roles[role] || role;
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
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{/* Filters */}
			<div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
					<label style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>Filtrează după rol:</label>
					<select
						className="va-form-input"
						value={roleFilter}
						onChange={(e) => setRoleFilter(e.target.value)}
						style={{ padding: '0.5rem', fontSize: '0.875rem' }}
					>
						<option value="all">Toate</option>
						<option value="teacher">Profesor</option>
						<option value="student">Student</option>
					</select>
				</div>
			</div>

			{/* Table */}
			<div style={{ overflowX: 'auto' }}>
				<table style={{ width: '100%', minWidth: '1400px', borderCollapse: 'collapse', background: 'var(--va-surface)', borderRadius: '8px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
					<thead>
						<tr style={{ background: 'var(--va-surface-2)', borderBottom: '2px solid var(--va-border)' }}>
							<th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSort('name')}>
								Nume {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
							</th>
							<th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSort('email')}>
								Email {sortBy === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
							</th>
							<th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSort('role')}>
								Rol {sortBy === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
							</th>
							<th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSort('team')}>
								Echipă {sortBy === 'team' && (sortOrder === 'asc' ? '↑' : '↓')}
							</th>
							<th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Cursuri Finalizate</th>
							<th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Procentaj</th>
							<th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Acțiuni</th>
						</tr>
					</thead>
					<tbody>
						{filteredUsers.length > 0 ? (
							filteredUsers.map((user) => {
								const totalCourses = user.total_courses || 0;
								const completedCourses = user.completed_courses || 0;
								const percentage = user.completion_percentage || 0;
								const color = getCompletionColor(percentage);

								return (
									<tr
										key={user.id}
										style={{
											borderBottom: '1px solid var(--va-border)',
											transition: 'background 0.2s ease',
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.background = 'rgba(139, 93, 255, 0.05)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.background = 'transparent';
										}}
									>
										<td style={{ padding: '1rem' }}>
											<div style={{ fontWeight: 500 }}>{user.name}</div>
											{user.bio && (
												<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginTop: '0.25rem' }}>
													{user.bio.substring(0, 50)}{user.bio.length > 50 ? '...' : ''}
												</div>
											)}
										</td>
										<td style={{ padding: '1rem', color: 'var(--va-muted)' }}>{user.email}</td>
										<td style={{ padding: '1rem' }}>
											<span
												style={{
													display: 'inline-block',
													padding: '0.25rem 0.75rem',
													borderRadius: '12px',
													fontSize: '0.875rem',
													fontWeight: 500,
													background:
														user.role === 'admin'
															? 'rgba(239, 68, 68, 0.2)'
															: user.role === 'teacher'
															? 'rgba(59, 130, 246, 0.2)'
															: 'rgba(16, 185, 129, 0.2)',
													color:
														user.role === 'admin'
															? '#ef4444'
															: user.role === 'teacher'
															? '#3b82f6'
															: '#10b981',
												}}
											>
												{getRoleLabel(user.role)}
											</span>
										</td>
										<td style={{ padding: '1rem' }}>
											{Array.isArray(user.teams) && user.teams.length > 0
												? user.teams.map(t => t?.name).filter(Boolean).join(', ')
												: '-'}
										</td>
										<td style={{ padding: '1rem' }}>
											<span style={{ color: color, fontWeight: 600, fontSize: '1rem' }}>
												{completedCourses}/{totalCourses}
											</span>
										</td>
										<td style={{ padding: '1rem' }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
												<div
													style={{
														flex: 1,
														height: '8px',
														background: 'var(--va-border)',
														borderRadius: '4px',
														overflow: 'hidden',
													}}
												>
													<div
														style={{
															height: '100%',
															width: `${percentage}%`,
															background: color,
															transition: 'width 0.3s ease',
														}}
													/>
												</div>
												<span style={{ color: color, fontWeight: 600, minWidth: '45px', fontSize: '0.875rem' }}>
													{percentage}%
												</span>
											</div>
										</td>
										<td style={{ padding: '1rem', textAlign: 'center' }}>
											<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
												<button
													className="va-btn va-btn-sm"
													onClick={() => handleEdit(user)}
													style={{ padding: '0.5rem 1rem' }}
												>
													Editează
												</button>
												<button
													className="va-btn va-btn-sm va-btn-danger"
													onClick={() => handleDelete(user.id)}
													style={{ padding: '0.5rem 1rem' }}
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
								<td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--va-muted)' }}>
									Nu există utilizatori
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Modal */}
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
							<h2>{editingUser ? 'Editează Utilizator' : 'Adaugă Utilizator Nou'}</h2>
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
										<option value="student">Student</option>
										<option value="teacher">Profesor</option>
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
		</div>
	);
};

export default AdminUsersPage;
