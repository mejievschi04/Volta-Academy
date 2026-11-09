import '../styles/achievements-modern.css';
import React, { useState, useEffect } from 'react';
import { achievementsService } from '../services/api';



import { useToast } from '../contexts/ToastContextShared.js';
import { logger } from '../utils/logger';

/** Sub o oră, minutele („0h” la câteva minute de învățare părea că timpul nu se înregistrează). */
function formatLearningTime(achievements) {
	const minutes = Number(achievements?.learning_minutes);
	if (Number.isFinite(minutes) && minutes < 60) return `${Math.max(0, minutes)} min`;
	return `${achievements?.learning_hours || 0}h`;
}
import { BookOpenText, GraduationCap, Medal, RocketLaunch, Star, Target, Timer } from '@phosphor-icons/react';

/** Serverul trimite etapele cu emoji; pe ecran folosim iconițele aplicației. */
const MILESTONE_ICONS = { '🎯': Target, '🌟': Star, '🚀': RocketLaunch, '🎓': GraduationCap };

function MilestoneIcon({ emoji }) {
	const Icon = MILESTONE_ICONS[emoji] || Medal;
	return <Icon size={22} weight="bold" aria-hidden />;
}

const AchievementsPage = () => {

	const { error: showError } = useToast();
	const [achievements, setAchievements] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const achievementsData = await achievementsService.getAchievements();
				setAchievements(achievementsData);
			} catch (err) {
				logger.error('Error fetching achievements:', err);
				const errorMessage = 'Nu s-au putut încărca realizările';
				setError(errorMessage);
				showError(errorMessage);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	if (loading) {
		return (
			<div className="student-achievements-page">
				<div className="student-achievements-loading">
					<div className="student-loading-spinner"></div>
					<p>Se încarcă realizările...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="student-achievements-page">
				<div className="student-achievements-error">
					<p>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="student-achievements-page">
			<div className="student-achievements-header">
				<h1 className="student-achievements-title">Istoric Realizări</h1>
			</div>

			{/* Statistics */}
			{achievements && (
				<div className="student-achievements-stats">
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon"><GraduationCap size={26} weight="bold" aria-hidden /></div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{achievements.completed_courses || 0}</div>
							<div className="student-achievements-stat-label">Cursuri finalizate</div>
						</div>
					</div>
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon"><BookOpenText size={26} weight="bold" aria-hidden /></div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{achievements.completed_lessons || 0}</div>
							<div className="student-achievements-stat-label">Lecții finalizate</div>
						</div>
					</div>
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon"><Timer size={26} weight="bold" aria-hidden /></div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{formatLearningTime(achievements)}</div>
							<div className="student-achievements-stat-label">Timp de învățare</div>
						</div>
					</div>
				</div>
			)}

			{/* Milestones */}
			{achievements && achievements.milestones && achievements.milestones.length > 0 && (
				<div className="student-achievements-section">
					<h2 className="student-achievements-section-title">
						<span className="student-achievements-section-icon"><Target size={20} weight="bold" aria-hidden /></span>
						<span>Etape atinse</span>
					</h2>
					<div className="student-milestones-timeline">
						{achievements.milestones.map((milestone, index) => (
							<div key={index} className="student-milestone-item">
								<div className="student-milestone-icon"><MilestoneIcon emoji={milestone.icon} /></div>
								<div className="student-milestone-content">
									<div className="student-milestone-title">{milestone.title}</div>
									<div className="student-milestone-description">{milestone.description}</div>
									<div className="student-milestone-date">
										{new Date(milestone.achieved_at).toLocaleDateString('ro-RO')}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default AchievementsPage;
