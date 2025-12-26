import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency, getDefaultCurrency } from '../../utils/currency';

const ChartSection = ({ data, selectedMetric, onMetricChange, loading }) => {
	const [currency, setCurrency] = useState(getDefaultCurrency());

	useEffect(() => {
		const handleCurrencyChange = (e) => {
			setCurrency(e.detail);
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		setCurrency(getDefaultCurrency());
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, []);

	// Get chart color from CSS variable
	const getChartColor = () => {
		if (typeof window !== 'undefined') {
			const root = document.documentElement;
			const color = getComputedStyle(root).getPropertyValue('--btn-primary-bg').trim();
			return color || '#004643'; // Fallback to Cyprus Green
		}
		return '#004643';
	};

	const chartColor = getChartColor();

	const metrics = [
		{ id: 'enrollments', label: 'Înscrieri', color: chartColor },
		{ id: 'revenue', label: 'Venituri', color: chartColor },
		{ id: 'users', label: 'Utilizatori', color: chartColor },
	];

	const currentMetric = metrics.find(m => m.id === selectedMetric) || metrics[0];

	// Custom formatter for tooltip
	const formatTooltipValue = (value) => {
		if (selectedMetric === 'revenue' && typeof value === 'number') {
			return formatCurrency(value, currency);
		}
		return value;
	};

	if (loading) {
		return (
			<div className="admin-chart-section">
				<div className="skeleton-card" style={{ height: '400px' }}></div>
			</div>
		);
	}

	return (
		<div className="admin-chart-section">
			<div className="admin-chart-header">
				<h2>Evoluție {currentMetric.label}</h2>
				<div className="admin-chart-toggle">
					{metrics.map((metric) => (
						<button
							key={metric.id}
							className={`admin-chart-toggle-btn ${selectedMetric === metric.id ? 'active' : ''}`}
							onClick={() => onMetricChange(metric.id)}
							style={{
								'--metric-color': metric.color
							}}
						>
							{metric.label}
						</button>
					))}
				</div>
			</div>
			<div className="admin-chart-container">
				<ResponsiveContainer width="100%" height={400}>
					<AreaChart data={data || []}>
						<defs>
							<linearGradient id={`color${currentMetric.id}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor={currentMetric.color} stopOpacity={0.8}/>
								<stop offset="95%" stopColor={currentMetric.color} stopOpacity={0.1}/>
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
						<XAxis 
							dataKey="date" 
							stroke="var(--text-tertiary)"
							style={{ fontSize: '12px' }}
						/>
						<YAxis 
							stroke="var(--text-tertiary)"
							style={{ fontSize: '12px' }}
						/>
						<Tooltip 
							contentStyle={{ 
								backgroundColor: 'var(--bg-elevated)', 
								border: '1px solid var(--border-primary)',
								borderRadius: '8px',
								color: 'var(--text-primary)'
							}}
							formatter={(value) => formatTooltipValue(value)}
						/>
						<Area
							type="monotone"
							dataKey={selectedMetric}
							stroke={currentMetric.color}
							fillOpacity={1}
							fill={`url(#color${currentMetric.id})`}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};

export default ChartSection;

