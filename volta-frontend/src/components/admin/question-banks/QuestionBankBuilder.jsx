import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import QuestionBankBuilderStep1 from './QuestionBankBuilderSteps/Step1Basics';
import QuestionBankBuilderStep2 from './QuestionBankBuilderSteps/Step2Questions';
import QuestionBankBuilderStep3 from './QuestionBankBuilderSteps/Step3Review';
import '../courses/CourseCreationWizard.css';

/**
 * QuestionBankBuilder - Component pentru crearea și editarea băncilor de întrebări
 * Flow simplificat cu 3 pași:
 * 1. Informații de bază (titlu, descriere, categorie)
 * 2. Întrebări (adaugare și editare întrebări)
 * 3. Revizuire & Publicare
 */

const QuestionBankBuilder = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { showToast } = useToast();
	const isEditMode = !!id && id !== 'new';
	
	const [currentStep, setCurrentStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [bankId, setBankId] = useState(id && id !== 'new' ? id : null);
	const [bankData, setBankData] = useState({
		title: '',
		description: '',
		category: '',
		status: 'draft',
		questions: [],
	});
	const [errors, setErrors] = useState({});

	// Fetch bank if editing
	useEffect(() => {
		if (isEditMode && id) {
			fetchBank();
		}
	}, [id, isEditMode]);

	const fetchBank = async () => {
		try {
			setLoading(true);
			const bank = await adminService.getQuestionBank(id);
			const bankData = bank.data || bank;
			
			setBankData({
				title: bankData.title || '',
				description: bankData.description || '',
				category: bankData.category || '',
				status: bankData.status || 'draft',
				questions: bankData.questions || [],
			});
			setBankId(bankData.id || id);
		} catch (err) {
			console.error('Error fetching question bank:', err);
			showToast('Eroare la încărcarea băncii de întrebări', 'error');
			navigate('/admin/question-banks');
		} finally {
			setLoading(false);
		}
	};

	const updateBankData = (updates) => {
		setBankData(prev => ({ ...prev, ...updates }));
		if (Object.keys(errors).length > 0) {
			setErrors({});
		}
	};

	const validateStep = (step) => {
		const newErrors = {};
		
		if (step === 0) {
			// Step 1: Informații de bază
			if (!bankData.title || bankData.title.trim() === '') {
				newErrors.title = 'Titlul băncii de întrebări este obligatoriu';
			}
		}
		
		if (step === 1) {
			// Step 2: Întrebări
			if (!bankData.questions || bankData.questions.length === 0) {
				newErrors.questions = 'Adaugă cel puțin o întrebare';
			}
		}
		
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleNext = async () => {
		if (currentStep === 0) {
			// Save bank after step 1 if not saved yet
			if (!bankId && bankData.title?.trim()) {
				try {
					setSaving(true);
					const saved = await adminService.createQuestionBank({
						title: bankData.title.trim(),
						description: bankData.description || null,
						category: bankData.category || null,
						status: 'draft',
					});
					if (saved?.id) {
						setBankId(saved.id);
						window.history.replaceState({}, '', `/admin/question-banks/${saved.id}/builder`);
						showToast('Banca de întrebări a fost creată', 'success');
					}
				} catch (err) {
					console.error('Error creating bank:', err);
					showToast('Eroare la crearea băncii de întrebări', 'error');
					return;
				} finally {
					setSaving(false);
				}
			}
		}

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
			navigate('/admin/question-banks');
		}
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			setErrors({});
			
			if (!bankData.title || bankData.title.trim() === '') {
				setErrors({ title: 'Titlul băncii de întrebări este obligatoriu' });
				setCurrentStep(0);
				return;
			}

			if (!bankData.questions || bankData.questions.length === 0) {
				setErrors({ questions: 'Adaugă cel puțin o întrebare' });
				setCurrentStep(1);
				return;
			}

			// Update bank data
			const bankPayload = {
				title: bankData.title.trim(),
				description: bankData.description || null,
				category: bankData.category || null,
				status: bankData.status || 'draft',
			};

			if (bankId) {
				await adminService.updateQuestionBank(bankId, bankPayload);
				showToast('Banca de întrebări a fost actualizată', 'success');
			} else {
				const saved = await adminService.createQuestionBank(bankPayload);
				if (saved?.id) {
					setBankId(saved.id);
					window.history.replaceState({}, '', `/admin/question-banks/${saved.id}/builder`);
					showToast('Banca de întrebări a fost creată', 'success');
				}
			}

			// Navigate back to list
			navigate('/admin/question-banks');
		} catch (err) {
			console.error('Error saving bank:', err);
			showToast('Eroare la salvarea băncii de întrebări', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handlePublish = async () => {
		try {
			setSaving(true);
			setErrors({});
			
			if (!bankData.title || bankData.title.trim() === '') {
				setErrors({ title: 'Titlul băncii de întrebări este obligatoriu' });
				setCurrentStep(0);
				return;
			}

			if (!bankData.questions || bankData.questions.length === 0) {
				setErrors({ questions: 'Adaugă cel puțin o întrebare' });
				setCurrentStep(1);
				return;
			}

			const bankPayload = {
				title: bankData.title.trim(),
				description: bankData.description || null,
				category: bankData.category || null,
				status: 'active',
			};

			if (bankId) {
				await adminService.updateQuestionBank(bankId, bankPayload);
				showToast('Banca de întrebări a fost publicată', 'success');
			} else {
				const saved = await adminService.createQuestionBank(bankPayload);
				if (saved?.id) {
					setBankId(saved.id);
					window.history.replaceState({}, '', `/admin/question-banks/${saved.id}/builder`);
					showToast('Banca de întrebări a fost creată și publicată', 'success');
				}
			}

			navigate('/admin/question-banks');
		} catch (err) {
			console.error('Error publishing bank:', err);
			showToast('Eroare la publicarea băncii de întrebări', 'error');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="admin-courses-loading">
					<div className="va-spinner va-spinner-lg"></div>
					<p>Se încarcă banca de întrebări...</p>
				</div>
			</div>
		);
	}

	const steps = [
		{ label: 'Informații de Bază', number: 1 },
		{ label: 'Întrebări', number: 2 },
		{ label: 'Revizuire', number: 3 },
	];

	return (
		<div className="admin-container">
			<div className="admin-course-builder">
				{/* Header */}
				<div className="admin-course-builder-header">
					<div className="admin-course-builder-header-content">
						<h1 className="admin-course-builder-title">
							{isEditMode ? 'Editează Bancă de Întrebări' : 'Creează Bancă de Întrebări'}
						</h1>
						<p className="admin-course-builder-subtitle">
							{isEditMode 
								? 'Modifică detaliile băncii de întrebări'
								: 'Creează o nouă bancă de întrebări reutilizabilă'}
						</p>
					</div>
				</div>

				{/* Steps Indicator */}
				<div className="admin-course-builder-steps">
					{steps.map((step, index) => (
						<div
							key={index}
							className={`admin-course-builder-step ${
								index === currentStep ? 'active' : ''
							} ${index < currentStep ? 'completed' : ''}`}
						>
							<div className="admin-course-builder-step-number">
								{index < currentStep ? '✓' : step.number}
							</div>
							<div className="admin-course-builder-step-label">{step.label}</div>
						</div>
					))}
				</div>

				{/* Step Content */}
				<div className="admin-course-builder-content">
					{currentStep === 0 && (
						<QuestionBankBuilderStep1
							data={bankData}
							onUpdate={updateBankData}
							errors={errors}
						/>
					)}
					{currentStep === 1 && (
						<QuestionBankBuilderStep2
							bankId={bankId}
							data={bankData}
							onUpdate={updateBankData}
							errors={errors}
						/>
					)}
					{currentStep === 2 && (
						<QuestionBankBuilderStep3
							data={bankData}
							onUpdate={updateBankData}
							errors={errors}
							bankId={bankId}
							onPublish={handlePublish}
							loading={saving}
						/>
					)}
				</div>

				{/* Navigation */}
				<div className="admin-course-builder-footer">
					<button
						type="button"
						className="admin-btn-secondary"
						onClick={handleBack}
						disabled={saving}
					>
						{currentStep === 0 ? 'Anulează' : 'Înapoi'}
					</button>
					<div className="admin-course-builder-footer-actions">
						{currentStep < 2 ? (
							<button
								type="button"
								className="admin-btn-primary"
								onClick={handleNext}
								disabled={saving}
							>
								{saving ? 'Se salvează...' : 'Următorul Pas'}
							</button>
						) : (
							<>
								<button
									type="button"
									className="admin-btn-secondary"
									onClick={handleSave}
									disabled={saving}
								>
									{saving ? 'Se salvează...' : 'Salvează ca Draft'}
								</button>
								<button
									type="button"
									className="admin-btn-primary"
									onClick={handlePublish}
									disabled={saving}
								>
									{saving ? 'Se publică...' : 'Publică'}
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default QuestionBankBuilder;
