import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { useToast } from '../../../contexts/ToastContext';
import UndoRedoControls from '../../common/UndoRedoControls';
import AutoSaveIndicator from '../../common/AutoSaveIndicator';
import QuestionBankBuilderStep1 from './QuestionBankBuilderSteps/Step1Basics';
import QuestionBankBuilderStep2 from './QuestionBankBuilderSteps/Step2Questions';
import QuestionBankBuilderStep3 from './QuestionBankBuilderSteps/Step3Review';
import QuestionBankCreationModal from './QuestionBankCreationModal';

const QuestionBankBuilder = () => {
	const params = useParams();
	const navigate = useNavigate();
	const { showToast } = useToast();
	
	const id = params.id && params.id !== 'new' ? params.id : null;
	const isEditMode = !!id;

	const [currentStep, setCurrentStep] = useState(1);
	const [showModal, setShowModal] = useState(!isEditMode); // Show unified modal for new banks
	
	// Initial bank data
	const initialBankData = {
		// Step 1: Basics
		title: '',
		description: '',
		category: '',

		// Step 2: Questions
		questions: [],
	};
	
	// Use undo/redo for bank data
	const { state: bankData, setState: setBankData, undo, redo, canUndo, canRedo } = useUndoRedo(initialBankData);

	const [loading, setLoading] = useState(isEditMode);
	const [error, setError] = useState(null);
	const [validationErrors, setValidationErrors] = useState({});

	// Load bank data if editing
	useEffect(() => {
		if (isEditMode) {
			fetchBankData();
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
			category: data.category || null,
		};

		if (isEditMode && id) {
			try {
				await adminService.updateQuestionBank(id, dataToSend);
			} catch (err) {
				console.error('Auto-save error:', err);
			}
		} else {
			try {
				const saved = await adminService.createQuestionBank(dataToSend);
				if (saved?.id && !id) {
					window.history.replaceState({}, '', `/admin/question-banks/${saved.id}/builder`);
				}
			} catch (err) {
				console.error('Auto-save error:', err);
			}
		}
	};

	const hasValidTitle = bankData.title && typeof bankData.title === 'string' && bankData.title.trim().length >= 3;
	const autoSaveEnabled = currentStep > 1 && hasValidTitle;
	
	const { saveStatus: autoSaveStatus, manualSave } = useAutoSave(bankData, autoSaveFn, 2000, autoSaveEnabled);
	
	// Update save status
	const [saveStatus, setSaveStatus] = useState('idle');
	useEffect(() => {
		setSaveStatus(autoSaveStatus);
	}, [autoSaveStatus]);

	const fetchBankData = async () => {
		try {
			setLoading(true);
			const bank = await adminService.getQuestionBank(id);
			const questions = await adminService.getQuestionBankQuestions(id);
			
			setBankData({
				...bank,
				questions: Array.isArray(questions) ? questions : (questions?.data || []),
			});
		} catch (err) {
			console.error('Error fetching bank:', err);
			setError('Nu s-a putut încărca banca de întrebări');
			showToast('Eroare la încărcarea băncii de întrebări', 'error');
		} finally {
			setLoading(false);
		}
	};

	const updateBankData = (updates) => {
		setBankData(prev => ({ ...prev, ...updates }));
		setValidationErrors({});
	};

	const validateStep = (step) => {
		const errors = {};

		switch (step) {
			case 1:
				if (!bankData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				break;
			case 2:
				if (!bankData.questions || bankData.questions.length === 0) {
					errors.questions = 'Adaugă cel puțin o întrebare';
				}
				break;
			case 3:
				// Final validation
				if (!bankData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				if (!bankData.questions || bankData.questions.length === 0) {
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
			if (currentStep < 3) {
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
		const validationResult = validateStep(3);
		if (!validationResult.isValid) {
			setValidationErrors(validationResult.errors);
			setCurrentStep(3);
			return;
		}

		try {
			setLoading(true);
			
			// Save bank first
			const dataToSend = {
				title: bankData.title.trim(),
				description: bankData.description || null,
				category: bankData.category || null,
			};

			let bankId = id;
			if (isEditMode && id) {
				await adminService.updateQuestionBank(id, dataToSend);
			} else {
				const saved = await adminService.createQuestionBank(dataToSend);
				if (saved?.id) {
					bankId = saved.id;
					window.history.replaceState({}, '', `/admin/question-banks/${bankId}/builder`);
				}
			}

			// Save questions if we have temporary ones
			if (bankId && bankData.questions) {
				for (const question of bankData.questions) {
					if (question.id && question.id.toString().startsWith('temp-')) {
						// This is a new question, add it
						await adminService.addQuestionToBank(bankId, {
							type: question.type,
							content: question.content || question.text,
							answers: question.answers || [],
							points: question.points || 1,
							explanation: question.explanation || '',
						});
					}
				}
			}

			showToast('Bancă de întrebări publicată cu succes!', 'success');
			navigate('/admin/question-banks');
		} catch (err) {
			console.error('Error publishing bank:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la publicarea băncii de întrebări';
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
			showToast('Bancă de întrebări salvată cu succes!', 'success');
		} catch (err) {
			console.error('Error saving bank:', err);
			const errorMsg = err.response?.data?.error || err.message || 'Eroare la salvarea băncii de întrebări';
			setError(errorMsg);
			showToast(errorMsg, 'error');
		} finally {
			setLoading(false);
		}
	};

	if (loading && isEditMode) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
				</div>
			</div>
		);
	}

	const steps = [
		{ number: 1, title: 'Informații de bază', icon: '📝' },
		{ number: 2, title: 'Întrebări', icon: '❓' },
		{ number: 3, title: 'Revizuire', icon: '📋' },
	];

	// Unified Modal for new banks
	if (showModal && !isEditMode) {
		return (
			<QuestionBankCreationModal
				onClose={() => navigate('/admin/question-banks')}
				bankData={bankData}
				onUpdate={updateBankData}
				currentStep={currentStep}
				onStepChange={setCurrentStep}
				onValidationErrors={setValidationErrors}
				validationErrors={validationErrors}
				onSaveDraft={handleSaveDraft}
				loading={loading}
				bankId={id}
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
							className="lms-btn-secondary"
							onClick={() => navigate('/admin/question-banks')}
						>
							← Înapoi
						</button>
						<h1 className="admin-course-builder-title">
							{isEditMode ? 'Editează Bancă de Întrebări' : 'Creează Bancă de Întrebări Nouă'}
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
							className="lms-btn-secondary"
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
						<div className="lms-error-message">
							{error}
						</div>
					)}

					{/* Show validation errors summary */}
					{Object.keys(validationErrors).length > 0 && (
						<div className="lms-error-message">
							<strong>⚠️ Erori de validare:</strong>
							<ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
								{Object.entries(validationErrors).map(([key, message]) => (
									<li key={key}>{message}</li>
								))}
							</ul>
						</div>
					)}

					{/* PASUL 1: Basics */}
					{currentStep === 1 && (
						<QuestionBankBuilderStep1
							data={bankData}
							onUpdate={updateBankData}
							errors={validationErrors}
						/>
					)}

					{/* PASUL 2: Questions */}
					{currentStep === 2 && (
						<QuestionBankBuilderStep2
							bankId={id}
							data={bankData}
							onUpdate={updateBankData}
							errors={validationErrors}
						/>
					)}

					{/* PASUL 3: Review */}
					{currentStep === 3 && (
						<QuestionBankBuilderStep3
							bankId={id}
							data={bankData}
							onPublish={handlePublish}
							loading={loading}
							errors={validationErrors}
						/>
					)}
				</div>

				{/* Navigation */}
				<div className="admin-course-builder-footer">
					<button
						className="lms-btn-secondary"
						onClick={handlePrevious}
						disabled={currentStep === 1}
					>
						← Anterior
					</button>
					<div style={{ display: 'flex', gap: 'var(--space-3)' }}>
						{currentStep < 3 ? (
							<button
								className="lms-btn-primary"
								onClick={handleNext}
								disabled={loading}
							>
								Următor →
							</button>
						) : (
							<button
								className="lms-btn-primary"
								onClick={handlePublish}
								disabled={loading}
							>
								🚀 Publică Bancă de Întrebări
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default QuestionBankBuilder;
