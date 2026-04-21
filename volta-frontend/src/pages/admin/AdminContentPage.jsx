import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AICourseChat from '../../components/admin/ai/AICourseChat';
import AdminCoursesPage from './AdminCoursesPage';
import AdminCourseMapsPage from './AdminCourseMapsPage';
import AdminQuestionBanksPage from './AdminQuestionBanksPage';
import AdminExamsPage from './AdminExamsPage';
import AdminTestsPage from './AdminTestsPage';
import AdminManualReviewPage from './AdminManualReviewPage';

const AdminContentPage = () => {
	const { user, canMutateInAdminArea } = useAuth();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [showCreateMenu, setShowCreateMenu] = useState(false);
	const [showVoltCourseChat, setShowVoltCourseChat] = useState(false);
	const createMenuRef = useRef(null);
	const tab = searchParams.get('tab') || 'courses';
	const rawView = searchParams.get('view') || '';
	const isInstructor = user?.actualRole === 'instructor';
	const view = isInstructor && rawView === 'maps' ? '' : rawView;
	const shouldOpenNewMap = searchParams.get('new') === '1';
	const activeTab = ['courses', 'tests', 'banks', 'exams', 'manual-review'].includes(tab) ? tab : 'courses';

	useEffect(() => {
		const handleOutsideClick = (event) => {
			if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
				setShowCreateMenu(false);
			}
		};
		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, []);

	useEffect(() => {
		if (!isInstructor || rawView !== 'maps') return;
		setSearchParams((prev) => {
			const next = new URLSearchParams(prev);
			next.delete('view');
			next.delete('new');
			return next;
		}, { replace: true });
	}, [isInstructor, rawView, setSearchParams]);

	const handleVoltCourseGenerated = (course) => {
		if (course?.id) {
			setShowVoltCourseChat(false);
			navigate(`/admin/courses/${course.id}/builder`);
		}
	};

	return (
		<div className="admin-container admin-content-page">
			{showVoltCourseChat && canMutateInAdminArea && (
				<div className="ai-chat-modal-overlay" onClick={() => setShowVoltCourseChat(false)}>
					<div className="ai-chat-modal" onClick={(e) => e.stopPropagation()}>
						<AICourseChat
							onCourseGenerated={handleVoltCourseGenerated}
							onClose={() => setShowVoltCourseChat(false)}
						/>
					</div>
				</div>
			)}
			{activeTab === 'courses' && view === 'maps' && canMutateInAdminArea && (
				<div className="admin-content-page-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
					<div className="admin-courses-create-wrap" ref={createMenuRef}>
						<button className="admin-courses-create-btn" onClick={() => setShowCreateMenu((prev) => !prev)}>
							+ Creează curs
						</button>
						{showCreateMenu && (
							<div className="admin-courses-create-menu">
								<button onClick={() => { setShowCreateMenu(false); navigate('/admin/courses/new'); }}>
									Curs nou
								</button>
								<button onClick={() => { setShowCreateMenu(false); setShowVoltCourseChat(true); }}>
									Curs cu Volt
								</button>
							</div>
						)}
					</div>
				</div>
			)}
			<div className="admin-content-tab-panel" role="tabpanel">
				{activeTab === 'courses' && (
					view === 'maps'
						? <AdminCourseMapsPage embedded autoOpenCreate={shouldOpenNewMap} />
						: <AdminCoursesPage embedded />
				)}
				{activeTab === 'tests' && <AdminTestsPage />}
				{activeTab === 'exams' && <AdminExamsPage />}
				{activeTab === 'manual-review' && <AdminManualReviewPage />}
				{activeTab === 'banks' && <AdminQuestionBanksPage embedded />}
			</div>
		</div>
	);
};

export default AdminContentPage;