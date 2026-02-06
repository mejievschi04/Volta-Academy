import React, { lazy, Suspense, useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, AuthContext } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import AdminRoute from './components/AdminRoute';
import UserRoute from './components/UserRoute';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoadingOverlay from './components/LoadingOverlay';
import SplashScreen from './components/SplashScreen';
import GlobalSearch from './components/GlobalSearch';
import ThemeToggle from './components/common/ThemeToggle';
import AdminTopNavControls from './components/admin/AdminTopNavControls';
import StudentTopNavNotifications from './components/student/StudentTopNavNotifications';
import AdminStylesLoader from './components/AdminStylesLoader';
import AITutor from './components/student/AITutor';
import ErrorBoundary from './components/common/ErrorBoundary';
import { prefetchRoute } from './utils/prefetch';
/* Modern Design System - Unified & Standardized */
import './styles/design-system.css';
import './styles/light-theme-wcag.css';
import './styles/dark-theme-wcag.css';
import './styles/unified-cards.css';
import './styles/components.css';
import './styles/button-modern.css';
import './styles/common-patterns.css';
import './styles/micro-interactions.css';
import './styles/empty-states.css';
import './styles/loading-states.css';
import './styles/toast-system.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/ui-components.css';
import './styles/additional-pages.css';
import './styles/exam-results-modern.css';
import './styles/profile-modern.css';
import './styles/lms-dashboard-enterprise.css';
import './styles/achievements-modern.css';
/* Student styles - loaded after shared to ensure proper cascade */
import './styles/student-navigation-modern.css';
import './styles/student-components.css';
import './styles/student-overrides.css';
import './styles/common-components.css';
import './styles/auth-modern.css';
import './styles/course-detail-modern.css';
import './components/SplashScreen.css';
/* Mobile optimizations must be last to override base styles */
import './styles/mobile-optimizations.css';
import logoShort from './assets/Volta Logo 2@300x 1.png';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ExamPage = lazy(() => import('./pages/ExamPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const ExamResultsPage = lazy(() => import('./pages/ExamResultsPage'));
const CalendarViewPage = lazy(() => import('./pages/CalendarViewPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminCoursesPage = lazy(() => import('./pages/admin/AdminCoursesPage'));
const AdminCourseDetailPage = lazy(() => import('./pages/admin/AdminCourseDetailPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage'));
const AdminTeamsPage = lazy(() => import('./pages/admin/AdminTeamsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminActivityLogsPage = lazy(() => import('./pages/admin/AdminActivityLogsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminTopCoursesPage = lazy(() => import('./pages/admin/AdminTopCoursesPage'));
const AdminProblematicCoursesPage = lazy(() => import('./pages/admin/AdminProblematicCoursesPage'));
const AdminAlertsPage = lazy(() => import('./pages/admin/AdminAlertsPage'));
const AdminTasksPage = lazy(() => import('./pages/admin/AdminTasksPage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));
const ModuleCreatorPage = lazy(() => import('./pages/admin/ModuleCreatorPage'));
const LessonCreatorPage = lazy(() => import('./pages/admin/LessonCreatorPage'));
// const CourseCreatorPage = lazy(() => import('./pages/admin/CourseCreatorPage')); // Removed - will be rebuilt from scratch
// const AdminCourseEditPage = lazy(() => import('./pages/admin/AdminCourseEditPage')); // Removed - will be rebuilt from scratch
const AdminTestsPage = lazy(() => import('./pages/admin/AdminTestsPage'));
const AdminTestEditorPage = lazy(() => import('./pages/admin/AdminTestEditorPage'));
const CourseCreationPage = lazy(() => import('./pages/admin/CourseCreationPage'));
const AdminCourseBuilderPage = lazy(() => import('./pages/admin/AdminCourseBuilderPage'));
const AdminQuestionBanksPage = lazy(() => import('./pages/admin/AdminQuestionBanksPage'));
// const AdminQuestionBankQuestionsPage = lazy(() => import('./pages/admin/AdminQuestionBankQuestionsPage')); // Removed - will be rebuilt from scratch
const QuestionBankBuilder = lazy(() => import('./components/admin/question-banks/QuestionBankBuilder'));
const ProDashboard = lazy(() => import('./pages/ProDashboard'));
const ProCourses = lazy(() => import('./pages/ProCourses'));
const CompletedCoursesPage = lazy(() => import('./pages/CompletedCoursesPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'));
const LessonsPage = lazy(() => import('./pages/LessonsPage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));

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
	const authContext = useContext(AuthContext);
	
	if (!authContext) {
		// Context not available yet, show loading
		return (
			<div className="va-main" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
				<p>Se încarcă...</p>
			</div>
		);
	}
	const { user, logout } = authContext;
	const navigate = useNavigate();
	const location = useLocation();
	const isAdmin = user?.role === 'admin';
	
	// Check if we're on a user page (not admin pages)
	// Messages page behavior:
	// - Regular users (students): always use user layout (top nav), including on /messages
	// - Admin users: can view /messages in both interfaces
	//   - If accessed from admin sidebar: use admin layout
	//   - If accessed from user top nav: use user layout
	const isMessagesPage = location.pathname === '/messages';
	const isAdminPage = location.pathname.startsWith('/admin');
	
	// Track if we came from admin context for messages page
	const [cameFromAdmin, setCameFromAdmin] = React.useState(() => {
		if (isMessagesPage) {
			// Check if we have a stored admin context
			return sessionStorage.getItem('messagesFromAdmin') === 'true';
		}
		return false;
	});
	
	const isUserPage = !isAdminPage && !(isMessagesPage && cameFromAdmin);
	
	// For regular users (students): always show user layout (including /messages)
	// For admin: 
	//   - If on admin pages: use admin layout
	//   - If on /messages and came from admin: use admin layout
	//   - If on other user pages: use user layout (student interface)
	const isStudent = !isAdmin || (user?.role === 'student' || !user?.role || user?.role === '');
	const showUserLayout = isStudent ? true : (!isAdminPage && !(isMessagesPage && cameFromAdmin));
	
	// State for admin view toggle (active when on admin page or messages from admin)
	const [isAdminView, setIsAdminView] = React.useState((!isUserPage || (isMessagesPage && cameFromAdmin)) && isAdmin);
	
	// State for sidebar expanded/collapsed
	const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(() => {
		const saved = localStorage.getItem('sidebarExpanded');
		return saved !== null ? saved === 'true' : false;
	});

	// Detect mobile viewport
	const [isMobile, setIsMobile] = React.useState(() => window.innerWidth <= 768);
	
	React.useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth <= 768);
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);
	
	// Track navigation context for messages page
	React.useEffect(() => {
		if (isAdmin) {
			if (isAdminPage) {
				// We're on an admin page - mark that we're in admin context, clear student preview
				sessionStorage.setItem('messagesFromAdmin', 'true');
				sessionStorage.removeItem('studentPreviewFromAdmin');
				setCameFromAdmin(true);
			} else if (isMessagesPage) {
				// We're on messages - check if we came from admin
				const fromAdmin = sessionStorage.getItem('messagesFromAdmin') === 'true';
				setCameFromAdmin(fromAdmin);
			} else {
				// We're on a user page (not messages) - clear admin context
				sessionStorage.setItem('messagesFromAdmin', 'false');
				setCameFromAdmin(false);
			}
		}
	}, [location.pathname, isAdmin, isAdminPage, isMessagesPage]);

	// Student preview mode: admin viewing as student - no admin UI, 100% student experience
	const isStudentPreviewMode = isAdmin && showUserLayout && sessionStorage.getItem('studentPreviewFromAdmin') === 'true';
	
	// Update toggle state when location changes
	React.useEffect(() => {
		if (isAdmin) {
			// Admin view is active when on admin pages or messages from admin context
			setIsAdminView((!isUserPage || (isMessagesPage && cameFromAdmin)) && isAdmin);
		}
	}, [location.pathname, isAdmin, isUserPage, isMessagesPage, cameFromAdmin]);
	
	// Save sidebar state to localStorage and update body class
	React.useEffect(() => {
		localStorage.setItem('sidebarExpanded', isSidebarExpanded.toString());
		// Add class to body for CSS targeting
		if (isSidebarExpanded) {
			document.body.classList.add('sidebar-expanded');
		} else {
			document.body.classList.remove('sidebar-expanded');
		}
		return () => {
			document.body.classList.remove('sidebar-expanded');
		};
	}, [isSidebarExpanded]);

	// Admin-only layout styling hooks (avoid impacting student UI)
	React.useEffect(() => {
		const isAdminLayoutActive = !showUserLayout && isAdmin;
		document.body.classList.toggle('admin-view', isAdminLayoutActive);
		return () => {
			document.body.classList.remove('admin-view');
		};
	}, [showUserLayout, isAdmin]);
	
	// Check must_change_password - handle boolean, number, or string values
	const mustChangePassword = user?.must_change_password === true || 
		user?.must_change_password === 1 || 
		user?.must_change_password === '1' ||
		user?.must_change_password === 'true' ||
		user?.must_change_password === true;
	
	// Determine courses path based on user role and current view
	// All users use /courses (which redirects appropriately based on role)
	// Use useMemo to recalculate when location or user changes
	const coursesPath = React.useMemo(() => {
		// All users use /courses (will redirect appropriately)
		return '/courses';
	}, [user, isAdmin, isUserPage]);

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
			path: '/messages', 
			label: 'Mesagerie', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{ 
			path: coursesPath, 
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
			path: '/exam-results', 
			label: 'Rezultate Teste', 
			icon: (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

	// Admin Navigation - Flat list, grouped logically
	const adminNavItems = [
		{
			path: '/admin',
			label: 'Dashboard',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M9 21V12H15V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/courses',
			label: 'Cursuri',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M3 7V5C3 3.89543 3.89543 3 5 3H9.58579C9.851 3 10.1054 3.10536 10.2929 3.29289L12.7071 5.70711C12.8946 5.89464 13.149 6 13.4142 6H19C20.1046 6 21 6.89543 21 8V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/tests',
			label: 'Teste',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/question-banks',
			label: 'Banci de întrebări',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M4 19.5C4 18.6716 4.67157 18 5.5 18H20M4 19.5C4 20.3284 4.67157 21 5.5 21H20M4 19.5V4.5C4 3.67157 4.67157 3 5.5 3H20V18M20 18V21M9 7H15M9 11H15M9 15H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/events',
			label: 'Evenimente',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/team-members',
			label: 'Echipe',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/users',
			label: 'Utilizatori',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/messages',
			label: 'Mesagerie',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
		{
			path: '/admin/settings',
			label: 'Setări',
			icon: (
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					<path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			)
		},
	];

	return (
		<div className={`${showUserLayout ? "va-shell va-shell-topnav" : "va-shell"} ${isStudentPreviewMode ? "student-preview-mode" : ""}`}>
			<AdminStylesLoader loadOnAdminPagesOnly={true} />
			{mustChangePassword && (
				<ChangePasswordModal />
			)}
			
			{!showUserLayout && isAdmin ? (
				// Admin keeps sidebar layout with top navigation
				<>
					{/* Backdrop overlay for mobile */}
					{isSidebarExpanded && (
						<div 
							className="sidebar-backdrop"
							onClick={() => setIsSidebarExpanded(false)}
							aria-hidden="true"
						/>
					)}
					
					<aside className={`modern-sidebar va-sidebar ${isSidebarExpanded ? 'expanded open' : ''}`}>
						<div className="modern-sidebar-brand va-sidebar-brand">
							<span className="modern-sidebar-logo va-logo-text">
								<img 
									src={logoShort} 
									alt="Volta Academy" 
									className="va-logo-icon-img"
									style={{ width: '32px', height: '32px', objectFit: 'contain' }}
								/>
							</span>
							{isSidebarExpanded && (
								<span className="modern-sidebar-brand-text">Volta Academy</span>
							)}
						</div>

						<nav className="modern-nav va-sidebar-nav">
							{adminNavItems.map((item) => (
								<NavLink
									key={item.path}
									to={item.path}
									data-tooltip={!isSidebarExpanded ? item.label : undefined}
									className={({ isActive }) => ['modern-nav-item', 'va-nav-btn', isActive ? 'active is-active' : ''].join(' ').trim()}
									end={item.path === '/admin'}
									onMouseEnter={() => prefetchRoute(item.path)}
									onClick={() => {
										// Close sidebar on mobile when clicking a link
										if (window.innerWidth <= 768) {
											setIsSidebarExpanded(false);
										}
									}}
								>
									<span className="modern-nav-item-icon va-nav-icon">{item.icon}</span>
									<span className="modern-nav-item-label va-nav-label">{item.label}</span>
								</NavLink>
							))}
						</nav>

						{/* Mobile Toggle Controls in Sidebar - positioned after nav - only on mobile */}
						{isMobile && (
						<div className="sidebar-mobile-controls">
							{/* Theme Toggle */}
							<div className="sidebar-mobile-control-item">
								<span className="sidebar-mobile-control-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<circle cx="12" cy="12" r="4"/>
										<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
									</svg>
								</span>
								{isSidebarExpanded && (
									<div className="sidebar-mobile-control-content">
										<span className="sidebar-mobile-control-label">Temă</span>
										<ThemeToggle />
									</div>
								)}
							</div>

							{/* View Switcher */}
							<div className="sidebar-mobile-control-item">
								<span className="sidebar-mobile-control-icon">
									{isUserPage ? (
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
											<circle cx="12" cy="12" r="3"/>
										</svg>
									) : (
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
										</svg>
									)}
								</span>
								{isSidebarExpanded && (
									<div className="sidebar-mobile-control-content">
										<span className="sidebar-mobile-control-label">Vizionare</span>
										<button
											onClick={() => {
												if (isUserPage) {
													navigate('/admin', { replace: true });
												} else {
													navigate('/home', { replace: true });
												}
											}}
											className="admin-view-switcher"
											title={isUserPage ? "Comută la Admin" : "Comută la Student"}
											aria-label={isUserPage ? "Comută la Admin" : "Comută la Student"}
										>
											<div className="admin-view-switcher-slider" style={{
												transform: isUserPage ? 'translateX(0)' : 'translateX(24px)',
											}}>
												{isUserPage ? (
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
														<circle cx="12" cy="12" r="3"/>
													</svg>
												) : (
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
													</svg>
												)}
											</div>
										</button>
									</div>
								)}
							</div>
						</div>
						)}

						{/* Mobile Logout Button - positioned at bottom - only on mobile */}
						{isMobile && user && (
							<div className="sidebar-mobile-logout">
								<button
									onClick={logout}
									className="sidebar-mobile-logout-btn"
									title="Deconectare"
									aria-label="Deconectare"
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
										<polyline points="16 17 21 12 16 7"/>
										<line x1="21" y1="12" x2="9" y2="12"/>
									</svg>
									{isSidebarExpanded && <span className="sidebar-mobile-logout-label">Deconectare</span>}
								</button>
							</div>
						)}
					</aside>

					{/* Desktop: expand/collapse button - outside sidebar, bottom right */}
					<button
						className={`sidebar-expand-toggle desktop-sidebar-toggle ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}
						onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
						title={isSidebarExpanded ? "Restrânge meniul" : "Extinde meniul"}
						aria-label={isSidebarExpanded ? "Restrânge meniul" : "Extinde meniul"}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isSidebarExpanded ? 'none' : 'rotate(180deg)' }}>
							<polyline points="15 18 9 12 15 6"/>
						</svg>
					</button>

					{/* Top Navigation Bar for Admin */}
					<header className={`modern-topnav admin-topnav ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
						<div className="modern-topnav-left">
							{/* Mobile hamburger button */}
							<button
								className="mobile-sidebar-toggle"
								onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
								title="Deschide meniul"
								aria-label="Deschide meniul"
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
									<line x1="3" y1="6" x2="21" y2="6"/>
									<line x1="3" y1="12" x2="21" y2="12"/>
									<line x1="3" y1="18" x2="21" y2="18"/>
								</svg>
							</button>
							<span className="va-logo-text">
								<img 
									src={logoShort} 
									alt="Volta Academy" 
									className="va-logo-icon-img"
									style={{ width: '32px', height: '32px', objectFit: 'contain' }}
								/>
							</span>
							{/* Volta Academy text - shown when sidebar is closed on mobile */}
							{isMobile && !isSidebarExpanded && (
								<span className="va-topnav-page-title">Volta Academy</span>
							)}
						</div>
						
						<div className="modern-topnav-right">
							{/* Search and Notifications */}
							<AdminTopNavControls />

							{/* Theme Toggle - Desktop only */}
							<div className="admin-topnav-control desktop-only">
								<span className="admin-topnav-control-label">Temă</span>
								<ThemeToggle />
							</div>

							{/* View Switcher - Desktop only */}
							<div className="admin-topnav-control desktop-only">
								<span className="admin-topnav-control-label">Vizionare</span>
								<button
									type="button"
									onClick={() => {
										if (isUserPage) {
											navigate('/admin', { replace: true });
										} else {
											// Redirect to student home page when switching to student view
											navigate('/home', { replace: true });
										}
									}}
									className="admin-view-switcher"
									title={isUserPage ? "Comută la Admin" : "Comută la Student"}
									aria-label={isUserPage ? "Comută la Admin" : "Comută la Student"}
								>
									<div className="admin-view-switcher-slider" style={{
										transform: isUserPage ? 'translateX(0)' : 'translateX(24px)',
									}}>
										{isUserPage ? (
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
												<circle cx="12" cy="12" r="3"/>
											</svg>
										) : (
											<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
											</svg>
										)}
									</div>
								</button>
							</div>

							{/* User Info */}
							{user && (
								<div className="admin-topnav-user">
									<div className="admin-topnav-user-avatar">
										{user.name
											?.split(' ')
											.map((n) => n[0])
											.join('')
											.toUpperCase() || 'A'}
									</div>
									<div className="admin-topnav-user-info">
										<p className="admin-topnav-user-name">{user.name || 'Administrator'}</p>
										<p className="admin-topnav-user-role">Administrator</p>
									</div>
									<button
										onClick={logout}
										className="admin-topnav-logout"
										title="Deconectare"
										aria-label="Deconectare"
									>
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
											<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
											<polyline points="16 17 21 12 16 7"/>
											<line x1="21" y1="12" x2="9" y2="12"/>
										</svg>
									</button>
								</div>
							)}
						</div>
					</header>

					<div className="va-shell-main va-shell-main-topnav">
						<main className="va-main">{children}</main>
					</div>
					
					{/* AI Tutor - Only on courses page */}
					{user && location.pathname === '/courses' && (
						<AITutor />
					)}
				</>
			) : (
				// Regular users get modern top navigation with sidebar on mobile
				<>
					{/* Backdrop overlay for mobile */}
					{isSidebarExpanded && (
						<div 
							className="sidebar-backdrop"
							onClick={() => setIsSidebarExpanded(false)}
							aria-hidden="true"
						/>
					)}

					{/* Student Sidebar - Mobile (same structure as admin) */}
					<aside className={`modern-sidebar va-sidebar student-sidebar ${isSidebarExpanded ? 'expanded open' : ''}`}>
						<div className="modern-sidebar-brand va-sidebar-brand">
							<span className="modern-sidebar-logo va-logo-text">
								<img 
									src={logoShort} 
									alt="Volta Academy" 
									className="va-logo-icon-img"
									style={{ width: '32px', height: '32px', objectFit: 'contain' }}
								/>
							</span>
							{isSidebarExpanded && (
								<span className="modern-sidebar-brand-text">Volta Academy</span>
							)}
						</div>

						<nav className="modern-nav va-sidebar-nav">
							{navItems.map((item) => (
								<NavLink
									key={item.path}
									to={item.path}
									data-tooltip={!isSidebarExpanded ? item.label : undefined}
									className={({ isActive }) => ['modern-nav-item', 'va-nav-btn', isActive ? 'active is-active' : ''].join(' ').trim()}
									end={item.path === '/home'}
									onMouseEnter={() => prefetchRoute(item.path)}
									onClick={() => {
										// Close sidebar on mobile when clicking a link
										if (window.innerWidth <= 768) {
											setIsSidebarExpanded(false);
										}
									}}
								>
									<span className="modern-nav-item-icon va-nav-icon">{item.icon}</span>
									<span className="modern-nav-item-label va-nav-label">{item.label}</span>
								</NavLink>
							))}
						</nav>

						{/* Mobile Toggle Controls in Sidebar - positioned after nav - only on mobile */}
						{isMobile && (
						<div className="sidebar-mobile-controls">
							{/* Theme Toggle */}
							<div className="sidebar-mobile-control-item">
								<span className="sidebar-mobile-control-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<circle cx="12" cy="12" r="4"/>
										<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
									</svg>
								</span>
								{isSidebarExpanded && (
									<div className="sidebar-mobile-control-content">
										<span className="sidebar-mobile-control-label">Temă</span>
										<ThemeToggle />
									</div>
								)}
							</div>

							{/* View Switcher (only for admins, hidden in student preview mode) */}
							{isAdmin && !isStudentPreviewMode && (
								<div className="sidebar-mobile-control-item">
									<span className="sidebar-mobile-control-icon">
										{isUserPage ? (
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
												<circle cx="12" cy="12" r="3"/>
											</svg>
										) : (
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
											</svg>
										)}
									</span>
									{isSidebarExpanded && (
										<div className="sidebar-mobile-control-content">
											<span className="sidebar-mobile-control-label">Vizionare</span>
											<button
												onClick={() => {
													if (isUserPage) {
														navigate('/admin', { replace: true });
													} else {
														navigate('/home', { replace: true });
													}
												}}
												className="admin-view-switcher"
												title={isUserPage ? "Comută la Admin" : "Comută la Student"}
												aria-label={isUserPage ? "Comută la Admin" : "Comută la Student"}
											>
												<div className="admin-view-switcher-slider" style={{
													transform: isUserPage ? 'translateX(0)' : 'translateX(24px)',
												}}>
													{isUserPage ? (
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
															<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
															<circle cx="12" cy="12" r="3"/>
														</svg>
													) : (
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
															<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
														</svg>
													)}
												</div>
											</button>
										</div>
									)}
								</div>
							)}
						</div>
						)}

						{/* Mobile Logout Button - positioned at bottom - only on mobile */}
						{isMobile && user && (
							<div className="sidebar-mobile-logout">
								<button
									onClick={logout}
									className="sidebar-mobile-logout-btn"
									title="Deconectare"
									aria-label="Deconectare"
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
										<polyline points="16 17 21 12 16 7"/>
										<line x1="21" y1="12" x2="9" y2="12"/>
									</svg>
									{isSidebarExpanded && <span className="sidebar-mobile-logout-label">Deconectare</span>}
								</button>
							</div>
						)}
					</aside>

					<header className={`modern-topnav va-topnav ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
						<div className="modern-topnav-left va-topnav-brand">
							{/* Mobile hamburger button */}
							<button
								className="mobile-sidebar-toggle"
								onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
								title="Deschide meniul"
								aria-label="Deschide meniul"
							>
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
									<line x1="3" y1="6" x2="21" y2="6"/>
									<line x1="3" y1="12" x2="21" y2="12"/>
									<line x1="3" y1="18" x2="21" y2="18"/>
								</svg>
							</button>
							<span className="va-logo-text">
								<img 
									src={logoShort} 
									alt="Volta Academy" 
									className="va-logo-icon-img"
									style={{ width: '32px', height: '32px', objectFit: 'contain' }}
								/>
							</span>
							{/* Volta Academy text - shown when sidebar is closed on mobile (same as admin) */}
							{isMobile && !isSidebarExpanded && (
								<span className="va-topnav-page-title">Volta Academy</span>
							)}
						</div>

						<nav className="modern-topnav-nav va-topnav-nav desktop-only">
							{navItems.map((item) => (
								<NavLink
									key={item.path}
									to={item.path}
									className={({ isActive }) => ['modern-topnav-item', 'va-topnav-btn', isActive ? 'active is-active' : ''].join(' ').trim()}
									end={item.path === '/home'}
									onMouseEnter={() => prefetchRoute(item.path)}
								>
									<span className="modern-topnav-item-icon va-topnav-icon">{item.icon}</span>
									<span className="modern-topnav-item-label va-topnav-label">{item.label}</span>
								</NavLink>
							))}
						</nav>

						<div className="modern-topnav-right">
							{user && (
								<>
									{/* Notifications - studenți */}
									<StudentTopNavNotifications />

									{/* Theme Toggle - Desktop only */}
									<div className="admin-topnav-control desktop-only">
										<span className="admin-topnav-control-label">Temă</span>
										<ThemeToggle />
									</div>

									{/* View Switcher (only for admins, hidden in student preview mode) - Desktop only */}
									{isAdmin && !isStudentPreviewMode && (
										<div className="admin-topnav-control desktop-only">
											<span className="admin-topnav-control-label">Vizionare</span>
											<button
												type="button"
												onClick={() => {
													if (isUserPage) {
														navigate('/admin', { replace: true });
													} else {
														// Redirect to student home page when switching to student view
														navigate('/home', { replace: true });
													}
												}}
												className="admin-view-switcher"
												title={isUserPage ? "Comută la Admin" : "Comută la Student"}
												aria-label={isUserPage ? "Comută la Admin" : "Comută la Student"}
											>
												<div className="admin-view-switcher-slider" style={{
													transform: isUserPage ? 'translateX(0)' : 'translateX(24px)',
												}}>
													{isUserPage ? (
														<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
															<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
															<circle cx="12" cy="12" r="3"/>
														</svg>
													) : (
														<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
															<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
														</svg>
													)}
												</div>
											</button>
										</div>
									)}

									{/* User Info - Desktop only */}
									<div className="admin-topnav-user desktop-only">
										<div className="admin-topnav-user-avatar">
											{user.name
												?.split(' ')
												.map((n) => n[0])
												.join('')
												.toUpperCase() || 'U'}
										</div>
										<div className="admin-topnav-user-info">
											<p className="admin-topnav-user-name">{user.name || 'Utilizator'}</p>
										<p className="admin-topnav-user-role">
											{isStudentPreviewMode ? 'Student' : (isAdmin ? 'Administrator' : 'Student')}
										</p>
										</div>
										<button
											onClick={logout}
											className="admin-topnav-logout"
											title="Deconectare"
											aria-label="Deconectare"
										>
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
												<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
												<polyline points="16 17 21 12 16 7"/>
												<line x1="21" y1="12" x2="9" y2="12"/>
											</svg>
										</button>
									</div>
								</>
							)}
						</div>
					</header>

					<div className="va-shell-main va-shell-main-topnav">
						<main className="va-main">{children}</main>
					</div>
					
					{/* AI Tutor - Only on courses page */}
					{showUserLayout && user && location.pathname === '/courses' && (
						<AITutor />
					)}

					{/* Înapoi la Admin - minimal button when admin views as student */}
					{isStudentPreviewMode && (
						<button
							type="button"
							className="student-preview-back-to-admin"
							onClick={() => {
								sessionStorage.removeItem('studentPreviewFromAdmin');
								navigate('/admin/courses', { replace: true });
							}}
							title="Înapoi la Admin"
							aria-label="Înapoi la Admin"
						>
							← Admin
						</button>
					)}
				</>
			)}
		</div>
	);
}

function App() {
	const [isSearchOpen, setIsSearchOpen] = useState(false);

	useEffect(() => {
		const handleOpenSearch = () => setIsSearchOpen(true);
		document.addEventListener('openGlobalSearch', handleOpenSearch);
		return () => document.removeEventListener('openGlobalSearch', handleOpenSearch);
	}, []);

	return (
		<ThemeProvider>
			<ToastProvider>
				<AuthProvider>
					<Router>
						<GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
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
							path="/pro-dashboard"
							element={
								<UserRoute>
									<Suspense fallback={<PageLoader />}>
										<ProDashboard />
									</Suspense>
								</UserRoute>
							}
						/>

						<Route
							path="/pro-courses"
							element={
								<UserRoute>
									<Suspense fallback={<PageLoader />}>
										<ProCourses />
									</Suspense>
								</UserRoute>
							}
						/>

						{/* Course Lessons Page - Main course view */}
									<Route
										path="/courses/:courseId"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<LessonsPage />
												</Suspense>
											</UserRoute>
										}
									/>
						{/* Individual Lesson Page */}
									<Route
										path="/courses/:courseId/lessons/:lessonId"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<LessonPage />
												</Suspense>
											</UserRoute>
										}
									/>
						{/* Course Detail Page */}
									<Route
										path="/courses/:courseId/detail"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<CourseDetailPage />
												</Suspense>
											</UserRoute>
										}
									/>
									{/* Exam/Test page - course context required for correct test attribution */}
									<Route
										path="/courses/:courseId/exams/:examId"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<ExamPage />
												</Suspense>
											</UserRoute>
										}
									/>
									{/* Legacy routes - kept for backward compatibility */}
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
										path="/events/:id"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<EventDetailPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/exam-results"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<ExamResultsPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/achievements"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<AchievementsPage />
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
									<Route
										path="/messages"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<MessagesPage />
												</Suspense>
											</UserRoute>
										}
									/>
									<Route
										path="/completed-courses"
										element={
											<UserRoute>
												<Suspense fallback={<PageLoader />}>
													<CompletedCoursesPage />
												</Suspense>
											</UserRoute>
										}
									/>
									{/* Admin viewing user profile */}
									<Route
										path="/admin/users/:userId/profile"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<ProfilePage />
												</Suspense>
											</AdminRoute>
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
										path="/admin/analytics"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminAnalyticsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/courses"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCoursesPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									{/* Course Creation Route */}
									<Route
										path="/admin/courses/new"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<CourseCreationPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									{/* Course Detail Route */}
									<Route
										path="/admin/courses/:id"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCourseDetailPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/courses/:id/builder"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCourseBuilderPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									{/* Course Edit/Detail Routes - Removed - will be rebuilt from scratch */}
									{/* <Route
										path="/admin/courses/new"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCourseEditPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/courses/:id/builder"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCourseEditPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/courses/:id/edit"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminCourseEditPage />
												</Suspense>
											</AdminRoute>
										}
									/> */}
									<Route
										path="/admin/modules/:id?"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<ModuleCreatorPage />
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
									{/* Test Routes */}
									<Route
										path="/admin/tests"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTestsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/tests/reviews"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTestsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/tests/new"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTestEditorPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/tests/:id"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTestEditorPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									{/* Question Bank Routes */}
									<Route
										path="/admin/question-banks"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminQuestionBanksPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/question-banks/new/builder"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<QuestionBankBuilder />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/question-banks/:id/builder"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<QuestionBankBuilder />
												</Suspense>
											</AdminRoute>
										}
									/>
									{/* <Route
										path="/admin/question-banks/:bankId/questions"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminQuestionBankQuestionsPage />
												</Suspense>
											</AdminRoute>
										}
									/> */}
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
										path="/admin/team-members"
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
									<Route
										path="/admin/activity-logs"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminActivityLogsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/settings"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminSettingsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/top-courses"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTopCoursesPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/problematic-courses"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminProblematicCoursesPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/activity"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminActivityPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/alerts"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminAlertsPage />
												</Suspense>
											</AdminRoute>
										}
									/>
									<Route
										path="/admin/tasks"
										element={
											<AdminRoute>
												<Suspense fallback={<PageLoader />}>
													<AdminTasksPage />
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
		</ToastProvider>
		</ThemeProvider>
	);
}

// Wrap App with ErrorBoundary
function AppWithErrorBoundary() {
	return (
		<ErrorBoundary showDetails={import.meta.env.DEV}>
			<App />
		</ErrorBoundary>
	);
}

export default AppWithErrorBoundary;

// Splash entry - afișează splash-ul în timp ce se încarcă auth, prefetch, etc.
function SplashEntry() {
	const { user, loading } = useAuth();
	const navigate = useNavigate();
	const [prefetchDone, setPrefetchDone] = useState(false);

	// Prefetch pagini critice – butonul apare doar după ce totul e încărcat
	useEffect(() => {
		Promise.all([
			import('./pages/LoginPage'),
			import('./pages/DashboardPage'),
			import('./pages/CoursesPage'),
		])
			.then(() => setPrefetchDone(true))
			.catch(() => setPrefetchDone(true));
	}, []);

	useEffect(() => {
		if (!loading && user) {
			navigate('/home', { replace: true });
		}
	}, [user, loading, navigate]);

	if (user) {
		return null;
	}

	// appReady = auth gata ȘI prefetch gata
	const appReady = !loading && prefetchDone;

	return (
		<SplashScreen
			onStart={() => navigate('/login', { replace: true })}
			appReady={appReady}
		/>
	);
}
