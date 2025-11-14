import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LessonsPage from './pages/LessonsPage';
import LessonDetailPage from './pages/LessonDetailPage';
import CoursesPage from './pages/CoursesPage';
import QuizPage from './pages/QuizPage';
import RewardsPage from './pages/RewardsPage';
import ProfilePage from './pages/ProfilePage';
import CalendarPage from './pages/CalendarPage';
import CalendarViewPage from './pages/CalendarViewPage';
import './App.css';

function Layout({ children }) {
	const navItems = [
		{ 
			path: '/', 
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
			path: '/calendar', 
			label: 'Calendar', 
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

	return (
		<div className="va-shell">
			<aside className="va-sidebar">
				<div className="va-sidebar-brand">
					<div className="va-logo-orb" />
					<span className="va-logo-text">Volta Academy</span>
				</div>

				<nav className="va-sidebar-nav">
					{navItems.map((item) => (
						<NavLink
							key={item.path}
							to={item.path}
							className={({ isActive }) => ['va-nav-btn', isActive ? 'is-active' : ''].join(' ').trim()}
							end={item.path === '/'}
						>
							<span className="va-nav-icon">{item.icon}</span>
							<span className="va-nav-label">{item.label}</span>
						</NavLink>
					))}
				</nav>

				<div className="va-sidebar-footer">
					<p>© {new Date().getFullYear()} Volta Academy</p>
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
		<Router>
			<Layout>
				<Routes>
					<Route path="/" element={<DashboardPage />} />
					<Route path="/courses" element={<CoursesPage />} />
					<Route path="/courses/:courseId/lessons" element={<LessonsPage />} />
					<Route path="/courses/:courseId/lessons/:lessonId" element={<LessonDetailPage />} />
					<Route path="/courses/:courseId/quiz" element={<QuizPage />} />
					<Route path="/calendar" element={<CalendarPage />} />
					<Route path="/calendar/view" element={<CalendarViewPage />} />
					<Route path="/rewards" element={<RewardsPage />} />
					<Route path="/profile" element={<ProfilePage />} />
				</Routes>
			</Layout>
		</Router>
	);
}

export default App;
