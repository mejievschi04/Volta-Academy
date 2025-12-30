import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, getDefaultCurrency } from '../../utils/currency';
import DashboardHeader from '../../components/admin/DashboardHeader';
import KPICard from '../../components/admin/KPICard';
import MetricSelector from '../../components/admin/MetricSelector';
import ChartSection from '../../components/admin/ChartSection';

const AdminDashboardPage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [period, setPeriod] = useState('month');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedChartMetric, setSelectedChartMetric] = useState('enrollments');
	const [showMetricSelector, setShowMetricSelector] = useState(false);
	const [currency, setCurrency] = useState(getDefaultCurrency());

	useEffect(() => {
		const handleCurrencyChange = (e) => {
			setCurrency(e.detail);
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		setCurrency(getDefaultCurrency());
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, []);

	// Available metrics for KPI selection
	const availableMetrics = [
		{ id: 'active_users', label: 'Utilizatori Activi', icon: '👥' },
		{ id: 'new_enrollments', label: 'Înscrieri Noi', icon: '📈' },
		{ id: 'revenue_gross', label: 'Venituri Brut', icon: '💰' },
		{ id: 'revenue_net', label: 'Venituri Net', icon: '💵' },
		{ id: 'completion_rate', label: 'Rată Finalizare', icon: '✅' },
		{ id: 'engagement', label: 'Engagement', icon: '🔥' },
		{ id: 'issues', label: 'Probleme/Tichete', icon: '⚠️' },
	];

	// Default selected metrics (can be saved to localStorage)
	const [selectedMetrics, setSelectedMetrics] = useState(() => {
		const saved = localStorage.getItem('admin_selected_metrics');
		return saved ? JSON.parse(saved) : [
			'active_users',
			'new_enrollments',
			'revenue_gross',
			'completion_rate',
			'engagement',
			'issues'
		];
	});

	useEffect(() => {
		localStorage.setItem('admin_selected_metrics', JSON.stringify(selectedMetrics));
	}, [selectedMetrics]);

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await adminService.getDashboard({ period });
				setDashboardData(data);
			} catch (err) {
				console.error('Error fetching admin dashboard:', err);
				setError('Nu s-au putut încărca datele dashboard-ului');
			} finally {
				setLoading(false);
			}
		};
		fetchDashboard();
	}, [period]);

	const toggleMetric = (metricId) => {
		setSelectedMetrics(prev => {
			if (prev.includes(metricId)) {
				return prev.filter(id => id !== metricId);
			} else {
				return [...prev, metricId];
			}
		});
	};

	// Filter KPIs based on selected metrics
	const displayedKPIs = useMemo(() => {
		if (!dashboardData?.kpis) return [];
		
		return availableMetrics
			.filter(metric => selectedMetrics.includes(metric.id))
			.map(metric => {
				const kpiData = dashboardData.kpis[metric.id];
				if (!kpiData) return null;
				
				// Format revenue values with currency
				let formattedValue = kpiData.value;
				if (metric.id === 'revenue_gross' || metric.id === 'revenue_net') {
					// Handle both number and string (for backward compatibility)
					if (typeof kpiData.value === 'number') {
						formattedValue = formatCurrency(kpiData.value, currency);
					} else if (typeof kpiData.value === 'string') {
						// If it's already a string, try to extract the number and reformat
						const match = kpiData.value.match(/[\d,]+/);
						if (match) {
							const numValue = parseFloat(match[0].replace(/,/g, ''));
							formattedValue = formatCurrency(numValue, currency);
						} else {
							formattedValue = kpiData.value;
						}
					}
				}
				
				// Format trend value if it's a revenue metric
				let formattedTrendValue = kpiData.trendValue;
				if ((metric.id === 'revenue_gross' || metric.id === 'revenue_net') && kpiData.trendValue) {
					if (typeof kpiData.trendValue === 'string') {
						// Try to extract number from trend value (e.g., "+100" or "-50" or "100%")
						const match = kpiData.trendValue.match(/[+-]?\d+(\.\d+)?/);
						if (match) {
							const numValue = parseFloat(match[0]);
							// Keep the sign and percentage if present
							const sign = kpiData.trendValue.includes('-') ? '-' : (kpiData.trendValue.includes('+') ? '+' : '');
							const hasPercent = kpiData.trendValue.includes('%');
							formattedTrendValue = sign + formatCurrency(Math.abs(numValue), currency) + (hasPercent ? '%' : '');
						}
					}
				}
				
				return {
					id: metric.id,
					label: metric.label,
					icon: metric.icon,
					value: formattedValue,
					trend: kpiData.trend,
					trendValue: formattedTrendValue,
					color: kpiData.color || 'var(--va-primary)',
				};
			})
			.filter(Boolean);
	}, [dashboardData, selectedMetrics, currency]);

	if (error) {
		return (
			<div className="admin-container fade-in">
				<div className="va-stack">
					<p style={{ color: 'var(--va-error)', fontSize: '1.1rem' }}>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-dashboard-page">
			<DashboardHeader
				period={period}
				onPeriodChange={setPeriod}
			/>

			<div className="admin-dashboard-content">
				{/* Metric Selector Modal */}
				{showMetricSelector && (
					<div className="admin-metric-selector-overlay" onClick={() => setShowMetricSelector(false)}>
						<div className="admin-metric-selector-modal" onClick={(e) => e.stopPropagation()}>
							<MetricSelector
								availableMetrics={availableMetrics}
								selectedMetrics={selectedMetrics}
								onToggleMetric={toggleMetric}
							/>
							<button 
								className="admin-metric-selector-close"
								onClick={() => setShowMetricSelector(false)}
							>
								Închide
							</button>
						</div>
					</div>
				)}

				{/* TOP ROW: Compact KPI Cards */}
				<div className="admin-kpi-grid-compact">
					{loading ? (
						Array.from({ length: displayedKPIs.length || 4 }).map((_, i) => (
							<div key={i} className="admin-kpi-card-compact skeleton-card" style={{ minHeight: '100px' }}></div>
						))
					) : (
						displayedKPIs.map((kpi) => (
							<KPICard
								key={kpi.id}
								label={kpi.label}
								value={kpi.value}
								trend={kpi.trend}
								trendValue={kpi.trendValue}
								icon={kpi.icon}
								color={kpi.color}
							/>
						))
					)}
				</div>

				{/* MIDDLE ROW: Main Insight + Charts */}
				<div className="admin-dashboard-middle-row">
					{/* Left: Main Insight Card */}
					<div className="admin-dashboard-insight-card">
						<div className="admin-insight-header">
							<h2>Rezumat AI</h2>
							<button 
								className="admin-metric-selector-toggle"
								onClick={() => setShowMetricSelector(!showMetricSelector)}
								style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--space-2) var(--space-3)' }}
							>
								⚙️
							</button>
						</div>
						<div className="admin-insight-content">
							{dashboardData?.top_courses && dashboardData.top_courses.length > 0 ? (
								<div className="admin-insight-summary">
									<p className="admin-insight-text">
										<strong>{dashboardData.top_courses[0]?.title || 'N/A'}</strong> este cursul cu cel mai mare număr de înscrieri ({dashboardData.top_courses[0]?.enrollments_count || 0}).
									</p>
									{dashboardData.problematic_courses && dashboardData.problematic_courses.length > 0 && (
										<p className="admin-insight-text" style={{ marginTop: 'var(--space-4)' }}>
											<strong>{dashboardData.problematic_courses.length}</strong> cursuri necesită atenție.
										</p>
									)}
								</div>
							) : (
								<div className="admin-insight-empty">
									<p>Nu există date disponibile pentru rezumat.</p>
								</div>
							)}
						</div>
					</div>

					{/* Right: Charts */}
					<div className="admin-dashboard-charts-section">
						<ChartSection
							data={dashboardData?.chart_data || []}
							selectedMetric={selectedChartMetric}
							onMetricChange={setSelectedChartMetric}
							loading={loading}
						/>
					</div>
				</div>

				{/* BOTTOM ROW: Secondary Widgets */}
				<div className="admin-dashboard-bottom-row">
					{/* Quick Access Buttons */}
					<div className="admin-quick-access-widget">
						<h3>Acces Rapid</h3>
						<div className="admin-quick-access-buttons-compact">
							<button 
								className="admin-quick-access-btn-compact"
								onClick={() => navigate('/admin/top-courses')}
							>
								<span className="admin-quick-access-icon">📚</span>
								<span className="admin-quick-access-label">Top Cursuri</span>
							</button>
							<button 
								className="admin-quick-access-btn-compact"
								onClick={() => navigate('/admin/problematic-courses')}
							>
								<span className="admin-quick-access-icon">⚠️</span>
								<span className="admin-quick-access-label">Problemice</span>
							</button>
							<button 
								className="admin-quick-access-btn-compact"
								onClick={() => navigate('/admin/activity')}
							>
								<span className="admin-quick-access-icon">📋</span>
								<span className="admin-quick-access-label">Activitate</span>
							</button>
							<button 
								className="admin-quick-access-btn-compact"
								onClick={() => navigate('/admin/alerts')}
							>
								<span className="admin-quick-access-icon">🔔</span>
								<span className="admin-quick-access-label">Alerte</span>
							</button>
							<button 
								className="admin-quick-access-btn-compact"
								onClick={() => navigate('/admin/tasks')}
							>
								<span className="admin-quick-access-icon">✅</span>
								<span className="admin-quick-access-label">Taskuri</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AdminDashboardPage;
