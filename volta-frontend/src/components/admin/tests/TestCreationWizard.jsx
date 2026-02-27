import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import Step1Details from './TestCreationSteps/Step1Details';
import Step2Questions from './TestCreationSteps/Step2Questions';
import Step3Settings from './TestCreationSteps/Step3Settings';
import Step4Review from './TestCreationSteps/Step4Review';
import '../courses/CourseCreationWizard.css';

/**
 * Test Creation Wizard – Conform ANALIZA_FLOW_CREARE_LMS.md
 * Pași: Detalii test → Întrebări (sursă) → Setări → Rezumat și creează.
 * La final se creează testul ca ciornă și se redirecționează în editorul de test.
 */
const STEPS = [
	{ id: 0, title: 'Detalii test', shortTitle: 'Detalii', icon: '📝' },
	{ id: 1, title: 'Sursă întrebări', shortTitle: 'Întrebări', icon: '❓' },
	{ id: 2, title: 'Setări', shortTitle: 'Setări', icon: '⚙️' },
	{ id: 3, title: 'Rezumat și creează', shortTitle: 'Rezumat', icon: '✓' },
];

const defaultTestData = {
	title: '',
	description: '',
	type: 'graded',
	status: 'draft',
	time_limit_minutes: null,
	max_attempts: null,
	randomize_questions: false,
	randomize_answers: false,
	show_results_immediately: true,
	show_correct_answers: false,
	allow_review: true,
	question_source: 'direct',
	question_set_id: null,
	question_selection: null,
};

const TestCreationWizard = ({ onClose, onSuccess }) => {
	const navigate = useNavigate();
	const { success: showSuccess, error: showError } = useToast();

	const [currentStep, setCurrentStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const [testData, setTestData] = useState(defaultTestData);

	const canProceedFromStep = (step) => {
		if (step === 0) return !!(testData.title?.trim());
		if (step === 1) {
			if ((testData.question_source || 'direct') === 'bank') {
				return !!testData.question_set_id;
			}
			return true;
		}
		return true;
	};

	const handleNext = () => {
		if (currentStep < 3 && canProceedFromStep(currentStep)) {
			setCurrentStep(currentStep + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		} else {
			handleCloseAttempt();
		}
	};

	const hasUnsavedData = () => {
		return !!(testData.title?.trim() || testData.description?.trim());
	};

	const handleCloseAttempt = () => {
		if (hasUnsavedData() && !window.confirm('Ai date nesalvate. Ești sigur că vrei să închizi?')) {
			return;
		}
		if (onClose) onClose();
	};

	const updateTestData = (updates) => {
		setTestData((prev) => ({ ...prev, ...updates }));
	};

	const handleCreate = async () => {
		setLoading(true);
		try {
			const payload = {
				title: testData.title?.trim() || 'Test nou',
				description: testData.description || '',
				type: testData.type || 'graded',
				status: 'draft',
				time_limit_minutes: testData.time_limit_minutes || null,
				max_attempts: testData.max_attempts || null,
				randomize_questions: !!testData.randomize_questions,
				randomize_answers: !!testData.randomize_answers,
				show_results_immediately: testData.show_results_immediately !== false,
				show_correct_answers: !!testData.show_correct_answers,
				allow_review: testData.allow_review !== false,
				question_source: testData.question_source || 'direct',
				question_set_id: testData.question_source === 'bank' ? testData.question_set_id : null,
				question_selection: testData.question_source === 'bank' ? testData.question_selection : null,
			};

			const result = await adminService.createTest(payload);
			const createdId = result?.test?.id ?? result?.id ?? result?.data?.id;

			if (!createdId) {
				throw new Error('Crearea testului nu a returnat un ID');
			}

			showSuccess('Testul a fost creat ca ciornă. Poți adăuga întrebări și publica din editor.');
			if (onSuccess) {
				onSuccess(createdId);
			} else {
				navigate(`/admin/tests/${createdId}`);
			}
			if (onClose) onClose();
		} catch (err) {
			console.error('Error creating test:', err);
			showError(err.response?.data?.message || err.message || 'Eroare la crearea testului');
		} finally {
			setLoading(false);
		}
	};

	const progress = ((currentStep + 1) / STEPS.length) * 100;

	return (
		<div className="course-creation-wizard-page test-creation-wizard-page" role="main" aria-label="Creare test nou">
			<div className="course-creation-wizard test-creation-wizard" role="application" aria-label="Wizard creare test">
				<div className="course-creation-wizard-header">
					<div>
						<h2>Creează test nou</h2>
						<p className="course-creation-wizard-subtitle">
							{STEPS[currentStep].icon} {STEPS[currentStep].title}
						</p>
					</div>
					{onClose && (
						<button type="button" className="course-creation-wizard-close" onClick={handleCloseAttempt} aria-label="Închide wizard">×</button>
					)}
				</div>

				<div className="course-creation-wizard-progress" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Progres pași">
					<div className="course-creation-wizard-progress-bar">
						<div className="course-creation-wizard-progress-fill" style={{ width: `${progress}%` }} />
					</div>
					<span className="course-creation-wizard-progress-text">
						Pasul {currentStep + 1} din {STEPS.length}
					</span>
				</div>

				<nav className="course-creation-wizard-steps-indicator" aria-label="Pași creare test">
					{STEPS.map((step, index) => (
						<button
							key={step.id}
							type="button"
							className={`course-creation-wizard-step-indicator ${index === currentStep ? 'active' : index < currentStep ? 'completed' : ''}`}
							onClick={() => index <= currentStep && setCurrentStep(index)}
							disabled={index > currentStep}
							aria-current={index === currentStep ? 'step' : undefined}
							aria-label={`Pas ${index + 1}: ${step.title}${index < currentStep ? ', completat' : ''}`}
						>
							<span className="course-creation-wizard-step-indicator-icon">
								{index < currentStep ? '✓' : step.icon}
							</span>
							<span className="course-creation-wizard-step-indicator-label">{step.shortTitle}</span>
						</button>
					))}
				</nav>

				<div className="course-creation-wizard-content">
					<div className="course-creation-wizard-form-panel">
						{currentStep === 0 && (
							<Step1Details data={testData} onUpdate={updateTestData} />
						)}
						{currentStep === 1 && (
							<Step2Questions data={testData} onUpdate={updateTestData} />
						)}
						{currentStep === 2 && (
							<Step3Settings data={testData} onUpdate={updateTestData} />
						)}
						{currentStep === 3 && (
							<Step4Review data={testData} onCreate={handleCreate} loading={loading} />
						)}
					</div>
				</div>

				<div className="course-creation-wizard-footer">
					<button
						type="button"
						className="course-creation-wizard-btn course-creation-wizard-btn-secondary"
						onClick={handleBack}
					>
						{currentStep === 0 ? 'Anulează' : '← Înapoi'}
					</button>
					{currentStep < 3 && (
						<button
							type="button"
							className="course-creation-wizard-btn course-creation-wizard-btn-primary"
							onClick={handleNext}
							disabled={!canProceedFromStep(currentStep)}
						>
							Continuă →
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default TestCreationWizard;
