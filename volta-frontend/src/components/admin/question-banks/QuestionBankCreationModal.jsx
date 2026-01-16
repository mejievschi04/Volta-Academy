import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionBankBuilderStep1 from './QuestionBankBuilderSteps/Step1Basics';
import QuestionBankBuilderStep2 from './QuestionBankBuilderSteps/Step2Questions';
import QuestionBankBuilderStep3 from './QuestionBankBuilderSteps/Step3Review';
import UndoRedoControls from '../../common/UndoRedoControls';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import './QuestionBankCreationModal.css';

/**
 * Question Bank Creation Modal - Unified Modal for all creation steps
 * Combines Entry Flow and Question Bank Builder in a single modal
 */
const QuestionBankCreationModal = ({ 
	onClose, 
	bankData: initialBankData,
	onUpdate,
	currentStep: builderStep,
	onStepChange,
	onValidationErrors,
	validationErrors,
	onSaveDraft,
	loading,
	bankId,
	onPublish,
	undo,
	redo,
	canUndo,
	canRedo,
	saveStatus
}) => {
	const navigate = useNavigate();
	const [modalStep, setModalStep] = useState(1); // 1: Welcome, 2+: Builder Steps

	const isInBuilder = modalStep >= 2;
	const totalSteps = 4; // 1 modal step + 3 builder steps (Step1Basics, Step2Questions, Step3Review)

	// Ensure bankData is always an object, even if initialBankData is undefined
	const safeBankData = initialBankData || {};

	const handleStart = () => {
		setModalStep(2);
		if (onStepChange) {
			onStepChange(1); // Start builder at step 1
		}
	};

	const handleBack = () => {
		if (isInBuilder && builderStep > 1) {
			if (onStepChange) {
				onStepChange(builderStep - 1);
			}
		} else if (modalStep === 2) {
			setModalStep(1);
			if (onStepChange) {
				onStepChange(0); // Indicate no builder step is active
			}
		} else {
			onClose?.();
		}
	};

	const handleNext = () => {
		if (isInBuilder && builderStep < 3) { // Max builder step is 3 (Review)
			if (onStepChange) {
				onStepChange(builderStep + 1);
			}
		}
	};

	const getProgressPercentage = () => {
		if (isInBuilder) {
			return ((1 + builderStep - 1) / totalSteps) * 100; // 1 modal step + builder steps
		}
		return (modalStep / 1) * 100; // Only 1 modal step (Welcome)
	};

	const getCurrentStepText = () => {
		if (isInBuilder) {
			return `Pasul ${1 + builderStep - 1} din ${totalSteps - 1}`; // Builder steps are 1-3
		}
		return `Pasul ${modalStep} din 1`; // Only 1 modal step
	};

	return (
		<div className="course-creation-modal-overlay" onClick={onClose}>
			<div className="course-creation-modal" onClick={(e) => e.stopPropagation()}>
				<div className="course-creation-modal-header">
					<div className="course-creation-modal-header-left">
						<h2>{isInBuilder ? 'Creează Bancă de Întrebări' : 'Creează o bancă de întrebări nouă'}</h2>
						{isInBuilder && (
							<div className="course-creation-modal-header-actions">
								<UndoRedoControls
									onUndo={undo}
									onRedo={redo}
									canUndo={canUndo}
									canRedo={canRedo}
								/>
								<AutoSaveIndicator status={saveStatus} />
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
									Creează bănci de întrebări reutilizabile pentru teste
								</p>
							</div>

							{/* Features Preview */}
							<div className="course-creation-modal-features">
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">📚</span>
									<div>
										<h3>Reutilizabile</h3>
										<p>Folosește aceleași întrebări în multiple teste</p>
									</div>
								</div>
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">❓</span>
									<div>
										<h3>Diverse Tipuri</h3>
										<p>Suport pentru multiple choice, true/false, răspuns scurt</p>
									</div>
								</div>
								<div className="course-creation-modal-feature">
									<span className="course-creation-modal-feature-icon">🔄</span>
									<div>
										<h3>Actualizări Ușoare</h3>
										<p>Modifică întrebările și se actualizează automat în toate testele</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Builder Steps (2-4) */}
					{isInBuilder && (
						<div className="course-creation-modal-builder">
							{/* Step 1: Basics */}
							{builderStep === 1 && (
								<QuestionBankBuilderStep1
									data={safeBankData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 2: Questions */}
							{builderStep === 2 && (
								<QuestionBankBuilderStep2
									bankId={bankId}
									data={safeBankData}
									onUpdate={onUpdate}
									errors={validationErrors}
								/>
							)}

							{/* Step 3: Review */}
							{builderStep === 3 && (
								<QuestionBankBuilderStep3
									bankId={bankId}
									data={safeBankData}
									onPublish={onPublish}
									loading={loading}
									errors={validationErrors}
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
							Începe Crearea Băncii →
						</button>
					)}
					{isInBuilder && builderStep < 3 && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={handleNext}
							disabled={loading}
						>
							Următor →
						</button>
					)}
					{isInBuilder && builderStep === 3 && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={onPublish}
							disabled={loading}
						>
							🚀 Publică Bancă de Întrebări
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default QuestionBankCreationModal;
