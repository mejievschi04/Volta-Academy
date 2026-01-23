import React from 'react';
import './Step6Review.css';

/**
 * PAS 3: Review & Publish
 * Simplificat pentru o companie de produse electrotehnice
 */
const Step6Review = ({ data, onUpdate, onPublish, loading }) => {
	const modules = data.structure?.modules || [];
	const allLessons = modules.flatMap(module => module.lessons || []);
	const totalModules = modules.length;
	const totalLessons = allLessons.length;
	const totalContent = Object.values(data.content_blocks || {}).reduce((sum, contents) => sum + contents.length, 0);
	
	return (
		<div className="step6-review">
			<div className="step6-header">
				<h3>Review & Publish</h3>
				<p className="step6-description">
					Revizuiește cursul și publică-l. Poți reveni la orice pas pentru modificări.
				</p>
			</div>
			
			<div className="step6-content">
				{/* Course Summary */}
				<div className="step6-summary">
					<h4>Rezumat Curs</h4>
					<div className="step6-summary-grid">
						<div className="step6-summary-item">
							<div className="step6-summary-label">Titlu</div>
							<div className="step6-summary-value">{data.title || 'Nespecificat'}</div>
						</div>
						
						<div className="step6-summary-item">
							<div className="step6-summary-label">Module</div>
							<div className="step6-summary-value">{totalModules}</div>
						</div>
						
						<div className="step6-summary-item">
							<div className="step6-summary-label">Lecții</div>
							<div className="step6-summary-value">{totalLessons}</div>
						</div>
						
						<div className="step6-summary-item">
							<div className="step6-summary-label">Conținut</div>
							<div className="step6-summary-value">{totalContent} blocuri</div>
						</div>
					</div>
				</div>
				
				{/* Publish Options */}
				<div className="step6-publish">
					<h4>Opțiuni Publicare</h4>
					<div className="step6-form-group">
						<label className="step6-label">Status</label>
						<select
							value={data.status || 'draft'}
							onChange={(e) => onUpdate({ status: e.target.value })}
							className="step6-select"
						>
							<option value="draft">Draft</option>
							<option value="published">Publicat</option>
						</select>
					</div>
				</div>
				
				{/* Publish Button */}
				<div className="step6-actions">
					<button
						type="button"
						className="step6-publish-btn"
						onClick={onPublish}
						disabled={loading || !data.title || !data.description || totalModules === 0}
					>
						{loading ? 'Publicare...' : '🚀 Publică Curs'}
					</button>
					{(!data.title || !data.description || totalModules === 0) && (
						<p className="step6-hint">
							Completează toate câmpurile obligatorii pentru a publica cursul.
						</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default Step6Review;
