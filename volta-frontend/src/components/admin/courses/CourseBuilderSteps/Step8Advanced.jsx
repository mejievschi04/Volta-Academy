import React from 'react';

const CourseBuilderStep8 = ({ data, onUpdate, errors }) => {
	return (
		<div className="admin-course-builder-step-content">
			<h2>Setări Avansate</h2>
			<p className="admin-course-builder-step-description">
				Configurează setările avansate pentru curs
			</p>

			<div className="admin-course-builder-form">
				{/* Content Unlock Settings */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Deblocare Conținut</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.sequential_unlock !== false}
								onChange={(e) => onUpdate({ sequential_unlock: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Deblocare secvențială</span>
						</label>
						<p className="admin-form-hint">
							Studenții trebuie să completeze lecțiile în ordine
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Procent Minim de Finalizare (%)</label>
						<input
							type="number"
							className="admin-form-input"
							value={data.min_completion_percentage || 0}
							onChange={(e) => onUpdate({ min_completion_percentage: parseInt(e.target.value) || 0 })}
							min="0"
							max="100"
						/>
						<p className="admin-form-hint">
							Procentul minim de finalizare necesar pentru a accesa următoarele module
						</p>
					</div>
				</div>

				{/* Drip Content */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Drip Content</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.drip_content === true}
								onChange={(e) => onUpdate({ drip_content: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Activează drip content</span>
						</label>
						<p className="admin-form-hint">
							Conținutul va fi deblocat progresiv în timp
						</p>
					</div>

					{data.drip_content && (
						<div className="admin-form-group">
							<label className="admin-form-label">Programare Drip Content</label>
							<select
								className="admin-form-select"
								value={data.drip_schedule || 'daily'}
								onChange={(e) => onUpdate({ drip_schedule: e.target.value })}
							>
								<option value="daily">Zilnic</option>
								<option value="weekly">Săptămânal</option>
								<option value="custom">Personalizat</option>
							</select>
							<p className="admin-form-hint">
								Frecvența de deblocare a conținutului
							</p>
						</div>
					)}
				</div>

				{/* Comments & Visibility */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Comentarii & Vizibilitate</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.comments_enabled !== false}
								onChange={(e) => onUpdate({ comments_enabled: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Activează comentarii</span>
						</label>
						<p className="admin-form-hint">
							Permite studenților să comenteze și să întrebe întrebări
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Vizibilitate</label>
						<select
							className="admin-form-select"
							value={data.visibility || 'public'}
							onChange={(e) => onUpdate({ visibility: e.target.value })}
						>
							<option value="public">Public - Vizibil pentru toți</option>
							<option value="private">Privat - Doar pentru utilizatori înscriși</option>
							<option value="hidden">Ascuns - Doar prin link direct</option>
						</select>
						<p className="admin-form-hint">
							Controlează cine poate vedea și accesa cursul
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseBuilderStep8;

