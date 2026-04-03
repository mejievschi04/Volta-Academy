import React from 'react';

const AIGenerateQuestionsModal = ({
	open,
	aiGenerating,
	aiContent,
	setAiContent,
	aiOptions,
	setAiOptions,
	aiError,
	onClose,
	onGenerate,
}) => {
	if (!open) return null;
	return (
		<div className="admin-team-modal-overlay" onClick={() => !aiGenerating && onClose()} style={{ zIndex: 10000 }}>
			<div className="admin-team-modal" onClick={(e) => e.stopPropagation()}>
				<div className="admin-team-modal-header">
					<div>
						<h2 className="admin-team-modal-title">🤖 Generează Întrebări cu AI</h2>
						<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
							Introdu conținutul pentru care vrei să generezi întrebări
						</p>
					</div>
					{!aiGenerating && <button type="button" className="admin-team-modal-close" onClick={onClose}>×</button>}
				</div>
				<div className="admin-team-modal-body">
					<div className="admin-form-group">
						<label className="admin-form-label">Conținut pentru Generare *</label>
						<textarea className="admin-form-input" value={aiContent} onChange={(e) => setAiContent(e.target.value)} rows={8} disabled={aiGenerating} />
					</div>
					<div className="admin-form-group">
						<label className="admin-form-label">Număr de Întrebări</label>
						<input type="number" className="admin-form-input" value={aiOptions.numberOfQuestions} min="1" max="50" disabled={aiGenerating} onChange={(e) => setAiOptions((prev) => ({ ...prev, numberOfQuestions: parseInt(e.target.value, 10) || 10 }))} />
					</div>
					<div className="admin-form-group">
						<label className="admin-form-label">Dificultate</label>
						<select className="admin-form-input" value={aiOptions.difficulty} disabled={aiGenerating} onChange={(e) => setAiOptions((prev) => ({ ...prev, difficulty: e.target.value }))}>
							<option value="easy">Ușor</option>
							<option value="medium">Mediu</option>
							<option value="hard">Dificil</option>
						</select>
					</div>
					{aiError ? <div className="lms-error-message">{aiError}</div> : null}
					<div className="admin-team-modal-footer">
						<button type="button" className="lms-btn-secondary" onClick={onClose} disabled={aiGenerating}>Anulează</button>
						<button type="button" className="lms-btn-primary" onClick={onGenerate} disabled={aiGenerating || !aiContent?.trim()}>
							🤖 {aiGenerating ? 'Se generează...' : 'Generează Întrebări'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AIGenerateQuestionsModal;
