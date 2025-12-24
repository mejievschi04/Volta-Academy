import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { profileService, adminService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage = () => {
	const { userId } = useParams(); // Optional user ID from URL
	const navigate = useNavigate();
	const { user: currentUser } = useAuth();
	const [profileData, setProfileData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
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
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.5rem',
							padding: '0.75rem 1.5rem',
							background: 'rgba(var(--color-light-rgb), 0.05)',
							border: '1px solid rgba(var(--color-dark-rgb), 0.2)',
							borderRadius: '12px',
							color: 'var(--color-light)',
							fontWeight: 600,
							cursor: 'pointer',
							transition: 'all 0.3s ease',
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = 'rgba(var(--color-dark-rgb), 0.1)';
							e.currentTarget.style.borderColor = 'rgba(var(--color-dark-rgb), 0.4)';
							e.currentTarget.style.transform = 'translateX(-4px)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'rgba(var(--color-light-rgb), 0.05)';
							e.currentTarget.style.borderColor = 'rgba(var(--color-dark-rgb), 0.2)';
							e.currentTarget.style.transform = 'translateX(0)';
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
								? (profileData.user.role === 'admin' ? 'Administrator' : 'Utilizator VoltaAcademy')
								: 'Student VoltaAcademy'
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
										<span>Quiz: {course.quizPassed ? 'Promovat ✓' : 'Nepromovat'}</span>
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

			</div>
		</div>
	);
};

export default ProfilePage;

