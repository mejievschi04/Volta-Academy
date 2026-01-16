import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TestBuilderStep1 from './TestBuilderSteps/Step1Basics';
import TestBuilderStep2 from './TestBuilderSteps/Step2Questions';
import TestBuilderStep3 from './TestBuilderSteps/Step3Settings';
import TestBuilderStep4 from './TestBuilderSteps/Step4Review';
import UndoRedoControls from '../../common/UndoRedoControls';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import './TestCreationModal.css';

/**
 * Test Creation Modal - Unified Modal for all test creation steps
 * Similar to CourseCreationModal but simplified for tests
 */
const TestCreationModal = ({ 
	onClose, 
	testData,
	onUpdate,
	currentStep: builderStep,
	onStepChange,
	onValidationErrors,
	validationErrors,
	onSaveDraft,
	loading,
	testId,
	onPublish,
	undo,
	redo,
	canUndo,
	canRedo,
	saveStatus
}) => {
	const navigate = useNavigate();
	const [modalStep, setModalStep] = useState(1); // 1: Welcome, 2+: Builder Steps

	// Ensure testData is always defined
	const safeTestData = testData || {
		title: '',
		description: '',
		type: 'graded',
		status: 'draft',
		questions: [],
		question_source: 'direct',
		question_set_id: null,
		time_limit_minutes: null,
		max_attempts: null,
		randomize_questions: false,
		randomize_answers: false,
		show_results_immediately: true,
		show_correct_answers: false,
		allow_review: true,
	};

	const isInBuilder = modalStep >= 2;
	const totalSteps = 5; // 1 modal step + 4 builder steps

	const handleStart = () => {
		setModalStep(2);
		if (onStepChange) {
			onStepChange(1);
		}
	};

	const handleBack = () => {
		if (isInBuilder && builderStep > 1) {
			// Go to previous builder step
			if (onStepChange) {
				onStepChange(builderStep - 1);
			}
		} else if (modalStep === 2) {
			// Go back to welcome
			setModalStep(1);
			if (onStepChange) {
				onStepChange(0);
			}
		} else {
			onClose?.();
		}
	};

	const handleNext = () => {
		if (isInBuilder && builderStep < 4) {
			if (onStepChange) {
				onStepChange(builderStep + 1);
			}
		}
	};

	const getProgressPercentage = () => {
		if (isInBuilder) {
			return ((1 + builderStep) / totalSteps) * 100;
		}
		return (modalStep / totalSteps) * 100;
	};

	const getCurrentStepText = () => {
		if (isInBuilder) {
			return `Pasul ${1 + builderStep} din ${totalSteps}`;
		}
		return `Pasul ${modalStep} din ${totalSteps}`;
	};

	return (
		<div className="course-creation-modal-overlay" onClick={onClose}>
			<div className="course-creation-modal" onClick={(e) => e.stopPropagation()}>
				<div className="course-creation-modal-header">
					<div className="course-creation-modal-header-left">
						<h2>{isInBuilder ? 'Creează Test Nou' : 'Creează un test nou'}</h2>
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
								<h3>Creează un test nou</h3>
								<p className="course-creation-modal-subtitle">
									Teste standalone care pot fi reutilizate în multiple cursuri
								</p>
							</div>

							{/* Features Preview */}
							<div className="course-creation-modal-features">
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">❓</span>
									<div>
										<h3>Întrebări Multiple</h3>
										<p>Adaugă întrebări direct sau din question banks</p>
									</div>
								</div>
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">⚙️</span>
									<div>
										<h3>Setări Flexibile</h3>
										<p>Configurează timpul, încercările și feedback-ul</p>
									</div>
								</div>
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">📊</span>
									<div>
										<h3>Reutilizabil</h3>
										<p>Folosește același test în multiple cursuri</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Builder Steps (2-5) */}
					{isInBuilder && (
						<div className="course-creation-modal-builder">
							{/* Step 1: Test Basics */}
							{builderStep === 1 && (
								<TestBuilderStep1
									data={safeTestData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 2: Questions */}
							{builderStep === 2 && (
								<TestBuilderStep2
									testId={testId}
									data={safeTestData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 3: Settings */}
							{builderStep === 3 && (
								<TestBuilderStep3
									data={safeTestData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 4: Review */}
							{builderStep === 4 && (
								<TestBuilderStep4
									testId={testId}
									data={safeTestData}
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
							Începe Crearea Testului → 
						</button>
					)}
					{isInBuilder && builderStep < 4 && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={handleNext}
							disabled={loading}
						>
							Următor →
						</button>
					)}
					{isInBuilder && builderStep === 4 && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={onPublish}
							disabled={loading}
						>
							🚀 Publică Test
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default TestCreationModal;
