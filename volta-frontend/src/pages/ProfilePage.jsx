import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { profileService, adminService, achievementsService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage = () => {
	const { userId } = useParams(); // Optional user ID from URL
	const navigate = useNavigate();
	const { user: currentUser } = useAuth();
	const [profileData, setProfileData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [badges, setBadges] = useState([]);
	const isViewingOtherUser = userId && currentUser?.role === 'admin';

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				let profile;
				
				if (isViewingOtherUser) {
					// Admin viewing another user's profile
					const userData = await adminService.getUser(userId);
					// Construct profile from user data
					profile = {
						user: userData,
						stats: {
							completedLessons: userData.completed_lessons || 0,
							completedQuizzes: userData.completed_quizzes || 0,
							inProgressCourses: userData.in_progress_courses || 0,
							progressPercentage: userData.completion_percentage || 0,
						},
						coursesInProgress: userData.courses_in_progress || [],
						coursesCompleted: userData.courses_completed || [],
					};
				} else {
					// Current user viewing their own profile
					profile = await profileService.getProfile();
				}
				
				setProfileData(profile);

				// Fetch badges
				try {
					const achievements = await achievementsService.getAchievements();
					setBadges(achievements.badges || []);
				} catch (err) {
					console.error('Error fetching badges:', err);
					setBadges([]);
				}
			} catch (err) {
				console.error('Error fetching profile:', err);
				setError('Nu s-a putut încărca profilul');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [userId, isViewingOtherUser]);

	if (loading) { return null; }

	if (error || !profileData) {
		return (
			<div className="va-profile-container">
				<p style={{ color: 'red' }}>{error || 'Eroare la încărcarea profilului'}</p>
			</div>
		);
	}

	const stats = profileData.stats;
	const coursesInProgress = profileData.coursesInProgress || [];
	const coursesCompleted = profileData.coursesCompleted || [];

	return (
		<div className="va-profile-container">
			{/* Back Button for Admin */}
			{isViewingOtherUser && (
				<div style={{ marginBottom: '2rem' }}>
					<button
						onClick={() => navigate('/admin/users')}
						className="lms-btn-secondary"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.5rem',
							padding: '0.75rem 1.5rem',
						}}
					>
						<span>←</span>
						<span>Înapoi la Utilizatori</span>
					</button>
				</div>
			)}
			{/* Profile Header */}
			<div className="va-profile-header">
				<div className="va-profile-cover"></div>
				<div className="va-profile-info">
					<div className="va-profile-avatar">
						<div className="va-profile-avatar-inner">
							{profileData.user.name
								.split(' ')
								.map((n) => n[0])
								.join('')
								.toUpperCase()}
						</div>
					</div>
					<div className="va-profile-details">
						<h1 className="va-profile-name">{profileData.user.name}</h1>
						<p className="va-profile-role">
							{isViewingOtherUser 
								? (profileData.user.role === 'admin' ? 'Administrator' : 'Utilizator')
								: 'Student'
							}
						</p>
						{isViewingOtherUser && (
							<div className="va-profile-badges">
								<span className="va-profile-badge" style={{ background: 'rgba(var(--color-dark-rgb), 0.2)', color: 'var(--color-dark)' }}>
									👤 {profileData.user.email}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="va-profile-stats">
				<div className="va-stat-card">
					<div className="va-stat-icon">📚</div>
					<div className="va-stat-content">
						<div className="va-stat-value">{stats.completedModules || stats.completedLessons || 0}</div>
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
											{course.completedModules || course.completedLessons || 0} / {course.totalModules || course.totalLessons || 0} module
										</span>
									</div>
									<Link
										to={`/courses/${course.id}/lessons`}
										className="lms-btn-primary lms-btn-sm"
									>
										Continuă cursul
									</Link>
								</div>
							))
						) : (
							<div className="lms-empty-state">
								<p className="lms-empty-description">Nu ai cursuri în progres momentan.</p>
								<Link to="/courses" className="lms-btn-secondary">
									Explorează cursuri
								</Link>
							</div>
						)}
					</div>
				</div>

				{/* Completed Courses */}
				<div className="va-profile-section">
					<div className="va-section-header">
						<div className="va-section-title-group">
							<h2 className="va-section-title">Cursuri finalizate</h2>
							{coursesCompleted.length > 3 && (
								<Link
									to="/completed-courses"
									className="va-section-more-btn"
									title="Vezi toate cursurile finalizate"
								>
									⋯
								</Link>
							)}
						</div>
						<span className="va-section-count">{coursesCompleted.length}</span>
					</div>
					<div className="va-completed-courses-list">
						{coursesCompleted.length > 0 ? (
							coursesCompleted.slice(0, 3).map((course) => (
								<div className="va-completed-course-item" key={course.id}>
									<div className="va-completed-course-content">
										<span className="va-completed-course-title">{course.title}</span>
										<span className="va-completed-course-badge">✓ Completat</span>
									</div>
									<div className="va-completed-course-meta">
										<span>Quiz: {course.quizPassed ? 'Promovat ✓' : 'Nepromovat'}</span>
									</div>
								</div>
							))
						) : (
							<div className="lms-empty-state">
								<p className="lms-empty-description">Nu ai finalizat niciun curs încă.</p>
							</div>
						)}
					</div>
				</div>

			</div>

			{/* Badges Container */}
			<div className="va-profile-badges-container">
				<h2 className="va-profile-badges-title">Badge-uri</h2>
				<div className="va-profile-badges-list">
					{badges.length > 0 ? (
						badges.map((badge, index) => (
							<div key={index} className="va-profile-badge-item">
								<div className="va-profile-badge-icon">{badge.icon || '🏆'}</div>
								<div className="va-profile-badge-content">
									<div className="va-profile-badge-name">{badge.title || badge.name}</div>
									{badge.description && (
										<div className="va-profile-badge-description">{badge.description}</div>
									)}
								</div>
							</div>
						))
					) : (
						<div className="va-profile-badges-empty">
							<p>Nu ai badge-uri încă. Completează cursuri pentru a obține badge-uri!</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ProfilePage;

