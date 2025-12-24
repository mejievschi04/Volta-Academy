import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { coursesService } from '../../services/api';

const AdminTeamMembersPage = () => {
	const navigate = useNavigate();
	const [members, setMembers] = useState([]);
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [filters, setFilters] = useState({
		role: 'all',
		status: 'all',
	});
	const [selectedMember, setSelectedMember] = useState(null);
	const [showRoleModal, setShowRoleModal] = useState(false);
	const [showCoursesModal, setShowCoursesModal] = useState(false);
	const [showSuspendModal, setShowSuspendModal] = useState(false);
	const [actionLoading, setActionLoading] = useState(null);

	useEffect(() => {
		fetchTeamMembers();
		fetchCourses();
	}, [filters, searchQuery]);

	const fetchTeamMembers = async () => {
		try {
			setLoading(true);
			const params = {
				search: searchQuery || undefined,
				role: filters.role !== 'all' ? filters.role : undefined,
				status: filters.status !== 'all' ? filters.status : undefined,
			};
			const data = await adminService.getTeamMembers(params);
			setMembers(Array.isArray(data) ? data : (data.data || []));
		} catch (err) {
			console.error('Error fetching team members:', err);
			setError('Nu s-au putut încărca membrii echipei');
		} finally {
			setLoading(false);
		}
	};

	const fetchCourses = async () => {
		try {
			const data = await coursesService.getAll();
			setCourses(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleDateString('ro-RO', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const getRoleLabel = (role) => {
		const labels = {
			admin: 'Admin',
			manager: 'Manager',
			instructor: 'Instructor',
			teacher: 'Instructor',
		};
		return labels[role] || role;
	};

	const getRoleColor = (role) => {
		const colors = {
			admin: '#ef4444',
			manager: '#3b82f6',
			instructor: '#10b981',
			teacher: '#10b981',
		};
		return colors[role] || '#6b7280';
	};

	const getStatusBadge = (status) => {
		if (!status || status === 'active') {
			return { label: 'Activ', color: '#10b981' };
		}
		return { label: 'Suspendat', color: '#f97316' };
	};

	const handleQuickAction = async (memberId, action, data = {}) => {
		setActionLoading(memberId);
		try {
			switch (action) {
				case 'activate':
					await adminService.activateTeamMember(memberId);
					break;
				case 'suspend':
					await adminService.suspendTeamMember(memberId, data.reason, data.suspendedUntil);
					break;
				case 'resetAccess':
					await adminService.resetTeamMemberAccess(memberId);
					break;
				case 'removeFromTeam':
					await adminService.removeTeamMemberFromTeam(memberId);
					break;
				default:
					break;
			}
			await fetchTeamMembers();
			alert('Acțiune realizată cu succes!');
		} catch (err) {
			console.error(`Error ${action}:`, err);
			alert(err.response?.data?.message || `Eroare la ${action}`);
		} finally {
			setActionLoading(null);
		}
	};

	const handleUpdateRole = async (memberId, role, permissions) => {
		setActionLoading(memberId);
		try {
			await adminService.updateRoleAndPermissions(memberId, role, permissions);
			await fetchTeamMembers();
			setShowRoleModal(false);
			setSelectedMember(null);
			alert('Rol și permisiuni actualizate cu succes!');
		} catch (err) {
			console.error('Error updating role:', err);
			alert(err.response?.data?.message || 'Eroare la actualizarea rolului');
		} finally {
			setActionLoading(null);
		}
	};

	const handleAssignCourses = async (memberId, courseIds) => {
		setActionLoading(memberId);
		try {
			await adminService.assignCourses(memberId, courseIds);
			await fetchTeamMembers();
			setShowCoursesModal(false);
			setSelectedMember(null);
			alert('Cursuri atribuite cu succes!');
		} catch (err) {
			console.error('Error assigning courses:', err);
			alert(err.response?.data?.message || 'Eroare la atribuirea cursurilor');
		} finally {
			setActionLoading(null);
		}
	};

	if (loading) {
		return null;
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Membri Echipă</h1>
					<p className="va-muted admin-page-subtitle">
						Gestionează membrii echipei interne: admini, manageri și instructori
					</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => navigate('/admin/users')}
				>
					+ Adaugă Membru
				</button>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{/* Filters */}
			<div style={{ 
				display: 'flex', 
				gap: '1rem', 
				marginBottom: '1.5rem',
				flexWrap: 'wrap',
				alignItems: 'center',
			}}>
				<input
					type="text"
					placeholder="Caută după nume sau email..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					style={{
						padding: '0.75rem 1rem',
						background: 'var(--va-surface-2)',
						border: '1px solid var(--va-border)',
						borderRadius: '8px',
						color: 'var(--va-text)',
						fontSize: '0.9rem',
						minWidth: '300px',
						flex: 1,
					}}
				/>
				<select
					value={filters.role}
					onChange={(e) => setFilters({ ...filters, role: e.target.value })}
					style={{
						padding: '0.75rem 1rem',
						background: 'var(--va-surface-2)',
						border: '1px solid var(--va-border)',
						borderRadius: '8px',
						color: 'var(--va-text)',
						fontSize: '0.9rem',
					}}
				>
					<option value="all">Toate rolurile</option>
					<option value="admin">Admin</option>
					<option value="manager">Manager</option>
					<option value="instructor">Instructor</option>
					<option value="teacher">Instructor (Teacher)</option>
				</select>
				<select
					value={filters.status}
					onChange={(e) => setFilters({ ...filters, status: e.target.value })}
					style={{
						padding: '0.75rem 1rem',
						background: 'var(--va-surface-2)',
						border: '1px solid var(--va-border)',
						borderRadius: '8px',
						color: 'var(--va-text)',
						fontSize: '0.9rem',
					}}
				>
					<option value="all">Toate statusurile</option>
					<option value="active">Activ</option>
					<option value="suspended">Suspendat</option>
				</select>
			</div>

			{/* Members List */}
			{members.length > 0 ? (
				<div style={{ display: 'grid', gap: '1rem' }}>
					{members.map((member) => {
						const statusBadge = getStatusBadge(member.status);
						const roleColor = getRoleColor(member.role);
						
						return (
							<div
								key={member.id}
								className="va-card"
								style={{
									cursor: 'pointer',
									transition: 'all 0.3s ease',
									position: 'relative',
								}}
								onClick={() => navigate(`/admin/users/${member.id}`)}
								onMouseEnter={(e) => {
									e.currentTarget.style.transform = 'translateY(-2px)';
									e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = 'none';
								}}
							>
								<div className="va-card-body" style={{ padding: '1.5rem' }}>
									<div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
										{/* Avatar */}
										<div style={{
											width: '64px',
											height: '64px',
											borderRadius: '50%',
											background: `linear-gradient(135deg, ${roleColor}, ${roleColor}dd)`,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontSize: '1.5rem',
											fontWeight: 'bold',
											color: '#fff',
											flexShrink: 0,
										}}>
											{member.avatar ? (
												<img 
													src={member.avatar} 
													alt={member.name}
													style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
												/>
											) : (
												(member.name?.charAt(0) || 'U').toUpperCase()
											)}
										</div>

										{/* Member Info */}
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
												<div>
													<h3 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
														{member.name}
													</h3>
													<p style={{ margin: 0, color: 'var(--va-muted)', fontSize: '0.9rem' }}>
														{member.email}
													</p>
												</div>
												<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
													<span style={{
														padding: '0.25rem 0.75rem',
														borderRadius: '12px',
														fontSize: '0.75rem',
														fontWeight: 'bold',
														background: roleColor,
														color: '#fff',
													}}>
														{getRoleLabel(member.role)}
													</span>
													<span style={{
														padding: '0.25rem 0.75rem',
														borderRadius: '12px',
														fontSize: '0.75rem',
														fontWeight: 'bold',
														background: statusBadge.color,
														color: '#fff',
													}}>
														{statusBadge.label}
													</span>
												</div>
											</div>

											{/* Additional Info */}
											<div style={{ 
												display: 'grid', 
												gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
												gap: '1rem',
												marginTop: '1rem',
												fontSize: '0.85rem',
												color: 'var(--va-muted)',
											}}>
												<div>
													<strong style={{ color: 'var(--va-text)' }}>Cursuri asignate:</strong>{' '}
													{member.assigned_courses_count || 0}
												</div>
												<div>
													<strong style={{ color: 'var(--va-text)' }}>Ultima autentificare:</strong>{' '}
													{formatDate(member.last_login_at)}
												</div>
												{member.recent_activity && member.recent_activity.length > 0 && (
													<div>
														<strong style={{ color: 'var(--va-text)' }}>Activitate recentă:</strong>{' '}
														{member.recent_activity.map((act, idx) => (
															<span key={idx}>
																{act.count} {act.label}
																{idx < member.recent_activity.length - 1 ? ', ' : ''}
															</span>
														))}
													</div>
												)}
											</div>
										</div>

										{/* Quick Actions */}
										<div 
											style={{ 
												display: 'flex', 
												gap: '0.5rem',
												flexDirection: 'column',
												flexShrink: 0,
											}}
											onClick={(e) => e.stopPropagation()}
										>
											<button
												className="va-btn va-btn-sm"
												onClick={() => {
													setSelectedMember(member);
													setShowRoleModal(true);
												}}
												disabled={actionLoading === member.id}
												style={{ 
													background: '#3b82f6',
													color: '#fff',
													whiteSpace: 'nowrap',
												}}
											>
												✏️ Rol & Permisiuni
											</button>
											<button
												className="va-btn va-btn-sm"
												onClick={() => {
													setSelectedMember(member);
													setShowCoursesModal(true);
												}}
												disabled={actionLoading === member.id}
												style={{ 
													background: '#10b981',
													color: '#fff',
													whiteSpace: 'nowrap',
												}}
											>
												📚 Cursuri
											</button>
											{member.status === 'suspended' ? (
												<button
													className="va-btn va-btn-sm"
													onClick={() => handleQuickAction(member.id, 'activate')}
													disabled={actionLoading === member.id}
													style={{ 
														background: '#10b981',
														color: '#fff',
														whiteSpace: 'nowrap',
													}}
												>
													✓ Activează
												</button>
											) : (
												<button
													className="va-btn va-btn-sm"
													onClick={() => {
														setSelectedMember(member);
														setShowSuspendModal(true);
													}}
													disabled={actionLoading === member.id}
													style={{ 
														background: '#f97316',
														color: '#fff',
														whiteSpace: 'nowrap',
													}}
												>
													⏸️ Suspendă
												</button>
											)}
											<button
												className="va-btn va-btn-sm"
												onClick={() => handleQuickAction(member.id, 'resetAccess')}
												disabled={actionLoading === member.id}
												style={{ 
													background: '#8b5cf6',
													color: '#fff',
													whiteSpace: 'nowrap',
												}}
											>
												🔑 Reset Acces
											</button>
											<button
												className="va-btn va-btn-sm"
												onClick={() => {
													if (confirm('Sigur dorești să elimini acest membru din echipă?')) {
														handleQuickAction(member.id, 'removeFromTeam');
													}
												}}
												disabled={actionLoading === member.id}
												style={{ 
													background: '#ef4444',
													color: '#fff',
													whiteSpace: 'nowrap',
												}}
											>
												🗑️ Elimină
											</button>
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body">
						<div style={{ textAlign: 'center', padding: '3rem' }}>
							<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
							<h3 style={{ marginBottom: '0.5rem' }}>Nu există membri</h3>
							<p style={{ color: 'var(--va-muted)' }}>
								Nu există membri ai echipei care să corespundă filtrelor selectate.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Role & Permissions Modal */}
			{showRoleModal && selectedMember && (
				<RolePermissionsModal
					member={selectedMember}
					onClose={() => {
						setShowRoleModal(false);
						setSelectedMember(null);
					}}
					onSave={handleUpdateRole}
					loading={actionLoading === selectedMember.id}
				/>
			)}

			{/* Courses Assignment Modal */}
			{showCoursesModal && selectedMember && (
				<CoursesAssignmentModal
					member={selectedMember}
					courses={courses}
					onClose={() => {
						setShowCoursesModal(false);
						setSelectedMember(null);
					}}
					onSave={handleAssignCourses}
					loading={actionLoading === selectedMember.id}
				/>
			)}

			{/* Suspend Modal */}
			{showSuspendModal && selectedMember && (
				<SuspendModal
					member={selectedMember}
					onClose={() => {
						setShowSuspendModal(false);
						setSelectedMember(null);
					}}
					onSave={(reason, suspendedUntil) => handleQuickAction(selectedMember.id, 'suspend', { reason, suspendedUntil })}
					loading={actionLoading === selectedMember.id}
				/>
			)}
		</div>
	);
};

// Role & Permissions Modal Component
const RolePermissionsModal = ({ member, onClose, onSave, loading }) => {
	const [role, setRole] = useState(member.role || 'instructor');
	const [permissions, setPermissions] = useState(member.permissions || {});

	const defaultPermissions = {
		can_manage_courses: false,
		can_manage_users: false,
		can_manage_events: false,
		can_view_analytics: false,
		can_manage_settings: false,
	};

	const currentPermissions = { ...defaultPermissions, ...permissions };

	const handlePermissionChange = (key, value) => {
		setPermissions({ ...currentPermissions, [key]: value });
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		onSave(member.id, role, permissions);
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0,0,0,0.7)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		}}>
			<div className="va-card" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
				<div className="va-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h2>Editare Rol & Permisiuni - {member.name}</h2>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: '#fff',
							fontSize: '1.5rem',
							cursor: 'pointer',
						}}
					>
						×
					</button>
				</div>
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Rol</label>
							<select
								className="va-form-input"
								value={role}
								onChange={(e) => setRole(e.target.value)}
								required
							>
								<option value="admin">Admin</option>
								<option value="manager">Manager</option>
								<option value="instructor">Instructor</option>
								<option value="teacher">Teacher</option>
							</select>
						</div>

						<div className="va-form-group">
							<label className="va-form-label">Permisiuni</label>
							<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
								{Object.keys(defaultPermissions).map((key) => (
									<label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
										<input
											type="checkbox"
											checked={currentPermissions[key] || false}
											onChange={(e) => handlePermissionChange(key, e.target.checked)}
											style={{ width: '20px', height: '20px', cursor: 'pointer' }}
										/>
										<span style={{ textTransform: 'capitalize' }}>
											{key.replace(/_/g, ' ').replace(/can /g, '')}
										</span>
									</label>
								))}
							</div>
						</div>

						<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
							<button type="button" className="va-btn" onClick={onClose} disabled={loading}>
								Anulează
							</button>
							<button type="submit" className="va-btn va-btn-primary" disabled={loading}>
								{loading ? 'Se salvează...' : 'Salvează'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

// Courses Assignment Modal Component
const CoursesAssignmentModal = ({ member, courses, onClose, onSave, loading }) => {
	const [selectedCourseIds, setSelectedCourseIds] = useState(
		member.assignedCourses?.map(c => c.id) || []
	);

	const handleSubmit = (e) => {
		e.preventDefault();
		onSave(member.id, selectedCourseIds);
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0,0,0,0.7)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		}}>
			<div className="va-card" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
				<div className="va-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h2>Atribuie Cursuri - {member.name}</h2>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: '#fff',
							fontSize: '1.5rem',
							cursor: 'pointer',
						}}
					>
						×
					</button>
				</div>
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Selectează Cursuri</label>
							<div style={{ 
								maxHeight: '400px', 
								overflow: 'auto', 
								background: 'rgba(0,0,0,0.3)',
								border: '1px solid rgba(255,238,0,0.2)', 
								borderRadius: '12px', 
								padding: '1rem',
							}}>
								<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
									{courses.map((course) => (
										<label 
											key={course.id} 
											style={{ 
												display: 'flex', 
												alignItems: 'center', 
												gap: '0.75rem', 
												padding: '0.75rem',
												borderRadius: '8px',
												cursor: 'pointer',
												background: selectedCourseIds.includes(course.id) 
													? 'rgba(255,238,0,0.15)' 
													: 'transparent',
											}}
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
												style={{ width: '18px', height: '18px', cursor: 'pointer' }}
											/>
											<span style={{ fontWeight: 600 }}>
												{course.title}
											</span>
										</label>
									))}
								</div>
							</div>
						</div>
						<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
							<button type="button" className="va-btn" onClick={onClose} disabled={loading}>
								Anulează
							</button>
							<button type="submit" className="va-btn va-btn-primary" disabled={loading}>
								{loading ? 'Se salvează...' : 'Salvează'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

// Suspend Modal Component
const SuspendModal = ({ member, onClose, onSave, loading }) => {
	const [reason, setReason] = useState('');
	const [suspendedUntil, setSuspendedUntil] = useState('');

	const handleSubmit = (e) => {
		e.preventDefault();
		onSave(reason || null, suspendedUntil || null);
	};

	return (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: 'rgba(0,0,0,0.7)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		}}>
			<div className="va-card" style={{ width: '90%', maxWidth: '500px' }}>
				<div className="va-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h2>Suspendă Membru - {member.name}</h2>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: '#fff',
							fontSize: '1.5rem',
							cursor: 'pointer',
						}}
					>
						×
					</button>
				</div>
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Motiv (opțional)</label>
							<textarea
								className="va-form-input"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								rows={3}
								placeholder="Ex: Încălcare reguli platformă..."
							/>
						</div>
						<div className="va-form-group">
							<label className="va-form-label">Suspendat până la (opțional)</label>
							<input
								type="datetime-local"
								className="va-form-input"
								value={suspendedUntil}
								onChange={(e) => setSuspendedUntil(e.target.value)}
							/>
						</div>
						<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
							<button type="button" className="va-btn" onClick={onClose} disabled={loading}>
								Anulează
							</button>
							<button type="submit" className="va-btn" disabled={loading} style={{ background: '#f97316', color: '#fff' }}>
								{loading ? 'Se suspendă...' : 'Suspendă'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

export default AdminTeamMembersPage;

