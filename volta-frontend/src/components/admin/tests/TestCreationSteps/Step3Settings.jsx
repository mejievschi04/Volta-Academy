import React from 'react';

/**
 * Pas 3: Setări – ordine aleatorie, afișare răspunsuri corecte, timp limitat (opțional).
 */
const Step3Settings = ({ data, onUpdate }) => {
	return (
		<div className="test-wizard-step-settings">
			<h3 className="admin-settings-section-title">Setări test</h3>
			<p className="course-creation-wizard-step-desc">
				Configurează cum se afișează și se evaluează testul.
			</p>

			<div className="admin-settings-form-group">
				<label className="admin-settings-label" htmlFor="test-wizard-time">Timp limitat (minute)</label>
				<input
					id="test-wizard-time"
					className="admin-settings-input"
					type="number"
					min={1}
					value={data.time_limit_minutes ?? ''}
					onChange={(e) => onUpdate({
						time_limit_minutes: e.target.value === '' ? null : Number(e.target.value),
					})}
					placeholder="Fără limită"
				/>
				<span className="admin-settings-hint">Lăsat gol = fără limită de timp</span>
			</div>

			<div className="admin-settings-form-group">
				<label className="admin-settings-checkbox-label">
					<input
						type="checkbox"
						checked={!!data.randomize_questions}
						onChange={(e) => onUpdate({ randomize_questions: e.target.checked })}
					/>
					Ordine aleatorie a întrebărilor
				</label>
			</div>
			<div className="admin-settings-form-group">
				<label className="admin-settings-checkbox-label">
					<input
						type="checkbox"
						checked={!!data.randomize_answers}
						onChange={(e) => onUpdate({ randomize_answers: e.target.checked })}
					/>
					Ordine aleatorie a răspunsurilor
				</label>
			</div>
			<div className="admin-settings-form-group">
				<label className="admin-settings-checkbox-label">
					<input
						type="checkbox"
						checked={data.show_results_immediately !== false}
						onChange={(e) => onUpdate({ show_results_immediately: e.target.checked })}
					/>
					Afișare rezultate imediat după trimitere
				</label>
			</div>
			<div className="admin-settings-form-group">
				<label className="admin-settings-checkbox-label">
					<input
						type="checkbox"
						checked={!!data.show_correct_answers}
						onChange={(e) => onUpdate({ show_correct_answers: e.target.checked })}
					/>
					Afișare răspunsuri corecte după submit
				</label>
			</div>
			<div className="admin-settings-form-group">
				<label className="admin-settings-checkbox-label">
					<input
						type="checkbox"
						checked={data.allow_review !== false}
						onChange={(e) => onUpdate({ allow_review: e.target.checked })}
					/>
					Permite revizuirea după finalizare
				</label>
			</div>
		</div>
	);
};

export default Step3Settings;
