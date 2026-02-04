import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import Step0Context from './CourseCreationSteps/Step0Context';
import Step1Blueprint from './CourseCreationSteps/Step1Blueprint';
import Step3Content from './CourseCreationSteps/Step3Content';
import Step6Review from './CourseCreationSteps/Step6Review';
import './CourseCreationWizard.css';

/**
 * Course Creation Wizard - Conform TODO.md
 * Flow complet pas cu pas pentru crearea cursurilor
 * AI este strict opțional și non-intruziv
 */
const CourseCreationWizard = ({ onClose, onSuccess }) => {
	const navigate = useNavigate();
	const { success: showSuccess, error: showError } = useToast();
	
	const [currentStep, setCurrentStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const [courseData, setCourseData] = useState({
		// PAS 0: Informații de bază
		title: '',
		description: '',
		
		// PAS 1: Structura pedagogică
		structure: {
			modules: []
		},
		
		// PAS 2: Conținut
		content_blocks: {},
		
		// PAS 3: Publicare
		status: 'draft',
	});
	
	// Navigation
	const handleNext = () => {
		if (currentStep < 3) {
			setCurrentStep(currentStep + 1);
		}
	};
	
	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		} else {
			onClose();
		}
	};
	
	// Update course data
	const updateCourseData = (updates) => {
		setCourseData(prev => ({
			...prev,
			...updates
		}));
	};
	
	// Publish course
	const handlePublish = async () => {
		setLoading(true);
		try {
		// Prepare course data for API
		const formData = new FormData();
		
		// Basic info
		formData.append('title', courseData.title || 'Curs nou');
		formData.append('description', courseData.description || '');
		formData.append('status', courseData.status || 'published');
		formData.append('visibility', courseData.visibility || 'public');
		
		// Image (required)
		if (courseData.image) {
			formData.append('image', courseData.image);
		}
			
			
			// Create course
			const result = await adminService.createCourse(formData);
			const courseId = result.course?.id;
			
			if (!courseId) {
				throw new Error('Course creation failed - no ID returned');
			}
			
			// Create modules and lessons from structure
			if (courseData.structure?.modules?.length > 0) {
				for (const moduleData of courseData.structure.modules) {
					const module = await adminService.createModule({
						course_id: courseId,
						title: moduleData.title,
						description: moduleData.objective || '',
						order: moduleData.order || 0,
					});
					
					// Create lessons for this module
					if (moduleData.lessons && moduleData.lessons.length > 0 && module?.id) {
						for (const lessonData of moduleData.lessons) {
							await adminService.createLesson({
								module_id: module.id,
								title: lessonData.title,
								content: lessonData.objective || '',
								type: lessonData.type || 'text',
								order: lessonData.order || 0,
							});
						}
					}
				}
			}
			
			showSuccess('Cursul a fost creat și publicat cu succes!');
			
			if (onSuccess) {
				onSuccess(courseId);
			} else {
				navigate(`/admin/courses/${courseId}/builder`);
			}
			
			if (onClose) {
				onClose();
			}
		} catch (err) {
			console.error('Error publishing course:', err);
			showError('Eroare la publicarea cursului: ' + (err.response?.data?.message || err.message));
		} finally {
			setLoading(false);
		}
	};
	
	const steps = [
		{ number: 0, title: 'Informații de bază', icon: '📝' },
		{ number: 1, title: 'Structură', icon: '📐' },
		{ number: 2, title: 'Conținut', icon: '📚' },
		{ number: 3, title: 'Publicare', icon: '🚀' },
	];
	
	const progress = ((currentStep + 1) / steps.length) * 100;
	
	return (
		<div className="course-creation-wizard-page">
			<div className="course-creation-wizard">
				{/* Header */}
				<div className="course-creation-wizard-header">
					<div>
						<h2>Creează Curs Nou</h2>
						<p className="course-creation-wizard-subtitle">
							{steps[currentStep].icon} {steps[currentStep].title}
						</p>
					</div>
					{onClose && (
						<button type="button" className="course-creation-wizard-close" onClick={onClose}>×</button>
					)}
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
								// Allow going back to completed steps
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
							<Step0Context
								data={courseData}
								onUpdate={updateCourseData}
							/>
						)}
						
						{currentStep === 1 && (
							<Step1Blueprint
								data={courseData}
								onUpdate={updateCourseData}
							/>
						)}
						
						{currentStep === 2 && (
							<Step3Content
								data={courseData}
								onUpdate={updateCourseData}
							/>
						)}
						
						{currentStep === 3 && (
							<Step6Review
								data={courseData}
								onUpdate={updateCourseData}
								onPublish={handlePublish}
								loading={loading}
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
							<div className="course-preview-card">
								{courseData.image && (
									<div className="course-preview-thumbnail">
										<img src={typeof courseData.image === 'string' ? courseData.image : URL.createObjectURL(courseData.image)} alt={courseData.title} loading="lazy" decoding="async" />
									</div>
								)}
								<div className="course-preview-body">
									<h4 className="course-preview-title">{courseData.title || 'Titlu curs'}</h4>
									<p className="course-preview-description">{courseData.description || 'Descriere curs...'}</p>
									{courseData.structure?.modules?.length > 0 && (
										<div className="course-preview-structure">
											<div className="course-preview-structure-label">Structură:</div>
											{courseData.structure.modules.map((module, idx) => (
												<div key={idx} className="course-preview-module">
													<span className="course-preview-module-icon">📚</span>
													<span className="course-preview-module-title">{module.title || `Modul ${idx + 1}`}</span>
													{module.lessons?.length > 0 && (
														<span className="course-preview-module-lessons">({module.lessons.length} lecții)</span>
													)}
												</div>
											))}
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
						{currentStep === 0 ? (onClose ? 'Anulează' : '← Înapoi') : '← Înapoi'}
					</button>
					
					{currentStep < 3 && (
						<button
							type="button"
							className="course-creation-wizard-btn course-creation-wizard-btn-primary"
							onClick={handleNext}
						>
							Continuă →
						</button>
					)}
					
					{currentStep === 3 && (
						<button
							type="button"
							className="course-creation-wizard-btn course-creation-wizard-btn-primary"
							onClick={handlePublish}
							disabled={loading}
						>
							{loading ? 'Publicare...' : '🚀 Publică Curs'}
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default CourseCreationWizard;
