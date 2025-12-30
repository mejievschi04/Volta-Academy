import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, getDefaultCurrency } from '../../../../utils/currency';

const CourseBuilderStep9 = ({ courseId, data, onPublish, loading }) => {
	const navigate = useNavigate();
	const [currency, setCurrency] = useState(getDefaultCurrency());
	const [previewMode, setPreviewMode] = useState(false);

	useEffect(() => {
		const handleCurrencyChange = (e) => {
			setCurrency(e.detail);
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		setCurrency(getDefaultCurrency());
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, []);

	const validationChecklist = [
		{
			key: 'title',
			label: 'Titlu completat',
			valid: !!data.title?.trim(),
		},
		{
			key: 'teacher',
			label: 'Instructor selectat',
			valid: !!data.teacher_id,
		},
		{
			key: 'price',
			label: 'Preț configurat (dacă e plătit)',
			valid: data.access_type === 'free' || !!data.price,
		},
		{
			key: 'modules',
			label: 'Minimum 1 modul adăugat',
			valid: (data.modules || []).length > 0,
		},
		{
			key: 'lessons',
			label: 'Minimum 1 lecție în fiecare modul',
			valid: (data.modules || []).every(m => (m.lessons || []).length > 0),
		},
		{
			key: 'description',
			label: 'Descriere completată',
			valid: !!data.description?.trim(),
		},
	];

	const allValid = validationChecklist.every(item => item.valid);
	const validCount = validationChecklist.filter(item => item.valid).length;

	const handlePreview = () => {
		if (courseId) {
			window.open(`/courses/${courseId}`, '_blank');
		} else {
			setPreviewMode(true);
		}
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Previzualizare & Publicare</h2>
			<p className="admin-course-builder-step-description">
				Verifică informațiile, previzualizează cursul și publică
			</p>

			<div className="admin-course-builder-review">
				{/* Validation Checklist */}
				<div className="admin-course-builder-review-section">
					<h3>Checklist Validare</h3>
					<div className="admin-course-builder-checklist">
						{validationChecklist.map((item) => (
							<div
								key={item.key}
								className={`admin-course-builder-checklist-item ${item.valid ? 'valid' : 'invalid'}`}
							>
								<span className="admin-course-builder-checklist-icon">
									{item.valid ? '✓' : '✗'}
								</span>
								<span>{item.label}</span>
							</div>
						))}
					</div>
					<div className={`admin-course-builder-checklist-summary ${allValid ? 'valid' : 'invalid'}`}>
						{validCount} / {validationChecklist.length} verificări trecute
					</div>
				</div>

				{/* Course Summary */}
				<div className="admin-course-builder-review-section">
					<h3>Rezumat Curs</h3>
					<div className="admin-course-builder-summary">
						{data.image_url && (
							<div className="admin-course-builder-summary-image">
								<img src={data.image_url} alt={data.title} />
							</div>
						)}
						<div className="admin-course-builder-summary-item">
							<span className="admin-course-builder-summary-label">Titlu:</span>
							<span className="admin-course-builder-summary-value">{data.title || 'N/A'}</span>
						</div>
						{data.short_description && (
							<div className="admin-course-builder-summary-item">
								<span className="admin-course-builder-summary-label">Descriere scurtă:</span>
								<span className="admin-course-builder-summary-value">{data.short_description}</span>
							</div>
						)}
						<div className="admin-course-builder-summary-item">
							<span className="admin-course-builder-summary-label">Tip acces:</span>
							<span className="admin-course-builder-summary-value">
								{data.access_type === 'free' ? '🆓 Gratuit' :
								 data.access_type === 'paid' ? '💰 Plătit' :
								 '📅 Subscription'}
							</span>
						</div>
						{data.price && (
							<div className="admin-course-builder-summary-item">
								<span className="admin-course-builder-summary-label">Preț:</span>
								<span className="admin-course-builder-summary-value">
									{formatCurrency(data.price, data.currency || currency)}
								</span>
							</div>
						)}
						<div className="admin-course-builder-summary-item">
							<span className="admin-course-builder-summary-label">Module:</span>
							<span className="admin-course-builder-summary-value">
								{(data.modules || []).length}
							</span>
						</div>
						<div className="admin-course-builder-summary-item">
							<span className="admin-course-builder-summary-label">Lecții:</span>
							<span className="admin-course-builder-summary-value">
								{(data.modules || []).reduce((sum, m) => sum + (m.lessons || []).length, 0)}
							</span>
						</div>
						{data.has_certificate && (
							<div className="admin-course-builder-summary-item">
								<span className="admin-course-builder-summary-label">Certificat:</span>
								<span className="admin-course-builder-summary-value">✓ Disponibil</span>
							</div>
						)}
					</div>
				</div>

				{/* Preview & Publish Actions */}
				<div className="admin-course-builder-review-actions">
					{courseId && (
						<button
							className="admin-btn admin-btn-secondary admin-btn-large"
							onClick={handlePreview}
							disabled={loading}
						>
							👁️ Previzualizează Curs
						</button>
					)}
					<button
						className="admin-btn admin-btn-primary admin-btn-large"
						onClick={onPublish}
						disabled={!allValid || loading}
					>
						{loading ? 'Se publică...' : '🚀 Publică Curs'}
					</button>
				</div>

				{/* Publish Warning */}
				{!allValid && (
					<div className="admin-course-builder-warning">
						<strong>⚠️ Atenție:</strong> Nu toate verificările au trecut. Rezolvă problemele înainte de publicare.
					</div>
				)}

				{allValid && (
					<div className="admin-course-builder-success">
						<strong>✅ Toate verificările au trecut!</strong> Cursul este gata de publicare.
					</div>
				)}
			</div>
		</div>
	);
};

export default CourseBuilderStep9;

