import React from 'react';

const LearningFunnel = ({ data }) => {
	const stages = [
		{ key: 'enrolled', label: 'Enrolled', count: data?.enrolled || 0, color: '#FFEE00' },
		{ key: 'started', label: 'Started', count: data?.started || 0, color: '#FFEE00' },
		{ key: 'in_progress', label: 'In Progress', count: data?.in_progress || 0, color: '#f59e0b' },
		{ key: 'completed', label: 'Completed', count: data?.completed || 0, color: '#10b981' },
		{ key: 'certified', label: 'Certified', count: data?.certified || 0, color: '#06b6d4' },
	];

	// Calculate drop-offs and find largest drop-off
	const dropOffs = stages.slice(0, -1).map((stage, index) => {
		const nextStage = stages[index + 1];
		const dropOff = stage.count - nextStage.count;
		const dropOffPercent = stage.count > 0 ? ((dropOff / stage.count) * 100).toFixed(1) : 0;
		return {
			from: stage.label,
			to: nextStage.label,
			dropOff,
			dropOffPercent: parseFloat(dropOffPercent),
		};
	});

	const largestDropOff = dropOffs.reduce((max, current) =>
		current.dropOffPercent > max.dropOffPercent ? current : max,
		{ dropOffPercent: 0 }
	);

	const maxCount = Math.max(...stages.map(s => s.count));
	const totalWidth = 100;
	const stageWidth = totalWidth / stages.length;

	return (
		<div className="admin-learning-funnel">
			<div className="admin-funnel-header">
				<h3>Learning Funnel</h3>
				<p className="admin-funnel-subtitle">Student progression through courses</p>
			</div>

			{/* Horizontal Funnel Visualization */}
			<div className="admin-funnel-visualization">
				<svg viewBox="0 0 400 200" className="admin-funnel-svg">
					{/* Background grid */}
					<defs>
						<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
							<path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5"/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#grid)" />

					{/* Funnel stages */}
					{stages.map((stage, index) => {
						const x = index * stageWidth;
						const height = maxCount > 0 ? (stage.count / maxCount) * 120 : 0;
						const y = 160 - height; // Start from bottom

						return (
							<g key={stage.key}>
								{/* Stage bar */}
								<rect
									x={`${x + 2}%`}
									y={y}
									width={`${stageWidth - 4}%`}
									height={height}
									fill={stage.color}
									rx="2"
									className="admin-funnel-stage-bar"
								/>

								{/* Stage label */}
								<text
									x={`${x + stageWidth/2}%`}
									y="185"
									textAnchor="middle"
									className="admin-funnel-stage-label"
									fontSize="10"
									fill="#64748b"
								>
									{stage.label}
								</text>

								{/* Count */}
								<text
									x={`${x + stageWidth/2}%`}
									y={y - 5}
									textAnchor="middle"
									className="admin-funnel-count"
									fontSize="11"
									fontWeight="600"
									fill="#1e293b"
								>
									{stage.count.toLocaleString()}
								</text>
							</g>
						);
					})}

					{/* Drop-off indicators */}
					{dropOffs.map((dropOff, index) => {
						if (dropOff.dropOffPercent === 0) return null;

						const x = (index + 0.5) * stageWidth;
						const isLargest = dropOff.dropOffPercent === largestDropOff.dropOffPercent;

						return (
							<g key={`dropoff-${index}`}>
								{/* Drop-off line */}
								<line
									x1={`${x}%`}
									y1="40"
									x2={`${x}%`}
									y2="160"
									stroke={isLargest ? "#ef4444" : "#f59e0b"}
									strokeWidth={isLargest ? "3" : "2"}
									strokeDasharray="5,5"
									opacity="0.7"
								/>

								{/* Drop-off percentage */}
								<circle
									cx={`${x}%`}
									cy="30"
									r="12"
									fill={isLargest ? "#ef4444" : "#f59e0b"}
									className="admin-dropoff-indicator"
								/>
								<text
									x={`${x}%`}
									y="35"
									textAnchor="middle"
									fontSize="9"
									fontWeight="600"
									fill="white"
								>
									-{dropOff.dropOffPercent}%
								</text>
							</g>
						);
					})}
				</svg>
			</div>

			{/* Statistics Summary */}
			<div className="admin-funnel-stats">
				<div className="admin-funnel-stat">
					<span className="admin-funnel-stat-label">Total Enrolled:</span>
					<span className="admin-funnel-stat-value">{stages[0].count.toLocaleString()}</span>
				</div>
				<div className="admin-funnel-stat">
					<span className="admin-funnel-stat-label">Completion Rate:</span>
					<span className="admin-funnel-stat-value">
						{stages[0].count > 0 ? ((stages[3].count / stages[0].count) * 100).toFixed(1) : 0}%
					</span>
				</div>
				<div className="admin-funnel-stat">
					<span className="admin-funnel-stat-label">Certification Rate:</span>
					<span className="admin-funnel-stat-value">
						{stages[0].count > 0 ? ((stages[4].count / stages[0].count) * 100).toFixed(1) : 0}%
					</span>
				</div>
			</div>

			{/* Insight for largest drop-off */}
			{largestDropOff.dropOffPercent > 5 && (
				<div className="admin-funnel-insight">
					<div className="admin-funnel-insight-icon">⚠️</div>
					<div className="admin-funnel-insight-text">
						<strong>Critical drop-off:</strong> {largestDropOff.from} → {largestDropOff.to}
						({largestDropOff.dropOffPercent}% of students lost)
					</div>
				</div>
			)}
		</div>
	);
};

export default LearningFunnel;
