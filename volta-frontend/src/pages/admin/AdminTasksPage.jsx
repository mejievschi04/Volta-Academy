import React from 'react';
import { useNavigate } from 'react-router-dom';

const AdminTasksPage = () => {
	const navigate = useNavigate();

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<button 
						onClick={() => navigate('/admin')}
						className="lms-btn-secondary"
						style={{ marginBottom: 'var(--space-4)' }}
					>
						← Înapoi la Dashboard
					</button>
					<h1 className="admin-page-title">Taskuri</h1>
					<p className="admin-page-subtitle">Gestionarea taskurilor</p>
				</div>
			</div>
			<div className="lms-empty-state">
				<div className="lms-empty-icon">✅</div>
				<h3 className="lms-empty-title">Secțiunea de taskuri va fi implementată aici</h3>
				<p className="lms-empty-description">Funcționalitatea de gestionare a taskurilor va fi disponibilă în curând</p>
			</div>
		</div>
	);
};

export default AdminTasksPage;

