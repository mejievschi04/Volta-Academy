import React from 'react';

const TestBuilderStep4 = ({ data, onUpdate, errors }) => {
	const totalPoints = data.questions?.reduce((sum, q) => sum + (q.points || 1), 0) || 0;
	const questionsCount = data.questions?.length || 0;

	return (
		<div className="admin-course-builder-step-content">
			<h2>Revizuire & Publicare</h2>
			<p className="admin-course-builder-step-description">
				Verifică detaliile testului înainte de publicare
			</p>

			<div className="admin-course-builder-form">
				{errors.title && (
					<div style={{
						padding: '1rem',
						background: 'rgba(244, 67, 54, 0.1)',
						color: '#f44336',
						borderRadius: '8px',
						marginBottom: '1rem',
					}}>
						{errors.title}
					</div>
				)}

				{errors.questions && (
					<div style={{
						padding: '1rem',
						background: 'rgba(244, 67, 54, 0.1)',
						color: '#f44336',
						borderRadius: '8px',
						marginBottom: '1rem',
					}}>
						{errors.questions}
					</div>
				)}

				{/* Test Summary */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Rezumat Test</h3>
					
					<div style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
						gap: '1rem',
						marginBottom: '2rem',
					}}>
						<div style={{
							padding: '1.5rem',
							background: 'rgba(0, 0, 0, 0.3)',
							borderRadius: '8px',
							border: '1px solid rgba(255, 238, 0, 0.2)',
						}}>
							<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
								Titlu
							</div>
							<div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
								{data.title || 'Fără titlu'}
							</div>
						</div>

						<div style={{
							padding: '1.5rem',
							background: 'rgba(0, 0, 0, 0.3)',
							borderRadius: '8px',
							border: '1px solid rgba(255, 238, 0, 0.2)',
						}}>
							<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
								Tip
							</div>
							<div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
								{data.type === 'practice' ? 'Practică' : data.type === 'final' ? 'Final' : 'Notat'}
							</div>
						</div>

						<div style={{
							padding: '1.5rem',
							background: 'rgba(0, 0, 0, 0.3)',
							borderRadius: '8px',
							border: '1px solid rgba(255, 238, 0, 0.2)',
						}}>
							<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
								Întrebări
							</div>
							<div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
								{questionsCount}
							</div>
						</div>

						<div style={{
							padding: '1.5rem',
							background: 'rgba(0, 0, 0, 0.3)',
							borderRadius: '8px',
							border: '1px solid rgba(255, 238, 0, 0.2)',
						}}>
							<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)', marginBottom: '0.5rem' }}>
								Total Puncte
							</div>
							<div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
								{totalPoints}
							</div>
						</div>
					</div>
				</div>

				{/* Settings Summary */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Setări</h3>
					
					<div style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
						gap: '1rem',
					}}>
						<div>
							<strong>Limită de timp:</strong>{' '}
							{data.time_limit_minutes ? `${data.time_limit_minutes} minute` : 'Fără limită'}
						</div>
						<div>
							<strong>Încercări maxime:</strong>{' '}
							{data.max_attempts || 'Nelimitat'}
						</div>
						<div>
							<strong>Randomizează întrebări:</strong>{' '}
							{data.randomize_questions ? 'Da' : 'Nu'}
						</div>
						<div>
							<strong>Randomizează răspunsuri:</strong>{' '}
							{data.randomize_answers ? 'Da' : 'Nu'}
						</div>
						<div>
							<strong>Afișează rezultate imediat:</strong>{' '}
							{data.show_results_immediately !== false ? 'Da' : 'Nu'}
						</div>
						<div>
							<strong>Afișează răspunsuri corecte:</strong>{' '}
							{data.show_correct_answers ? 'Da' : 'Nu'}
						</div>
						<div>
							<strong>Permite revizuire:</strong>{' '}
							{data.allow_review !== false ? 'Da' : 'Nu'}
						</div>
					</div>
				</div>

				{/* Questions Preview */}
				{data.questions && data.questions.length > 0 && (
					<div className="admin-form-section">
						<h3 className="admin-form-section-title">Previzualizare Întrebări</h3>
						<div className="va-stack" style={{ gap: '1rem' }}>
							{data.questions.slice(0, 3).map((question, index) => (
								<div
									key={index}
									style={{
										padding: '1rem',
										background: 'rgba(0, 0, 0, 0.3)',
										borderRadius: '8px',
										border: '1px solid rgba(255, 238, 0, 0.2)',
									}}
								>
									<div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
										#{index + 1}: {question.content}
									</div>
									<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
										{question.points} puncte • {question.type}
									</div>
								</div>
							))}
							{data.questions.length > 3 && (
								<div style={{ textAlign: 'center', padding: '1rem', color: 'var(--va-muted)' }}>
									... și încă {data.questions.length - 3} întrebări
								</div>
							)}
						</div>
					</div>
				)}

				{/* Info Box */}
				<div className="admin-info-box" style={{ marginTop: '2rem' }}>
					<h4 style={{ marginBottom: '0.5rem' }}>📋 Informații</h4>
					<ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
						<li>După publicare, testul poate fi atașat la cursuri</li>
						<li>Testele publicate nu pot fi modificate dacă sunt deja legate de cursuri</li>
						<li>Poți crea o nouă versiune a testului pentru modificări</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default TestBuilderStep4;

