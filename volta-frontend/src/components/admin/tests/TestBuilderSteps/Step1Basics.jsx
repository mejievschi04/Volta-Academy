import React from 'react';

const TestBuilderStep1 = ({ data, onUpdate, errors }) => {
	return (
		<div className="admin-course-builder-step-content">
			<h2>Informații de Bază</h2>
			<p className="admin-course-builder-step-description">
				Definește titlul, descrierea și tipul testului
			</p>

			<div className="admin-course-builder-form">
				<div className="admin-form-group">
					<label className="admin-form-label">
						Titlu Test <span style={{ color: '#f44336' }}>*</span>
					</label>
					<input
						type="text"
						className={`admin-form-input ${errors.title ? 'error' : ''}`}
						value={data.title || ''}
						onChange={(e) => onUpdate({ title: e.target.value })}
						placeholder="ex: Test Final - PHP Avansat"
						data-field="title"
					/>
					{errors.title && (
						<span className="admin-form-error">{errors.title}</span>
					)}
				</div>

				<div className="admin-form-group">
					<label className="admin-form-label">Descriere</label>
					<textarea
						className="admin-form-input"
						value={data.description || ''}
						onChange={(e) => onUpdate({ description: e.target.value })}
						placeholder="Descrierea testului (opțional)"
						rows={4}
					/>
					<p className="admin-form-hint">
						O descriere scurtă a testului și a obiectivelor sale
					</p>
				</div>

				<div className="admin-form-group">
					<label className="admin-form-label">
						Tip Test <span style={{ color: '#f44336' }}>*</span>
					</label>
					<select
						className="admin-form-input"
						value={data.type || 'graded'}
						onChange={(e) => onUpdate({ type: e.target.value })}
					>
						<option value="practice">Practică (nu se notează)</option>
						<option value="graded">Notat (contribuie la notă)</option>
						<option value="final">Final (obligatoriu pentru certificat)</option>
					</select>
					<p className="admin-form-hint">
						Tipul testului determină cum este evaluat și dacă este obligatoriu
					</p>
				</div>

				<div className="admin-info-box" style={{ marginTop: '2rem' }}>
					<h4 style={{ marginBottom: '0.5rem' }}>💡 Informații</h4>
					<ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
						<li>Testele sunt create standalone și pot fi reutilizate în multiple cursuri</li>
						<li>După creare, poți atașa testul la cursuri din Course Builder</li>
						<li>Testele trebuie publicate înainte de a fi atașate la cursuri</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default TestBuilderStep1;

