import React, { useState, useEffect } from 'react';
import { adminService } from '../../../../services/api';
import { analyzeLessonTypes } from '../../../../utils/lessonTypeAnalyzer';

const AdvancedFeatures = ({ data, onUpdate }) => {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div className="admin-form-section" style={{ marginTop: '2rem', borderTop: '2px solid var(--border-primary)', paddingTop: '1.5rem' }}>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="admin-btn admin-btn-secondary"
				style={{ width: '100%', marginBottom: isExpanded ? '1rem' : 0 }}
			>
				{isExpanded ? '▼' : '▶'} Funcții Avansate {!isExpanded && '(opțional)'}
			</button>

			{isExpanded && (
				<div>
					{/* Prerequisites */}
					<div className="admin-form-group">
						<label className="admin-form-label">Cursuri Prerecizite</label>
						<p className="admin-form-hint">
							Selectează cursurile care trebuie finalizate înainte de a accesa acest curs
						</p>
						<div className="admin-info-box">
							<p>💡 Funcționalitatea de prerecizite va fi disponibilă în versiunea viitoare</p>
						</div>
					</div>

					{/* Badges & Gamification */}
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.badges?.length > 0 || false}
								onChange={(e) => onUpdate({
									badges: e.target.checked ? [] : null
								})}
								className="admin-checkbox-input"
							/>
							<span>Activează badge-uri și gamificare</span>
						</label>
						<p className="admin-form-hint">
							Permite atribuirea de badge-uri pentru realizări în curs
						</p>
					</div>

					{/* Analytics */}
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.analytics_enabled !== false}
								onChange={(e) => onUpdate({ analytics_enabled: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Activează tracking și analiză</span>
						</label>
						<p className="admin-form-hint">
							Colectează date despre progresul studenților pentru analiză
						</p>
					</div>

					{/* Versioning */}
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.versioning_enabled || false}
								onChange={(e) => onUpdate({ versioning_enabled: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Activează versionare</span>
						</label>
						<p className="admin-form-hint">
							Permite gestionarea versiunilor cursului
						</p>
					</div>

					{/* Multi-instructor */}
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.multi_instructor_support || false}
								onChange={(e) => onUpdate({ multi_instructor_support: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Suport multi-instructor</span>
						</label>
						<p className="admin-form-hint">
							Permite mai mulți instructori pentru acest curs
						</p>
					</div>
				</div>
			)}
		</div>
	);
};

const CourseBuilderStep5 = ({ data, onUpdate, errors }) => {
	const [instructors, setInstructors] = useState([]);
	const [appliedPricingRecommendation, setAppliedPricingRecommendation] = useState(false);

	// Analizează tipurile de lecții și generează recomandări de preț
	const lessonAnalysis = analyzeLessonTypes(data.modules || []);

	useEffect(() => {
		fetchInstructors();
	}, []);

	const fetchInstructors = async () => {
		try {
			const insts = await adminService.getTeachers();
			setInstructors(Array.isArray(insts) ? insts : (insts?.data || []));
		} catch (err) {
			console.error('Error fetching instructors:', err);
		}
	};

	// Aplică recomandarea de preț
	const handleApplyPricingRecommendation = () => {
		const pricing = lessonAnalysis.recommendations.pricing;
		if (pricing.suggestedAccessType && pricing.suggestedPrice) {
			onUpdate({
				access_type: pricing.suggestedAccessType,
				price: pricing.suggestedPrice
			});
			setAppliedPricingRecommendation(true);
		}
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Acces & Monetizare</h2>
			<p className="admin-course-builder-step-description">
				Configurează prețul, accesul, durata și conținutul cu drip
			</p>

			{/* Recomandări de preț bazate pe tipurile de lecții */}
			{lessonAnalysis.recommendations.pricing.reasons.length > 0 && !appliedPricingRecommendation && (
				<div className="admin-recommendations-card" style={{
					background: 'var(--bg-surface-hover)',
					border: '1.5px solid var(--color-primary)',
					borderRadius: 'var(--radius-lg)',
					padding: 'var(--space-5)',
					marginBottom: 'var(--space-6)'
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
						<span style={{ fontSize: '24px' }}>💰</span>
						<h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
							Recomandare Preț AI
						</h3>
					</div>
					<div style={{ marginBottom: 'var(--space-4)' }}>
						<p style={{ 
							margin: 0, 
							fontSize: 'var(--font-size-base)', 
							color: 'var(--text-primary)',
							marginBottom: 'var(--space-2)',
							fontWeight: 'var(--font-weight-semibold)'
						}}>
							Tip Acces Recomandat: {lessonAnalysis.recommendations.pricing.suggestedAccessType === 'paid' ? '💰 Plătit' : '🆓 Gratuit'}
						</p>
						{lessonAnalysis.recommendations.pricing.suggestedPrice && (
							<p style={{ 
								margin: 0, 
								fontSize: 'var(--font-size-xl)', 
								color: 'var(--color-primary)',
								fontWeight: 'var(--font-weight-bold)',
								marginBottom: 'var(--space-2)'
							}}>
								Preț Recomandat: {lessonAnalysis.recommendations.pricing.suggestedPrice} {data.currency || 'RON'}
							</p>
						)}
						<ul style={{ 
							margin: 0, 
							paddingLeft: 'var(--space-5)',
							fontSize: 'var(--font-size-sm)',
							color: 'var(--text-secondary)',
							lineHeight: 1.6
						}}>
							{lessonAnalysis.recommendations.pricing.reasons.map((reason, idx) => (
								<li key={idx}>{reason}</li>
							))}
						</ul>
					</div>
					<button
						className="admin-btn admin-btn-primary"
						onClick={handleApplyPricingRecommendation}
					>
						✅ Aplică Recomandarea
					</button>
				</div>
			)}

			<div className="admin-course-builder-form">
				{/* Instructor */}
				<div className="admin-form-group">
					<label className="admin-form-label">
						Instructor Principal <span className="admin-form-required">*</span>
					</label>
					<select
						className={`admin-form-select ${errors.teacher_id ? 'error' : ''}`}
						value={data.teacher_id || ''}
						onChange={(e) => onUpdate({ teacher_id: e.target.value || null })}
					>
						<option value="">Selectează instructor</option>
						{instructors.map(inst => (
							<option key={inst.id} value={inst.id}>
								{inst.name} {inst.email ? `(${inst.email})` : ''}
							</option>
						))}
					</select>
					{errors.teacher_id && <span className="admin-form-error">{errors.teacher_id}</span>}
					<p className="admin-form-hint">
						Instructorul principal va fi afișat pe pagina cursului
					</p>
				</div>

				{/* Access Type */}
				<div className="admin-form-group">
					<label className="admin-form-label">Tip Acces</label>
					<select
						className="admin-form-select"
						value={data.access_type || 'free'}
						onChange={(e) => onUpdate({ access_type: e.target.value })}
					>
						<option value="free">🆓 Gratuit</option>
						<option value="paid">💰 Plătit (One-time)</option>
						<option value="subscription">📅 Subscription (Abonament)</option>
					</select>
					<p className="admin-form-hint">
						Selectează modul în care utilizatorii pot accesa cursul
					</p>
				</div>

				{/* Price */}
				{(data.access_type === 'paid' || data.access_type === 'subscription') && (
					<div className="admin-form-group">
						<label className="admin-form-label">
							Preț <span className="admin-form-required">*</span>
						</label>
						<div className="admin-form-input-group">
							<input
								type="number"
								className={`admin-form-input ${errors.price ? 'error' : ''}`}
								value={data.price || ''}
								onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || null })}
								placeholder="0.00"
								min="0"
								step="0.01"
							/>
							<select
								className="admin-form-select admin-form-select-small"
								value={data.currency || 'RON'}
								onChange={(e) => onUpdate({ currency: e.target.value })}
							>
								<option value="MDL">MDL</option>
								<option value="RON">RON</option>
								<option value="USD">USD</option>
								<option value="EUR">EUR</option>
							</select>
						</div>
						{errors.price && <span className="admin-form-error">{errors.price}</span>}
						<p className="admin-form-hint">
							{data.access_type === 'subscription' 
								? 'Prețul lunar pentru abonament'
								: 'Prețul unic pentru acces la curs'}
						</p>
					</div>
				)}

				{/* Access Duration */}
				<div className="admin-form-group">
					<label className="admin-form-label">Durată Acces (zile)</label>
					<input
						type="number"
						className="admin-form-input"
						value={data.access_duration_days || ''}
						onChange={(e) => onUpdate({ access_duration_days: parseInt(e.target.value) || null })}
						placeholder="Lăsă gol pentru acces nelimitat"
						min="1"
					/>
					<p className="admin-form-hint">
						Numărul de zile în care utilizatorul are acces la curs (lăsă gol pentru acces nelimitat)
					</p>
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
							Conținutul va fi deblocat progresiv în timp după înscriere
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

				{/* Role-based Visibility */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Vizibilitate Bazată pe Rol</h3>
					<div className="admin-form-group">
						<label className="admin-form-label">Roluri Permise</label>
						<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
							{['student', 'teacher', 'admin'].map(role => (
								<label key={role} className="admin-form-label admin-form-label-checkbox">
									<input
										type="checkbox"
										checked={(data.role_based_visibility || []).includes(role)}
										onChange={(e) => {
											const current = data.role_based_visibility || [];
											if (e.target.checked) {
												onUpdate({ role_based_visibility: [...current, role] });
											} else {
												onUpdate({ role_based_visibility: current.filter(r => r !== role) });
											}
										}}
										className="admin-checkbox-input"
									/>
									<span>{role === 'student' ? '👨‍🎓 Studenți' : role === 'teacher' ? '👨‍🏫 Profesori' : '👨‍💼 Administratori'}</span>
								</label>
							))}
						</div>
						<p className="admin-form-hint">
							Selectează rolurile care pot accesa acest curs (lăsă necompletat pentru toți)
						</p>
					</div>
				</div>

				{/* Certificate Toggle */}
				<div className="admin-form-group">
					<label className="admin-form-label admin-form-label-checkbox">
						<input
							type="checkbox"
							checked={data.has_certificate || false}
							onChange={(e) => onUpdate({ has_certificate: e.target.checked })}
							className="admin-checkbox-input"
						/>
						<span>Oferă certificat la finalizarea cursului</span>
					</label>
				</div>

				{/* Free Course Info */}
				{data.access_type === 'free' && (
					<div className="admin-info-box">
						<p>✅ Cursul va fi disponibil gratuit pentru toți utilizatorii.</p>
						<p className="admin-info-box-hint">
							Poți schimba acest lucru oricând după publicare.
						</p>
					</div>
				)}

				{/* Advanced Features */}
				<AdvancedFeatures data={data} onUpdate={onUpdate} />
			</div>
		</div>
	);
};

export default CourseBuilderStep5;

