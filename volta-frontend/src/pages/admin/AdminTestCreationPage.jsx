import React from 'react';
import { useNavigate } from 'react-router-dom';
import TestCreationWizard from '../../components/admin/tests/TestCreationWizard';

/**
 * Pagină dedicată wizardului de creare test nou.
 * Când utilizatorul finalizează, este redirecționat la editorul de test.
 */
const AdminTestCreationPage = () => {
	const navigate = useNavigate();

	return (
		<div className="admin-container admin-test-creation-page-wrap">
			<TestCreationWizard
				onClose={() => navigate('/admin/content?tab=tests')}
			/>
		</div>
	);
};

export default AdminTestCreationPage;
