import React from 'react';

/**
 * Pas 4: Rezumat și creează – previzualizare + buton Creează test (draft).
 */
const Step4Review = ({ data, onCreate, loading }) => {
	const source = data.question_source || 'direct';
	const bankInfo = source === 'bank' && data.question_set_id
		? `Bancă ID: ${data.question_set_id}${data.question_selection?.count ? `, ${data.question_selection.count} întrebări` : ''}`
		 : 'Întrebări adăugate manual în editor';

	return (
		<div className="test-wizard-step-review">
			<h3 className="admin-settings-section-title">Rezumat și creează</h3>
			<p className="course-creation-wizard-step-desc">
				Revizuiește și creează testul ca ciornă. Îl poți edita și publica din editorul de test după ce îl creezi.
			</p>

			<div className="course-preview-card" style={{ marginTop: 'var(--space-4)' }}>
				<div className="course-preview-body">
					<h4 className="course-preview-title">{data.title || 'Titlu test'}</h4>
					{data.description && (
						<p className="course-preview-description">{data.description}</p>
					)}
					<dl className="test-wizard-review-list">
						<dt>Tip</dt>
						<dd>{data.type === 'practice' ? 'Exersare' : data.type === 'final' ? 'Final' : 'Notat'}</dd>
						<dt>Încercări max</dt>
						<dd>{data.max_attempts ?? 'Nelimitat'}</dd>
						<dt>Timp limitat</dt>
						<dd>{data.time_limit_minutes ? `${data.time_limit_minutes} min` : 'Nu'}</dd>
						<dt>Sursă întrebări</dt>
						<dd>{bankInfo}</dd>
						<dt>Setări</dt>
						<dd>
							{data.randomize_questions && 'Întrebări aleatorii • '}
							{data.randomize_answers && 'Răspunsuri aleatorii • '}
							{data.show_results_immediately !== false && 'Rezultate imediate • '}
							{data.show_correct_answers && 'Afișare răspunsuri corecte'}
							{!data.randomize_questions && !data.randomize_answers && data.show_results_immediately === false && !data.show_correct_answers && '—'}
						</dd>
					</dl>
				</div>
			</div>

			<div className="course-creation-wizard-step-actions" style={{ marginTop: 'var(--space-6)' }}>
				<button
					type="button"
					className="course-creation-wizard-btn course-creation-wizard-btn-primary"
					onClick={onCreate}
					disabled={loading || !data.title?.trim()}
				>
					{loading ? 'Se creează...' : 'Creează test'}
				</button>
			</div>
		</div>
	);
};

export default Step4Review;
