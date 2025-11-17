import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoriesService } from '../services/api';

const CoursesPage = () => {
	const navigate = useNavigate();
	const [categories, setCategories] = useState([]);
	const [selectedFolder, setSelectedFolder] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchCategories = async () => {
			try {
				setLoading(true);
				const data = await categoriesService.getAll();
				setCategories(data);
			} catch (err) {
				console.error('Error fetching categories:', err);
				setError('Nu s-au putut încărca categoriile');
			} finally {
				setLoading(false);
			}
		};
		fetchCategories();
	}, []);

	if (loading) {
		return (
			<div className="va-stack" style={{ padding: '2rem', textAlign: 'center' }}>
				<p className="va-muted">Se încarcă...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="va-stack" style={{ padding: '2rem' }}>
				<p style={{ color: 'var(--va-primary)' }}>{error}</p>
			</div>
		);
	}

	// If a folder is selected, show courses in that folder
	if (selectedFolder) {
		const folder = categories.find(cat => cat.id === selectedFolder);
		if (!folder) {
			setSelectedFolder(null);
			return null;
		}

		return (
			<div className="va-stack" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
				{/* Breadcrumb */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
					<button
						type="button"
						onClick={() => setSelectedFolder(null)}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							background: 'rgba(255,255,255,0.05)',
							border: '1px solid rgba(255,238,0,0.22)',
							borderRadius: '12px',
							padding: '0.75rem 1.25rem',
							color: 'var(--va-text)',
							cursor: 'pointer',
							fontSize: '0.95rem',
							fontWeight: 600,
							transition: 'all 0.3s ease'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = 'rgba(255,238,0,0.12)';
							e.currentTarget.style.borderColor = 'rgba(255,238,0,0.35)';
							e.currentTarget.style.transform = 'translateX(-4px)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
							e.currentTarget.style.borderColor = 'rgba(255,238,0,0.22)';
							e.currentTarget.style.transform = 'translateX(0)';
						}}
					>
						<span>←</span>
						<span>Înapoi la foldere</span>
					</button>
					<span style={{ color: 'var(--va-muted)', fontSize: '1.2rem' }}>/</span>
					<span style={{ color: 'var(--va-primary)', fontWeight: 600 }}>
						{folder.name}
					</span>
				</div>

				{/* Folder Header */}
				<div className="va-course-detail-header" style={{
					background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
					border: '1px solid rgba(255,238,0,0.3)',
					borderRadius: '24px',
					padding: '3rem',
					marginBottom: '2.5rem',
					boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset',
					position: 'relative',
					overflow: 'hidden'
				}}>
					<div style={{
						position: 'absolute',
						top: '-30%',
						right: '-10%',
						width: '400px',
						height: '400px',
						background: 'radial-gradient(circle, rgba(255,238,0,0.12), transparent)',
						pointerEvents: 'none'
					}} />
					<div style={{ position: 'relative', zIndex: 1 }}>
						<h1 className="va-page-title" style={{
							background: 'linear-gradient(135deg, #fff, #ffee00)',
							WebkitBackgroundClip: 'text',
							WebkitTextFillColor: 'transparent',
							fontSize: '2.5rem',
							letterSpacing: '-0.02em',
							lineHeight: 1.2,
							marginBottom: '0.75rem'
						}}>
							{folder.name}
						</h1>
						{folder.description && (
							<p className="va-muted" style={{ fontSize: '1.15rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)' }}>
								{folder.description}
							</p>
						)}
					</div>
				</div>

				{/* Courses Grid */}
				{folder.courses && folder.courses.length > 0 ? (
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
						{folder.courses.map((course) => (
							<button
								key={course.id}
								type="button"
								onClick={() => navigate(`/courses/${course.id}`)}
								className="va-course-detail-header"
								style={{
									width: '100%',
									background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
									border: '1px solid rgba(255,238,0,0.3)',
									borderRadius: '24px',
									padding: '2.5rem',
									cursor: 'pointer',
									transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
									display: 'flex',
									flexDirection: 'column',
									textAlign: 'left',
									color: 'var(--va-text)',
									boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset',
									position: 'relative',
									overflow: 'hidden'
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))';
									e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
									e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
									e.currentTarget.style.boxShadow = '0 16px 48px rgba(255,238,0,0.2), 0 0 0 1px rgba(255,238,0,0.2) inset';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))';
									e.currentTarget.style.borderColor = 'rgba(255,238,0,0.3)';
									e.currentTarget.style.transform = 'translateY(0) scale(1)';
									e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset';
								}}
							>
								<div style={{
									position: 'absolute',
									top: '-30%',
									right: '-10%',
									width: '300px',
									height: '300px',
									background: 'radial-gradient(circle, rgba(255,238,0,0.12), transparent)',
									pointerEvents: 'none'
								}} />
								<div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
									<h3 style={{
										color: 'var(--va-text)',
										fontSize: '1.5rem',
										fontWeight: 700,
										margin: 0,
										marginBottom: '1rem',
										lineHeight: 1.3
									}}>
										{course.title}
									</h3>
									{course.description && (
										<p style={{
											color: 'var(--va-muted)',
											fontSize: '1rem',
											margin: 0,
											marginBottom: '1.5rem',
											lineHeight: 1.6
										}}>
											{course.description}
										</p>
									)}
									<div style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.5rem',
										color: 'var(--va-muted)',
										fontSize: '0.9rem',
										marginTop: 'auto',
										paddingTop: '1.5rem',
										borderTop: '1px solid rgba(255,238,0,0.15)'
									}}>
										<span>📖</span>
										<span>{course.lessons_count || course.lessons?.length || 0} module</span>
									</div>
								</div>
							</button>
						))}
					</div>
				) : (
					<div style={{
						padding: '2rem',
						textAlign: 'center',
						color: 'var(--va-muted)',
						background: 'rgba(0,0,0,0.9)',
						border: '1px solid rgba(255,238,0,0.22)',
						borderRadius: '16px'
					}}>
						Nu există cursuri în acest folder.
					</div>
				)}
			</div>
		);
	}

	// Show folders
	return (
		<div className="va-stack" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
			<div style={{ marginBottom: '2.5rem' }}>
				<h1 className="va-page-title" style={{
					background: 'linear-gradient(135deg, #fff, #ffee00)',
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent',
					marginBottom: '0.5rem'
				}}>
					Cursuri
				</h1>
				<p className="va-muted" style={{ fontSize: '1.05rem' }}>
					Selectează un folder pentru a vedea cursurile disponibile
				</p>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
				{categories.map((category) => (
					<button
						key={category.id}
						type="button"
						onClick={() => setSelectedFolder(category.id)}
						className="va-course-detail-header"
						style={{
							width: '100%',
							background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))',
							border: '1px solid rgba(255,238,0,0.3)',
							borderRadius: '24px',
							padding: '2.5rem',
							cursor: 'pointer',
							transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
							display: 'flex',
							flexDirection: 'column',
							textAlign: 'left',
							color: 'var(--va-text)',
							boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset',
							position: 'relative',
							overflow: 'hidden'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,238,0,0.12), rgba(255,238,0,0.08))';
							e.currentTarget.style.borderColor = 'rgba(255,238,0,0.4)';
							e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
							e.currentTarget.style.boxShadow = '0 16px 48px rgba(255,238,0,0.2), 0 0 0 1px rgba(255,238,0,0.2) inset';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.98))';
							e.currentTarget.style.borderColor = 'rgba(255,238,0,0.3)';
							e.currentTarget.style.transform = 'translateY(0) scale(1)';
							e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,238,0,0.15) inset';
						}}
					>
						<div style={{
							position: 'absolute',
							top: '-30%',
							right: '-10%',
							width: '300px',
							height: '300px',
							background: 'radial-gradient(circle, rgba(255,238,0,0.12), transparent)',
							pointerEvents: 'none'
						}} />
						<div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
							<h3 style={{
								color: 'var(--va-text)',
								fontSize: '1.5rem',
								fontWeight: 700,
								margin: 0,
								marginBottom: '1rem',
								lineHeight: 1.3
							}}>
								{category.name}
							</h3>
							{category.description && (
								<p style={{
									color: 'var(--va-muted)',
									fontSize: '1rem',
									margin: 0,
									marginBottom: '1.5rem',
									lineHeight: 1.6
								}}>
									{category.description}
								</p>
							)}
							<div style={{
								display: 'flex',
								alignItems: 'center',
								gap: '0.5rem',
								color: 'var(--va-muted)',
								fontSize: '0.9rem',
								marginTop: 'auto',
								paddingTop: '1.5rem',
								borderTop: '1px solid rgba(255,238,0,0.15)'
							}}>
								<span>📁</span>
								<span>{category.courses?.length || 0} {category.courses?.length === 1 ? 'curs' : 'cursuri'}</span>
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
};

export default CoursesPage;

