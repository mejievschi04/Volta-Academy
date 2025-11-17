import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';
import '../../styles/modern-enhancements.css';

const AdminDashboardPage = () => {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				setLoading(true);
				const data = await adminService.getDashboard();
				setStats(data);
			} catch (err) {
				console.error('Error fetching admin dashboard:', err);
				setError('Nu s-au putut încărca statisticile');
			} finally {
				setLoading(false);
			}
		};
		fetchStats();
	}, []);

	if (loading) {
		return (
			<div className="admin-container fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
				</div>
				<div className="admin-stats-grid">
					{[1, 2, 3, 4, 5, 6].map(i => (
						<div key={i} className="skeleton-card">
							<div className="skeleton skeleton-text" style={{ height: '2rem', marginBottom: '1rem' }}></div>
							<div className="skeleton skeleton-text" style={{ height: '3rem', marginBottom: '0.5rem' }}></div>
							<div className="skeleton skeleton-text" style={{ width: '70%' }}></div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error || !stats) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Eroare la încărcarea dashboard-ului'}</p>
			</div>
		);
	}

	const statCards = [
		{ 
			label: 'Cursuri Disponibile', 
			value: stats.available_courses || 0, 
			icon: '📚'
		},
		{ 
			label: 'Cursuri Finalizate', 
			value: stats.completed_courses || 0, 
			icon: '✅'
		},
		{ 
			label: 'Utilizatori', 
			value: stats.total_users || 0, 
			icon: '👥'
		},
		{ 
			label: 'Evenimente', 
			value: stats.total_events || 0, 
			icon: '📅'
		},
		{ 
			label: 'Echipe', 
			value: stats.total_teams || 0, 
			icon: '👥'
		},
		{ 
			label: '% Realizare Curs', 
			value: `${stats.average_completion || 0}%`, 
			icon: '📊'
		},
	];

	return (
		<div className="admin-container fade-in">
			<div className="fade-in-up" style={{ marginBottom: '2.5rem' }}>
				<h1 className="va-page-title gradient-text" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>
					Panou de Administrare
				</h1>
				<p className="va-muted" style={{ fontSize: '1.1rem' }}>Bine ai revenit în panoul de administrare V Academy</p>
			</div>

			{/* Statistics Grid */}
			<div className="admin-stats-grid">
				{statCards.map((stat, index) => (
					<div
						key={index}
						className="admin-stat-card stagger-item"
					>
						<div className="admin-stat-icon">{stat.icon}</div>
						<div className="admin-stat-value">{stat.value}</div>
						<div className="admin-stat-label">{stat.label}</div>
					</div>
				))}
			</div>

			{/* Recent Activity Grid */}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
				<div className="va-card-enhanced admin-activity-card slide-in-right">
					<div className="admin-activity-header">
						<h2>📚 Cursuri Recente</h2>
					</div>
					<div className="admin-activity-body">
						{stats.recent_courses && stats.recent_courses.length > 0 ? (
							<div className="va-stack" style={{ gap: '0.75rem' }}>
								{stats.recent_courses.map((course, idx) => (
									<div 
										key={course.id} 
										className="admin-activity-item stagger-item"
										style={{ animationDelay: `${idx * 0.1}s` }}
									>
										<div style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '1rem' }}>{course.title}</div>
										<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
											👤 {course.teacher?.name || 'N/A'} • 📚 {course.lessons?.length || 0} lecții
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="empty-state">
								<div className="empty-state-icon">📚</div>
								<div className="empty-state-title">Nu există cursuri</div>
								<div className="empty-state-description">Cursurile recente vor apărea aici</div>
							</div>
						)}
					</div>
				</div>

				<div className="va-card-enhanced admin-activity-card slide-in-right" style={{ animationDelay: '0.2s' }}>
					<div className="admin-activity-header">
						<h2>👥 Utilizatori Recenti</h2>
					</div>
					<div className="admin-activity-body">
						{stats.recent_users && stats.recent_users.length > 0 ? (
							<div className="va-stack" style={{ gap: '0.75rem' }}>
								{stats.recent_users.map((user, idx) => (
									<div 
										key={user.id} 
										className="admin-activity-item stagger-item"
										style={{ animationDelay: `${idx * 0.1}s` }}
									>
										<div style={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '1rem' }}>{user.name}</div>
										<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
											📧 {user.email} • 🎭 {user.role === 'admin' ? 'Administrator' : user.role === 'teacher' ? 'Profesor' : 'Student'}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="empty-state">
								<div className="empty-state-icon">👥</div>
								<div className="empty-state-title">Nu există utilizatori</div>
								<div className="empty-state-description">Utilizatorii recenti vor apărea aici</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default AdminDashboardPage;

