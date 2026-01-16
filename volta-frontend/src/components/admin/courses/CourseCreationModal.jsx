import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Step2CourseIntent from './CourseBuilderSteps/Step2CourseIntent';
import CourseBuilderStep3 from './CourseBuilderSteps/Step3Content';
import CourseQualityValidation from './CourseQualityValidation';
import CourseBuilderStep4 from './CourseBuilderSteps/Step4Tests';
import CourseBuilderStep5 from './CourseBuilderSteps/Step5Price';
import CourseBuilderStep9 from './CourseBuilderSteps/Step9Preview';
import UndoRedoControls from '../../common/UndoRedoControls';
import './CourseCreationModal.css';

/**
 * Course Creation Modal - Unified Modal for all creation steps
 * Combines Entry Flow, Wizard, and Course Builder in a single modal
 */
const CourseCreationModal = ({ 
	onClose, 
	onSelectBlueprint,
	blueprint,
	courseData,
	onUpdate,
	currentStep: builderStep,
	onStepChange,
	onValidationErrors,
	validationErrors,
	onSaveDraft,
	loading,
	courseId,
	onPublish,
	undo,
	redo,
	canUndo,
	canRedo,
	saveStatus
}) => {
	const navigate = useNavigate();
	const [modalStep, setModalStep] = useState(blueprint ? 4 : 1); // 1: Welcome, 2: Creator Type, 3: Blueprint, 4+: Builder Steps
	const [creatorType, setCreatorType] = useState(null);
	const [selectedBlueprint, setSelectedBlueprint] = useState(null);

	// Tipuri de creatori
	const creatorTypes = [
		{
			id: 'solo',
			title: 'Solo Creator',
			description: 'Creez cursuri individual, pentru audiență generală',
			icon: '👤',
			terminology: {
				students: 'Studenți',
				enrollments: 'Înscrieri'
			}
		},
		{
			id: 'team',
			title: 'Team / Company Trainer',
			description: 'Cursuri pentru echipă sau companie, training corporativ',
			icon: '👥',
			terminology: {
				students: 'Angajați',
				enrollments: 'Participanți'
			}
		},
		{
			id: 'academy',
			title: 'Academy / School',
			description: 'Academie sau școală, multiple cursuri, structură complexă',
			icon: '🏫',
			terminology: {
				students: 'Studenți',
				enrollments: 'Înscrieri'
			}
		}
	];

	// Blueprints
	const blueprints = [
		{
			id: 'video',
			title: 'Video Course',
			description: 'Curs bazat pe video-uri, cu transcrieri și capitole AI',
			icon: '🎥',
			structure: {
				modules: 3,
				lessonsPerModule: 5,
				lessonTypes: ['video'],
				assessments: ['lesson_quiz', 'final_exam']
			}
		},
		{
			id: 'bootcamp',
			title: 'Bootcamp',
			description: 'Program intensiv, practic, cu proiecte și evaluări',
			icon: '🚀',
			structure: {
				modules: 5,
				lessonsPerModule: 8,
				lessonTypes: ['video', 'text', 'assignment'],
				assessments: ['module_test', 'final_exam']
			}
		},
		{
			id: 'certification',
			title: 'Certification Path',
			description: 'Cale de certificare cu examene și verificări stricte',
			icon: '🎓',
			structure: {
				modules: 6,
				lessonsPerModule: 6,
				lessonTypes: ['video', 'text'],
				assessments: ['module_test', 'final_exam']
			}
		},
		{
			id: 'microlearning',
			title: 'Microlearning',
			description: 'Lecții scurte, fragmentate, perfecte pentru mobile',
			icon: '📱',
			structure: {
				modules: 4,
				lessonsPerModule: 3,
				lessonTypes: ['video', 'text'],
				assessments: ['lesson_quiz']
			}
		},
		{
			id: 'corporate',
			title: 'Corporate Training',
			description: 'Training corporativ, cu tracking și raportare',
			icon: '🏢',
			structure: {
				modules: 4,
				lessonsPerModule: 5,
				lessonTypes: ['video', 'text', 'live'],
				assessments: ['module_test']
			}
		},
		{
			id: 'workshop',
			title: 'Workshop Interactiv',
			description: 'Workshop-uri practice cu exerciții hands-on și feedback',
			icon: '🛠️',
			structure: {
				modules: 3,
				lessonsPerModule: 4,
				lessonTypes: ['video', 'assignment', 'live'],
				assessments: ['assignment', 'final_exam']
			}
		},
		{
			id: 'text-based',
			title: 'Curs Text',
			description: 'Curs bazat pe conținut text, articole și resurse scrise',
			icon: '📝',
			structure: {
				modules: 4,
				lessonsPerModule: 6,
				lessonTypes: ['text', 'pdf'],
				assessments: ['lesson_quiz', 'final_exam']
			}
		},
		{
			id: 'hybrid',
			title: 'Curs Hibrid',
			description: 'Combinație de video, text, live sessions și assignments',
			icon: '🔄',
			structure: {
				modules: 5,
				lessonsPerModule: 6,
				lessonTypes: ['video', 'text', 'live', 'assignment'],
				assessments: ['lesson_quiz', 'module_test', 'final_exam']
			}
		},
		{
			id: 'onboarding',
			title: 'Onboarding Program',
			description: 'Program de onboarding pentru noii angajați sau studenți',
			icon: '👋',
			structure: {
				modules: 3,
				lessonsPerModule: 4,
				lessonTypes: ['video', 'text', 'quiz'],
				assessments: ['lesson_quiz']
			}
		},
		{
			id: 'masterclass',
			title: 'Masterclass',
			description: 'Curs avansat cu conținut premium și sesiuni live',
			icon: '⭐',
			structure: {
				modules: 6,
				lessonsPerModule: 7,
				lessonTypes: ['video', 'live', 'assignment'],
				assessments: ['module_test', 'final_exam', 'certification']
			}
		}
	];

	// Use blueprint from props if available
	const activeBlueprint = blueprint || selectedBlueprint;
	const isInBuilder = modalStep >= 4;
	const totalSteps = 8; // 3 modal steps + 5 builder steps (steps 3 - Course Structure and 4 - Lesson Design were removed)

	const handleStart = () => {
		setModalStep(2);
	};

	const handleCreatorTypeSelect = (type) => {
		setCreatorType(type);
		setModalStep(3);
	};

	const handleBlueprintSelect = (bp) => {
		setSelectedBlueprint(bp);
		if (onSelectBlueprint) {
			onSelectBlueprint({
				creatorType,
				blueprint: bp,
				terminology: creatorTypes.find(ct => ct.id === creatorType)?.terminology
			});
		}
		// Move to builder step 2 (Course Intent)
		setModalStep(4);
		if (onStepChange) {
			onStepChange(2);
		}
	};

	const handleBack = () => {
		if (isInBuilder && builderStep > 2) {
			// Go to previous builder step
			if (onStepChange) {
				onStepChange(builderStep - 1);
			}
		} else if (modalStep === 4) {
			// Go back to blueprint selection
			setModalStep(3);
			if (onStepChange) {
				onStepChange(1);
			}
		} else if (modalStep === 3) {
			setModalStep(2);
			setSelectedBlueprint(null);
		} else if (modalStep === 2) {
			setModalStep(1);
			setCreatorType(null);
		} else {
			onClose?.();
		}
	};

	const handleNext = () => {
		if (isInBuilder && builderStep < 6) {
			if (onStepChange) {
				onStepChange(builderStep + 1);
			}
		}
	};

	const getProgressPercentage = () => {
		if (isInBuilder) {
			return ((3 + builderStep - 1) / totalSteps) * 100;
		}
		return (modalStep / 3) * 100;
	};

	const getCurrentStepText = () => {
		if (isInBuilder) {
			return `Pasul ${3 + builderStep - 1} din ${totalSteps}`;
		}
		return `Pasul ${modalStep} din 3`;
	};

	return (
		<div className="course-creation-modal-overlay" onClick={onClose}>
			<div className="course-creation-modal" onClick={(e) => e.stopPropagation()}>
				<div className="course-creation-modal-header">
					<div className="course-creation-modal-header-left">
						<h2>{isInBuilder ? 'Creează Curs Nou' : 'Creează un curs nou'}</h2>
						{isInBuilder && (
							<div className="course-creation-modal-header-actions">
								<UndoRedoControls
									onUndo={undo}
									onRedo={redo}
									canUndo={canUndo}
									canRedo={canRedo}
								/>
								<button
									className="admin-btn admin-btn-sm admin-btn-secondary"
									onClick={onSaveDraft}
									disabled={loading}
								>
									💾 Salvează Draft
								</button>
							</div>
						)}
					</div>
					<button className="course-creation-modal-close" onClick={onClose}>×</button>
				</div>

				{/* Progress Bar */}
				<div className="course-creation-modal-progress">
					<div className="course-creation-modal-progress-bar">
						<div 
							className="course-creation-modal-progress-fill" 
							style={{ width: `${getProgressPercentage()}%` }}
						/>
					</div>
					<span className="course-creation-modal-progress-text">
						{getCurrentStepText()}
					</span>
				</div>

				<div className="course-creation-modal-content">
					{/* Step 1: Welcome */}
					{modalStep === 1 && (
						<div className="course-creation-modal-step">
							<div className="course-creation-modal-intro">
								<p className="course-creation-modal-subtitle">
									Lasă AI-ul să te ajute să structurezi și să optimizezi cursul tău
								</p>
							</div>

							{/* Features Preview */}
							<div className="course-creation-modal-features">
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">🤖</span>
									<div>
										<h3>Structură Alimentată de AI</h3>
										<p>Generează automat structura cursului, modulele și lecțiile</p>
									</div>
								</div>
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">✨</span>
									<div>
										<h3>Validare Inteligentă</h3>
										<p>AI verifică calitatea, lacunele și engagement-ul înainte de publicare</p>
									</div>
								</div>
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">📱</span>
									<div>
										<h3>Optimizat pentru Mobile</h3>
										<p>Lecții optimizate pentru experiența de învățare pe mobil</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 2: Creator Type */}
					{modalStep === 2 && (
						<div className="course-creation-modal-step">
							<h3>Ce tip de creator ești?</h3>
							<p className="course-creation-modal-hint">
								Această selecție va adapta wizard-ul și terminologia pentru nevoile tale
							</p>
							<div className="creator-types-grid">
								{creatorTypes.map((type) => (
									<button
										key={type.id}
										className={`creator-type-card ${creatorType === type.id ? 'selected' : ''}`}
										onClick={() => handleCreatorTypeSelect(type.id)}
									>
										<div className="creator-type-icon">{type.icon}</div>
										<div className="creator-type-title">{type.title}</div>
										<div className="creator-type-description">{type.description}</div>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Step 3: Blueprint Selection */}
					{modalStep === 3 && (
						<div className="course-creation-modal-step">
							<h3>Selectează un Blueprint</h3>
							<p className="course-creation-modal-hint">
								Blueprint-ul definește structura inițială și tipurile de lecții
							</p>
							<div className="blueprints-grid">
								{blueprints.map((blueprint) => (
									<button
										key={blueprint.id}
										className={`blueprint-card ${selectedBlueprint?.id === blueprint.id ? 'selected' : ''}`}
										onClick={() => handleBlueprintSelect(blueprint)}
									>
										<div className="blueprint-icon">{blueprint.icon}</div>
										<div className="blueprint-title">{blueprint.title}</div>
										<div className="blueprint-description">{blueprint.description}</div>
										<div className="blueprint-structure">
											<div className="blueprint-structure-item">
												<span className="blueprint-structure-label">Module:</span>
												<span className="blueprint-structure-value">{blueprint.structure.modules}</span>
											</div>
											<div className="blueprint-structure-item">
												<span className="blueprint-structure-label">Lecții/modul:</span>
												<span className="blueprint-structure-value">{blueprint.structure.lessonsPerModule}</span>
											</div>
										</div>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Builder Steps (4-10) */}
					{isInBuilder && activeBlueprint && (
						<div className="course-creation-modal-builder">
							{/* Step 2: Course Intent */}
							{builderStep === 2 && (
								<Step2CourseIntent
									data={courseData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 3: Lesson Content (formerly step 5, steps 3 and 4 were removed) */}
							{builderStep === 3 && (
								<CourseBuilderStep3
									courseId={courseId}
									data={courseData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 4: AI Course Validation (formerly step 6) */}
							{builderStep === 4 && (
								<CourseQualityValidation
									courseData={courseData}
									onValidationComplete={(validationData) => {
										onUpdate({
											readiness_score: validationData.readiness_score,
											ai_validation: validationData
										});
									}}
								/>
							)}

							{/* Step 5: Publish Settings (formerly step 7) */}
							{builderStep === 5 && (
								<div>
									<CourseBuilderStep4
										courseId={courseId}
										data={courseData}
										onUpdate={onUpdate}
										errors={validationErrors}
									/>
									<CourseBuilderStep5
										data={courseData}
										onUpdate={onUpdate}
										errors={validationErrors}
									/>
								</div>
							)}

							{/* Step 6: Post-Publish View (formerly step 8) */}
							{builderStep === 6 && (
								<CourseBuilderStep9
									courseId={courseId}
									data={courseData}
									onPublish={onPublish}
									loading={loading}
								/>
							)}
						</div>
					)}
				</div>

				<div className="course-creation-modal-footer">
					<button className="admin-btn admin-btn-secondary" onClick={handleBack}>
						{modalStep === 1 ? 'Anulează' : '← Înapoi'}
					</button>
					{modalStep === 1 && (
						<button className="admin-btn admin-btn-primary" onClick={handleStart}>
							Începe Crearea Cursului →
						</button>
					)}
					{modalStep === 3 && selectedBlueprint && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={() => handleBlueprintSelect(selectedBlueprint)}
						>
							Continuă cu {selectedBlueprint.title} →
						</button>
					)}
					{isInBuilder && builderStep < 6 && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={handleNext}
							disabled={loading}
						>
							Următor →
						</button>
					)}
					{isInBuilder && builderStep === 6 && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={onPublish}
							disabled={loading}
						>
							🚀 Publică Curs
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default CourseCreationModal;
