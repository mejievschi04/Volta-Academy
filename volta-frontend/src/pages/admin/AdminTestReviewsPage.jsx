import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const MANUAL_TYPES = ['short_answer', 'essay'];

const AdminTestReviewsPage = () => {
	const { showToast } = useToast();
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(true);
	const [expandedId, setExpandedId] = useState(null);
	const [scores, setScores] = useState({});
	const [submitting, setSubmitting] = useState(null);

	const fetchPending = useCallback(async () => {
		try {
			setLoading(true);
			const data = await adminService.getPendingTestReviews();
			setResults(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching pending reviews:', err);
			showToast('Eroare la încărcarea verificărilor', 'error');
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, [showToast]);

	useEffect(() => {
		fetchPending();
	}, [fetchPending]);

	const getManualQuestions = (result) => {
		const test = result?.test;
		if (!test) return [];
		const questions =
			test.question_source === 'bank' && test.question_bank?.questions
				? test.question_bank.questions
				: test.questions ?? [];
		return (Array.isArray(questions) ? questions : []).filter((q) =>
			MANUAL_TYPES.includes(q.type || '')
		);
	};

	const initScores = (result) => {
		const manual = getManualQuestions(result);
		const init = {};
		manual.forEach((q) => {
			init[q.id] = scores[`${result.id}_${q.id}`] ?? 0;
		});
		return init;
	};

	const handleScoreChange = (resultId, questionId, value) => {
		setScores((prev) => ({
			...prev,
			[`${resultId}_${questionId}`]: Math.max(0, parseFloat(value) || 0),
		}));
	};

	const handleSubmitReview = async (resultId) => {
		const result = results.find((r) => r.id === resultId);
		if (!result) return;

		const manual = getManualQuestions(result);
		const reviewScores = manual.map((q) => ({
			question_id: q.id,
			score: scores[`${resultId}_${q.id}`] ?? 0,
		}));

		try {
			setSubmitting(resultId);
			await adminService.submitTestManualReview(resultId, reviewScores);
			showToast('Verificare salvată cu succes', 'success');
			setExpandedId(null);
			setScores((prev) => {
				const next = { ...prev };
				manual.forEach((q) => delete next[`${resultId}_${q.id}`]);
				return next;
			});
			fetchPending();
		} catch (err) {
			console.error('Error submitting review:', err);
			showToast(err?.response?.data?.error || 'Eroare la salvare', 'error');
		} finally {
			setSubmitting(null);
		}
	};

	const formatDate = (d) => {
		if (!d) return '-';
		const dt = new Date(d);
		return dt.toLocaleString('ro-RO');
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner" />
					<p>Se încarcă verificările...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-courses-page-header">
				<div className="admin-courses-header-content">
					<div className="admin-courses-header-text">
						<h1 className="admin-courses-title">Verificări manuale teste</h1>
						<p className="admin-courses-subtitle">
							Rezultate cu întrebări deschise (răspuns scurt, eseu) care necesită notare manuală
						</p>
					</div>
				</div>
			</div>

			{results.length === 0 ? (
				<div className="lms-empty-state">
					<p>Nu există verificări în așteptare.</p>
				</div>
			) : (
				<div className="admin-test-reviews-list">
					{results.map((result) => {
						const manual = getManualQuestions(result);
						const isExpanded = expandedId === result.id;

						return (
							<div
								key={result.id}
								className="admin-test-review-card"
								style={{
									border: '1px solid var(--border-primary)',
									borderRadius: 'var(--radius-lg)',
									padding: 'var(--space-4)',
									marginBottom: 'var(--space-4)',
									background: 'var(--bg-elevated)',
								}}
							>
								<div
									className="admin-test-review-header"
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										cursor: 'pointer',
										flexWrap: 'wrap',
										gap: 'var(--space-2)',
									}}
									onClick={() => setExpandedId(isExpanded ? null : result.id)}
								>
									<div>
										<strong>{result.test?.title ?? 'Test'}</strong>
										<span style={{ marginLeft: 'var(--space-2)', color: 'var(--text-tertiary)' }}>
											{result.user?.name ?? result.user?.email ?? 'Student'}
										</span>
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
										<span>
											{result.score ?? 0} / {result.max_score ?? 0} (auto)
										</span>
										<span>{formatDate(result.completed_at)}</span>
										<span
											style={{
												padding: '2px 8px',
												borderRadius: 'var(--radius-md)',
												background: 'var(--color-warning)',
												color: '#000',
												fontSize: 'var(--font-size-xs)',
											}}
										>
											{manual.length} de verificat
										</span>
										<svg
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											style={{
												transform: isExpanded ? 'rotate(180deg)' : 'none',
												transition: 'transform 0.2s',
											}}
										>
											<path d="M6 9l6 6 6-6" />
										</svg>
									</div>
								</div>

								{isExpanded && (
									<div
										className="admin-test-review-body"
										style={{
											marginTop: 'var(--space-4)',
											paddingTop: 'var(--space-4)',
											borderTop: '1px solid var(--border-primary)',
										}}
									>
										{manual.map((q) => {
											const ans = result.answers?.[q.id];
											const userAnswer = typeof ans === 'string' ? ans : ans?.text ?? JSON.stringify(ans ?? '');
											const maxPts = q.points ?? 1;

											return (
												<div
													key={q.id}
													style={{
														marginBottom: 'var(--space-4)',
														padding: 'var(--space-3)',
														background: 'var(--bg-secondary)',
														borderRadius: 'var(--radius-md)',
													}}
												>
													<div style={{ marginBottom: 'var(--space-2)' }}>
														<strong>Întrebare ({q.type}):</strong>
														<div
															dangerouslySetInnerHTML={{ __html: q.content || '' }}
															style={{ marginTop: 'var(--space-1)' }}
														/>
													</div>
													<div style={{ marginBottom: 'var(--space-2)' }}>
														<strong>Răspuns student:</strong>
														<p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{userAnswer || '(gol)'}</p>
													</div>
													<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
														<label>
															Puncte (0–{maxPts}):
															<input
																type="number"
																min={0}
																max={maxPts}
																step={0.5}
																value={scores[`${result.id}_${q.id}`] ?? ''}
																onChange={(e) => handleScoreChange(result.id, q.id, e.target.value)}
																style={{
																	marginLeft: 'var(--space-2)',
																	width: 80,
																	padding: '4px 8px',
																	borderRadius: 'var(--radius-md)',
																	border: '1px solid var(--border-primary)',
																}}
															/>
														</label>
													</div>
												</div>
											);
										})}

										<div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
											<button
												className="admin-btn-create-course"
												onClick={(e) => {
													e.stopPropagation();
													handleSubmitReview(result.id);
												}}
												disabled={submitting === result.id}
											>
												{submitting === result.id ? 'Se salvează...' : 'Salvează verificarea'}
											</button>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default AdminTestReviewsPage;
