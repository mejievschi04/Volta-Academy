import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { mockProfile, mockCourses, mockRewards, getCourseById } from '../data/mockData';

const ProfilePage = () => {
	const progressMap = useMemo(
		() => Object.fromEntries(mockProfile.progress.map((p) => [p.courseId, p])),
		[]
	);

	const stats = useMemo(() => {
		const totalCourses = mockCourses.length;
		const totalLessons = mockCourses.reduce((sum, course) => sum + course.lessons.length, 0);
		const completedLessons = mockProfile.progress.reduce(
			(sum, p) => sum + p.completedLessons.length,
			0
		);
		const completedQuizzes = mockProfile.progress.filter((p) => p.quizPassed).length;
		const inProgressCourses = mockProfile.progress.filter(
			(p) =>
				p.completedLessons.length > 0 &&
				p.completedLessons.length < (getCourseById(p.courseId)?.lessons.length || 0)
		).length;
		const completedCourses = mockProfile.progress.filter(
			(p) => p.completedLessons.length === (getCourseById(p.courseId)?.lessons.length || 0) && p.quizPassed
		).length;
		const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

		return {
			totalCourses,
			totalLessons,
			completedLessons,
			completedQuizzes,
			inProgressCourses,
			completedCourses,
			progressPercentage,
		};
	}, []);

	const coursesInProgress = useMemo(() => {
		return mockProfile.progress
			.filter(
				(p) =>
					p.completedLessons.length > 0 &&
					p.completedLessons.length < (getCourseById(p.courseId)?.lessons.length || 0)
			)
			.map((p) => {
				const course = getCourseById(p.courseId);
				if (!course) return null;
				const progress = Math.round((p.completedLessons.length / course.lessons.length) * 100);
				return { ...course, progress, progressData: p };
			})
			.filter(Boolean);
	}, []);

	const coursesCompleted = useMemo(() => {
		return mockProfile.progress
			.filter(
				(p) =>
					p.completedLessons.length === (getCourseById(p.courseId)?.lessons.length || 0) && p.quizPassed
			)
			.map((p) => {
				const course = getCourseById(p.courseId);
				return course ? { ...course, progressData: p } : null;
			})
			.filter(Boolean);
	}, []);

	return (
		<div className="va-profile-container">
			{/* Profile Header */}
			<div className="va-profile-header">
				<div className="va-profile-cover"></div>
				<div className="va-profile-info">
					<div className="va-profile-avatar">
						<div className="va-profile-avatar-inner">
							{mockProfile.name
								.split(' ')
								.map((n) => n[0])
								.join('')
								.toUpperCase()}
						</div>
					</div>
					<div className="va-profile-details">
						<h1 className="va-profile-name">{mockProfile.name}</h1>
						<p className="va-profile-role">Student VoltaAcademy</p>
						<div className="va-profile-badges">
							<span className="va-profile-badge">Nivel: Începător</span>
							<span className="va-profile-badge">Membru din 2024</span>
						</div>
					</div>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="va-profile-stats">
				<div className="va-stat-card">
					<div className="va-stat-icon">📚</div>
					<div className="va-stat-content">
						<div className="va-stat-value">{stats.completedLessons}</div>
						<div className="va-stat-label">Module finalizate</div>
					</div>
				</div>
				<div className="va-stat-card">
					<div className="va-stat-icon">🎯</div>
					<div className="va-stat-content">
						<div className="va-stat-value">{stats.completedQuizzes}</div>
						<div className="va-stat-label">Teste promovate</div>
					</div>
				</div>
				<div className="va-stat-card">
					<div className="va-stat-icon">🚀</div>
					<div className="va-stat-content">
						<div className="va-stat-value">{stats.inProgressCourses}</div>
						<div className="va-stat-label">Cursuri în progres</div>
					</div>
				</div>
				<div className="va-stat-card va-stat-card-progress">
					<div className="va-stat-icon">⭐</div>
					<div className="va-stat-content">
						<div className="va-stat-value">{stats.progressPercentage}%</div>
						<div className="va-stat-label">Progres general</div>
						<div className="va-stat-progress-bar">
							<div
								className="va-stat-progress-fill"
								style={{ width: `${stats.progressPercentage}%` }}
							></div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content Grid */}
			<div className="va-profile-grid">
				{/* Courses In Progress */}
				<div className="va-profile-section">
					<div className="va-section-header">
						<h2 className="va-section-title">Cursuri în progres</h2>
						<span className="va-section-count">{coursesInProgress.length}</span>
					</div>
					<div className="va-courses-list">
						{coursesInProgress.length > 0 ? (
							coursesInProgress.map((course) => (
								<div className="va-course-card" key={course.id}>
									<div className="va-course-card-header">
										<h3 className="va-course-card-title">{course.title}</h3>
										<span className="va-course-card-progress">{course.progress}%</span>
									</div>
									<p className="va-course-card-description">{course.description}</p>
									<div className="va-course-card-progress-bar">
										<div
											className="va-course-card-progress-fill"
											style={{ width: `${course.progress}%` }}
										></div>
									</div>
									<div className="va-course-card-meta">
										<span>
											{course.progressData.completedLessons.length} / {course.lessons.length} module
										</span>
									</div>
									<Link
										to={`/courses/${course.id}/lessons`}
										className="va-btn va-btn-primary va-btn-sm"
									>
										Continuă cursul
									</Link>
								</div>
							))
						) : (
							<div className="va-empty-state">
								<p className="va-empty-text">Nu ai cursuri în progres momentan.</p>
								<Link to="/courses" className="va-btn va-btn-secondary">
									Explorează cursuri
								</Link>
							</div>
						)}
					</div>
				</div>

				{/* Completed Courses */}
				<div className="va-profile-section">
					<div className="va-section-header">
						<h2 className="va-section-title">Cursuri finalizate</h2>
						<span className="va-section-count">{coursesCompleted.length}</span>
					</div>
					<div className="va-courses-list">
						{coursesCompleted.length > 0 ? (
							coursesCompleted.map((course) => (
								<div className="va-course-card va-course-card-completed" key={course.id}>
									<div className="va-course-card-header">
										<h3 className="va-course-card-title">{course.title}</h3>
										<span className="va-course-card-badge">✓ Completat</span>
									</div>
									<p className="va-course-card-description">{course.description}</p>
									<div className="va-course-card-meta">
										<span>Quiz: {course.progressData.quizPassed ? 'Promovat ✓' : 'Nepromovat'}</span>
									</div>
								</div>
							))
						) : (
							<div className="va-empty-state">
								<p className="va-empty-text">Nu ai finalizat niciun curs încă.</p>
							</div>
						)}
					</div>
				</div>

				{/* Achievements Preview */}
				<div className="va-profile-section">
					<div className="va-section-header">
						<h2 className="va-section-title">Realizări recente</h2>
						<Link to="/rewards" className="va-section-link">
							Vezi toate →
						</Link>
					</div>
					<div className="va-achievements-grid">
						{mockRewards.slice(0, 4).map((reward) => (
							<div className="va-achievement-card" key={reward.id}>
								<div className="va-achievement-icon">
									{reward.id === 'streak-3' && '🔥'}
									{reward.id === 'promo-champ' && '🏆'}
									{reward.id === 'security-guardian' && '🛡️'}
									{reward.id === 'sales-closer' && '💼'}
									{reward.id === 'product-master' && '⭐'}
								</div>
								<div className="va-achievement-content">
									<h4 className="va-achievement-title">{reward.title}</h4>
									<p className="va-achievement-description">{reward.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ProfilePage;

