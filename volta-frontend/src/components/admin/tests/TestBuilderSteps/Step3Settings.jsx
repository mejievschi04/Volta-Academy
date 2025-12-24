import React from 'react';

const TestBuilderStep3 = ({ data, onUpdate, errors }) => {
	return (
		<div className="admin-course-builder-step-content">
			<h2>Setări Test</h2>
			<p className="admin-course-builder-step-description">
				Configurează limitele de timp, încercări și comportamentul testului
			</p>

			<div className="admin-course-builder-form">
				{/* Timing */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Timp & Încercări</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label">Limită de Timp (minute)</label>
						<input
							type="number"
							className="admin-form-input"
							value={data.time_limit_minutes || ''}
							onChange={(e) => onUpdate({ time_limit_minutes: e.target.value ? parseInt(e.target.value) : null })}
							min="1"
							placeholder="Lăsat gol = fără limită"
						/>
						<p className="admin-form-hint">
							Timpul maxim permis pentru finalizarea testului. Lăsat gol = fără limită.
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Număr Maxim de Încercări</label>
						<input
							type="number"
							className="admin-form-input"
							value={data.max_attempts || ''}
							onChange={(e) => onUpdate({ max_attempts: e.target.value ? parseInt(e.target.value) : null })}
							min="1"
							placeholder="Lăsat gol = nelimitat"
						/>
						<p className="admin-form-hint">
							Numărul maxim de încercări permise. Lăsat gol = nelimitat.
						</p>
					</div>
				</div>

				{/* Randomization */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Randomizare</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.randomize_questions || false}
								onChange={(e) => onUpdate({ randomize_questions: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Randomizează ordinea întrebărilor</span>
						</label>
						<p className="admin-form-hint">
							Fiecare student va vedea întrebările într-o ordine diferită
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.randomize_answers || false}
								onChange={(e) => onUpdate({ randomize_answers: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Randomizează ordinea răspunsurilor</span>
						</label>
						<p className="admin-form-hint">
							Răspunsurile vor fi afișate într-o ordine aleatorie pentru fiecare întrebare
						</p>
					</div>
				</div>

				{/* Feedback & Results */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Feedback & Rezultate</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.show_results_immediately !== false}
								onChange={(e) => onUpdate({ show_results_immediately: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Afișează rezultatele imediat după finalizare</span>
						</label>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.show_correct_answers || false}
								onChange={(e) => onUpdate({ show_correct_answers: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Afișează răspunsurile corecte</span>
						</label>
						<p className="admin-form-hint">
							Studenții vor vedea care răspunsuri erau corecte
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.allow_review !== false}
								onChange={(e) => onUpdate({ allow_review: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Permite revizuirea testului</span>
						</label>
						<p className="admin-form-hint">
							Studenții pot revizui testul după finalizare
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TestBuilderStep3;

