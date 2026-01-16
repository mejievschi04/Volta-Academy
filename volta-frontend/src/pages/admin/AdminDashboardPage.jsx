import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AdminDashboardPage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				const data = await adminService.getDashboard({ period: '30d' });
				setDashboardData(data);
			} catch (err) {
				console.error('Eroare la încărcarea dashboard-ului:', err);
			} finally {
				setLoading(false);
			}
		};
		fetchDashboard();
	}, []);

	// Extract data from API response
	const kpis = dashboardData?.kpis || {};
	const chartData = dashboardData?.chart_data || [];
	const problematicCourses = dashboardData?.problematic_courses || [];
	const recentActivities = dashboardData?.recent_activities || [];
	const alerts = dashboardData?.alerts || [];

	// Calculate stats
	const totalUsers = kpis.total_users?.value || kpis.total_users || '0';
	const activeUsers = kpis.active_users?.value || '0';
	const totalCourses = kpis.total_courses?.value || kpis.total_courses || '0';
	const completionRate = kpis.completion_rate?.value || '0%';
	const dropoffRate = kpis.dropoff_rate?.value || kpis.dropoff_rate || '0%';
	const engagement = kpis.engagement?.value || '0%';
	
	const totalUsersNum = parseInt(totalUsers.toString().replace(/,/g, '')) || 0;
	const completionRateNum = parseFloat(completionRate.toString().replace('%', '')) || 0;
	const dropoffRateNum = parseFloat(dropoffRate.toString().replace('%', '')) || 0;
	const engagementNum = parseFloat(engagement.toString().replace('%', '')) || 0;
	const activeUsersNum = parseInt(activeUsers.toString().replace(/,/g, '')) || 0;
	const totalCoursesNum = parseInt(totalCourses.toString().replace(/,/g, '')) || 0;

	// Previous period for trends
	const previousPeriod = {
		completionRate: completionRateNum * 0.95,
		engagement: engagementNum * 0.92,
		activeUsers: activeUsersNum * 0.97
	};

	// System Health
	const calculateSystemHealth = () => {
		let status = 'healthy';
		let statusText = 'Sănătos';
		let statusColor = '#10B981';
		const issues = [];

		if (completionRateNum < 50) {
			status = 'critical';
			statusText = 'Critic';
			statusColor = '#EF4444';
			issues.push('Rata de completare scăzută');
		} else if (completionRateNum < 70) {
			status = 'needs_attention';
			statusText = 'Necesită Atenție';
			statusColor = '#F59E0B';
			issues.push('Rata de completare sub țintă');
		}

		if (engagementNum < 40) {
			if (status === 'healthy') {
				status = 'needs_attention';
				statusText = 'Necesită Atenție';
				statusColor = '#F59E0B';
			}
			issues.push('Implicare scăzută');
		}

		if (problematicCourses.length > 3) {
			if (status === 'healthy') {
				status = 'needs_attention';
				statusText = 'Necesită Atenție';
				statusColor = '#F59E0B';
			}
			issues.push(`${problematicCourses.length} cursuri cu probleme`);
		}

		return { status, statusText, statusColor, issues };
	};

	const systemHealth = calculateSystemHealth();

	// Engagement Metrics
	const engagementMetrics = dashboardData?.engagement_metrics || {
		dau: Math.floor(activeUsersNum * 0.3),
		wau: Math.floor(activeUsersNum * 0.7),
		mau: activeUsersNum,
		avgSessionTime: 42,
		sessionsPerUser: 3.2,
		satisfactionScore: 4.2
	};

	if (loading) {
		return (
			<div className="lms-dashboard">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă dashboard-ul...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="lms-dashboard">
			{/* 1. Health Status Banner */}
			<HealthStatusBanner 
				health={systemHealth}
				completionRate={completionRate}
				engagement={engagement}
				activeLearners={activeUsersNum}
				onViewIssues={() => navigate('/admin/courses')}
				onViewAI={() => navigate('/admin/analytics')}
			/>

			{/* 2. KPI Row - Compact */}
			<div className="lms-kpi-row">
				<KPICard 
					label="Utilizatori Activi"
					value={`${engagementMetrics.dau.toLocaleString()} / ${engagementMetrics.wau.toLocaleString()}`}
					subLabel="Zilnic / Săptămânal"
					trend={activeUsersNum > previousPeriod.activeUsers ? 'up' : 'down'}
					tooltip="Utilizatori activi zilnic și săptămânal"
				/>
				<KPICard 
					label="Cursuri Active"
					value={totalCoursesNum.toLocaleString()}
					trend="neutral"
					tooltip="Numărul total de cursuri active"
				/>
				<KPICard 
					label="Rata Completare"
					value={completionRate}
					trend={completionRateNum > previousPeriod.completionRate ? 'up' : 'down'}
					tooltip="Rata medie de completare a cursurilor"
				/>
				<KPICard 
					label="Timp Mediu / Sesiune"
					value={`${engagementMetrics.avgSessionTime} min`}
					trend="neutral"
					tooltip="Timpul mediu petrecut într-o sesiune"
				/>
				<KPICard 
					label="Scor Satisfacție"
					value={engagementMetrics.satisfactionScore?.toFixed(1) || '4.2'}
					subLabel="/ 5.0"
					trend="up"
					tooltip="Scorul mediu de satisfacție al cursanților"
				/>
			</div>

			{/* 3. Courses Requiring Attention */}
			<div className="lms-courses-section">
				<div className="lms-section-header">
					<div>
						<h2 className="lms-section-title">Cursuri Care Necesită Atenție</h2>
						<p className="lms-section-subtitle">Cursuri care necesită intervenție</p>
					</div>
					<div style={{ display: 'flex', gap: 'var(--space-3)' }}>
						<button 
							className="lms-btn-primary"
							onClick={() => navigate('/admin/analytics')}
						>
							Analiză Avansată
						</button>
						<button 
							className="lms-btn-secondary"
							onClick={() => navigate('/admin/courses')}
						>
							Vezi toate cursurile
						</button>
					</div>
				</div>
				{problematicCourses.length > 0 ? (
					<CoursesAttentionTable courses={problematicCourses} navigate={navigate} />
				) : (
					<PremiumEmptyState 
						title="Toate cursurile au performanță bună"
						description="Nu există cursuri care necesită atenție imediată"
						suggestions={[
							'Revizuiește cursurile cu rating scăzut',
							'Analizează feedback-ul cursanților',
							'Optimizează conținutul pentru îmbunătățirea continuă'
						]}
					/>
				)}
			</div>

			{/* 4. Quick Actions - Sticky */}
			<div className="lms-quick-actions">
				<button className="lms-quick-action-btn" onClick={() => navigate('/admin/courses/new')}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M12 5v14M5 12h14"/>
					</svg>
					Creează Curs
				</button>
				<button className="lms-quick-action-btn" onClick={() => navigate('/admin/users')}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
						<circle cx="9" cy="7" r="4"/>
						<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
					</svg>
					Invită Instructor
				</button>
				<button className="lms-quick-action-btn" onClick={() => navigate('/admin/analytics')}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M12 2L2 7l10 5 10-5-10-5z"/>
						<path d="M2 17l10 5 10-5"/>
						<path d="M2 12l10 5 10-5"/>
					</svg>
					Analiză Avansată
				</button>
			</div>
		</div>
	);
};

// Component: Health Status Banner
const HealthStatusBanner = ({ health, completionRate, engagement, activeLearners, onViewIssues, onViewAI }) => {
	return (
		<div className="lms-health-banner" style={{ borderLeftColor: health.statusColor }}>
			<div className="lms-health-content">
				<div className="lms-health-status">
					<div className="lms-health-indicator" style={{ backgroundColor: health.statusColor }}></div>
					<div>
						<h2 className="lms-health-title">Status Sistem: {health.statusText}</h2>
						<div className="lms-health-metrics">
							<span className="lms-health-metric">Completare: {completionRate}</span>
							<span className="lms-health-metric">Implicare: {engagement}</span>
							<span className="lms-health-metric">Cursanți Activi (7 zile): {activeLearners.toLocaleString()}</span>
						</div>
					</div>
				</div>
				<div className="lms-health-actions">
					{health.issues.length > 0 && (
						<button className="lms-btn-primary" onClick={onViewIssues}>
							Vezi problemele
						</button>
					)}
					<button className="lms-btn-secondary" onClick={onViewAI}>
						Aplică recomandări AI
					</button>
				</div>
			</div>
		</div>
	);
};

// Component: KPI Card
const KPICard = ({ label, value, subLabel, trend, tooltip }) => {
	return (
		<div className="lms-kpi-card" title={tooltip}>
			<div className="lms-kpi-label">{label}</div>
			<div className="lms-kpi-value-row">
				<div className="lms-kpi-value">{value}</div>
				{subLabel && <div className="lms-kpi-sublabel">{subLabel}</div>}
				{trend !== 'neutral' && (
					<div className={`lms-kpi-trend lms-trend-${trend}`}>
						{trend === 'up' ? '↑' : '↓'}
					</div>
				)}
			</div>
		</div>
	);
};


// Component: Courses Attention Table
const CoursesAttentionTable = ({ courses, navigate }) => {
	return (
		<div className="lms-table-container">
			<table className="lms-table">
				<thead>
					<tr>
						<th>Nume Curs</th>
						<th>Status</th>
						<th>Rata Completare</th>
						<th>Implicare</th>
						<th>Motiv</th>
						<th>Acțiune</th>
					</tr>
				</thead>
				<tbody>
					{courses.map((course) => {
						const completionRate = course.completion_rate || 0;
						const dropoffRate = course.dropoff_rate || 0;
						const reason = completionRate < 30 
							? 'Rata de completare scăzută'
							: dropoffRate > 50 
							? 'Rata de abandon ridicată'
							: 'Implicare scăzută';

						return (
							<tr key={course.id}>
								<td>
									<div className="lms-table-course">
										<span className="lms-table-course-name">{course.title || course.name}</span>
									</div>
								</td>
								<td>
									<span className="lms-status-badge lms-status-warning">Necesită Atenție</span>
								</td>
								<td>{completionRate.toFixed(0)}%</td>
								<td>{course.engagement || 'N/A'}</td>
								<td>{reason}</td>
								<td>
									<button 
										className="lms-btn-link"
										onClick={() => navigate(`/admin/courses/${course.id}`)}
									>
										Vezi
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

// Component: Premium Empty State
const PremiumEmptyState = ({ title, description, suggestions }) => {
	return (
		<div className="lms-empty-state">
			<div className="lms-empty-icon">✨</div>
			<h3 className="lms-empty-title">{title}</h3>
			<p className="lms-empty-description">{description}</p>
			{suggestions && suggestions.length > 0 && (
				<div className="lms-empty-suggestions">
					<p className="lms-empty-suggestions-title">Îmbunătățiri proactive:</p>
					<ul>
						{suggestions.map((suggestion, index) => (
							<li key={index}>{suggestion}</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};


export default AdminDashboardPage;
