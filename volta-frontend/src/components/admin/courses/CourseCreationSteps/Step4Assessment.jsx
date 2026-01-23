import React from 'react';
import './Step4Assessment.css';

/**
 * PAS 4: Evaluare & Progres
 * Conform TODO.md
 * - Quiz, Assignment, Task practic, Self-assessment, Feedback deschis
 * - Prag de trecere, Retry rules, Randomizare
 * - AI opțional: Propune întrebări, detectează ambiguități
 */
const Step4Assessment = ({ data, onUpdate }) => {
	const modules = data.structure?.modules || [];
	
	const assessmentTypes = [
		{ id: 'quiz', label: 'Quiz', icon: '❓' },
		{ id: 'assignment', label: 'Assignment', icon: '📝' },
		{ id: 'task', label: 'Task practic', icon: '🛠️' },
		{ id: 'self-assessment', label: 'Self-assessment', icon: '✅' },
		{ id: 'feedback', label: 'Feedback deschis', icon: '💬' },
	];
	
	const handleAddAssessment = (lessonId, type) => {
		const assessments = data.assessments || {};
		const lessonAssessments = assessments[lessonId] || [];
		
		const newAssessment = {
			id: Date.now(),
			type,
			passing_threshold: 70,
			allow_retry: true,
			max_retries: 3,
			randomize: false,
		};
		
		onUpdate({
			assessments: {
				...assessments,
				[lessonId]: [...lessonAssessments, newAssessment]
			}
		});
	};
	
	const handleUpdateAssessment = (lessonId, assessmentId, updates) => {
		const assessments = { ...data.assessments };
		const lessonAssessments = [...(assessments[lessonId] || [])];
		const index = lessonAssessments.findIndex(a => a.id === assessmentId);
		
		if (index !== -1) {
			lessonAssessments[index] = { ...lessonAssessments[index], ...updates };
			assessments[lessonId] = lessonAssessments;
			onUpdate({ assessments });
		}
	};
	
	const handleDeleteAssessment = (lessonId, assessmentId) => {
		const assessments = { ...data.assessments };
		assessments[lessonId] = (assessments[lessonId] || []).filter(a => a.id !== assessmentId);
		onUpdate({ assessments });
	};
	
	return (
		<div className="step4-assessment">
			<div className="step4-header">
				<h3>Evaluare & Progres</h3>
				<p className="step4-description">
					Configurează evaluările pentru lecții. Opțional - nu toate lecțiile trebuie să aibă evaluări.
				</p>
			</div>
			
			<div className="step4-content">
				{modules.length === 0 ? (
					<div className="step4-empty">
						<div className="step4-empty-icon">✅</div>
						<p>Nu există lecții definite.</p>
					</div>
				) : (
					<div className="step4-lessons">
						{modules.map((module) => (
							<div key={module.id} className="step4-module-section">
								<h4 className="step4-module-title">{module.title}</h4>
								
								{module.lessons && module.lessons.length > 0 && (
									<div className="step4-lessons-list">
										{module.lessons.map((lesson) => {
											const assessments = data.assessments?.[lesson.id] || [];
											
											return (
												<div key={lesson.id} className="step4-lesson-card">
													<div className="step4-lesson-header">
														<h5 className="step4-lesson-title">{lesson.title}</h5>
													</div>
													
													<div className="step4-add-assessment">
														<span className="step4-add-label">Adaugă evaluare:</span>
														<div className="step4-assessment-type-buttons">
															{assessmentTypes.map(type => (
																<button
																	key={type.id}
																	type="button"
																	className="step4-assessment-type-btn"
																	onClick={() => handleAddAssessment(lesson.id, type.id)}
																>
																	<span>{type.icon}</span>
																	<span>{type.label}</span>
																</button>
															))}
														</div>
													</div>
													
													{assessments.length > 0 && (
														<div className="step4-assessments-list">
															{assessments.map((assessment) => (
																<div key={assessment.id} className="step4-assessment-item">
																	<div className="step4-assessment-item-header">
																		<div className="step4-assessment-item-type">
																			{assessmentTypes.find(t => t.id === assessment.type)?.icon}
																			{assessmentTypes.find(t => t.id === assessment.type)?.label}
																		</div>
																		<button
																			type="button"
																			className="step4-btn-remove"
																			onClick={() => handleDeleteAssessment(lesson.id, assessment.id)}
																		>
																			🗑️
																		</button>
																	</div>
																	
																	<div className="step4-assessment-settings">
																		<div className="step4-form-row">
																			<div className="step4-form-group">
																				<label>Prag de trecere (%)</label>
																				<input
																					type="number"
																					min="0"
																					max="100"
																					value={assessment.passing_threshold || 70}
																					onChange={(e) => handleUpdateAssessment(lesson.id, assessment.id, { 
																						passing_threshold: parseInt(e.target.value) 
																					})}
																					className="step4-input"
																				/>
																			</div>
																			
																			<div className="step4-form-group">
																				<label>
																					<input
																						type="checkbox"
																						checked={assessment.allow_retry || false}
																						onChange={(e) => handleUpdateAssessment(lesson.id, assessment.id, { 
																							allow_retry: e.target.checked 
																						})}
																					/>
																					Permite retry
																				</label>
																			</div>
																		</div>
																		
																		{assessment.allow_retry && (
																			<div className="step4-form-group">
																				<label>Număr maxim retry-uri</label>
																				<input
																					type="number"
																					min="1"
																					max="10"
																					value={assessment.max_retries || 3}
																					onChange={(e) => handleUpdateAssessment(lesson.id, assessment.id, { 
																						max_retries: parseInt(e.target.value) 
																					})}
																					className="step4-input"
																				/>
																			</div>
																		)}
																		
																		{assessment.type === 'quiz' && (
																			<div className="step4-form-group">
																				<label>
																					<input
																						type="checkbox"
																						checked={assessment.randomize || false}
																						onChange={(e) => handleUpdateAssessment(lesson.id, assessment.id, { 
																							randomize: e.target.checked 
																						})}
																					/>
																					Randomizează întrebările
																				</label>
																			</div>
																		)}
																	</div>
																</div>
															))}
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Step4Assessment;
