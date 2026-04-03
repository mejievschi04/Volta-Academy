import React, { useMemo, useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [selectedPeriod, setSelectedPeriod] = useState('14d');
	const PERIOD_OPTIONS = [
		{ value: '7d', label: 'Ultimele 7 zile' },
		{ value: '14d', label: 'Ultimele 14 zile' },
		{ value: '30d', label: 'Ultimele 30 zile' },
		{ value: '90d', label: 'Ultimele 90 zile' },
	];

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				const data = await adminService.getDashboard({ period: selectedPeriod });
				setDashboardData(data);
			} catch (err) {
				console.error('Eroare la încărcarea dashboard-ului:', err);
			} finally {
				setLoading(false);
			}
		};
		fetchDashboard();
	}, [selectedPeriod]);

	const kpis = dashboardData?.kpis || {};
	const chartData = dashboardData?.chart_data || [];

	const totalUsers = kpis.total_users?.value || kpis.total_users || '0';
	const activeUsers = kpis.active_users?.value || '0';
	const totalCourses = kpis.total_courses?.value || kpis.total_courses || '0';
	const completionRate = kpis.completion_rate?.value || '0%';
	const newUsers = Number(kpis.new_users?.value || kpis.new_users || 0);
	const learningHoursPeriod = Number(kpis.learning_hours?.value ?? 0) || 0;
	const learningHoursTotal = Number(kpis.learning_hours_total?.value ?? 0) || 0;

	const totalUsersNum = parseInt(totalUsers.toString().replace(/,/g, '')) || 0;
	const completionRateNum = parseFloat(completionRate.toString().replace('%', '')) || 0;
	const activeUsersNum = parseInt(activeUsers.toString().replace(/,/g, '')) || 0;
	const totalCoursesNum = parseInt(totalCourses.toString().replace(/,/g, '')) || 0;

	const courseTestStats = dashboardData?.course_test_stats ?? null;
	const testsStats = courseTestStats?.tests ?? {
		total: 0,
		published: 0,
		draft: 0,
		pending_reviews: 0,
		manual_reviews_total: 0
	};
	const publishedTests = Number(testsStats.published ?? 0);
	const draftTests = Number(testsStats.draft ?? 0);
	const totalTests = Number(testsStats.total ?? 0);

	const normalizedSeries = useMemo(
		() => (
			Array.isArray(chartData) && chartData.length > 0
				? chartData.slice(-14).map((point, index) => ({
					label: point.label || point.date || `${index + 1}`,
					users: Number(point.users || point.total_users || point.value || 0),
					active: Number(point.active_users || point.active || 0),
					courses: Number(point.courses || point.total_courses || 0),
				}))
				: []
		),
		[chartData]
	);

	const hourlySource = Array.isArray(dashboardData?.hourly_activity) ? dashboardData.hourly_activity : [];
	const learningFunnel = dashboardData?.learning_funnel ?? {};
	const hourlyMap = new Map();
	hourlySource.forEach((item) => {
		const rawHour = Number(item.hour ?? item.label ?? item.bucket ?? -1);
		if (!Number.isFinite(rawHour) || rawHour < 0 || rawHour > 23) return;
		hourlyMap.set(rawHour, {
			lessons: Math.max(0, Number(item.lessons ?? item.courses ?? 0)),
			users: Math.max(0, Number(item.users ?? item.active_users ?? 0)),
		});
	});
	const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
		const row = hourlyMap.get(hour);
		return {
			hour: `${hour}`,
			lessons: row?.lessons ?? 0,
			users: row?.users ?? 0,
		};
	});
	const hasChartData = normalizedSeries.length > 0;
	const hasHourlyData = hourlyActivity.some((h) => h.lessons > 0 || h.users > 0);
	const firstLabel = normalizedSeries[0]?.label || '—';
	const lastLabel = normalizedSeries[normalizedSeries.length - 1]?.label || '—';
	const trendData = useMemo(
		() => normalizedSeries.map((item) => ({
			label: item.label,
			elevi: item.users,
			activi: item.active,
			certificati: Math.max(0, Math.round(item.users * (completionRateNum / 100))),
		})),
		[normalizedSeries, completionRateNum]
	);
	const funnelBarData = useMemo(() => {
		const n = (k) => Math.max(0, Number(learningFunnel[k] ?? 0));
		return [
			{ key: 'enrolled', label: 'Înscrieri active', short: 'Înscrieri', count: n('enrolled'), fill: '#64748b' },
			{ key: 'started', label: 'Cu început înregistrat', short: 'Început', count: n('started'), fill: '#3b82f6' },
			{ key: 'p25', label: 'Progres ≥ 25%', short: '≥25%', count: n('progress_25'), fill: '#8b5cf6' },
			{ key: 'p50', label: 'Progres ≥ 50%', short: '≥50%', count: n('progress_50'), fill: '#ca8a04' },
			{ key: 'completed', label: 'Finalizat (curs)', short: 'Finalizat', count: n('completed'), fill: '#22c55e' },
		];
	}, [learningFunnel]);

	const funnelTotal = useMemo(
		() => funnelBarData.reduce((s, r) => s + r.count, 0),
		[funnelBarData]
	);
	const hourlyChartData = useMemo(
		() => hourlyActivity.map((item) => ({
			ora: item.hour.padStart(2, '0'),
			lectii: item.lessons,
			elevi: item.users,
		})),
		[hourlyActivity]
	);
	const tooltipLabel = (label) => `Perioadă: ${label}`;
	const tooltipHourLabel = (label) => `Ora: ${label}:00`;
	const renderTooltip = ({ active, payload, label }) => {
		if (!active || !Array.isArray(payload) || payload.length === 0) return null;
		return (
			<div className="dashboard-chart-tooltip">
				<p className="dashboard-chart-tooltip-title">{tooltipLabel(label)}</p>
				{payload.map((entry) => (
					<p key={entry.name} className="dashboard-chart-tooltip-row">
						<span>{entry.name}</span>
						<strong>{Number(entry.value || 0).toLocaleString()}</strong>
					</p>
				))}
			</div>
		);
	};
	const renderHourlyTooltip = ({ active, payload, label }) => {
		if (!active || !Array.isArray(payload) || payload.length === 0) return null;
		return (
			<div className="dashboard-chart-tooltip">
				<p className="dashboard-chart-tooltip-title">{tooltipHourLabel(label)}</p>
				{payload.map((entry) => (
					<p key={entry.name} className="dashboard-chart-tooltip-row">
						<span>{entry.name}</span>
						<strong>{Number(entry.value || 0).toLocaleString()}</strong>
					</p>
				))}
			</div>
		);
	};

	const renderFunnelTooltip = ({ active, payload }) => {
		if (!active || !payload?.[0]) return null;
		const row = payload[0].payload;
		return (
			<div className="dashboard-chart-tooltip">
				<p className="dashboard-chart-tooltip-title">{row.label}</p>
				<p className="dashboard-chart-tooltip-row">
					<span>Înscrieri (rânduri course_user)</span>
					<strong>{Number(row.count || 0).toLocaleString()}</strong>
				</p>
				<p className="dashboard-chart-tooltip-hint">
					Pragurile ≥25% și ≥50% sunt cumulative: aceeași înscriere poate fi numărată la mai multe etape.
				</p>
			</div>
		);
	};
	const renderPeriodSelect = () => (
		<select
			className="clean-card-period-select"
			value={selectedPeriod}
			onChange={(e) => setSelectedPeriod(e.target.value)}
			aria-label="Perioada raportului"
		>
			{PERIOD_OPTIONS.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);

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
		<div className="admin-dashboard-page admin-dashboard-clean">
			<header className="admin-dashboard-clean-header">
				<div>
					<h1 className="admin-dashboard-clean-title">Panou de control</h1>
					<p className="admin-dashboard-clean-subtitle">
						Privire rapidă asupra elevilor, progresului și activității din academie
					</p>
					<p className="admin-dashboard-clean-meta">
						Utilizatori noi: <strong>{newUsers.toLocaleString()}</strong> • Cursuri totale: <strong>{totalCoursesNum.toLocaleString()}</strong>
					</p>
				</div>
				<div className="admin-dashboard-clean-actions">
					{renderPeriodSelect()}
				</div>
			</header>

			<section className="admin-dashboard-clean-hero">
				<article className="hero-stat">
					<p className="hero-stat-label">Total elevi</p>
					<p className="hero-stat-value">{totalUsersNum.toLocaleString()}</p>
					<p className="hero-stat-meta">Înregistrați în platformă</p>
				</article>
				<article className="hero-stat">
					<p className="hero-stat-label">Elevi activi</p>
					<p className="hero-stat-value">{activeUsersNum.toLocaleString()}</p>
					<p className="hero-stat-meta">Activi în perioada selectată</p>
				</article>
				<article className="hero-stat">
					<p className="hero-stat-label">Rată finalizare</p>
					<p className="hero-stat-value">{completionRate}</p>
					<p className="hero-stat-meta">Elevi activi: {activeUsersNum.toLocaleString()}</p>
				</article>
				<article className="hero-stat">
					<p className="hero-stat-label">Teste publicate</p>
					<p className="hero-stat-value">{publishedTests.toLocaleString()}</p>
					<p className="hero-stat-meta">Total teste: {totalTests.toLocaleString()} • Draft: {draftTests.toLocaleString()}</p>
				</article>
				<article className="hero-stat hero-stat-cyan">
					<p className="hero-stat-label">Ore învățare (perioadă)</p>
					<p className="hero-stat-value">
						{learningHoursPeriod.toLocaleString('ro-RO', { maximumFractionDigits: 1 })}
					</p>
					<p className="hero-stat-meta">Timp înregistrat pe lecții în interval</p>
				</article>
				<article className="hero-stat hero-stat-blue">
					<p className="hero-stat-label">Ore învățare (total)</p>
					<p className="hero-stat-value">
						{learningHoursTotal.toLocaleString('ro-RO', { maximumFractionDigits: 1 })}
					</p>
					<p className="hero-stat-meta">Sumă timp pe toate lecțiile</p>
				</article>
			</section>

			<section className="admin-dashboard-clean-grid">
				<article className="clean-card">
					<header className="clean-card-header">
						<h2>Statistică generală pe academie</h2>
						<span>{PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label || 'Perioadă'}</span>
					</header>
					<div className="chart-modern-line">
						<div className="chart-rechart-wrap">
							<ResponsiveContainer width="100%" height={228} minWidth={280} minHeight={220}>
								<AreaChart data={trendData} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
									<defs>
										<linearGradient id="overviewAreaFill" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.24} />
											<stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.04} />
										</linearGradient>
									</defs>
									<CartesianGrid stroke="var(--border-primary)" strokeDasharray="3 3" />
									<XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} />
									<YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
									<Tooltip content={renderTooltip} />
									<Area type="monotone" dataKey="elevi" stroke="var(--color-primary)" strokeWidth={2.2} fill="url(#overviewAreaFill)" name="Elevi" />
								</AreaChart>
							</ResponsiveContainer>
						</div>
						<div className="chart-modern-footer">
							<span>{firstLabel}</span>
							<span>{lastLabel}</span>
						</div>
						{!hasChartData ? <p className="chart-modern-empty">Nu există date pentru perioada selectată.</p> : null}
					</div>
				</article>

				<article className="clean-card clean-card-funnel">
					<header className="clean-card-header">
						<div className="clean-card-header-text">
							<h2>Progres înscrieri la cursuri</h2>
							<p className="clean-card-funnel-sub">
								Date reale din înscrieri (nu estimări din procente). Barele orizontale arată câte înscrieri
								sunt la fiecare etapă; pragurile de progres sunt cumulative.
							</p>
						</div>
						<span className="clean-card-header-badge">Live</span>
					</header>
					<div className="funnel-chart-block">
						{funnelTotal === 0 ? (
							<p className="chart-modern-empty">Nu există încă înscrieri în baza de date.</p>
						) : (
							<div className="funnel-chart-row">
								<div className="chart-rechart-wrap funnel-chart-rechart">
									<ResponsiveContainer width="100%" height={236} minWidth={260} minHeight={220}>
										<BarChart
											layout="vertical"
											data={funnelBarData}
											margin={{ top: 6, right: 20, left: 4, bottom: 4 }}
											barCategoryGap={10}
										>
											<CartesianGrid stroke="var(--border-primary)" strokeDasharray="3 3" horizontal vertical={false} />
											<XAxis
												type="number"
												tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
												tickLine={false}
												axisLine={false}
												allowDecimals={false}
											/>
											<YAxis
												type="category"
												dataKey="short"
												width={72}
												tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
												tickLine={false}
												axisLine={false}
											/>
											<Tooltip content={renderFunnelTooltip} cursor={{ fill: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }} />
											<Bar dataKey="count" name="Înscrieri" radius={[0, 6, 6, 0]} maxBarSize={26}>
												{funnelBarData.map((entry) => (
													<Cell key={entry.key} fill={entry.fill} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
												))}
											</Bar>
										</BarChart>
									</ResponsiveContainer>
								</div>
								<ul className="funnel-legend" aria-label="Valori pe etapă">
									{funnelBarData.map((row) => (
										<li key={row.key}>
											<span className="funnel-legend-swatch" style={{ backgroundColor: row.fill }} aria-hidden />
											<span className="funnel-legend-label">{row.label}</span>
											<strong className="funnel-legend-value">{row.count.toLocaleString()}</strong>
										</li>
									))}
								</ul>
							</div>
						)}
						<div className="funnel-kpi-foot">
							<span>
								Rată finalizare elevi (KPI): <strong>{completionRate}</strong>
							</span>
							<span className="funnel-kpi-foot-sep" aria-hidden>
								·
							</span>
							<span>
								Total elevi: <strong>{totalUsersNum.toLocaleString()}</strong>
							</span>
						</div>
					</div>
				</article>

				<article className="clean-card">
					<header className="clean-card-header">
						<h2>Toți elevii</h2>
						<span>{PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label || 'Perioadă'}</span>
					</header>
					<div className="chart-modern-line chart-modern-line-multi">
						<div className="chart-rechart-wrap">
							<ResponsiveContainer width="100%" height={228} minWidth={280} minHeight={220}>
								<LineChart data={trendData} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
									<CartesianGrid stroke="var(--border-primary)" strokeDasharray="3 3" vertical={false} />
									<XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
									<YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
									<Tooltip content={renderTooltip} />
									<Line type="monotone" dataKey="elevi" name="Elevi" stroke="var(--color-primary)" strokeWidth={2.6} dot={false} activeDot={{ r: 4 }} />
									<Line type="monotone" dataKey="activi" name="Elevi activi" stroke="var(--text-secondary)" strokeWidth={2.1} dot={false} activeDot={{ r: 3.5 }} />
								</LineChart>
							</ResponsiveContainer>
						</div>
						<div className="chart-modern-footer">
							<span>{firstLabel}</span>
							<span>{lastLabel}</span>
						</div>
						<div className="chart-modern-legend">
							<span><i className="legend-dot legend-users" />Elevi</span>
							<span><i className="legend-dot legend-active" />Elevi activi</span>
						</div>
						{!hasChartData ? <p className="chart-modern-empty">Nu există date pentru perioada selectată.</p> : null}
					</div>
				</article>

				<article className="clean-card">
					<header className="clean-card-header">
						<h2>Popularitate academie pe ore</h2>
						<span>24 ore</span>
					</header>
					<div className="chart-modern-bars">
						<div className="chart-rechart-wrap">
							<ResponsiveContainer width="100%" height={228} minWidth={280} minHeight={220}>
								<BarChart data={hourlyChartData} margin={{ top: 6, right: 10, left: -22, bottom: 0 }}>
									<CartesianGrid stroke="var(--border-primary)" strokeDasharray="3 3" vertical={false} />
									<XAxis dataKey="ora" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
									<YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
									<Tooltip content={renderHourlyTooltip} />
									<Bar dataKey="lectii" name="Minute studiu" fill="color-mix(in srgb, var(--color-primary) 45%, var(--text-secondary) 55%)" radius={[4, 4, 0, 0]} maxBarSize={10} />
									<Bar dataKey="elevi" name="Elevi" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={10} />
								</BarChart>
							</ResponsiveContainer>
						</div>
						<div className="chart-modern-legend">
							<span><i className="legend-dot legend-lessons" />Minute studiu</span>
							<span><i className="legend-dot legend-users-2" />Elevi</span>
						</div>
						{!hasHourlyData ? <p className="chart-modern-empty">Nu există activitate orară disponibilă.</p> : null}
					</div>
				</article>
			</section>
		</div>
	);
};

export default AdminDashboardPage;
