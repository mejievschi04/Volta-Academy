import React, { useEffect, useId, useState } from 'react';
import { adminService } from '../../../services/api';
import { formatPercent } from '../../../utils/formatPercent';
import ExamQuestionReview from '../../common/ExamQuestionReview';
import Modal from '../../common/Modal';
import { formatResultDate, resultStatusLabel } from './TestResultsPanelShared.js';
import './TestResultsPanel.css';

export default function AttemptDetailsModal({ target, onClose, kind = 'test', title, cachedBreakdown }) {
	const headingId = useId();
	const [response, setResponse] = useState(null);
	const resultId = target.id;

	useEffect(() => {
		if (cachedBreakdown) return undefined;
		let active = true;
		const request = kind === 'exam'
			? adminService.getExamResultBreakdown(resultId)
			: adminService.getTestResultBreakdown(resultId);
		request.then((data) => {
			if (active) setResponse({ data });
		}).catch(() => {
			if (active) setResponse({ error: true });
		});
		return () => { active = false; };
	}, [cachedBreakdown, kind, resultId]);

	const breakdown = cachedBreakdown || response?.data;
	const result = cachedBreakdown ? { ...cachedBreakdown.result, ...target } : (breakdown?.result || target);
	const maxScore = kind === 'exam' ? result.total_points : result.max_score;

	return (
		<Modal
			isOpen
			onClose={onClose}
			ariaLabelledby={headingId}
			closeOnBackdropClick
			closeOnEscape
			className="admin-test-breakdown-overlay"
			contentClassName="admin-test-breakdown-dialog"
		>
			<div className="admin-test-results-modal admin-test-breakdown-modal">
				<header className="admin-test-breakdown-head">
					<div>
						{title && <span className="admin-test-breakdown-kicker">{title}</span>}
						<h3 id={headingId}>Detalii încercare</h3>
						<p className="admin-test-results-modal-sub">
							{result.user?.name || result.user?.email || 'Utilizator'}
							{result.attempt_number != null && ` · încercarea #${result.attempt_number}`}
						</p>
						{result.completed_at && (
							<p className="admin-test-results-modal-sub">
								{formatResultDate(result.completed_at)} · {resultStatusLabel(result)}
							</p>
						)}
					</div>
					{result.percentage != null && (
						<div className="admin-test-breakdown-score">
							<span>Scor total</span>
							<strong>{formatPercent(result.percentage)}</strong>
							{maxScore != null && <span>{result.score ?? 0} / {maxScore} p</span>}
						</div>
					)}
				</header>
				{!breakdown && response?.error ? (
					<div className="admin-test-results-empty" role="alert">Nu s-au putut încărca detaliile încercării.</div>
				) : !breakdown ? (
					<div className="admin-test-results-empty" role="status">Se încarcă răspunsurile…</div>
				) : breakdown.questions?.length > 0 ? (
					<div className="admin-test-breakdown-list">
						{breakdown.question_snapshot_available === false && (
							<p className="admin-test-results-modal-sub">Pentru această încercare mai veche, detaliile folosesc întrebările disponibile acum.</p>
						)}
						{breakdown.questions.map((question, index) => (
							<ExamQuestionReview key={question.id ?? question.question_id} question={question} index={index} staffView />
						))}
					</div>
				) : (
					<div className="admin-test-results-empty">Nu există întrebări pentru această încercare.</div>
				)}
				<div className="admin-test-results-modal-actions">
					<button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
						Închide
					</button>
				</div>
			</div>
		</Modal>
	);
}
