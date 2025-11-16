import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const AdminRewardsPage = () => {
	const [rewards, setRewards] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingReward, setEditingReward] = useState(null);
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		points_required: 0,
	});

	useEffect(() => {
		fetchRewards();
	}, []);

	const fetchRewards = async () => {
		try {
			setLoading(true);
			const data = await adminService.getRewards();
			setRewards(data);
		} catch (err) {
			console.error('Error fetching rewards:', err);
			setError('Nu s-au putut încărca recompensele');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingReward) {
				await adminService.updateReward(editingReward.id, formData);
			} else {
				await adminService.createReward(formData);
			}

			setShowModal(false);
			setEditingReward(null);
			setFormData({ title: '', description: '', points_required: 0 });
			fetchRewards();
		} catch (err) {
			console.error('Error saving reward:', err);
			alert('Eroare la salvarea recompensei');
		}
	};

	const handleEdit = (reward) => {
		setEditingReward(reward);
		setFormData({
			title: reward.title,
			description: reward.description,
			points_required: reward.points_required || 0,
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi această recompensă?')) return;

		try {
			await adminService.deleteReward(id);
			fetchRewards();
		} catch (err) {
			console.error('Error deleting reward:', err);
			alert('Eroare la ștergerea recompensei');
		}
	};

	if (loading) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Recompense</h1>
					<p className="va-muted admin-page-subtitle">Gestionează toate recompensele din platformă</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingReward(null);
						setFormData({ title: '', description: '', points_required: 0 });
						setShowModal(true);
					}}
				>
					+ Adaugă Recompensă
				</button>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{rewards.length > 0 ? (
				<div className="admin-grid">
					{rewards.map((reward) => (
						<div
							key={reward.id}
							className="va-card admin-card"
						>
							<div className="admin-card-body">
								<h3 className="admin-card-title">🏆 {reward.title}</h3>
								<p className="admin-card-description">
									{reward.description}
								</p>
								<div className="admin-card-info">
									<div>⭐ <strong>{reward.points_required || 0}</strong> puncte</div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm"
										onClick={() => handleEdit(reward)}
									>
										Editează
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(reward.id)}
									>
										Șterge
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body">
						<p className="va-muted">Nu există recompense</p>
					</div>
				</div>
			)}

			{showModal && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0,0,0,0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowModal(false)}
				>
					<div
						className="va-card"
						style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header">
							<h2>{editingReward ? 'Editează Recompensă' : 'Adaugă Recompensă Nouă'}</h2>
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
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Descriere</label>
									<textarea
										className="va-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										required
										rows={4}
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Puncte Necesare</label>
									<input
										type="number"
										className="va-form-input"
										value={formData.points_required}
										onChange={(e) => setFormData({ ...formData, points_required: parseInt(e.target.value) || 0 })}
										min="0"
										required
									/>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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

export default AdminRewardsPage;

