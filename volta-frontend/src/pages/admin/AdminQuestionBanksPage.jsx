import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const AdminQuestionBanksPage = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [questionBanks, setQuestionBanks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingBank, setEditingBank] = useState(null);
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		category: '',
	});

	useEffect(() => {
		fetchQuestionBanks();
	}, []);

	const fetchQuestionBanks = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await adminService.getQuestionBanks();
			setQuestionBanks(Array.isArray(data) ? data : (data?.data || []));
		} catch (err) {
			console.error('Error fetching question banks:', err);
			setError('Nu s-au putut încărca băncile de întrebări');
			showToast('Eroare la încărcarea băncilor de întrebări', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingBank) {
				await adminService.updateQuestionBank(editingBank.id, formData);
				showToast('Bancă de întrebări actualizată cu succes', 'success');
			} else {
				await adminService.createQuestionBank(formData);
				showToast('Bancă de întrebări creată cu succes', 'success');
			}
			setShowModal(false);
			setEditingBank(null);
			setFormData({ title: '', description: '', category: '' });
			fetchQuestionBanks();
		} catch (err) {
			console.error('Error saving question bank:', err);
			showToast('Eroare la salvarea băncii de întrebări', 'error');
		}
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi această bancă de întrebări?')) {
			return;
		}

		try {
			await adminService.deleteQuestionBank(id);
			showToast('Bancă de întrebări ștearsă cu succes', 'success');
			fetchQuestionBanks();
		} catch (err) {
			console.error('Error deleting question bank:', err);
			showToast('Eroare la ștergerea băncii de întrebări', 'error');
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
					<div className="va-loading-spinner"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Question Banks</h1>
					<p className="va-muted admin-page-subtitle">
						Gestionează băncile de întrebări reutilizabile pentru teste
					</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingBank(null);
						setFormData({ title: '', description: '', category: '' });
						setShowModal(true);
					}}
				>
					+ Creează Bancă de Întrebări
				</button>
			</div>

			{error && (
				<div style={{
					padding: '1rem',
					background: 'rgba(244, 67, 54, 0.1)',
					color: '#f44336',
					borderRadius: '8px',
					marginBottom: '1rem',
					border: '1px solid rgba(244, 67, 54, 0.3)',
				}}>
					{error}
				</div>
			)}

			{questionBanks.length > 0 ? (
				<div className="admin-grid">
					{questionBanks.map((bank) => (
						<div key={bank.id} className="va-card admin-card">
							<div className="admin-card-body">
								<h3 className="admin-card-title">{bank.title}</h3>
								{bank.description && (
									<p className="va-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
										{bank.description}
									</p>
								)}
								<div className="admin-card-info" style={{ marginBottom: '1rem' }}>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem' }}>
										{bank.questions_count !== undefined && (
											<div>❓ {bank.questions_count} întrebări</div>
										)}
										{bank.category && (
											<div>📁 {bank.category}</div>
										)}
									</div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm"
										onClick={() => {
											setEditingBank(bank);
											setFormData({
												title: bank.title,
												description: bank.description || '',
												category: bank.category || '',
											});
											setShowModal(true);
										}}
									>
										✏️ Editează
									</button>
									<button
										className="va-btn va-btn-sm"
										onClick={() => navigate(`/admin/question-banks/${bank.id}/questions`)}
									>
										📝 Gestionează Întrebări
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(bank.id)}
									>
										🗑️ Șterge
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body" style={{ textAlign: 'center', padding: '3rem' }}>
						<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
						<p className="va-muted" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
							Nu există bănci de întrebări
						</p>
						<p className="va-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
							Băncile de întrebări permit reutilizarea întrebărilor în multiple teste
						</p>
						<button
							className="va-btn va-btn-primary"
							onClick={() => {
								setEditingBank(null);
								setFormData({ title: '', description: '', category: '' });
								setShowModal(true);
							}}
						>
							+ Creează Prima Bancă de Întrebări
						</button>
					</div>
				</div>
			)}

			{/* Create/Edit Modal */}
			{showModal && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.7)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowModal(false)}
				>
					<div
						className="va-card"
						style={{
							width: '90%',
							maxWidth: '600px',
							maxHeight: '90vh',
							overflow: 'auto',
							position: 'relative',
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<h2>{editingBank ? 'Editează Bancă de Întrebări' : 'Creează Bancă de Întrebări Nouă'}</h2>
							<button
								type="button"
								onClick={() => setShowModal(false)}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#fff',
									fontSize: '1.5rem',
									cursor: 'pointer',
									padding: '0.25rem 0.5rem',
								}}
							>
								×
							</button>
						</div>
						<div className="va-card-body">
							<form onSubmit={handleSubmit} className="va-stack">
								<div className="va-form-group">
									<label className="va-form-label">Titlu</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.title}
										onChange={(e) => setFormData({ ...formData, title: e.target.value })}
										required
										placeholder="ex: Întrebări PHP Avansat"
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Descriere</label>
									<textarea
										className="va-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										rows={4}
										placeholder="Descrierea băncii de întrebări..."
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Categorie (opțional)</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.category}
										onChange={(e) => setFormData({ ...formData, category: e.target.value })}
										placeholder="ex: PHP, JavaScript, etc."
									/>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
									<button
										type="button"
										className="va-btn"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="va-btn va-btn-primary">
										Salvează
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminQuestionBanksPage;

