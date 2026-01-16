import React from 'react';

const QuestionBankBuilderStep1 = ({ data, onUpdate, errors }) => {
	return (
		<div className="admin-course-builder-step-content">
			<h2>Informații de Bază</h2>
			<p className="admin-course-builder-step-description">
				Definește titlul, descrierea și categoria băncii de întrebări
			</p>

			<div className="admin-course-builder-form">
				<div className="admin-form-group">
					<label className="admin-form-label">
						Titlu Bancă de Întrebări <span className="admin-form-required">*</span>
					</label>
					<input
						type="text"
						className={`admin-form-input ${errors.title ? 'error' : ''}`}
						value={data?.title || ''}
						onChange={(e) => onUpdate({ title: e.target.value })}
						placeholder="ex: Întrebări PHP Avansat"
						data-field="title"
					/>
					{errors?.title && (
						<span className="admin-form-error">{errors.title}</span>
					)}
				</div>

				<div className="admin-form-group">
					<label className="admin-form-label">Descriere</label>
					<textarea
						className="admin-form-textarea"
						value={data?.description || ''}
						onChange={(e) => onUpdate({ description: e.target.value })}
						placeholder="Descrierea băncii de întrebări (opțional)"
						rows={4}
					/>
					<p className="admin-form-hint">
						O descriere scurtă a băncii de întrebări și a obiectivelor sale
					</p>
				</div>

				<div className="admin-form-group">
					<label className="admin-form-label">Categorie (opțional)</label>
					<input
						type="text"
						className="admin-form-input"
						value={data?.category || ''}
						onChange={(e) => onUpdate({ category: e.target.value })}
						placeholder="ex: PHP, JavaScript, React, etc."
					/>
					<p className="admin-form-hint">
						Categoria ajută la organizarea băncilor de întrebări
					</p>
				</div>

				<div className="admin-info-box" style={{ marginTop: '2rem' }}>
					<h4 style={{ marginBottom: '0.5rem' }}>💡 Informații</h4>
					<ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
						<li>Băncile de întrebări permit reutilizarea întrebărilor în multiple teste</li>
						<li>După creare, poți adăuga întrebări în pasul următor</li>
						<li>Întrebările pot fi folosite în teste standalone sau în cursuri</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default QuestionBankBuilderStep1;
