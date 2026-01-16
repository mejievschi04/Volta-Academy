import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { useToast } from '../../../contexts/ToastContext';
import UndoRedoControls from '../../common/UndoRedoControls';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import TestBuilderStep1 from './TestBuilderSteps/Step1Basics';
import TestBuilderStep2 from './TestBuilderSteps/Step2Questions';
import TestBuilderStep3 from './TestBuilderSteps/Step3Settings';
import TestBuilderStep4 from './TestBuilderSteps/Step4Review';
import TestCreationModal from './TestCreationModal';

const TestBuilder = () => {
	const params = useParams();
	const navigate = useNavigate();
	const { showToast } = useToast();
	
	const id = params.id && params.id !== 'new' ? params.id : null;
	const isEditMode = !!id;

	const [currentStep, setCurrentStep] = useState(1);
	const [showModal, setShowModal] = useState(!isEditMode); // Show unified modal for new tests
	
	// Initial test data
	const initialTestData = {
		// Step 1: Test Basics
		title: '',
		description: '',
		type: 'graded', // practice, graded, final
		status: 'draft',

		// Step 2: Questions
		questions: [],
		question_source: 'direct', // direct, bank
		question_set_id: null,

		// Step 3: Settings
		time_limit_minutes: null,
		max_attempts: null,
		randomize_questions: false,
		randomize_answers: false,
		show_results_immediately: true,
		show_correct_answers: false,
		allow_review: true,
	};
	
	// Use undo/redo for test data
	const { state: testData, setState: setTestData, undo, redo, canUndo, canRedo } = useUndoRedo(initialTestData);

	const [loading, setLoading] = useState(isEditMode);
	const [error, setError] = useState(null);
	const [validationErrors, setValidationErrors] = useState({});

	// Load test data if editing
	useEffect(() => {
		if (isEditMode) {
			fetchTestData();
		}
	}, [id]);

	// Auto-save function
	const autoSaveFn = async (data) => {
		if (!data.title || typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length < 3) {
			return;
		}

		const dataToSend = {
			title: data.title.trim(),
			description: data.description || null,
			type: data.type || 'graded',
			status: 'draft',
			time_limit_minutes: data.time_limit_minutes || null,
			max_attempts: data.max_attempts || null,
			randomize_questions: data.randomize_questions || false,
			randomize_answers: data.randomize_answers || false,
			show_results_immediately: data.show_results_immediately !== false,
			show_correct_answers: data.show_correct_answers || false,
			allow_review: data.allow_review !== false,
			question_source: data.question_source || 'direct',
			question_set_id: data.question_set_id || null,
		};

		if (isEditMode && id) {
			try {
				await adminService.updateTest(id, dataToSend);
			} catch (err) {
				console.error('Auto-save error:', err);
			}
		} else {
			try {
				const saved = await adminService.createTest({
					...dataToSend,
					questions: data.questions || [],
				});
				if (saved.test?.id && !id) {
					window.history.replaceState({}, '', `/admin/tests/${saved.test.id}/builder`);
					// Don't reload - just continue with current step
				}
			} catch (err) {
				console.error('Auto-save error:', err);
			}
		}
	};

	const hasValidTitle = testData.title && typeof testData.title === 'string' && testData.title.trim().length >= 3;
	const autoSaveEnabled = currentStep > 1 && hasValidTitle;
	
	const { saveStatus: autoSaveStatus, manualSave } = useAutoSave(testData, autoSaveFn, 2000, autoSaveEnabled);
	
	// Update save status
	useEffect(() => {
		setSaveStatus(autoSaveStatus);
	}, [autoSaveStatus]);

	const fetchTestData = async () => {
		try {
			setLoading(true);
			const test = await adminService.getTest(id);
			
			setTestData({
				...test,
				questions: (test.questions || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
			});
		} catch (err) {
			console.error('Error fetching test:', err);
			setError('Nu s-a putut încărca testul');
			showToast('Eroare la încărcarea testului', 'error');
		} finally {
			setLoading(false);
		}
	};

	const updateTestData = (updates) => {
		setTestData(prev => ({ ...prev, ...updates }));
		setValidationErrors({});
	};
	
	// Auto-save status
	const [saveStatus, setSaveStatus] = useState('idle');

	const validateStep = (step) => {
		const errors = {};

		switch (step) {
			case 1:
				if (!testData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				break;
			case 2:
				if (testData.question_source === 'direct' && (!testData.questions || testData.questions.length === 0)) {
					errors.questions = 'Adaugă cel puțin o întrebare';
				}
				if (testData.question_source === 'bank' && !testData.question_set_id) {
					errors.question_set_id = 'Selectează un question bank';
				}
				break;
			case 3:
				// Optional validations
				break;
			case 4:
				// Final validation
				if (!testData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				if (testData.question_source === 'direct' && (!testData.questions || testData.questions.length === 0)) {
					errors.questions = 'Adaugă cel puțin o întrebare';
				}
				break;
		}

		setValidationErrors(errors);
		return {
			isValid: Object.keys(errors).length === 0,
			errors: errors
		};
	};

	const handleNext = () => {
		const validationResult = validateStep(currentStep);
		
		if (validationResult.isValid) {
			if (currentStep < 4) {
				setCurrentStep(currentStep + 1);
			}
		} else {
			const firstError = Object.keys(validationResult.errors)[0];
			if (firstError) {
				const errorElement = document.querySelector(`[data-field="${firstError}"]`) || 
					document.querySelector(`.admin-form-input.error`);
				if (errorElement) {
					errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
					errorElement.focus();
				}
			}
		}
	};

	const handlePrevious = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1);
		}
	};

	const handlePublish = async () => {
		const validationResult = validateStep(4);
		if (!validationResult.isValid) {
			setValidationErrors(validationResult.errors);
			setCurrentStep(4);
			return;
		}

		try {
			setLoading(true);
			
			// Save test first
			const dataToSend = {
				title: testData.title.trim(),
				description: testData.description || null,
				type: testData.type || 'graded',
				time_limit_minutes: testData.time_limit_minutes || null,
				max_attempts: testData.max_attempts || null,
				randomize_questions: testData.randomize_questions || false,
				randomize_answers: testData.randomize_answers || false,
				show_results_immediately: testData.show_results_immediately !== false,
				show_correct_answers: testData.show_correct_answers || false,
				allow_review: testData.allow_review !== false,
				question_source: testData.question_source || 'direct',
				question_set_id: testData.question_set_id || null,
				questions: testData.questions || [],
			};

			if (isEditMode && id) {
				await adminService.updateTest(id, dataToSend);
			} else {
				const saved = await adminService.createTest(dataToSend);
				if (saved.test?.id) {
					window.history.replaceState({}, '', `/admin/tests/${saved.test.id}/builder`);
				}
			}

			// Publish test
			const testId = id || testData.id;
			if (testId) {
				await adminService.publishTest(testId);
				showToast('Test publicat cu succes!', 'success');
				navigate('/admin/tests');
			}
		} catch (err) {
			console.error('Error publishing test:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la publicarea testului';
			setError(errorMsg);
			showToast(errorMsg, 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleSaveDraft = async () => {
		const validationResult = validateStep(currentStep);
		if (!validationResult.isValid) {
			setValidationErrors(validationResult.errors);
			return;
		}

		try {
			setLoading(true);
			await manualSave();
			showToast('Test salvat cu succes!', 'success');
		} catch (err) {
			console.error('Error saving test:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la salvarea testului';
			setError(errorMsg);
			showToast(errorMsg, 'error');
		} finally {
			setLoading(false);
		}
	};

	if (loading && isEditMode) {
		return (
			<div className="admin-container">
				<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
					<div className="va-loading-spinner"></div>
				</div>
			</div>
		);
	}

	const steps = [
		{ number: 1, title: 'Informații de bază', icon: '📝' },
		{ number: 2, title: 'Întrebări', icon: '❓' },
		{ number: 3, title: 'Setări', icon: '⚙️' },
		{ number: 4, title: 'Revizuire', icon: '📋' },
	];

	// Unified Modal for new tests
	if (showModal && !isEditMode) {
		return (
			<TestCreationModal
				onClose={() => navigate('/admin/tests')}
				testData={testData}
				onUpdate={updateTestData}
				currentStep={currentStep}
				onStepChange={setCurrentStep}
				onValidationErrors={setValidationErrors}
				validationErrors={validationErrors}
				onSaveDraft={handleSaveDraft}
				loading={loading}
				testId={id}
				onPublish={handlePublish}
				undo={undo}
				redo={redo}
				canUndo={canUndo}
				canRedo={canRedo}
				saveStatus={saveStatus}
			/>
		);
	}

	return (
		<div className="admin-course-builder">
			<div className="admin-course-builder-container">
				{/* Header */}
				<div className="admin-course-builder-header">
					<div className="admin-course-builder-header-left">
						<button
							className="admin-btn admin-btn-back"
							onClick={() => navigate('/admin/tests')}
						>
							← Înapoi
						</button>
						<h1 className="admin-course-builder-title">
							{isEditMode ? 'Editează Test' : 'Creează Test Nou'}
						</h1>
					</div>
					<div className="admin-course-builder-header-right">
						<UndoRedoControls
							onUndo={undo}
							onRedo={redo}
							canUndo={canUndo}
							canRedo={canRedo}
							className="course-builder-undo-redo"
						/>
						<AutoSaveIndicator status={saveStatus} />
						<button
							className="admin-btn admin-btn-secondary"
							onClick={handleSaveDraft}
							disabled={loading}
						>
							💾 Salvează Draft
						</button>
					</div>
				</div>

				{/* Progress Steps */}
				<div className="admin-course-builder-steps">
					{steps.map((step) => (
						<div
							key={step.number}
							className={`admin-course-builder-step ${
								step.number === currentStep ? 'active' : ''
							} ${step.number < currentStep ? 'completed' : ''}`}
						>
							<div className="admin-course-builder-step-number">
								{step.number < currentStep ? '✓' : step.number}
							</div>
							<div className="admin-course-builder-step-content">
								<div className="admin-course-builder-step-icon">{step.icon}</div>
								<div className="admin-course-builder-step-title">{step.title}</div>
							</div>
						</div>
					))}
				</div>

				{/* Content */}
				<div className="admin-course-builder-content">
					{error && (
						<div className="admin-error-message">
							<strong>Eroare:</strong> {error}
						</div>
					)}

					{/* Show validation errors summary */}
					{Object.keys(validationErrors).length > 0 && (
						<div className="admin-form-error-message">
							<strong>⚠️ Erori de validare:</strong>
							<ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
								{Object.entries(validationErrors).map(([key, message]) => (
									<li key={key}>{message}</li>
								))}
							</ul>
						</div>
					)}

					{/* PASUL 1: Test Basics */}
					{currentStep === 1 && (
						<TestBuilderStep1
							data={testData}
							onUpdate={updateTestData}
							errors={validationErrors}
						/>
					)}

					{/* PASUL 2: Questions */}
					{currentStep === 2 && (
						<TestBuilderStep2
							testId={id}
							data={testData}
							onUpdate={updateTestData}
							errors={validationErrors}
						/>
					)}

					{/* PASUL 3: Settings */}
					{currentStep === 3 && (
						<TestBuilderStep3
							data={testData}
							onUpdate={updateTestData}
							errors={validationErrors}
						/>
					)}

					{/* PASUL 4: Review */}
					{currentStep === 4 && (
						<TestBuilderStep4
							testId={id}
							data={testData}
							onPublish={handlePublish}
							loading={loading}
						/>
					)}
				</div>

				{/* Navigation */}
				<div className="admin-course-builder-footer">
					<button
						className="admin-btn admin-btn-secondary"
						onClick={handlePrevious}
						disabled={currentStep === 1}
					>
						← Anterior
					</button>
					<div style={{ display: 'flex', gap: 'var(--space-3)' }}>
						{currentStep < 4 ? (
							<button
								className="admin-btn admin-btn-primary"
								onClick={handleNext}
							>
								Următor →
							</button>
						) : (
							<button
								className="admin-btn admin-btn-primary"
								onClick={handlePublish}
								disabled={loading}
							>
								🚀 Publică Test
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default TestBuilder;

