import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../../../services/api';
import { useToast } from '../../../../contexts/ToastContext';
import AIAssessmentGenerator from '../AssessmentsSystem/AIAssessmentGenerator';
import AITutorSettings from '../AITutorSettings';
import { analyzeLessonTypes } from '../../../../utils/lessonTypeAnalyzer';

const CourseBuilderStep4 = ({ courseId, data, onUpdate, errors }) => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [availableTests, setAvailableTests] = useState([]);
	const [linkedTests, setLinkedTests] = useState([]);
	const [showTestSelector, setShowTestSelector] = useState(false);
	const [selectedTest, setSelectedTest] = useState(null);
	const [linkOptions, setLinkOptions] = useState({
		scope: 'course',
		scope_id: null,
		required: false,
		passing_score: 70,
		assessmentType: 'lesson_quiz', // For AI generator
	});
	
	// Analizează tipurile de lecții și generează recomandări
	const lessonAnalysis = analyzeLessonTypes(data.modules || []);
	const [appliedRecommendations, setAppliedRecommendations] = useState([]);

	useEffect(() => {
		if (courseId) {
			fetchLinkedTests();
			fetchAvailableTests();
		}
	}, [courseId]);

	const fetchAvailableTests = async () => {
		try {
			const tests = await adminService.getTests({ status: 'published' });
			setAvailableTests(Array.isArray(tests) ? tests : (tests?.data || []));
		} catch (err) {
			console.error('Error fetching available tests:', err);
		}
	};

	const fetchLinkedTests = async () => {
		try {
			const course = await adminService.getCourse(courseId);
			// Get tests from course-test relationships
			const tests = course.tests || course.courseTests || [];
			setLinkedTests(Array.isArray(tests) ? tests : []);
		} catch (err) {
			console.error('Error fetching linked tests:', err);
		}
	};

	const handleLinkTest = async () => {
		if (!selectedTest) {
			showToast('Selectează un test', 'error');
			return;
		}

		try {
			await adminService.linkTestToCourse(selectedTest.id, courseId, linkOptions);
			showToast('Test atașat cu succes', 'success');
			setShowTestSelector(false);
			setSelectedTest(null);
			fetchLinkedTests();
		} catch (err) {
			console.error('Error linking test:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la atașarea testului';
			showToast(errorMsg, 'error');
		}
	};

	const handleUnlinkTest = async (testId, scope, scopeId) => {
		if (!confirm('Sigur dorești să deconectezi acest test de la curs?')) {
			return;
		}

		try {
			await adminService.unlinkTestFromCourse(testId, courseId, scope, scopeId);
			showToast('Test deconectat cu succes', 'success');
			fetchLinkedTests();
		} catch (err) {
			console.error('Error unlinking test:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la deconectarea testului';
			showToast(errorMsg, 'error');
		}
	};

	// Aplică recomandări automate
	const handleApplyRecommendation = (recommendation) => {
		if (recommendation.autoGenerate) {
			// Auto-generate assessment
			setLinkOptions({
				...linkOptions,
				assessmentType: recommendation.type,
				required: recommendation.priority === 'high'
			});
			setShowTestSelector(true);
		}
		setAppliedRecommendations(prev => [...prev, recommendation.type]);
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Evaluare & Progres</h2>
			<p className="admin-course-builder-step-description">
				Configurează testele, regulile de finalizare și urmărirea progresului
			</p>

			{/* Recomandări bazate pe tipurile de lecții */}
			{lessonAnalysis.recommendations.assessments.length > 0 && (
				<div className="admin-recommendations-card" style={{
					background: 'var(--bg-surface-hover)',
					border: '1.5px solid var(--color-primary)',
					borderRadius: 'var(--radius-lg)',
					padding: 'var(--space-5)',
					marginBottom: 'var(--space-6)'
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
						<span style={{ fontSize: '24px' }}>✨</span>
						<h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
							Recomandări AI bazate pe tipurile de lecții
						</h3>
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
						{lessonAnalysis.recommendations.assessments.map((rec, idx) => (
							<div key={idx} style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								padding: 'var(--space-3)',
								background: 'var(--bg-surface)',
								borderRadius: 'var(--radius-md)',
								border: '1px solid var(--border-default)'
							}}>
								<div style={{ flex: 1 }}>
									<div style={{ 
										display: 'flex', 
										alignItems: 'center', 
										gap: 'var(--space-2)',
										marginBottom: 'var(--space-1)'
									}}>
										<span style={{ 
											fontSize: 'var(--font-size-sm)', 
											fontWeight: 'var(--font-weight-semibold)',
											color: rec.priority === 'high' ? 'var(--color-primary)' : 'var(--text-primary)'
										}}>
											{rec.type === 'lesson_quiz' ? '📝 Quiz pe Lecție' :
											 rec.type === 'module_test' ? '📚 Test pe Modul' :
											 rec.type === 'final_exam' ? '🎓 Test Final' :
											 rec.type === 'assignment_review' ? '✍️ Evaluare Temă' : rec.type}
										</span>
										{rec.priority === 'high' && (
											<span style={{
												padding: '2px 8px',
												background: 'var(--color-primary-lighter)',
												borderRadius: 'var(--radius-sm)',
												fontSize: 'var(--font-size-xs)',
												color: 'var(--color-primary)',
												fontWeight: 'var(--font-weight-semibold)'
											}}>
												Prioritate Înaltă
											</span>
										)}
									</div>
									<p style={{ 
										margin: 0, 
										fontSize: 'var(--font-size-sm)', 
										color: 'var(--text-secondary)',
										lineHeight: 1.5
									}}>
										{rec.reason}
									</p>
								</div>
								{!appliedRecommendations.includes(rec.type) && (
									<button
										className="admin-btn admin-btn-sm admin-btn-primary"
										onClick={() => handleApplyRecommendation(rec)}
										style={{ marginLeft: 'var(--space-3)' }}
									>
										{rec.autoGenerate ? '🤖 Generează' : 'Aplică'}
									</button>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			<div className="admin-course-builder-form">
				{/* Completion Rules */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Reguli de Finalizare</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.completion_rules?.require_all_lessons || false}
								onChange={(e) => onUpdate({
									completion_rules: {
										...data.completion_rules,
										require_all_lessons: e.target.checked,
									}
								})}
								className="admin-checkbox-input"
							/>
							<span>Necesită finalizarea tuturor lecțiilor</span>
						</label>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.completion_rules?.require_all_exams || false}
								onChange={(e) => onUpdate({
									completion_rules: {
										...data.completion_rules,
										require_all_exams: e.target.checked,
									}
								})}
								className="admin-checkbox-input"
							/>
							<span>Necesită finalizarea tuturor testelor</span>
						</label>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Procent Minim de Finalizare (%)</label>
						<input
							type="number"
							className="admin-form-input"
							value={data.min_completion_percentage || 0}
							onChange={(e) => onUpdate({ min_completion_percentage: parseInt(e.target.value) || 0 })}
							min="0"
							max="100"
						/>
						<p className="admin-form-hint">
							Procentul minim de finalizare necesar pentru a marca cursul ca finalizat
						</p>
					</div>
				</div>

				{/* Certificate Settings */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Certificare</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.has_certificate || false}
								onChange={(e) => onUpdate({ has_certificate: e.target.checked })}
								className="admin-checkbox-input"
							/>
							<span>Oferă certificat la finalizarea cursului</span>
						</label>
					</div>

					{data.has_certificate && (
						<>
							<div className="admin-form-group">
								<label className="admin-form-label">Scor Minim pentru Certificat (%)</label>
								<input
									type="number"
									className={`admin-form-input ${errors.min_exam_score ? 'error' : ''}`}
									value={data.min_exam_score || 70}
									onChange={(e) => onUpdate({ min_exam_score: parseInt(e.target.value) || 70 })}
									min="0"
									max="100"
								/>
								{errors.min_exam_score && (
									<span className="admin-form-error">{errors.min_exam_score}</span>
								)}
							</div>

							<div className="admin-form-group">
								<label className="admin-form-label">Permite Reîncercare</label>
								<label className="admin-form-label admin-form-label-checkbox">
									<input
										type="checkbox"
										checked={data.allow_retake !== false}
										onChange={(e) => onUpdate({ allow_retake: e.target.checked })}
										className="admin-checkbox-input"
									/>
									<span>Permite studenților să reia testul</span>
								</label>
							</div>

							{data.allow_retake && (
								<div className="admin-form-group">
									<label className="admin-form-label">Număr Maxim de Reîncercări</label>
									<input
										type="number"
										className="admin-form-input"
										value={data.max_retakes || 3}
										onChange={(e) => onUpdate({ max_retakes: parseInt(e.target.value) || 3 })}
										min="1"
										max="10"
									/>
								</div>
							)}
						</>
					)}
				</div>

				{/* AI Assessment Generator */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">🤖 Generează Teste cu AI</h3>
					<div className="ai-assessment-section">
						<div className="assessment-type-selector">
							<label className="admin-form-label">Tip Assessment:</label>
							<select
								className="admin-form-select"
								value={linkOptions.assessmentType || 'lesson_quiz'}
								onChange={(e) => setLinkOptions({ ...linkOptions, assessmentType: e.target.value })}
							>
								<option value="lesson_quiz">Lesson Quiz</option>
								<option value="module_test">Module Test</option>
								<option value="final_exam">Final Exam</option>
							</select>
						</div>
						<AIAssessmentGenerator
							courseData={data}
							assessmentType={linkOptions.assessmentType || 'lesson_quiz'}
							onQuestionsGenerated={(questions) => {
								// Navigate to test builder with generated questions
								showToast(`${questions.length} întrebări generate! Creează testul pentru a le folosi.`, 'success');
								// Optionally auto-create test
								navigate('/admin/tests/new/builder', { 
									state: { 
										generatedQuestions: questions,
										courseId: courseId
									}
								});
							}}
						/>
					</div>
				</div>

				{/* AI Tutor Settings */}
				<div className="admin-form-section">
					<AITutorSettings
						courseData={data}
						onUpdate={onUpdate}
					/>
				</div>

				{/* Attach Tests */}
				{courseId && (
					<div className="admin-form-section">
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
							<h3 className="admin-form-section-title">Teste Atașate</h3>
							<button
								className="va-btn va-btn-sm va-btn-primary"
								onClick={() => setShowTestSelector(true)}
							>
								+ Atașează Test
							</button>
						</div>

						{linkedTests.length > 0 ? (
							<div className="va-stack" style={{ gap: '1rem' }}>
								{linkedTests.map((link) => {
									const test = link.test || link;
									const pivot = link.pivot || link;
									return (
										<div
											key={test.id}
											style={{
												padding: '1.5rem',
												background: 'rgba(0, 0, 0, 0.3)',
												border: '1px solid rgba(255, 238, 0, 0.2)',
												borderRadius: '8px',
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
											}}
										>
											<div style={{ flex: 1 }}>
												<h4 style={{ marginBottom: '0.5rem' }}>{test.title}</h4>
												<div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--va-muted)', flexWrap: 'wrap' }}>
													<div>📋 Scope: {pivot.scope || 'course'}</div>
													<div>✅ Obligatoriu: {pivot.required ? 'Da' : 'Nu'}</div>
													<div>📊 Scor minim: {pivot.passing_score || 70}%</div>
													<div>📝 Tip: {test.type || 'graded'}</div>
												</div>
											</div>
											<div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
												<button
													className="va-btn va-btn-sm"
													onClick={() => navigate(`/admin/tests/${test.id}/builder`)}
												>
													✏️ Editează
												</button>
												<button
													className="va-btn va-btn-sm va-btn-danger"
													onClick={() => handleUnlinkTest(test.id, pivot.scope, pivot.scope_id)}
												>
													🔗 Deconectează
												</button>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="admin-info-box">
								<p>Nu există teste atașate la acest curs.</p>
								<p className="admin-info-box-hint">
									Testele trebuie create separat în Test Builder și publicate înainte de a fi atașate.
								</p>
								<button
									className="va-btn va-btn-primary"
									style={{ marginTop: '1rem' }}
									onClick={() => navigate('/admin/tests/new/builder')}
								>
									+ Creează Test Nou
								</button>
							</div>
						)}
					</div>
				)}

				{!courseId && (
					<div className="admin-course-builder-info-box">
						<p>💡 Completează mai întâi structura cursului pentru a atașa testele.</p>
					</div>
				)}
			</div>

			{/* Test Selector Modal */}
			{showTestSelector && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0, 0, 0, 0.3)',
						backdropFilter: 'blur(10px)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowTestSelector(false)}
				>
					<div
						className="va-card"
						style={{
							width: '90%',
							maxWidth: '800px',
							maxHeight: '90vh',
							overflow: 'auto',
							position: 'relative',
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<h2>Atașează Test la Curs</h2>
							<button
								type="button"
								onClick={() => setShowTestSelector(false)}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#fff',
									fontSize: '1.5rem',
									cursor: 'pointer',
									padding: '0.25rem 0.5rem',
								}}
							>
								×
							</button>
						</div>
						<div className="va-card-body">
							{availableTests.length > 0 ? (
								<>
									<div className="admin-form-group">
										<label className="admin-form-label">Selectează Test</label>
										<select
											className="admin-form-input"
											value={selectedTest?.id || ''}
											onChange={(e) => {
												const test = availableTests.find(t => t.id === parseInt(e.target.value));
												setSelectedTest(test);
											}}
										>
											<option value="">Selectează un test...</option>
											{availableTests.map((test) => (
												<option key={test.id} value={test.id}>
													{test.title} ({test.type})
												</option>
											))}
										</select>
									</div>

									{selectedTest && (
										<>
											<div className="admin-form-group">
												<label className="admin-form-label">Scope (Nivel)</label>
												<select
													className="admin-form-input"
													value={linkOptions.scope}
													onChange={(e) => setLinkOptions({ ...linkOptions, scope: e.target.value, scope_id: null })}
												>
													<option value="course">Nivel Curs</option>
													<option value="module">Nivel Modul</option>
													<option value="lesson">Nivel Lecție</option>
												</select>
											</div>

											<div className="admin-form-group">
												<label className="admin-form-label admin-form-label-checkbox">
													<input
														type="checkbox"
														checked={linkOptions.required}
														onChange={(e) => setLinkOptions({ ...linkOptions, required: e.target.checked })}
														className="admin-checkbox-input"
													/>
													<span>Test obligatoriu (blochează progresul dacă nu este trecut)</span>
												</label>
											</div>

											<div className="admin-form-group">
												<label className="admin-form-label">Scor Minim de Trecere (%)</label>
												<input
													type="number"
													className="admin-form-input"
													value={linkOptions.passing_score}
													onChange={(e) => setLinkOptions({ ...linkOptions, passing_score: parseInt(e.target.value) || 70 })}
													min="0"
													max="100"
												/>
											</div>

											<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
												<button
													type="button"
													className="va-btn"
													onClick={() => setShowTestSelector(false)}
												>
													Anulează
												</button>
												<button
													type="button"
													className="va-btn va-btn-primary"
													onClick={handleLinkTest}
												>
													Atașează Test
												</button>
											</div>
										</>
									)}
								</>
							) : (
								<div style={{ textAlign: 'center', padding: '2rem' }}>
									<p>Nu există teste publicate disponibile.</p>
									<button
										className="va-btn va-btn-primary"
										style={{ marginTop: '1rem' }}
										onClick={() => {
											setShowTestSelector(false);
											navigate('/admin/tests/new/builder');
										}}
									>
										+ Creează Test Nou
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CourseBuilderStep4;

