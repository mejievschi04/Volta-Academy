import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminRoute from './components/AdminRoute';
import UserRoute from './components/UserRoute';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoadingOverlay from './components/LoadingOverlay';
import SplashScreen from './components/SplashScreen';
import './App.css';
import './styles/modern-enhancements.css';
import './styles/loading.css';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LessonsPage = lazy(() => import('./pages/LessonsPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const LessonDetailPage = lazy(() => import('./pages/LessonDetailPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const CalendarViewPage = lazy(() => import('./pages/CalendarViewPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminCoursesPage = lazy(() => import('./pages/admin/AdminCoursesPage'));
const AdminCourseDetailPage = lazy(() => import('./pages/admin/AdminCourseDetailPage'));
const AdminRewardsPage = lazy(() => import('./pages/admin/AdminRewardsPage'));
const CategoryDetailPage = lazy(() => import('./pages/admin/CategoryDetailPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage'));
const AdminTeamsPage = lazy(() => import('./pages/admin/AdminTeamsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const LessonCreatorPage = lazy(() => import('./pages/admin/LessonCreatorPage'));
const ExamCreatorPage = lazy(() => import('./pages/admin/ExamCreatorPage'));

// Loading component (post-login: no full-screen overlay)
const PageLoader = () => (
	<div className="va-main" style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
		<p>Se încarcă...</p>
	</div>
);

function ProtectedRoute({ children }) {
	const { user, loading } = useAuth();

	if (loading) {
		return null;
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return children;
}

function Layout({ children }) {
	const { user, logout } = useAuth();
	const isAdmin = user?.role === 'admin';
	
	// Check must_change_password - handle boolean, number, or string values
	const mustChangePassword = user?.must_change_password === true || 
		user?.must_change_password === 1 || 
		user?.must_change_password === '1' ||
		user?.must_change_password === 'true' ||
		user?.must_change_password === true;
	
	// Debug logging
	React.useEffect(() => {
		if (user) {
			console.log('=== Layout Debug ===');
			console.log('Full user object:', user);
			console.log('must_change_password value:', user.must_change_password);
			console.log('must_change_password type:', typeof user.must_change_password);
			console.log('mustChangePassword result:', mustChangePassword);
			console.log('==================');
		}
	}, [user, mustChangePassword]);
	
	const navItems = [
		{ 
			path: '/home', 
			label: 'Acasă', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{ 
			path: '/courses', 
			label: 'Cursuri', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M4 19.5C4 18.6716 4.67157 18 5.5 18H20M4 19.5C4 20.3284 4.67157 21 5.5 21H20M4 19.5V4.5C4 3.67157 4.67157 3 5.5 3H20V18M20 18V21M9 7H15M9 11H15M9 15H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{ 
			path: '/events', 
			label: 'Evenimente', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M8 14H8.01M12 14H12.01M16 14H16.01M8 18H8.01M12 18H12.01M16 18H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{ 
			path: '/rewards', 
			label: 'Recompense', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{ 
			path: '/profile', 
			label: 'Profil', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
	];

	const adminNavItems = [
		{
			path: '/admin',
			label: 'Dashboard',
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M9 21V12H15V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/categories',
			label: 'Cursuri',
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3 7V5C3 3.89543 3.89543 3 5 3H9.58579C9.851 3 10.1054 3.10536 10.2929 3.29289L12.7071 5.70711C12.8946 5.89464 13.149 6 13.4142 6H19C20.1046 6 21 6.89543 21 8V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/rewards',
			label: 'Recompense',
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/events',
			label: 'Evenimente',
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/teams',
			label: 'Echipe',
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/users',
			label: 'Utilizatori',
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
	];

	return (
		<div className="va-shell">
			{mustChangePassword && (
				<>
					{console.log('Rendering ChangePasswordModal')}
					<ChangePasswordModal />
				</>
			)}
			
			<aside className="va-sidebar">
				<div className="va-sidebar-brand">
					<span className="va-logo-text">
						<span className="va-logo-v">V</span> Academy
					</span>
				</div>

				<nav className="va-sidebar-nav">
					{isAdmin ? (
						// Admin sees only admin navigation
						adminNavItems.map((item) => (
							<NavLink
								key={item.path}
								to={item.path}
								className={({ isActive }) => ['va-nav-btn', isActive ? 'is-active' : ''].join(' ').trim()}
								end={item.path === '/admin'}
							>
								<span className="va-nav-icon">{item.icon}</span>
								<span className="va-nav-label">{item.label}</span>
							</NavLink>
						))
					) : (
						// Regular users see normal navigation
						navItems.map((item) => (
							<NavLink
								key={item.path}
								to={item.path}
								className={({ isActive }) => ['va-nav-btn', isActive ? 'is-active' : ''].join(' ').trim()}
								end={item.path === '/'}
							>
								<span className="va-nav-icon">{item.icon}</span>
								<span className="va-nav-label">{item.label}</span>
							</NavLink>
						))
					)}
				</nav>

				<div className="va-sidebar-footer">
					{user && (
						<div className="va-sidebar-user">
							<div className="va-sidebar-user-info">
								<div className="va-sidebar-user-avatar">
									{user.name
										.split(' ')
										.map((n) => n[0])
										.join('')
										.toUpperCase()}
								</div>
								<div className="va-sidebar-user-details">
									<p className="va-sidebar-user-name">{user.name}</p>
									<p className="va-sidebar-user-role">{user.role === 'admin' ? 'Administrator' : user.role === 'teacher' ? 'Profesor' : 'Student'}</p>
								</div>
							</div>
							<button
								onClick={logout}
								className="va-btn va-btn-link va-btn-sm"
								style={{ marginTop: '1rem', width: '100%' }}
							>
								Deconectare
							</button>
						</div>
					)}
					<p>© {new Date().getFullYear()} V Academy</p>
					<span>Învățare fără limite.</span>
				</div>
			</aside>

			<div className="va-shell-main">
				<main className="va-main">{children}</main>
			</div>
		</div>
	);
}

function App() {
	return (
		<AuthProvider>
			<Router>
				<Routes>
					{/* Splash first page - if authenticated, redirect to app */}
					<Route
						path="/"
						element={
							<SplashEntry />
						}
					/>
					{/* Public routes */}
					<Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
					<Route path="/register" element={<Suspense fallback={<PageLoader />}><RegisterPage /></Suspense>} />
					
					{/* Protected routes */}
					<Route
						path="/*"
						element={
							<Layout>
								<Routes>
									<Route
										path="/home"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<DashboardPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/courses"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<CoursesPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/courses/:courseId"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<CourseDetailPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/courses/:courseId/lessons"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<LessonsPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/courses/:courseId/lessons/:lessonId"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<LessonDetailPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/courses/:courseId/quiz"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<QuizPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/events"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<EventsPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/rewards"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<RewardsPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/profile"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<ProfilePage />
												</Suspense>
											</UserRoute>
										}
									/>
									{/* Admin Routes */}
									<Route
										path="/admin"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminDashboardPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/categories"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCategoriesPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/categories/:id"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<CategoryDetailPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/lessons/:id?"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<LessonCreatorPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/exams/:id?"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<ExamCreatorPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/rewards"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminRewardsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/events"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminEventsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/teams"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTeamsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/users"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminUsersPage />
												</Suspense>
											</AdminRoute>
										}
									/>
								</Routes>
							</Layout>
						}
					/>
				</Routes>
			</Router>
		</AuthProvider>
	);
}

export default App;

// Splash entry route component
function SplashEntry() {
	const { user } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (user) {
			navigate('/home', { replace: true });
		}
	}, [user, navigate]);

	if (user) {
		return null;
	}

	return (
		<SplashScreen onStart={() => navigate('/login', { replace: true })} durationMs={3800} />
	);
}
