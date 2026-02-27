import React from 'react';

/**
 * Pas 1: Detalii test – titlu, descriere, tip, scor minim, nr. încercări.
 */
const Step1Details = ({ data, onUpdate }) => {
	return (
		<div className="test-wizard-step-details">
			<h3 className="admin-settings-section-title">Detalii test</h3>
			<p className="course-creation-wizard-step-desc">
				Completează informațiile de bază ale testului.
			</p>

			<div className="admin-settings-form-group">
				<label className="admin-settings-label" htmlFor="test-wizard-title">Titlu *</label>
				<input
					id="test-wizard-title"
					className="admin-settings-input"
					value={data.title || ''}
					onChange={(e) => onUpdate({ title: e.target.value })}
					placeholder="Ex: Test final Modul 1"
					autoFocus
				/>
			</div>

			<div className="admin-settings-form-group">
				<label className="admin-settings-label" htmlFor="test-wizard-desc">Descriere</label>
				<textarea
					id="test-wizard-desc"
					className="admin-settings-textarea"
					rows={3}
					value={data.description || ''}
					onChange={(e) => onUpdate({ description: e.target.value })}
					placeholder="Scurtă descriere a testului (opțional)"
				/>
			</div>

			<div className="admin-settings-form-row">
				<div className="admin-settings-form-group">
					<label className="admin-settings-label" htmlFor="test-wizard-type">Tip</label>
					<select
						id="test-wizard-type"
						className="admin-settings-select"
						value={data.type || 'graded'}
						onChange={(e) => onUpdate({ type: e.target.value })}
					>
						<option value="practice">Exersare (practice)</option>
						<option value="graded">Notat (graded)</option>
						<option value="final">Final</option>
					</select>
				</div>
				<div className="admin-settings-form-group">
					<label className="admin-settings-label" htmlFor="test-wizard-attempts">Nr. încercări max</label>
					<input
						id="test-wizard-attempts"
						className="admin-settings-input"
						type="number"
						min={1}
						value={data.max_attempts ?? ''}
						onChange={(e) => onUpdate({ max_attempts: e.target.value === '' ? null : Number(e.target.value) })}
						placeholder="Nelimitat"
					/>
					<span className="admin-settings-hint">Lăsat gol = nelimitat</span>
				</div>
			</div>
		</div>
	);
};

export default Step1Details;
