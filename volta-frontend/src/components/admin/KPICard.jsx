import React from 'react';

const KPICard = ({ 
	label, 
	value, 
	trend, 
	trendValue, 
	icon, 
	color = 'var(--va-primary)',
	onClick 
}) => {
	const trendColor = trend === 'up' ? '#09A86B' : trend === 'down' ? '#e63946' : 'var(--text-tertiary)';
	const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

	return (
		<div 
			className="admin-kpi-card" 
			onClick={onClick}
			style={{ cursor: onClick ? 'pointer' : 'default' }}
		>
			<div className="admin-kpi-header">
				<div className="admin-kpi-icon" style={{ color }}>
					{icon}
				</div>
				{trend && (
					<div className="admin-kpi-trend" style={{ color: trendColor }}>
						<span>{trendIcon}</span>
						<span>{trendValue}</span>
					</div>
				)}
			</div>
			<div className="admin-kpi-value" style={{ color }}>
				{value}
			</div>
			<div className="admin-kpi-label">{label}</div>
		</div>
	);
};

export default KPICard;

