import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const AdminCategoriesPage = () => {
	const navigate = useNavigate();
	const [categories, setCategories] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingCategory, setEditingCategory] = useState(null);
	const [formData, setFormData] = useState({
		name: '',
		description: '',
	});

	useEffect(() => {
		fetchCategories();
	}, []);

	const fetchCategories = async () => {
		try {
			setLoading(true);
			const data = await adminService.getCategories();
			setCategories(data);
		} catch (err) {
			console.error('Error fetching categories:', err);
			setError('Nu s-au putut încărca categoriile');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingCategory) {
				await adminService.updateCategory(editingCategory.id, formData);
			} else {
				await adminService.createCategory(formData);
			}
			setShowModal(false);
			setEditingCategory(null);
			setFormData({ name: '', description: '' });
			fetchCategories();
		} catch (err) {
			console.error('Error saving category:', err);
			alert('Eroare la salvarea categoriei');
		}
	};

	const handleEdit = (category) => {
		setEditingCategory(category);
		setFormData({
			name: category.name || '',
			description: category.description || '',
		});
		setShowModal(true);
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi acest folder? Cursurile din acest folder nu vor fi șterse, dar vor rămâne fără categorie.')) return;
		
		try {
			await adminService.deleteCategory(id);
			fetchCategories();
		} catch (err) {
			console.error('Error deleting category:', err);
			alert('Eroare la ștergerea categoriei');
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<p>Se încarcă...</p>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Foldere / Categorii</h1>
					<p className="va-muted admin-page-subtitle">
						Gestionează folderele pentru organizarea cursurilor
					</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setEditingCategory(null);
						setFormData({ name: '', description: '' });
						setShowModal(true);
					}}
				>
					+ Adaugă Folder
				</button>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: 'rgba(255,0,0,0.1)', borderRadius: '8px', marginBottom: '1rem', color: 'red' }}>
					{error}
				</div>
			)}

			{categories.length > 0 ? (
				<div className="admin-grid">
					{categories.map((category) => (
						<div key={category.id} className="va-card admin-card">
							<div className="admin-card-body">
								<div style={{ marginBottom: '1rem' }}>
									<h3 className="admin-card-title">{category.name}</h3>
									{category.description && (
										<p className="admin-card-description">{category.description}</p>
									)}
								</div>
								<div className="admin-card-info">
									<div>📚 <strong>{category.courses?.length || 0}</strong> cursuri</div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm va-btn-primary"
										onClick={() => navigate(`/admin/categories/${category.id}`)}
									>
										Deschide
									</button>
									<button
										className="va-btn va-btn-sm"
										onClick={() => handleEdit(category)}
									>
										Editează
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDelete(category.id)}
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
						<p className="va-muted">Nu există foldere create. Creează primul folder pentru a organiza cursurile.</p>
					</div>
				</div>
			)}

			{/* Modal */}
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
					onClick={() => {
						setShowModal(false);
						setEditingCategory(null);
					}}
				>
					<div
						className="va-card"
						style={{
							width: '90%',
							maxWidth: '500px',
							background: 'rgba(0,0,0,0.95)',
							border: '1px solid rgba(255,238,0,0.22)',
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header">
							<h2>{editingCategory ? 'Editează Folder' : 'Adaugă Folder Nou'}</h2>
						</div>
						<div className="va-card-body">
							<form onSubmit={handleSubmit} className="va-stack">
								<div className="va-form-group">
									<label className="va-form-label">Nume Folder *</label>
									<input
										type="text"
										className="va-form-input"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
										placeholder="ex: Regulament"
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Descriere</label>
									<textarea
										className="va-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										rows={3}
										placeholder="Descrierea folderului"
									/>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
									<button
										type="button"
										className="va-btn"
										onClick={() => {
											setShowModal(false);
											setEditingCategory(null);
										}}
									>
										Anulează
									</button>
									<button type="submit" className="va-btn va-btn-primary">
										{editingCategory ? 'Actualizează' : 'Creează'}
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

export default AdminCategoriesPage;

