import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useToast } from '../../../contexts/ToastContext';
import TestBuilderStep1 from './TestBuilderSteps/Step1Basics';
import TestBuilderStep2 from './TestBuilderSteps/Step2Questions';
import TestBuilderStep3 from './TestBuilderSteps/Step3Settings';
import TestBuilderStep4 from './TestBuilderSteps/Step4Review';

const TestBuilder = () => {
	const params = useParams();
	const navigate = useNavigate();
	const { showToast } = useToast();
	
	const id = params.id && params.id !== 'new' ? params.id : null;
	const isEditMode = !!id;

	const [currentStep, setCurrentStep] = useState(1);
	const [testData, setTestData] = useState({
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
	});

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
					window.location.reload();
				}
			} catch (err) {
				console.error('Auto-save error:', err);
			}
		}
	};

	const hasValidTitle = testData.title && typeof testData.title === 'string' && testData.title.trim().length >= 3;
	const autoSaveEnabled = currentStep > 1 && hasValidTitle;
	
	const { saveStatus, manualSave } = useAutoSave(testData, autoSaveFn, 2000, autoSaveEnabled);

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

	const handleSave = async () => {
		const validationResult = validateStep(currentStep);
		if (!validationResult.isValid) {
			setValidationErrors(validationResult.errors);
			return;
		}

		try {
			setLoading(true);
			
			const dataToSend = {
				title: testData.title.trim(),
				description: testData.description || null,
				type: testData.type || 'graded',
				status: 'draft',
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
				showToast('Test salvat cu succes!', 'success');
			} else {
				const saved = await adminService.createTest(dataToSend);
				if (saved.test?.id) {
					window.history.replaceState({}, '', `/admin/tests/${saved.test.id}/builder`);
					showToast('Test creat cu succes!', 'success');
					window.location.reload();
				}
			}
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
		{ number: 1, title: 'Informații de bază', component: TestBuilderStep1 },
		{ number: 2, title: 'Întrebări', component: TestBuilderStep2 },
		{ number: 3, title: 'Setări', component: TestBuilderStep3 },
		{ number: 4, title: 'Revizuire', component: TestBuilderStep4 },
	];

	const CurrentStepComponent = steps[currentStep - 1]?.component;

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">
						{isEditMode ? 'Editează Test' : 'Creează Test Nou'}
					</h1>
					<p className="va-muted admin-page-subtitle">
						Teste standalone care pot fi reutilizate în multiple cursuri
					</p>
				</div>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					<button
						className="va-btn"
						onClick={() => navigate('/admin/tests')}
					>
						← Înapoi
					</button>
					{saveStatus === 'saving' && (
						<span className="va-muted" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
							Se salvează...
						</span>
					)}
					{saveStatus === 'saved' && (
						<span className="va-muted" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
							✓ Salvat
						</span>
					)}
				</div>
			</div>

			{/* Progress Steps */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				marginBottom: '2rem',
				padding: '1rem',
				background: 'rgba(0, 0, 0, 0.3)',
				borderRadius: '8px',
			}}>
				{steps.map((step, index) => (
					<div key={step.number} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
						<div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
							<div style={{
								width: '40px',
								height: '40px',
								borderRadius: '50%',
								background: currentStep >= step.number ? '#ffee00' : 'rgba(255, 238, 0, 0.2)',
								color: currentStep >= step.number ? '#000' : '#fff',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontWeight: 'bold',
								marginRight: '0.5rem',
							}}>
								{currentStep > step.number ? '✓' : step.number}
							</div>
							<div>
								<div style={{ fontWeight: currentStep === step.number ? 600 : 400 }}>
									Pas {step.number}
								</div>
								<div style={{ fontSize: '0.875rem', color: 'var(--va-muted)' }}>
									{step.title}
								</div>
							</div>
						</div>
						{index < steps.length - 1 && (
							<div style={{
								width: '100%',
								height: '2px',
								background: currentStep > step.number ? '#ffee00' : 'rgba(255, 238, 0, 0.2)',
								margin: '0 1rem',
							}} />
						)}
					</div>
				))}
			</div>

			{error && (
				<div style={{
					padding: '1rem',
					background: 'rgba(244, 67, 54, 0.1)',
					color: '#f44336',
					borderRadius: '8px',
					marginBottom: '1rem',
					border: '1px solid rgba(244, 67, 54, 0.3)',
				}}>
					{error}
				</div>
			)}

			{CurrentStepComponent && (
				<CurrentStepComponent
					testId={id}
					data={testData}
					onUpdate={updateTestData}
					errors={validationErrors}
				/>
			)}

			{/* Navigation */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				marginTop: '2rem',
				paddingTop: '2rem',
				borderTop: '1px solid rgba(255, 238, 0, 0.2)',
			}}>
				<button
					className="va-btn"
					onClick={handlePrevious}
					disabled={currentStep === 1}
				>
					← Anterior
				</button>
				<div style={{ display: 'flex', gap: '0.5rem' }}>
					<button
						className="va-btn"
						onClick={handleSave}
						disabled={loading}
					>
						💾 Salvează Draft
					</button>
					{currentStep < 4 ? (
						<button
							className="va-btn va-btn-primary"
							onClick={handleNext}
						>
							Următor →
						</button>
					) : (
						<button
							className="va-btn va-btn-primary"
							onClick={handlePublish}
							disabled={loading}
						>
							📤 Publică Test
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default TestBuilder;

