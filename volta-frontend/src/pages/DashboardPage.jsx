import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ResumeLearningWidget from '../components/student/ResumeLearningWidget';
import CourseProgressWidget from '../components/student/CourseProgressWidget';
import IncompleteLessonsWidget from '../components/student/IncompleteLessonsWidget';
import PendingExamsWidget from '../components/student/PendingExamsWidget';
import BadgesWidget from '../components/student/BadgesWidget';

const DashboardPage = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [dashboardData, setDashboardData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchDashboard = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await dashboardService.getStudentDashboard();
				setDashboardData(data);
			} catch (err) {
				console.error('Error fetching dashboard:', err);
				setError(`Nu s-a putut încărca dashboard-ul: ${err.response?.data?.message || err.message || 'Eroare necunoscută'}`);
			} finally {
				setLoading(false);
			}
		};
		fetchDashboard();
	}, []);

	if (loading) {
		return (
			<div className="student-dashboard-page">
				<div className="student-dashboard-loading">
					<div className="student-loading-spinner"></div>
					<p>Se încarcă dashboard-ul...</p>
				</div>
			</div>
		);
	}

	if (error || !dashboardData) {
		return (
			<div className="student-dashboard-page">
				<div className="student-dashboard-error">
					<p>{error || 'Eroare la încărcarea datelor'}</p>
					<button onClick={() => window.location.reload()}>Reîncearcă</button>
				</div>
			</div>
		);
	}

	const { 
		global_progress, 
		active_courses, 
		next_lesson, 
		learning_time, 
		incomplete_lessons, 
		pending_exams, 
		badges,
		stats 
	} = dashboardData;

	return (
		<div className="student-dashboard-page">
			{/* Page Header */}
			<div className="student-dashboard-header">
				<div className="student-dashboard-welcome">
					<span className="student-dashboard-welcome-icon">✨</span>
					<span>Bine ai revenit, {user?.name || 'Utilizator'}!</span>
				</div>
				<h1 className="student-dashboard-title">
					Continuă-ți călătoria de învățare
				</h1>
				<p className="student-dashboard-subtitle">
					Urmărește-ți progresul și finalizează cursurile pentru a obține certificări
				</p>
			</div>

			{/* Hero Section */}
			<section className="student-dashboard-hero">
				<div className="student-dashboard-hero-content">
					{/* Global Progress */}
					<div className="student-dashboard-global-progress">
						<div className="student-global-progress-header">
							<h2>Progres Global</h2>
							<div className="student-global-progress-stats">
								<div className="student-global-progress-stat">
									<span className="student-global-progress-stat-value">
										{global_progress.completed_courses}
									</span>
									<span className="student-global-progress-stat-label">din {global_progress.total_courses} cursuri</span>
								</div>
								<div className="student-global-progress-stat">
									<span className="student-global-progress-stat-value">
										{global_progress.completed_lessons}
									</span>
									<span className="student-global-progress-stat-label">din {global_progress.total_lessons} lecții</span>
								</div>
							</div>
						</div>
						<div className="student-global-progress-bar-container">
							<div className="student-global-progress-bar">
								<div 
									className="student-global-progress-fill"
									style={{ width: `${global_progress.percentage}%` }}
								></div>
							</div>
							<div className="student-global-progress-percentage">
								{global_progress.percentage}%
							</div>
						</div>
					</div>

					{/* Quick Stats */}
					<div className="student-dashboard-quick-stats">
						<div className="student-quick-stat">
							<div className="student-quick-stat-icon">📚</div>
							<div className="student-quick-stat-content">
								<div className="student-quick-stat-value">{stats.total_courses}</div>
								<div className="student-quick-stat-label">Cursuri</div>
							</div>
						</div>
						<div className="student-quick-stat">
							<div className="student-quick-stat-icon">✅</div>
							<div className="student-quick-stat-content">
								<div className="student-quick-stat-value">{stats.completed_courses_count}</div>
								<div className="student-quick-stat-label">Finalizate</div>
							</div>
						</div>
						<div className="student-quick-stat">
							<div className="student-quick-stat-icon">📖</div>
							<div className="student-quick-stat-content">
								<div className="student-quick-stat-value">{stats.total_lessons_completed}</div>
								<div className="student-quick-stat-label">Lecții</div>
							</div>
						</div>
						<div className="student-quick-stat">
							<div className="student-quick-stat-icon">⏱️</div>
							<div className="student-quick-stat-content">
								<div className="student-quick-stat-value">{learning_time.formatted}</div>
								<div className="student-quick-stat-label">Timp învățare</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Main Content */}
			<div className="student-dashboard-content">
				{/* Left Column */}
				<div className="student-dashboard-left">
					{/* Resume Learning */}
					<ResumeLearningWidget nextLesson={next_lesson} />

					{/* Active Courses */}
					<div className="student-widget student-active-courses-widget">
						<div className="student-widget-header">
							<h3>Cursuri Active</h3>
							<span className="student-widget-count">{active_courses.length}</span>
						</div>
						<div className="student-widget-content">
							{active_courses.length === 0 ? (
								<p className="student-widget-empty">Nu ai cursuri active momentan.</p>
							) : (
								<div className="student-active-courses-grid">
									{active_courses.map((course) => (
										<CourseProgressWidget key={course.id} course={course} />
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Right Column */}
				<div className="student-dashboard-right">
					{/* Incomplete Lessons */}
					<IncompleteLessonsWidget lessons={incomplete_lessons} />

					{/* Pending Exams */}
					<PendingExamsWidget exams={pending_exams} />

					{/* Badges */}
					<BadgesWidget badges={badges} />
				</div>
			</div>
		</div>
	);
};

export default DashboardPage;
