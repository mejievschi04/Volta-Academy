import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import BuildCourseModal from '../../components/admin/courses/BuildCourseModal';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [showBuildModal, setShowBuildModal] = useState(false);
	const [creatingCourse, setCreatingCourse] = useState(false);

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				const data = await adminService.getDashboard({ period: '30d' });
				console.log('Dashboard data:', data); // Debug log
				console.log('KPIs:', data?.kpis); // Debug log
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

	// Calculate stats
	const totalUsers = kpis.total_users?.value || kpis.total_users || '0';
	const activeUsers = kpis.active_users?.value || '0';
	const totalCourses = kpis.total_courses?.value || kpis.total_courses || '0';
	const completionRate = kpis.completion_rate?.value || '0%';
	const engagement = kpis.engagement?.value || '0%';
	
	console.log('Total Users raw:', totalUsers); // Debug log
	console.log('KPIs total_users:', kpis.total_users); // Debug log
	
	const totalUsersNum = parseInt(totalUsers.toString().replace(/,/g, '')) || 0;
	const completionRateNum = parseFloat(completionRate.toString().replace('%', '')) || 0;
	const engagementNum = parseFloat(engagement.toString().replace('%', '')) || 0;
	const activeUsersNum = parseInt(activeUsers.toString().replace(/,/g, '')) || 0;
	const totalCoursesNum = parseInt(totalCourses.toString().replace(/,/g, '')) || 0;
	
	console.log('Total Users parsed:', totalUsersNum); // Debug log

	// Engagement Metrics (avg test completion % across students)
	const avgTestCompletionPct = dashboardData?.engagement_metrics?.avg_test_completion_percentage ?? 0;

	if (loading) {
		return (
			<div className="admin-dashboard-page">
				<div className="admin-dashboard-loading">
					<div className="admin-dashboard-spinner"></div>
					<p>Se încarcă dashboard-ul...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-dashboard-page">
			{/* Header */}
			<div className="admin-dashboard-header">
				<div className="admin-dashboard-header-content">
					<div>
						<h1 className="admin-dashboard-title">Panou Admin</h1>
						<p className="admin-dashboard-subtitle">
							Vizualizare generală a platformei de învățare
						</p>
					</div>
					<div className="admin-dashboard-header-actions">
						<button 
							className="admin-dashboard-btn admin-dashboard-btn-primary"
							onClick={() => setShowBuildModal(true)}
						>
							<span className="admin-dashboard-btn-icon">+</span>
							Build Curs
						</button>
						<button 
							className="admin-dashboard-btn admin-dashboard-btn-secondary"
							onClick={() => navigate('/admin/analytics')}
						>
							Analiză Avansată
						</button>
					</div>
				</div>
			</div>

			{/* KPI Cards */}
			<div className="admin-dashboard-kpis">
				<div className="admin-dashboard-kpi-card">
					<div className="admin-dashboard-kpi-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
							<circle cx="9" cy="7" r="4"/>
							<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
						</svg>
					</div>
					<div className="admin-dashboard-kpi-content">
						<div className="admin-dashboard-kpi-label">Utilizatori Totali</div>
						<div className="admin-dashboard-kpi-value">{totalUsersNum.toLocaleString()}</div>
						<div className="admin-dashboard-kpi-sublabel">Utilizatori activi: {activeUsersNum.toLocaleString()}</div>
					</div>
				</div>

				<div className="admin-dashboard-kpi-card">
					<div className="admin-dashboard-kpi-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
							<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
						</svg>
					</div>
					<div className="admin-dashboard-kpi-content">
						<div className="admin-dashboard-kpi-label">Cursuri Active</div>
						<div className="admin-dashboard-kpi-value">{totalCoursesNum.toLocaleString()}</div>
						<div className="admin-dashboard-kpi-sublabel">Cursuri publicate</div>
					</div>
				</div>

				<div className="admin-dashboard-kpi-card">
					<div className="admin-dashboard-kpi-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					</div>
					<div className="admin-dashboard-kpi-content">
						<div className="admin-dashboard-kpi-label">Rata Completare</div>
						<div className="admin-dashboard-kpi-value">{completionRate}</div>
						<div className="admin-dashboard-kpi-sublabel">Medie generală</div>
					</div>
				</div>

				<div className="admin-dashboard-kpi-card">
					<div className="admin-dashboard-kpi-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="18" y1="20" x2="18" y2="10"/>
							<line x1="12" y1="20" x2="12" y2="4"/>
							<line x1="6" y1="20" x2="6" y2="14"/>
						</svg>
					</div>
					<div className="admin-dashboard-kpi-content">
						<div className="admin-dashboard-kpi-label">Implicare</div>
						<div className="admin-dashboard-kpi-value">{engagement}</div>
						<div className="admin-dashboard-kpi-sublabel">Ultimele 30 zile</div>
					</div>
				</div>

				<div className="admin-dashboard-kpi-card">
					<div className="admin-dashboard-kpi-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
							<polyline points="14 2 14 8 20 8"/>
							<line x1="16" y1="13" x2="8" y2="13"/>
							<line x1="16" y1="17" x2="8" y2="17"/>
							<polyline points="10 9 9 9 8 9"/>
						</svg>
					</div>
					<div className="admin-dashboard-kpi-content">
						<div className="admin-dashboard-kpi-label">Procent realizare teste</div>
						<div className="admin-dashboard-kpi-value">{avgTestCompletionPct}%</div>
						<div className="admin-dashboard-kpi-sublabel">Medie pe studenți</div>
					</div>
				</div>
			</div>

			{/* Main Content Grid */}
			<div className="admin-dashboard-grid">
				{/* Left Column - Courses Requiring Attention */}
				<div className="admin-dashboard-main">
					<div className="admin-dashboard-section">
						<div className="admin-dashboard-section-header">
							<div>
								<h2 className="admin-dashboard-section-title">Cursuri Care Necesită Atenție</h2>
								<p className="admin-dashboard-section-subtitle">
									{problematicCourses.length} cursuri necesită intervenție
								</p>
							</div>
							<button 
								className="admin-dashboard-btn admin-dashboard-btn-link"
								onClick={() => navigate('/admin/courses')}
							>
								Vezi toate →
							</button>
						</div>

						{problematicCourses.length > 0 ? (
							<div className="admin-dashboard-courses-list">
								{problematicCourses.slice(0, 5).map((course) => {
									const completionRate = course.completion_rate || 0;
									const dropoffRate = course.dropoff_rate || 0;
									const reason = completionRate < 30 
										? 'Rata de completare scăzută'
										: dropoffRate > 50 
										? 'Rata de abandon ridicată'
										: 'Implicare scăzută';

									return (
										<div key={course.id} className="admin-dashboard-course-item">
											<div className="admin-dashboard-course-info">
												<h3 className="admin-dashboard-course-title">
													{course.title || course.name}
												</h3>
												<p className="admin-dashboard-course-reason">{reason}</p>
												<div className="admin-dashboard-course-metrics">
													<span className="admin-dashboard-course-metric">
														Completare: {completionRate.toFixed(0)}%
													</span>
													<span className="admin-dashboard-course-metric">
														Abandon: {dropoffRate.toFixed(0)}%
													</span>
												</div>
											</div>
											<button 
												className="admin-dashboard-btn admin-dashboard-btn-sm"
												onClick={() => navigate(`/admin/courses/${course.id}`)}
											>
												Vezi detalii
											</button>
										</div>
									);
								})}
							</div>
						) : (
							<div className="admin-dashboard-empty">
								<div className="admin-dashboard-empty-icon">
									<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M12 2L2 7l10 5 10-5-10-5z"/>
										<path d="M2 17l10 5 10-5"/>
										<path d="M2 12l10 5 10-5"/>
									</svg>
								</div>
								<h3 className="admin-dashboard-empty-title">Toate cursurile au performanță bună</h3>
								<p className="admin-dashboard-empty-description">
									Nu există cursuri care necesită atenție imediată
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Right Column - Quick Actions & Recent Activity */}
				<div className="admin-dashboard-sidebar">
					{/* Quick Actions */}
					<div className="admin-dashboard-section">
						<div className="admin-dashboard-section-header">
							<h2 className="admin-dashboard-section-title">Acțiuni Rapide</h2>
						</div>
						<div className="admin-dashboard-quick-actions">
							<button 
								className="admin-dashboard-quick-action"
								onClick={() => navigate('/admin/courses')}
							>
								<span className="admin-dashboard-quick-action-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
										<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
									</svg>
								</span>
								<span className="admin-dashboard-quick-action-label">Gestionează Cursuri</span>
							</button>
							<button 
								className="admin-dashboard-quick-action"
								onClick={() => navigate('/admin/users')}
							>
								<span className="admin-dashboard-quick-action-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
										<circle cx="9" cy="7" r="4"/>
										<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
									</svg>
								</span>
								<span className="admin-dashboard-quick-action-label">Gestionează Utilizatori</span>
							</button>
							<button 
								className="admin-dashboard-quick-action"
								onClick={() => navigate('/admin/tests')}
							>
								<span className="admin-dashboard-quick-action-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
										<polyline points="14 2 14 8 20 8"/>
										<line x1="16" y1="13" x2="8" y2="13"/>
										<line x1="16" y1="17" x2="8" y2="17"/>
										<polyline points="10 9 9 9 8 9"/>
									</svg>
								</span>
								<span className="admin-dashboard-quick-action-label">Gestionează Teste</span>
							</button>
							<button 
								className="admin-dashboard-quick-action"
								onClick={() => navigate('/admin/events')}
							>
								<span className="admin-dashboard-quick-action-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
										<line x1="16" y1="2" x2="16" y2="6"/>
										<line x1="8" y1="2" x2="8" y2="6"/>
										<line x1="3" y1="10" x2="21" y2="10"/>
									</svg>
								</span>
								<span className="admin-dashboard-quick-action-label">Gestionează Evenimente</span>
							</button>
							<button 
								className="admin-dashboard-quick-action"
								onClick={() => navigate('/admin/analytics')}
							>
								<span className="admin-dashboard-quick-action-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<line x1="18" y1="20" x2="18" y2="10"/>
										<line x1="12" y1="20" x2="12" y2="4"/>
										<line x1="6" y1="20" x2="6" y2="14"/>
									</svg>
								</span>
								<span className="admin-dashboard-quick-action-label">Analiză Avansată</span>
							</button>
						</div>
					</div>

					{/* Recent Activity */}
					{recentActivities.length > 0 && (
						<div className="admin-dashboard-section">
							<div className="admin-dashboard-section-header">
								<h2 className="admin-dashboard-section-title">Activitate Recentă</h2>
							</div>
							<div className="admin-dashboard-activity-list">
								{recentActivities.slice(0, 5).map((activity, index) => (
									<div key={index} className="admin-dashboard-activity-item">
										<div className="admin-dashboard-activity-content">
											<p className="admin-dashboard-activity-text">{activity.description || activity.message || 'Activitate'}</p>
											<span className="admin-dashboard-activity-time">
												{activity.created_at ? new Date(activity.created_at).toLocaleDateString('ro-RO') : 'Acum'}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{showBuildModal && (
				<BuildCourseModal
					onClose={() => setShowBuildModal(false)}
					onSubmit={async ({ title, description, image }) => {
						setCreatingCourse(true);
						try {
							let payload;
							if (image) {
								const formData = new FormData();
								formData.append('title', title);
								formData.append('description', description);
								formData.append('status', 'draft');
								formData.append('image', image);
								payload = formData;
							} else {
								payload = { title, description, status: 'draft' };
							}
							const result = await adminService.createCourse(payload);
							const courseId = result?.course?.id;
							if (courseId) {
								setShowBuildModal(false);
								navigate(`/admin/courses/${courseId}/builder`);
							}
						} catch (err) {
							console.error('Error creating course:', err);
						} finally {
							setCreatingCourse(false);
						}
					}}
					loading={creatingCourse}
				/>
			)}
		</div>
	);
};

export default AdminDashboardPage;
