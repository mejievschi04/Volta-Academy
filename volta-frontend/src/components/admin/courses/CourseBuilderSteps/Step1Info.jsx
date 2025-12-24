import React from 'react';

const CourseBuilderStep1 = ({ data, onUpdate, errors }) => {

	return (
		<div className="admin-course-builder-step-content">
			<h2>Bazele Cursului</h2>
			<p className="admin-course-builder-step-description">
				Completează informațiile de bază despre curs
			</p>

			<div className="admin-course-builder-form">
				{/* Title */}
				<div className="admin-form-group">
					<label className="admin-form-label">
						Titlu Curs <span className="admin-form-required">*</span>
					</label>
					<input
						type="text"
						className={`admin-form-input ${errors.title ? 'error' : ''}`}
						value={data.title || ''}
						onChange={(e) => onUpdate({ title: e.target.value })}
						placeholder="Ex: Introducere în React"
						data-field="title"
					/>
					{errors.title && <span className="admin-form-error">{errors.title}</span>}
				</div>

				{/* Short Description */}
				<div className="admin-form-group">
					<label className="admin-form-label">
						Descriere Scurtă <span className="admin-form-required">*</span>
					</label>
					<textarea
						className={`admin-form-textarea ${errors.short_description ? 'error' : ''}`}
						value={data.short_description || ''}
						onChange={(e) => onUpdate({ short_description: e.target.value })}
						placeholder="O scurtă descriere a cursului (max 200 caractere)..."
						rows={3}
						maxLength={200}
						data-field="short_description"
					/>
					<div className="admin-form-hint">
						{data.short_description?.length || 0} / 200 caractere
					</div>
					{errors.short_description && <span className="admin-form-error">{errors.short_description}</span>}
				</div>

				{/* Full Description */}
				<div className="admin-form-group">
					<label className="admin-form-label">Descriere Completă</label>
					<textarea
						className={`admin-form-textarea ${errors.description ? 'error' : ''}`}
						value={data.description || ''}
						onChange={(e) => onUpdate({ description: e.target.value })}
						placeholder="Descrierea detaliată a cursului..."
						rows={6}
						data-field="description"
					/>
					{errors.description && <span className="admin-form-error">{errors.description}</span>}
				</div>

				{/* Level */}
				<div className="admin-form-group">
					<label className="admin-form-label">Nivel</label>
					<select
						className="admin-form-select"
						value={data.level || ''}
						onChange={(e) => onUpdate({ level: e.target.value || null })}
					>
						<option value="">Selectează nivel</option>
						<option value="beginner">Începător</option>
						<option value="intermediate">Intermediar</option>
						<option value="advanced">Avansat</option>
					</select>
				</div>

				{/* Language and Duration Row */}
				<div className="admin-form-row">
					<div className="admin-form-group">
						<label className="admin-form-label">Limbă</label>
						<select
							className="admin-form-select"
							value={data.language || 'ro'}
							onChange={(e) => onUpdate({ language: e.target.value })}
						>
							<option value="ro">Română</option>
							<option value="en">English</option>
							<option value="ru">Русский</option>
						</select>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Durată Estimată (ore)</label>
						<input
							type="number"
							className="admin-form-input"
							value={data.estimated_duration_hours || ''}
							onChange={(e) => onUpdate({ estimated_duration_hours: parseInt(e.target.value) || null })}
							placeholder="Ex: 10"
							min="1"
						/>
					</div>
				</div>

				{/* Status */}
				<div className="admin-form-group">
					<label className="admin-form-label">Status</label>
					<select
						className="admin-form-select"
						value={data.status || 'draft'}
						onChange={(e) => onUpdate({ status: e.target.value })}
					>
						<option value="draft">Draft (implicit)</option>
						<option value="published">Publicat</option>
						<option value="archived">Arhivat</option>
					</select>
					<p className="admin-form-hint">
						Cursul va fi salvat ca draft până când îl publici în pasul final
					</p>
				</div>

				{/* Image Upload */}
				<div className="admin-form-group">
					<label className="admin-form-label">Imagine Curs</label>
					<div className="admin-image-upload-container">
						{data.image_url ? (
							<div className="admin-image-preview">
								<img src={data.image_url} alt="Course preview" />
								<button
									type="button"
									className="admin-image-remove"
									onClick={() => onUpdate({ image: null, image_url: null })}
								>
									×
								</button>
							</div>
						) : (
							<label className="admin-image-upload-label">
								<input
									type="file"
									accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
									onChange={(e) => {
										const file = e.target.files[0];
										if (file) {
											const reader = new FileReader();
											reader.onload = (event) => {
												onUpdate({ 
													image: file,
													image_url: event.target.result 
												});
											};
											reader.readAsDataURL(file);
										}
									}}
									className="admin-image-upload-input"
								/>
								<div className="admin-image-upload-placeholder">
									<span className="admin-image-upload-icon">📷</span>
									<span className="admin-image-upload-text">Click pentru a încărca imagine</span>
									<span className="admin-image-upload-hint">JPEG, PNG, GIF, WebP (max 2MB)</span>
								</div>
							</label>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseBuilderStep1;

