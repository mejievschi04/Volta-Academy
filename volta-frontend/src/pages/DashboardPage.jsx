import React, { useMemo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/api';
import '../styles/modern-enhancements.css';

const DashboardPage = () => {
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await dashboardService.getDashboard();
				console.log('Dashboard data received:', data);
				setDashboardData(data);
			} catch (err) {
				console.error('Error fetching dashboard:', err);
				console.error('Error details:', err.response?.data || err.message);
				setError(`Nu s-a putut încărca dashboard-ul: ${err.response?.data?.message || err.message || 'Eroare necunoscută'}`);
			} finally {
				setLoading(false);
			}
		};
		fetchDashboard();
	}, []);

	const stats = useMemo(() => {
		if (!dashboardData) {
			return {
				assignedCourses: 0,
				completedCourses: 0,
				completedLessons: 0,
				completedQuizzes: 0,
				progressPercentage: 0,
			};
		}
		return dashboardData.stats || {};
	}, [dashboardData]);

	if (loading) {
		return (
			<div className="va-main fade-in">
				<div className="skeleton-card" style={{ marginBottom: '2rem' }}>
					<div className="skeleton skeleton-title"></div>
					<div className="skeleton skeleton-text"></div>
					<div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
					{[1, 2, 3, 4].map(i => (
						<div key={i} className="skeleton-card">
							<div className="skeleton skeleton-text" style={{ height: '2rem', marginBottom: '1rem' }}></div>
							<div className="skeleton skeleton-text" style={{ height: '3rem', marginBottom: '0.5rem' }}></div>
							<div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error || !dashboardData) {
		return (
			<div className="va-main">
				<p style={{ color: 'red' }}>{error || 'Eroare la încărcarea datelor'}</p>
			</div>
		);
	}

	return (
		<div className="va-main fade-in">
			{/* HERO — o coloană completă */}
			<section className="va-hero fade-in-up" style={{ gridColumn: '1 / -1' }}>
				<div className="va-hero-background">
					<div className="va-hero-orb va-hero-orb-1"></div>
					<div className="va-hero-orb va-hero-orb-2"></div>
					<div className="va-hero-orb va-hero-orb-3"></div>
				</div>

				<div className="va-hero-content">
					<div className="va-hero-header">
						<div className="va-hero-badge">
							<span className="va-hero-badge-icon">✨</span>
							<span>Bine ai revenit, {dashboardData.user?.name || 'Utilizator'}!</span>
						</div>
						<h1 className="va-hero-title">
							<span className="va-hero-title-line">Învață.</span>
							<span className="va-hero-title-line">Exersează.</span>
							<span className="va-hero-title-line va-hero-title-accent">Evoluează.</span>
						</h1>
						<p className="va-hero-subtitle">
							Pornește pe un traseu structurat și urmărește-ți progresul în toate cursurile. Fiecare modul completat te aduce mai aproape de excelență.
						</p>
					</div>

					<div className="va-hero-stats">
						<div className="va-hero-stats-top">
							<div className="va-hero-stat">
								<div className="va-hero-stat-value">{stats.assignedCourses || 0}</div>
								<div className="va-hero-stat-label">Cursuri atribuite</div>
							</div>
							<div className="va-hero-stat">
								<div className="va-hero-stat-value">{stats.completedCourses || 0}</div>
								<div className="va-hero-stat-label">Cursuri finalizate</div>
							</div>
							<div className="va-hero-stat">
								<div className="va-hero-stat-value">{stats.completedQuizzes || 0}</div>
								<div className="va-hero-stat-label">Teste promovate</div>
							</div>
						</div>
						<div className="va-hero-stat va-hero-stat-progress">
							<div className="va-hero-stat-value">{stats.progressPercentage || 0}%</div>
							<div className="va-hero-stat-label">Progres general</div>
							<div className="va-hero-progress-bar">
								<div
									className="va-hero-progress-fill"
									style={{ width: `${stats.progressPercentage || 0}%` }}
								></div>
							</div>
						</div>
					</div>

					<div className="va-hero-actions">
						<Link to="/courses" className="va-btn va-btn-primary va-btn-hero">
							<span>Explorează cursurile</span>
							<span className="va-btn-icon">→</span>
						</Link>
						<Link to="/profile" className="va-btn va-btn-secondary va-btn-hero">
							<span>Vezi profilul</span>
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
};

export default DashboardPage;

