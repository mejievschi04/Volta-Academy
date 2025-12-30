import React from 'react';

const DashboardHeader = ({ 
	period, 
	onPeriodChange
}) => {
	const periods = [
		{ value: 'today', label: 'Astăzi' },
		{ value: 'week', label: 'Săptămâna aceasta' },
		{ value: 'month', label: 'Luna aceasta' },
		{ value: 'quarter', label: 'Trimestrul acesta' },
		{ value: 'year', label: 'Anul acesta' },
		{ value: 'all', label: 'Toate' },
	];

	return (
		<header className="admin-dashboard-header">
			<div className="admin-dashboard-header-left">
				<div className="admin-dashboard-title">
					<h1>Dashboard Admin</h1>
					<p className="admin-dashboard-subtitle">
						Centru de comandă business + operațional
					</p>
				</div>
			</div>
			
			<div className="admin-dashboard-header-right">
				<div className="admin-dashboard-controls">
					{/* Period Selector */}
					<div className="admin-period-selector">
						<select 
							value={period} 
							onChange={(e) => onPeriodChange(e.target.value)}
							className="admin-period-select"
						>
							{periods.map(p => (
								<option key={p.value} value={p.value}>{p.label}</option>
							))}
						</select>
					</div>
				</div>
			</div>
		</header>
	);
};

export default DashboardHeader;

