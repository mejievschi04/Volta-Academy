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
						className="btn btn-ghost"
						style={{ marginBottom: '1rem' }}
					>
						← Înapoi la Dashboard
					</button>
					<h1 className="admin-page-title">Taskuri</h1>
					<p className="admin-page-subtitle">Gestionarea taskurilor</p>
				</div>
			</div>
			<div className="admin-section-card">
				<div className="admin-section-header">
					<h2>Taskuri</h2>
				</div>
				<div className="empty-state">
					<div className="empty-state-icon">✅</div>
					<div className="empty-state-title">Secțiunea de taskuri va fi implementată aici</div>
				</div>
			</div>
		</div>
	);
};

export default AdminTasksPage;

