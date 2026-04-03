import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminCoursesPage from './AdminCoursesPage';
import AdminCourseMapsPage from './AdminCourseMapsPage';
import AdminQuestionBanksPage from './AdminQuestionBanksPage';
import AdminExamsPage from './AdminExamsPage';
import AdminTestsPage from './AdminTestsPage';

const AdminContentPage = () => {
	const { user } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const tab = searchParams.get('tab') || 'courses';
	const rawView = searchParams.get('view') || '';
	const isInstructor = user?.actualRole === 'instructor';
	const view = isInstructor && rawView === 'maps' ? '' : rawView;
	const shouldOpenNewMap = searchParams.get('new') === '1';
	const activeTab = ['courses', 'tests', 'banks', 'exams'].includes(tab) ? tab : 'courses';

	React.useEffect(() => {
		if (!isInstructor || rawView !== 'maps') return;
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.delete('view');
			next.delete('new');
			return next;
		}, { replace: true });
	}, [isInstructor, rawView, setSearchParams]);

	return (
		<div className="admin-container admin-content-page">
			<div className="admin-content-tab-panel" role="tabpanel">
				{activeTab === 'courses' && (
					view === 'maps'
						? <AdminCourseMapsPage embedded autoOpenCreate={shouldOpenNewMap} />
						: <AdminCoursesPage embedded />
				)}
				{activeTab === 'tests' && <AdminTestsPage />}
				{activeTab === 'exams' && <AdminExamsPage />}
				{activeTab === 'banks' && <AdminQuestionBanksPage embedded />}
			</div>
		</div>
	);
};

export default AdminContentPage;
