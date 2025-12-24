import React, { useState, useEffect } from 'react';
import { formatCurrency, getDefaultCurrency } from '../../../../utils/currency';

const CourseBuilderStep5 = ({ data, onPublish, loading }) => {
	const [currency, setCurrency] = useState(getDefaultCurrency());

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
	];

	const allValid = validationChecklist.every(item => item.valid);
	const validCount = validationChecklist.filter(item => item.valid).length;

	return (
		<div className="admin-course-builder-step-content">
			<h2>Review & Publicare</h2>
			<p className="admin-course-builder-step-description">
				Verifică informațiile și publică cursul
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
					<div className="admin-course-builder-checklist-summary">
						{validCount} / {validationChecklist.length} verificări trecute
					</div>
				</div>

				{/* Course Summary */}
				<div className="admin-course-builder-review-section">
					<h3>Rezumat Curs</h3>
					<div className="admin-course-builder-summary">
						<div className="admin-course-builder-summary-item">
							<span className="admin-course-builder-summary-label">Titlu:</span>
							<span className="admin-course-builder-summary-value">{data.title || 'N/A'}</span>
						</div>
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
						<div className="admin-course-builder-summary-item">
							<span className="admin-course-builder-summary-label">Teste:</span>
							<span className="admin-course-builder-summary-value">
								{(data.modules || []).reduce((sum, m) => sum + (m.exams || []).length, 0)}
							</span>
						</div>
					</div>
				</div>

				{/* Publish Warning */}
				{!allValid && (
					<div className="admin-course-builder-warning">
						<strong>⚠️ Atenție:</strong> Nu toate verificările au trecut. Rezolvă problemele înainte de publicare.
					</div>
				)}

				{/* Publish Button */}
				<div className="admin-course-builder-review-actions">
					<button
						className="admin-btn admin-btn-primary admin-btn-large"
						onClick={onPublish}
						disabled={!allValid || loading}
					>
						{loading ? 'Se publică...' : '🚀 Publică Curs'}
					</button>
					<p className="admin-course-builder-review-note">
						Cursul va fi publicat și va deveni disponibil pentru utilizatori
					</p>
				</div>
			</div>
		</div>
	);
};

export default CourseBuilderStep5;

