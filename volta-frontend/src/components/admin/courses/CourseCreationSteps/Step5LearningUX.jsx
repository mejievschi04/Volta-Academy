import React from 'react';
import './Step5LearningUX.css';

/**
 * PAS 5: Experiență Cursant (Learning UX)
 * Conform TODO.md
 * - Ordine obligatorie / liberă
 * - Deblocare progresivă
 * - Estimare timp
 * - Certificat / badge
 * - Reminder-e
 * - AI opțional: Recomandă pacing optim
 */
const Step5LearningUX = ({ data, onUpdate }) => {
	const learningUX = data.learning_ux || {};
	
	const handleUpdate = (updates) => {
		onUpdate({
			learning_ux: {
				...learningUX,
				...updates
			}
		});
	};
	
	// Calculate total estimated time from modules
	const totalEstimatedTime = data.structure?.modules?.reduce((total, module) => {
		const moduleTime = module.duration_estimate || 0;
		const lessonsTime = (module.lessons || []).reduce((sum, lesson) => {
			return sum + ((lesson.duration_estimate || 0) / 60); // Convert minutes to hours
		}, 0);
		return total + moduleTime + lessonsTime;
	}, 0) || 0;
	
	return (
		<div className="step5-learning-ux">
			<div className="step5-header">
				<h3>Experiență Cursant</h3>
				<p className="step5-description">
					Configurează experiența de învățare pentru cursanți: ordine, deblocare, certificare.
				</p>
			</div>
			
			<div className="step5-content">
				{/* Course Order */}
				<div className="step5-section">
					<label className="step5-label">Ordine Lecții</label>
					<p className="step5-hint">Cum pot cursanții să navigheze prin curs?</p>
					<div className="step5-order-options">
						<label className="step5-radio-option">
							<input
								type="radio"
								name="order"
								value="sequential"
								checked={learningUX.sequential !== false}
								onChange={() => handleUpdate({ sequential: true })}
							/>
							<div className="step5-radio-content">
								<div className="step5-radio-title">Ordine obligatorie (secvențială)</div>
								<div className="step5-radio-description">
									Cursanții trebuie să completeze lecțiile în ordine
								</div>
							</div>
						</label>
						
						<label className="step5-radio-option">
							<input
								type="radio"
								name="order"
								value="free"
								checked={learningUX.sequential === false}
								onChange={() => handleUpdate({ sequential: false })}
							/>
							<div className="step5-radio-content">
								<div className="step5-radio-title">Ordine liberă</div>
								<div className="step5-radio-description">
									Cursanții pot accesa lecțiile în orice ordine
								</div>
							</div>
						</label>
					</div>
				</div>
				
				{/* Progressive Unlock */}
				{learningUX.sequential !== false && (
					<div className="step5-section">
						<label className="step5-label">Deblocare Progresivă</label>
						<div className="step5-form-group">
							<label className="step5-checkbox-label">
								<input
									type="checkbox"
									checked={learningUX.progressive_unlock !== false}
									onChange={(e) => handleUpdate({ progressive_unlock: e.target.checked })}
								/>
								<span>Deblochează lecțiile progresiv pe măsură ce cursantul avansează</span>
							</label>
						</div>
					</div>
				)}
				
				{/* Estimated Time */}
				<div className="step5-section">
					<label className="step5-label">Timp Estimat</label>
					<p className="step5-hint">
						Timp total estimat: <strong>{totalEstimatedTime.toFixed(1)} ore</strong> 
						{' '}(calculat din module și lecții)
					</p>
					<div className="step5-form-group">
						<label>Timp total estimat (ore)</label>
						<input
							type="number"
							min="0"
							step="0.5"
							value={learningUX.estimated_time || totalEstimatedTime.toFixed(1)}
							onChange={(e) => handleUpdate({ estimated_time: e.target.value ? parseFloat(e.target.value) : null })}
							className="step5-input"
						/>
					</div>
				</div>
				
				{/* Certificate */}
				<div className="step5-section">
					<label className="step5-label">Certificat</label>
					<div className="step5-form-group">
						<label className="step5-checkbox-label">
							<input
								type="checkbox"
								checked={learningUX.certificate || false}
								onChange={(e) => handleUpdate({ certificate: e.target.checked })}
							/>
							<span>Oferă certificat la finalizarea cursului</span>
						</label>
					</div>
					
					{learningUX.certificate && (
						<div className="step5-certificate-settings">
							<div className="step5-form-group">
								<label>Prag minim pentru certificat (%)</label>
								<input
									type="number"
									min="0"
									max="100"
									value={learningUX.certificate_threshold || 70}
									onChange={(e) => handleUpdate({ certificate_threshold: parseInt(e.target.value) })}
									className="step5-input"
								/>
							</div>
						</div>
					)}
				</div>
				
				{/* Badges */}
				<div className="step5-section">
					<label className="step5-label">Badge-uri (opțional)</label>
					<p className="step5-hint">Adaugă badge-uri pentru realizări în curs</p>
					<div className="step5-badges-list">
						{(learningUX.badges || []).map((badge, index) => (
							<div key={index} className="step5-badge-item">
								<input
									type="text"
									placeholder="Nume badge (ex: Primul modul completat)"
									value={badge.name || ''}
									onChange={(e) => {
										const badges = [...(learningUX.badges || [])];
										badges[index] = { ...badges[index], name: e.target.value };
										handleUpdate({ badges });
									}}
									className="step5-input"
								/>
								<button
									type="button"
									className="step5-btn-remove"
									onClick={() => {
										const badges = [...(learningUX.badges || [])];
										badges.splice(index, 1);
										handleUpdate({ badges });
									}}
								>
									🗑️
								</button>
							</div>
						))}
					</div>
					<button
						type="button"
						className="step5-btn-add"
						onClick={() => {
							const badges = [...(learningUX.badges || []), { name: '', icon: '🏆' }];
							handleUpdate({ badges });
						}}
					>
						+ Adaugă badge
					</button>
				</div>
				
				{/* Reminders */}
				<div className="step5-section">
					<label className="step5-label">Reminder-e</label>
					<div className="step5-form-group">
						<label className="step5-checkbox-label">
							<input
								type="checkbox"
								checked={learningUX.reminders || false}
								onChange={(e) => handleUpdate({ reminders: e.target.checked })}
							/>
							<span>Trimite reminder-e automat pentru cursanți inactivi</span>
						</label>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Step5LearningUX;
