import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

const AdminCoursesPage = () => {
	const navigate = useNavigate();
	const [courses, setCourses] = useState([]);
	const [categories, setCategories] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showCategoryModal, setShowCategoryModal] = useState(false);
	const [categoryFormData, setCategoryFormData] = useState({
		name: '',
		description: '',
		icon: '',
		color: '#667eea',
		order: 0,
	});

	useEffect(() => {
		fetchCourses();
		fetchCategories();
	}, []);

	const fetchCategories = async () => {
		try {
			const data = await adminService.getCategories();
			setCategories(data);
		} catch (err) {
			console.error('Error fetching categories:', err);
		}
	};

	const fetchCourses = async () => {
		try {
			setLoading(true);
			const data = await adminService.getCourses();
			setCourses(data);
		} catch (err) {
			console.error('Error fetching courses:', err);
			setError('Nu s-au putut încărca cursurile');
		} finally {
			setLoading(false);
		}
	};


	if (loading) { return null; }

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Gestionare Cursuri</h1>
					<p className="va-muted admin-page-subtitle">Gestionează compartimentele și cursurile</p>
				</div>
				<button
					className="va-btn va-btn-primary"
					onClick={() => {
						setCategoryFormData({ name: '', description: '', icon: '', color: '#667eea', order: 0 });
						setShowCategoryModal(true);
					}}
				>
					+ Adaugă Compartiment
				</button>
			</div>

			{error && (
				<div style={{ padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px', marginBottom: '1rem' }}>
					{error}
				</div>
			)}

			{/* Categories Section */}
			{categories.length > 0 ? (
				<div className="admin-grid">
					{categories.map((category) => (
						<div
							key={category.id}
							className="va-card admin-card"
							style={{ cursor: 'pointer' }}
							onClick={() => navigate(`/admin/categories/${category.id}`)}
						>
							<div className="admin-card-body">
								<h3 className="admin-card-title">
									{category.icon || '📁'} {category.name}
								</h3>
								<p className="admin-card-description">
									{category.description || 'Fără descriere'}
								</p>
								<div className="admin-card-info">
									<div>📚 <strong>{courses.filter(c => c.category_id == category.id).length}</strong> cursuri</div>
								</div>
								<div className="admin-card-actions">
									<button
										className="va-btn va-btn-sm va-btn-primary"
										onClick={(e) => {
											e.stopPropagation();
											navigate(`/admin/categories/${category.id}`);
										}}
									>
										Deschide
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="va-card">
					<div className="va-card-body">
						<p className="va-muted">Nu există compartimente. Creează unul pentru a începe.</p>
					</div>
				</div>
			)}


			{/* Category Modal */}
			{showCategoryModal && (
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
					onClick={() => setShowCategoryModal(false)}
				>
					<div
						className="va-card"
						style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header">
							<h2>Adaugă Compartiment Nou</h2>
						</div>
						<div className="va-card-body">
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									try {
										await adminService.createCategory(categoryFormData);
										setShowCategoryModal(false);
										setCategoryFormData({ name: '', description: '', icon: '', color: '#667eea', order: 0 });
										fetchCategories();
									} catch (err) {
										console.error('Error creating category:', err);
										alert('Eroare la crearea compartimentului');
									}
								}}
								className="va-stack"
							>
								<div className="va-form-group">
									<label className="va-form-label">Nume</label>
									<input
										type="text"
										className="va-form-input"
										value={categoryFormData.name}
										onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
										required
										placeholder="ex: Produse Noi"
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Descriere</label>
									<textarea
										className="va-form-input"
										value={categoryFormData.description}
										onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
										rows={3}
										placeholder="Descriere compartiment"
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Iconiță (Emoji)</label>
									<input
										type="text"
										className="va-form-input"
										value={categoryFormData.icon}
										onChange={(e) => setCategoryFormData({ ...categoryFormData, icon: e.target.value })}
										placeholder="ex: 🆕"
										maxLength={2}
									/>
								</div>
								<div className="va-form-group">
									<label className="va-form-label">Culoare</label>
									<input
										type="color"
										className="va-form-input"
										value={categoryFormData.color}
										onChange={(e) => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
									/>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
									<button
										type="button"
										className="va-btn"
										onClick={() => setShowCategoryModal(false)}
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

// Export default
export default AdminCoursesPage;