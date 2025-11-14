import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { mockCourses, mockProfile } from '../data/mockData';

const DashboardPage = () => {
	const stats = useMemo(() => {
		const totalCourses = mockCourses.length;
		const totalLessons = mockCourses.reduce((sum, course) => sum + course.lessons.length, 0);
		const completedLessons = mockProfile.progress.reduce(
			(sum, p) => sum + p.completedLessons.length,
			0
		);
		const completedQuizzes = mockProfile.progress.filter((p) => p.quizPassed).length;
		const inProgressCourses = mockProfile.progress.filter(
			(p) => p.completedLessons.length > 0 && p.completedLessons.length < mockCourses.find((c) => c.id === p.courseId)?.lessons.length
		).length;
		const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

		return {
			totalCourses,
			totalLessons,
			completedLessons,
			completedQuizzes,
			inProgressCourses,
			progressPercentage,
		};
	}, []);

	return (
		<div className="va-main">
			{/* HERO — o coloană completă */}
			<section className="va-hero" style={{ gridColumn: '1 / -1' }}>
				<div className="va-hero-background">
					<div className="va-hero-orb va-hero-orb-1"></div>
					<div className="va-hero-orb va-hero-orb-2"></div>
					<div className="va-hero-orb va-hero-orb-3"></div>
				</div>

				<div className="va-hero-content">
					<div className="va-hero-header">
						<div className="va-hero-badge">
							<span className="va-hero-badge-icon">✨</span>
							<span>Bun venit înapoi, {mockProfile.name}!</span>
						</div>
						<h1 className="va-hero-title">
							<span className="va-hero-title-line">Învață.</span>
							<span className="va-hero-title-line">Exersează.</span>
							<span className="va-hero-title-line va-hero-title-accent">Evoluează.</span>
						</h1>
						<p className="va-hero-subtitle">
							Pornește pe un traseu structurat și urmărește-ți progresul în toate cursurile. Fiecare modul completat te aduce mai aproape de excelență.
						</p>
					</div>

					<div className="va-hero-stats">
						<div className="va-hero-stats-top">
							<div className="va-hero-stat">
								<div className="va-hero-stat-value">{stats.completedLessons}</div>
								<div className="va-hero-stat-label">Module finalizate</div>
							</div>
							<div className="va-hero-stat">
								<div className="va-hero-stat-value">{stats.inProgressCourses}</div>
								<div className="va-hero-stat-label">Cursuri în progres</div>
							</div>
							<div className="va-hero-stat">
								<div className="va-hero-stat-value">{stats.completedQuizzes}</div>
								<div className="va-hero-stat-label">Teste promovate</div>
							</div>
						</div>
						<div className="va-hero-stat va-hero-stat-progress">
							<div className="va-hero-stat-value">{stats.progressPercentage}%</div>
							<div className="va-hero-stat-label">Progres general</div>
							<div className="va-hero-progress-bar">
								<div
									className="va-hero-progress-fill"
									style={{ width: `${stats.progressPercentage}%` }}
								></div>
							</div>
						</div>
					</div>

					<div className="va-hero-actions">
						<Link to="/courses" className="va-btn va-btn-primary va-btn-hero">
							<span>Explorează cursurile</span>
							<span className="va-btn-icon">→</span>
						</Link>
						<Link to="/profile" className="va-btn va-btn-secondary va-btn-hero">
							<span>Vezi profilul</span>
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
};

export default DashboardPage;
