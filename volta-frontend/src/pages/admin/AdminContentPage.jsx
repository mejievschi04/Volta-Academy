import React from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminCoursesPage from './AdminCoursesPage';
import AdminTestsPage from './AdminTestsPage';
import AdminQuestionBanksPage from './AdminQuestionBanksPage';

const AdminContentPage = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const tab = searchParams.get('tab') || 'courses';
	const sub = searchParams.get('sub') || '';
	const isReviewsSubTab = sub === 'reviews';

	const setTestsSubTab = (subValue) => {
		const next = new URLSearchParams(searchParams);
		next.set('tab', 'tests');
		if (subValue) next.set('sub', subValue);
		else next.delete('sub');
		setSearchParams(next, { replace: true });
	};

	const activeTab = ['courses', 'tests', 'banks'].includes(tab) ? tab : 'courses';

	return (
		<div className="admin-container admin-content-page">
			<div className="admin-content-tab-panel" role="tabpanel">
				{activeTab === 'courses' && <AdminCoursesPage embedded />}
				{activeTab === 'tests' && (
					<AdminTestsPage
						embedded
						reviewsTab={isReviewsSubTab}
						onSubTabChange={setTestsSubTab}
					/>
				)}
				{activeTab === 'banks' && <AdminQuestionBanksPage embedded />}
			</div>
		</div>
	);
};

export default AdminContentPage;
