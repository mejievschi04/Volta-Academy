import React, { lazy, Suspense, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';

import { useAuth } from '../../contexts/AuthContextShared.js';

const AdminCoursesPage = lazy(() => import('./AdminCoursesPage'));
const AdminCourseMapsPage = lazy(() => import('./AdminCourseMapsPage'));
const AdminQuestionBanksPage = lazy(() => import('./AdminQuestionBanksPage'));
const AdminExamsPage = lazy(() => import('./AdminExamsPage'));
const AdminTestsPage = lazy(() => import('./AdminTestsPage'));
const AdminManualReviewPage = lazy(() => import('./AdminManualReviewPage'));
const AdminMediaLibraryPage = lazy(() => import('./AdminMediaLibraryPage'));

function ContentTabFallback() {
	return <p className="admin-content-list-empty">Se încarcă...</p>;
}

const AdminContentPage = () => {
	const { user, canMutateInAdminArea } = useAuth();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const tab = searchParams.get('tab') || 'courses';
	const rawView = searchParams.get('view') || '';
	const isInstructor = user?.actualRole === 'instructor';
	const view = isInstructor
		? 'list'
		: rawView === 'list'
			? 'list'
			: 'maps';
	const shouldOpenNewMap = searchParams.get('new') === '1';
	const activeTab = ['courses', 'tests', 'banks', 'exams', 'manual-review', 'media'].includes(tab) ? tab : 'courses';
	const showCourseMaps = activeTab === 'courses' && view === 'maps';

	useEffect(() => {
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
				<Suspense fallback={<ContentTabFallback />}>
				{activeTab === 'courses' && (
					showCourseMaps
						? (
							<AdminCourseMapsPage
								embedded
								autoOpenCreate={shouldOpenNewMap}
								headerActions={canMutateInAdminArea ? (
									<button
										type="button"
										className="lms-btn-primary admin-btn-create-course"
										onClick={() => navigate('/admin/courses/new')}
									>
										<Plus size={18} weight="bold" aria-hidden />
										Creează curs
									</button>
								) : null}
							/>
						)
						: <AdminCoursesPage embedded />
				)}
				{activeTab === 'tests' && <AdminTestsPage />}
				{activeTab === 'exams' && <AdminExamsPage />}
				{activeTab === 'manual-review' && <AdminManualReviewPage />}
				{activeTab === 'banks' && <AdminQuestionBanksPage embedded />}
				{activeTab === 'media' && <AdminMediaLibraryPage />}
				</Suspense>
			</div>
		</div>
	);
};

export default AdminContentPage;
