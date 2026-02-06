import React from 'react';
import './Step0Context.css';

/**
 * PAS 0: Informații de bază
 * Simplificat pentru o companie de produse electrotehnice
 */
const Step0Context = ({ data, onUpdate }) => {
	return (
		<div className="step0-context">
			<div className="step0-header">
				<h3>Informații de bază</h3>
				<p className="step0-description">
					Completează informațiile de bază despre curs
				</p>
			</div>
			
			<div className="step0-content">
				{/* Title */}
				<div className="step0-section">
					<label className="step0-label">
						Titlu Curs <span className="step0-required">*</span>
					</label>
					<p className="step0-hint">Numele cursului</p>
					<div className="step0-form-group">
						<input
							type="text"
							placeholder="ex: Produse Electrotehnice - Baze"
							value={data.title || ''}
							onChange={(e) => onUpdate({ title: e.target.value })}
							className="step0-input"
							required
						/>
					</div>
				</div>
				
				{/* Description */}
				<div className="step0-section">
					<label className="step0-label">
						Descriere <span className="step0-required">*</span>
					</label>
					<p className="step0-hint">Descrierea cursului</p>
					<div className="step0-form-group">
						<textarea
							placeholder="Descrie conținutul și scopul cursului..."
							value={data.description || ''}
							onChange={(e) => onUpdate({ description: e.target.value })}
							className="step0-textarea"
							rows={5}
							required
						/>
					</div>
				</div>
				
				{/* Image Upload */}
				<div className="step0-section">
					<label className="step0-label">
						Imagine Curs <span className="step0-required">*</span>
					</label>
					<p className="step0-hint">Imaginea reprezentativă a cursului (obligatorie)</p>
					<div className="step0-form-group">
						<input
							type="file"
							accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) {
									onUpdate({ image: file });
								}
							}}
							className="step0-input"
							required
						/>
						{data.image && (
							<div className="step0-image-preview">
								<img 
									src={typeof data.image === 'string' ? data.image : URL.createObjectURL(data.image)} 
									alt="Previzualizare" 
									loading="lazy"
									decoding="async"
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Step0Context;
