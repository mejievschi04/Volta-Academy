import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import TestBuilderStep1 from './TestBuilderSteps/Step1Basics';
import TestBuilderStep2 from './TestBuilderSteps/Step2Questions';
import TestBuilderStep3 from './TestBuilderSteps/Step3Settings';
import '../courses/CourseCreationWizard.css';

/**
 * TestBuilder - Versiune Simplificată
 * Flow simplificat cu 3 pași esențiali:
 * 1. Informații de bază (titlu, descriere, tip)
 * 2. Întrebări (adaugare și editare întrebări)
 * 3. Setări (timp, încercări, randomizare, feedback)
 */

// Main TestBuilder Component
const TestBuilder = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { showToast } = useToast();
	const isEditMode = !!id;
	
	const [currentStep, setCurrentStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [testData, setTestData] = useState({
		// Step 1: Scop
		evaluation_type: '',
		result_impact: '',
		
		// Step 2: Metadate
		title: '',
		description: '',
		domain: '',
		level: '',
		estimated_duration: null,
		tags: '',
		status: 'draft',
		
		// Step 3: Structură
		total_questions: null,
		randomize_questions: false,
		randomize_answers: false,
		question_source: 'direct',
		question_bank_id: null,
		
		// Step 4: Întrebări (va fi populat)
		questions: [],
		
		// Step 5: Scorare
		scoring_type: 'percentage',
		passing_score: null,
		negative_marking: false,
		time_penalty: false,
		retry_rules: 'unlimited',
		max_attempts: null,
		
		// Step 6: Acces
		timer_type: 'none',
		time_limit: null,
		lock_after_failure: false,
		proctoring: false,
		require_course_completion: false,
		role_based_access: false,
		group_based_access: false,
	});
	const [errors, setErrors] = useState({});

	// Fetch test if editing
	useEffect(() => {
		if (isEditMode && id) {
			fetchTest();
		}
	}, [id, isEditMode]);

	const fetchTest = async () => {
		try {
			setLoading(true);
			const test = await adminService.getTest(id);
			const testData = test.data || test;
			
			// Map existing test data to new structure
			setTestData({
				evaluation_type: testData.evaluation_type || '',
				result_impact: testData.result_impact || '',
				title: testData.title || '',
				description: testData.description || '',
				domain: testData.domain || '',
				level: testData.level || '',
				estimated_duration: testData.estimated_duration || testData.time_limit_minutes || null,
				tags: testData.tags || '',
				status: testData.status || 'draft',
				total_questions: testData.total_questions || null,
				randomize_questions: testData.randomize_questions || false,
				randomize_answers: testData.randomize_answers || false,
				question_source: testData.question_source || 'direct',
				question_bank_id: testData.question_bank_id || testData.question_set_id || null,
				questions: testData.questions || [],
				scoring_type: testData.scoring_type || 'percentage',
				passing_score: testData.passing_score || null,
				negative_marking: testData.negative_marking || false,
				time_penalty: testData.time_penalty || false,
				retry_rules: testData.retry_rules || 'unlimited',
				max_attempts: testData.max_attempts || null,
				timer_type: testData.timer_type || (testData.time_limit_minutes ? 'global' : 'none'),
				time_limit: testData.time_limit || testData.time_limit_minutes || null,
				lock_after_failure: testData.lock_after_failure || false,
				proctoring: testData.proctoring || false,
				require_course_completion: testData.require_course_completion || false,
				role_based_access: testData.role_based_access || false,
				group_based_access: testData.group_based_access || false,
			});
		} catch (err) {
			console.error('Error fetching test:', err);
			showToast('Eroare la încărcarea testului', 'error');
			navigate('/admin/tests');
		} finally {
			setLoading(false);
		}
	};

	const updateTestData = (updates) => {
		setTestData(prev => ({ ...prev, ...updates }));
		if (Object.keys(errors).length > 0) {
			setErrors({});
		}
	};

	const validateStep = (step) => {
		const newErrors = {};
		
		if (step === 0) {
			// Step 1: Informații de bază
			if (!testData.title || testData.title.trim() === '') {
				newErrors.title = 'Titlul testului este obligatoriu';
			}
		}
		
		if (step === 1) {
			// Step 2: Întrebări
			if (!testData.questions || testData.questions.length === 0) {
				newErrors.questions = 'Adaugă cel puțin o întrebare';
			}
		}
		
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleNext = () => {
		if (validateStep(currentStep)) {
			if (currentStep < 2) {
				setCurrentStep(currentStep + 1);
			}
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		} else {
			navigate('/admin/tests');
		}
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			setErrors({});
			
			if (!testData.title || testData.title.trim() === '') {
				setErrors({ title: 'Titlul testului este obligatoriu' });
				setCurrentStep(1);
				return;
			}

			// Map to API format
			const testPayload = {
				title: testData.title,
				description: testData.description || null,
				type: testData.evaluation_type === 'certification' ? 'final' : 
				      testData.evaluation_type === 'formative' ? 'practice' : 'graded',
				status: 'draft',
				time_limit_minutes: testData.timer_type === 'global' ? testData.time_limit : null,
				max_attempts: testData.retry_rules === 'limited' ? testData.max_attempts : null,
				randomize_questions: testData.randomize_questions || false,
				randomize_answers: testData.randomize_answers || false,
				show_results_immediately: true,
				show_correct_answers: testData.evaluation_type !== 'certification',
				allow_review: testData.evaluation_type !== 'certification',
				question_source: testData.question_source || 'direct',
				question_set_id: testData.question_bank_id || null,
				questions: testData.questions || [],
				// Additional fields for future use
				evaluation_type: testData.evaluation_type,
				result_impact: testData.result_impact,
				domain: testData.domain,
				level: testData.level,
				estimated_duration: testData.estimated_duration,
				tags: testData.tags,
				scoring_type: testData.scoring_type,
				passing_score: testData.passing_score,
			};

			let savedTest;
			if (isEditMode) {
				savedTest = await adminService.updateTest(id, testPayload);
			} else {
				savedTest = await adminService.createTest(testPayload);
			}

			showToast('Test salvat cu succes', 'success');
			
			if (!isEditMode && savedTest?.id) {
				navigate(`/admin/tests/${savedTest.id}/builder`, { replace: true });
			}
		} catch (err) {
			console.error('Error saving test:', err);
			showToast('Eroare la salvarea testului', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handlePublish = async () => {
		try {
			setSaving(true);
			setErrors({});
			
			if (!testData.title || testData.title.trim() === '') {
				setErrors({ title: 'Titlul testului este obligatoriu' });
				setCurrentStep(1);
				return;
			}

			if (!testData.questions || testData.questions.length === 0) {
				setErrors({ questions: 'Adaugă cel puțin o întrebare înainte de publicare' });
				setCurrentStep(1);
				return;
			}

			// Save as draft first
			const testPayload = {
				title: testData.title,
				description: testData.description || null,
				type: testData.evaluation_type === 'certification' ? 'final' : 
				      testData.evaluation_type === 'formative' ? 'practice' : 'graded',
				status: 'draft',
				time_limit_minutes: testData.timer_type === 'global' ? testData.time_limit : null,
				max_attempts: testData.retry_rules === 'limited' ? testData.max_attempts : null,
				randomize_questions: testData.randomize_questions || false,
				randomize_answers: testData.randomize_answers || false,
				show_results_immediately: true,
				show_correct_answers: testData.evaluation_type !== 'certification',
				allow_review: testData.evaluation_type !== 'certification',
				question_source: testData.question_source || 'direct',
				question_set_id: testData.question_bank_id || null,
				questions: testData.questions || [],
			};

			let savedTest;
			if (isEditMode) {
				savedTest = await adminService.updateTest(id, testPayload);
			} else {
				savedTest = await adminService.createTest(testPayload);
			}

			const testId = savedTest?.id || id;

			// Then publish
			await adminService.publishTest(testId);
			
			showToast('Test publicat cu succes', 'success');
			navigate('/admin/tests');
		} catch (err) {
			console.error('Error publishing test:', err);
			showToast('Eroare la publicarea testului', 'error');
		} finally {
			setSaving(false);
		}
	};

	const steps = [
		{ number: 0, title: 'Informații de Bază', icon: '📝' },
		{ number: 1, title: 'Întrebări', icon: '❓' },
		{ number: 2, title: 'Setări', icon: '⚙️' },
	];

	const progress = ((currentStep + 1) / steps.length) * 100;

	if (loading) {
		return (
			<div className="admin-container">
				<div style={{ 
					display: 'flex', 
					flexDirection: 'column', 
					alignItems: 'center', 
					justifyContent: 'center',
					minHeight: '60vh',
					gap: 'var(--space-4)'
				}}>
					<div className="va-spinner va-spinner-lg"></div>
					<p style={{ color: 'var(--text-secondary)' }}>Se încarcă testul...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="course-creation-wizard-page">
			<div className="course-creation-wizard">
				{/* Header */}
				<div className="course-creation-wizard-header">
					<div>
						<h2>{isEditMode ? 'Editează Test' : 'Creează Test Nou'}</h2>
						<p className="course-creation-wizard-subtitle">
							{steps[currentStep].icon} {steps[currentStep].title}
						</p>
					</div>
					<button 
						type="button" 
						className="course-creation-wizard-close" 
						onClick={() => navigate('/admin/tests')}
					>
						×
					</button>
				</div>
				
				{/* Progress Bar */}
				<div className="course-creation-wizard-progress">
					<div className="course-creation-wizard-progress-bar">
						<div 
							className="course-creation-wizard-progress-fill"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<span className="course-creation-wizard-progress-text">
						Pasul {currentStep + 1} din {steps.length}
					</span>
				</div>
				
				{/* Steps Indicator */}
				<div className="course-creation-wizard-steps-indicator">
					{steps.map((step, index) => (
						<div
							key={step.number}
							className={`course-creation-wizard-step-indicator ${
								index === currentStep ? 'active' : 
								index < currentStep ? 'completed' : ''
							}`}
							onClick={() => {
								if (index <= currentStep) {
									setCurrentStep(index);
								}
							}}
						>
							<div className="course-creation-wizard-step-indicator-icon">
								{index < currentStep ? '✓' : step.icon}
							</div>
							<div className="course-creation-wizard-step-indicator-label">
								{step.title}
							</div>
						</div>
					))}
				</div>
				
				{/* Content - Split Layout */}
				<div className="course-creation-wizard-content course-creation-wizard-split">
					<div className="course-creation-wizard-form-panel">
						{currentStep === 0 && (
							<TestBuilderStep1
								data={testData}
								onUpdate={updateTestData}
								errors={errors}
							/>
						)}
						
						{currentStep === 1 && (
							<TestBuilderStep2
								testId={id}
								data={testData}
								onUpdate={updateTestData}
								errors={errors}
							/>
						)}
						
						{currentStep === 2 && (
							<TestBuilderStep3
								data={testData}
								onUpdate={updateTestData}
								errors={errors}
							/>
						)}
					</div>
					
					{/* Preview Panel */}
					<div className="course-creation-wizard-preview-panel">
						<div className="course-creation-wizard-preview-header">
							<h3>Preview Live</h3>
							<p>Vizualizează modificările în timp real</p>
						</div>
						<div className="course-creation-wizard-preview-content">
							<div className="test-preview-card">
								<div className="test-preview-body">
									<h4 className="test-preview-title">{testData.title || 'Titlu test'}</h4>
									<p className="test-preview-description">{testData.description || 'Descriere test...'}</p>
									<div className="test-preview-meta">
										{testData.evaluation_type && (
											<div className="test-preview-meta-item">
												<span className="test-preview-meta-label">Tip:</span>
												<span className="test-preview-meta-value">{testData.evaluation_type}</span>
											</div>
										)}
										{testData.domain && (
											<div className="test-preview-meta-item">
												<span className="test-preview-meta-label">Domeniu:</span>
												<span className="test-preview-meta-value">{testData.domain}</span>
											</div>
										)}
										{testData.level && (
											<div className="test-preview-meta-item">
												<span className="test-preview-meta-label">Nivel:</span>
												<span className="test-preview-meta-value">{testData.level}</span>
											</div>
										)}
										{testData.estimated_duration && (
											<div className="test-preview-meta-item">
												<span className="test-preview-meta-label">Durată:</span>
												<span className="test-preview-meta-value">{testData.estimated_duration} min</span>
											</div>
										)}
									</div>
									{testData.questions?.length > 0 && (
										<div className="test-preview-questions">
											<div className="test-preview-questions-label">Întrebări ({testData.questions.length}):</div>
											{testData.questions.slice(0, 3).map((q, idx) => (
												<div key={idx} className="test-preview-question">
													<span className="test-preview-question-number">{idx + 1}.</span>
													<span className="test-preview-question-text">{q.question || q.text || 'Întrebare'}</span>
												</div>
											))}
											{testData.questions.length > 3 && (
												<div className="test-preview-questions-more">+{testData.questions.length - 3} mai multe...</div>
											)}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
				
				{/* Footer */}
				<div className="course-creation-wizard-footer">
					<button
						type="button"
						className="course-creation-wizard-btn course-creation-wizard-btn-secondary"
						onClick={handleBack}
					>
						{currentStep === 0 ? 'Anulează' : '← Înapoi'}
					</button>
					
					<button
						type="button"
						className="course-creation-wizard-btn course-creation-wizard-btn-secondary"
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? 'Salvare...' : '💾 Salvează Draft'}
					</button>
					
					{currentStep < 2 && (
						<button
							type="button"
							className="course-creation-wizard-btn course-creation-wizard-btn-primary"
							onClick={handleNext}
						>
							Continuă →
						</button>
					)}
					
					{currentStep === 2 && (
						<button
							type="button"
							className="course-creation-wizard-btn course-creation-wizard-btn-primary"
							onClick={handlePublish}
							disabled={saving}
						>
							{saving ? 'Publicare...' : '🚀 Publică Test'}
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default TestBuilder;
