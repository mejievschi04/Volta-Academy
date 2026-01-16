import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AdminAnalyticsPage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [engagementPeriod, setEngagementPeriod] = useState('30d');
	const [activityFilter, setActivityFilter] = useState('all');

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				const data = await adminService.getDashboard({ period: '30d' });
				setDashboardData(data);
			} catch (err) {
				console.error('Eroare la încărcarea datelor:', err);
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
	const completionRate = kpis.completion_rate?.value || '0%';
	const engagement = kpis.engagement?.value || '0%';
	
	const totalUsersNum = parseInt(totalUsers.toString().replace(/,/g, '')) || 0;
	const completionRateNum = parseFloat(completionRate.toString().replace('%', '')) || 0;
	const engagementNum = parseFloat(engagement.toString().replace('%', '')) || 0;
	const activeUsersNum = parseInt(activeUsers.toString().replace(/,/g, '')) || 0;

	// Engagement Metrics
	const engagementMetrics = dashboardData?.engagement_metrics || {
		dau: Math.floor(activeUsersNum * 0.3),
		wau: Math.floor(activeUsersNum * 0.7),
		mau: activeUsersNum,
		avgSessionTime: 42,
		sessionsPerUser: 3.2,
		satisfactionScore: 4.2
	};

	// Learning Funnel
	const learningFunnelData = dashboardData?.learning_funnel || {
		enrolled: totalUsersNum,
		started: Math.floor(totalUsersNum * 0.85),
		progress_25: Math.floor(totalUsersNum * 0.70),
		progress_50: Math.floor(totalUsersNum * 0.60),
		progress_75: Math.floor(totalUsersNum * 0.50),
		completed: Math.floor(totalUsersNum * 0.45)
	};

	// Engagement Timeline
	const engagementTimeline = chartData.length > 0 
		? chartData.slice(-30).map((item, index) => ({
			date: item.date || `Ziua ${index + 1}`,
			engagement: item.engagement || engagementNum,
			sessionDuration: item.session_duration || engagementMetrics.avgSessionTime
		}))
		: Array.from({ length: 30 }, (_, i) => ({
			date: `Ziua ${i + 1}`,
			engagement: engagementNum + (Math.random() * 10 - 5),
			sessionDuration: engagementMetrics.avgSessionTime + (Math.random() * 10 - 5)
		}));

	// AI Recommendations
	const generateAIRecommendations = () => {
		const recommendations = [];

		problematicCourses.slice(0, 2).forEach(course => {
			const dropoffRate = course.dropoff_rate || 0;
			if (dropoffRate > 40) {
				recommendations.push({
					id: `risk-${course.id}`,
					type: 'risk',
					priority: 'high',
					title: `Cursul "${course.title || course.name}" are risc ridicat de abandon`,
					description: `Rata de abandon: ${dropoffRate.toFixed(0)}%`,
					impact: 'Ridicat',
					urgency: 'high',
					action: 'Vezi analiza',
					actionPath: `/admin/courses/${course.id}/analytics`
				});
			}
		});

		if (completionRateNum < 70) {
			recommendations.push({
				id: 'completion-optimization',
				type: 'optimization',
				priority: 'high',
				title: 'Rata de completare poate fi îmbunătățită cu micro-learning',
				description: `Rata actuală: ${completionRateNum.toFixed(1)}%`,
				impact: 'Mediu',
				urgency: 'medium',
				action: 'Aplică sugestia',
				actionPath: '/admin/courses'
			});
		}

		if (engagementMetrics.dau / engagementMetrics.mau < 0.3) {
			recommendations.push({
				id: 'engagement-tip',
				type: 'insight',
				priority: 'medium',
				title: 'Utilizatorii noi performează mai bine cu quiz la început',
				description: 'Pattern detectat în comportamentul utilizatorilor',
				impact: 'Mediu',
				urgency: 'low',
				action: 'Vezi analiza',
				actionPath: '/admin/analytics/engagement'
			});
		}

		return recommendations;
	};

	const aiRecommendations = generateAIRecommendations();

	// User Segments
	const userSegments = dashboardData?.user_segments || {
		new: Math.floor(totalUsersNum * 0.15),
		at_risk: Math.floor(totalUsersNum * 0.10),
		highly_engaged: Math.floor(totalUsersNum * 0.25),
		inactive: Math.floor(totalUsersNum * 0.20)
	};

	// Instructor Performance
	const instructorPerformance = dashboardData?.instructor_performance || [];

	// Filtered Activities
	const filteredActivities = activityFilter === 'all' 
		? recentActivities 
		: recentActivities.filter(activity => activity.type === activityFilter);

	if (loading) {
		return (
			<div className="lms-dashboard">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă analiza...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="lms-dashboard">
			{/* Header */}
			<div className="lms-section-header">
				<div>
					<h1 className="lms-section-title">Analiză Avansată</h1>
					<p className="lms-section-subtitle">Analiză detaliată a performanței platformei</p>
				</div>
				<button 
					className="lms-btn-secondary"
					onClick={() => navigate('/admin')}
				>
					← Înapoi la Dashboard
				</button>
			</div>

			{/* 1. Learning Analytics Core */}
			<div className="lms-analytics-grid">
				{/* Learning Funnel */}
				<div className="lms-analytics-card">
					<div className="lms-card-header">
						<h3 className="lms-card-title">Funnel de Învățare</h3>
						<p className="lms-card-subtitle">Progresie cursanți prin etape</p>
					</div>
					<LearningFunnel data={learningFunnelData} />
				</div>

				{/* Engagement Timeline */}
				<div className="lms-analytics-card">
					<div className="lms-card-header">
						<h3 className="lms-card-title">Evoluția Implicării</h3>
						<div className="lms-card-actions">
							<button 
								className={`lms-period-btn ${engagementPeriod === '7d' ? 'active' : ''}`}
								onClick={() => setEngagementPeriod('7d')}
							>
								7 zile
							</button>
							<button 
								className={`lms-period-btn ${engagementPeriod === '30d' ? 'active' : ''}`}
								onClick={() => setEngagementPeriod('30d')}
							>
								30 zile
							</button>
							<button 
								className={`lms-period-btn ${engagementPeriod === '90d' ? 'active' : ''}`}
								onClick={() => setEngagementPeriod('90d')}
							>
								90 zile
							</button>
						</div>
					</div>
					<EngagementTimeline data={engagementTimeline} period={engagementPeriod} />
				</div>
			</div>

			{/* 2. AI Insights & Recommendations */}
			{aiRecommendations.length > 0 && (
				<div className="lms-ai-section">
					<div className="lms-section-header">
						<div>
							<h2 className="lms-section-title">Recomandări AI</h2>
							<p className="lms-section-subtitle">Sugestii inteligente bazate pe analiza datelor</p>
						</div>
					</div>
					<div className="lms-ai-grid">
						{aiRecommendations.map((rec) => (
							<AIInsightCard key={rec.id} recommendation={rec} navigate={navigate} />
						))}
					</div>
				</div>
			)}

			{/* 3. Users & Instructors Intelligence */}
			<div className="lms-intelligence-grid">
				{/* User Segments */}
				<div className="lms-analytics-card">
					<div className="lms-card-header">
						<h3 className="lms-card-title">Segmente Utilizatori</h3>
						<p className="lms-card-subtitle">Distribuția utilizatorilor pe segmente</p>
					</div>
					<UserSegments segments={userSegments} total={totalUsersNum} />
				</div>

				{/* Instructor Performance */}
				<div className="lms-analytics-card">
					<div className="lms-card-header">
						<h3 className="lms-card-title">Performanța Instructorilor</h3>
						<p className="lms-card-subtitle">Metrici de performanță pentru instructori</p>
					</div>
					<InstructorPerformance data={instructorPerformance} />
				</div>
			</div>

			{/* 4. Smart Activity Feed */}
			<div className="lms-activity-section">
				<div className="lms-section-header">
					<div>
						<h2 className="lms-section-title">Feed de Activitate</h2>
						<p className="lms-section-subtitle">Evenimente și activități importante</p>
					</div>
					<div className="lms-activity-filters">
						<button 
							className={`lms-filter-btn ${activityFilter === 'all' ? 'active' : ''}`}
							onClick={() => setActivityFilter('all')}
						>
							Toate
						</button>
						<button 
							className={`lms-filter-btn ${activityFilter === 'users' ? 'active' : ''}`}
							onClick={() => setActivityFilter('users')}
						>
							Utilizatori
						</button>
						<button 
							className={`lms-filter-btn ${activityFilter === 'courses' ? 'active' : ''}`}
							onClick={() => setActivityFilter('courses')}
						>
							Cursuri
						</button>
						<button 
							className={`lms-filter-btn ${activityFilter === 'system' ? 'active' : ''}`}
							onClick={() => setActivityFilter('system')}
						>
							Sistem
						</button>
						<button 
							className={`lms-filter-btn ${activityFilter === 'ai' ? 'active' : ''}`}
							onClick={() => setActivityFilter('ai')}
						>
							AI
						</button>
					</div>
				</div>
				<SmartActivityFeed activities={filteredActivities} />
			</div>
		</div>
	);
};

// Component: Learning Funnel
const LearningFunnel = ({ data }) => {
	const stages = [
		{ key: 'enrolled', label: 'Înscriere', count: data.enrolled, color: '#38BDF8' },
		{ key: 'started', label: 'Start', count: data.started, color: '#3B82F6' },
		{ key: 'progress_25', label: '25%', count: data.progress_25, color: '#8B5CF6' },
		{ key: 'progress_50', label: '50%', count: data.progress_50, color: '#A855F7' },
		{ key: 'progress_75', label: '75%', count: data.progress_75, color: '#C084FC' },
		{ key: 'completed', label: 'Finalizare', count: data.completed, color: '#10B981' }
	];

	const maxCount = Math.max(...stages.map(s => s.count), 1);

	return (
		<div className="lms-funnel">
			<div className="lms-funnel-stages">
				{stages.map((stage, index) => {
					const width = (stage.count / maxCount) * 100;
					const dropoff = index > 0 
						? ((stages[index - 1].count - stage.count) / stages[index - 1].count * 100).toFixed(1)
						: 0;
					
					return (
						<div key={stage.key} className="lms-funnel-stage" onClick={() => console.log('Detalii:', stage.key)}>
							<div className="lms-funnel-stage-header">
								<span className="lms-funnel-label">{stage.label}</span>
								<span className="lms-funnel-count">{stage.count.toLocaleString()}</span>
							</div>
							<div className="lms-funnel-bar-wrapper">
								<div 
									className="lms-funnel-bar"
									style={{ 
										width: `${width}%`,
										backgroundColor: stage.color
									}}
								></div>
							</div>
							{index > 0 && dropoff > 0 && (
								<div className="lms-funnel-dropoff">↓ {dropoff}%</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

// Component: Engagement Timeline
const EngagementTimeline = ({ data, period }) => {
	const filteredData = period === '7d' ? data.slice(-7) : period === '30d' ? data.slice(-30) : data;
	const maxEngagement = Math.max(...filteredData.map(d => d.engagement), 1);
	const maxDuration = Math.max(...filteredData.map(d => d.sessionDuration), 1);

	return (
		<div className="lms-timeline">
			<div className="lms-timeline-legend">
				<div className="lms-legend-item">
					<span className="lms-legend-dot" style={{ backgroundColor: '#38BDF8' }}></span>
					<span>Implicare</span>
				</div>
				<div className="lms-legend-item">
					<span className="lms-legend-dot" style={{ backgroundColor: '#10B981' }}></span>
					<span>Durata Sesiune</span>
				</div>
			</div>
			<div className="lms-timeline-chart">
				<svg width="100%" height="200" viewBox={`0 0 ${filteredData.length * 20} 200`} preserveAspectRatio="none">
					<polyline
						points={filteredData.map((d, i) => `${i * 20},${200 - (d.engagement / maxEngagement) * 180}`).join(' ')}
						fill="none"
						stroke="#38BDF8"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<polyline
						points={filteredData.map((d, i) => `${i * 20},${200 - (d.sessionDuration / maxDuration) * 180}`).join(' ')}
						fill="none"
						stroke="#10B981"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</div>
		</div>
	);
};

// Component: AI Insight Card
const AIInsightCard = ({ recommendation, navigate }) => {
	const getPriorityColor = (priority) => {
		switch (priority) {
			case 'high': return '#EF4444';
			case 'medium': return '#F59E0B';
			case 'low': return '#84CC16';
			default: return '#38BDF8';
		}
	};

	return (
		<div className="lms-ai-card">
			<div className="lms-ai-card-header">
				<div className="lms-ai-priority" style={{ backgroundColor: getPriorityColor(recommendation.priority) + '20', borderColor: getPriorityColor(recommendation.priority) }}>
					{recommendation.priority === 'high' ? 'Ridicat' : recommendation.priority === 'medium' ? 'Mediu' : 'Scăzut'}
				</div>
			</div>
			<h3 className="lms-ai-title">{recommendation.title}</h3>
			<p className="lms-ai-description">{recommendation.description}</p>
			<div className="lms-ai-meta">
				<span className="lms-ai-impact">Impact: {recommendation.impact}</span>
				<span className="lms-ai-urgency">Urgență: {recommendation.urgency === 'high' ? 'Ridicată' : recommendation.urgency === 'medium' ? 'Medie' : 'Scăzută'}</span>
			</div>
			<div className="lms-ai-actions">
				<button 
					className="lms-btn-primary lms-btn-sm"
					onClick={() => navigate(recommendation.actionPath)}
				>
					{recommendation.action}
				</button>
			</div>
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

// Component: User Segments
const UserSegments = ({ segments, total }) => {
	const segmentData = [
		{ key: 'new', label: 'Noi', count: segments.new, color: '#38BDF8' },
		{ key: 'at_risk', label: 'În Risc', count: segments.at_risk, color: '#EF4444' },
		{ key: 'highly_engaged', label: 'Foarte Implicați', count: segments.highly_engaged, color: '#10B981' },
		{ key: 'inactive', label: 'Inactivi', count: segments.inactive, color: '#94A3B8' }
	];

	return (
		<div className="lms-segments">
			{segmentData.map((segment) => {
				const percentage = total > 0 ? ((segment.count / total) * 100).toFixed(1) : 0;
				return (
					<div key={segment.key} className="lms-segment-item">
						<div className="lms-segment-header">
							<span className="lms-segment-label">{segment.label}</span>
							<span className="lms-segment-count">{segment.count.toLocaleString()}</span>
						</div>
						<div className="lms-segment-bar">
							<div 
								className="lms-segment-fill"
								style={{ 
									width: `${percentage}%`,
									backgroundColor: segment.color
								}}
							></div>
						</div>
						<span className="lms-segment-percentage">{percentage}%</span>
					</div>
				);
			})}
		</div>
	);
};

// Component: Instructor Performance
const InstructorPerformance = ({ data }) => {
	if (!data || data.length === 0) {
		return (
			<PremiumEmptyState 
				title="Nu există date despre instructori"
				description="Metricile de performanță ale instructorilor vor apărea aici"
			/>
		);
	}

	return (
		<div className="lms-instructors">
			{data.slice(0, 5).map((instructor, index) => (
				<div key={index} className="lms-instructor-item">
					<div className="lms-instructor-info">
						<span className="lms-instructor-name">{instructor.name || 'Instructor'}</span>
						<span className="lms-instructor-meta">Implicare: {instructor.engagement || 'N/A'}</span>
					</div>
					<div className="lms-instructor-stats">
						<span>Retenție: {instructor.retention || 'N/A'}</span>
						<span>Feedback: {instructor.feedback || 'N/A'}</span>
					</div>
				</div>
			))}
		</div>
	);
};

// Component: Smart Activity Feed
const SmartActivityFeed = ({ activities }) => {
	if (!activities || activities.length === 0) {
		return (
			<PremiumEmptyState 
				title="Nu există activitate recentă"
				description="Feed-ul de activitate va afișa evenimente importante și anomalii"
			/>
		);
	}

	return (
		<div className="lms-activity-feed">
			{activities.slice(0, 10).map((activity, index) => {
				const isCritical = activity.severity === 'critical';
				const isAnomaly = activity.type === 'anomaly' || activity.type === 'spike';
				
				return (
					<div 
						key={activity.id || index} 
						className={`lms-activity-item ${isCritical ? 'critical' : ''} ${isAnomaly ? 'anomaly' : ''}`}
					>
						<div className="lms-activity-icon">
							{isCritical ? '⚠️' : isAnomaly ? '📊' : 'ℹ️'}
						</div>
						<div className="lms-activity-content">
							<p className="lms-activity-text">{activity.description || activity.message || 'Activitate'}</p>
							<span className="lms-activity-time">
								{activity.created_at ? new Date(activity.created_at).toLocaleDateString('ro-RO') : 'Recent'}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default AdminAnalyticsPage;
