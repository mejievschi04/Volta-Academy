import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useToast } from '../../../contexts/ToastContext';
import { logger } from '../../../utils/logger';
import { handleApiError } from '../../../utils/errorHandler';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import UndoRedoControls from '../../common/UndoRedoControls';
import CourseBuilderStep1 from './CourseBuilderSteps/Step1Info';
import Step2CourseIntent from './CourseBuilderSteps/Step2CourseIntent';
import CourseBuilderStep3 from './CourseBuilderSteps/Step3Content';
import CourseBuilderStep4 from './CourseBuilderSteps/Step4Tests';
import CourseBuilderStep5 from './CourseBuilderSteps/Step5Price';
import CourseBuilderStep9 from './CourseBuilderSteps/Step9Preview';
import CourseCreationModal from './CourseCreationModal';
import CourseQualityValidation from './CourseQualityValidation';

const CourseBuilder = () => {
	const params = useParams();
	const navigate = useNavigate();
	const { error: showError, success: showSuccess } = useToast();
	const id = params.id && params.id !== 'new' ? params.id : null;
	const isEditMode = !!id;

	const [currentStep, setCurrentStep] = useState(1);
	const [showModal, setShowModal] = useState(!isEditMode);
	const [blueprint, setBlueprint] = useState(null);
	const [creatorType, setCreatorType] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [validationErrors, setValidationErrors] = useState({});

	// Initial course data
	const initialCourseData = {
		title: '',
		target_audience: '',
		level: null,
		learning_goal: '',
		short_description: '',
		description: '',
		language: 'ro',
		image: null,
		image_url: null,
		estimated_duration_hours: null,
		status: 'draft',
		blueprint_type: null,
		creator_type: null,
		modules: [],
		has_certificate: false,
		min_exam_score: 70,
		allow_retake: true,
		max_retakes: 3,
		min_completion_percentage: 0,
		completion_rules: {
			require_all_lessons: false,
			require_all_exams: false,
			require_minimum_score: false,
		},
		access_type: 'free',
		price: null,
		currency: 'RON',
		access_duration_days: null,
		drip_content: false,
		drip_schedule: null,
		teacher_id: null,
		role_based_visibility: [],
		prerequisites: [],
		badges: [],
		analytics_enabled: true,
		versioning_enabled: false,
		multi_instructor_support: false,
		instructors: [],
		permissions: {
			can_comment: true,
			can_download: false,
			can_share: true,
		},
		sequential_unlock: true,
		comments_enabled: true,
		visibility: 'public',
	};

	const {
		state: courseData,
		setState: setCourseData,
		undo,
		redo,
		canUndo,
		canRedo
	} = useUndoRedo(initialCourseData, 50);

	// Use a ref to always have access to latest courseData
	const courseDataRef = React.useRef(courseData);
	React.useEffect(() => {
		courseDataRef.current = courseData;
	}, [courseData]);

	// Load course data in edit mode
	useEffect(() => {
		if (isEditMode && id) {
			fetchCourseData();
		}
	}, [isEditMode, id]);

	// Keyboard shortcuts for undo/redo
	useEffect(() => {
		const handleKeyDown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
				e.preventDefault();
				if (canUndo) undo();
			} else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
				e.preventDefault();
				if (canRedo) redo();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [canUndo, canRedo, undo, redo]);

	// ============================================
	// HELPER FUNCTIONS - Centralized Logic
	// ============================================

	/**
	 * Prepare FormData from course data (excludes modules and image_url)
	 */
	const prepareCourseFormData = (data, status = null) => {
		const formData = new FormData();
		
		// Add all fields except image_url and modules
		Object.keys(data).forEach(key => {
			if (key === 'image' && data[key] instanceof File) {
				formData.append('image', data[key]);
			} else if (key === 'image_url' || key === 'modules') {
				// Skip - these are handled separately
				return;
			} else if (Array.isArray(data[key])) {
				if (data[key].length > 0) {
					data[key].forEach((item, index) => {
						formData.append(`${key}[${index}]`, item);
					});
				}
			} else if (typeof data[key] === 'object' && data[key] !== null) {
				Object.keys(data[key]).forEach(subKey => {
					const value = data[key][subKey];
					if (typeof value === 'boolean') {
						formData.append(`${key}[${subKey}]`, value ? '1' : '0');
					} else {
						formData.append(`${key}[${subKey}]`, value);
					}
				});
			} else if (typeof data[key] === 'boolean') {
				formData.append(key, data[key] ? '1' : '0');
			} else if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
				formData.append(key, data[key]);
			}
		});

		// Ensure currency is valid
		if (data.currency && data.currency.length !== 3) {
			formData.set('currency', 'RON');
		} else if (!data.currency) {
			formData.append('currency', 'RON');
		}

		// Set status if provided
		if (status) {
			formData.append('status', status);
		}

		return formData;
	};

	/**
	 * Save modules and lessons for a course
	 */
	const saveModulesAndLessons = async (courseId, modules) => {
		if (!courseId) {
			logger.error('saveModulesAndLessons: No course ID provided');
			return { success: false, savedModules: 0, savedLessons: 0 };
		}

		if (!modules || !Array.isArray(modules) || modules.length === 0) {
			logger.debug('saveModulesAndLessons: No modules to save');
			return { success: true, savedModules: 0, savedLessons: 0 };
		}

		try {
			logger.debug(`[saveModulesAndLessons] Starting save for course ${courseId}, ${modules.length} modules`);
			
			let savedModulesCount = 0;
			let savedLessonsCount = 0;

			for (const moduleData of modules) {
				// Skip if module already has a real ID (already saved)
				if (moduleData.id && !moduleData.id.toString().startsWith('temp-')) {
					logger.debug(`[saveModulesAndLessons] Module ${moduleData.id} already saved, skipping`);
					continue;
				}

				// Create module
				const modulePayload = {
					course_id: courseId,
					title: moduleData.title || `Modul ${(moduleData.order || 0) + 1}`,
					description: moduleData.description || '',
					order: moduleData.order || 0,
					status: 'published',
				};

				try {
					const createdModule = await adminService.createModule(modulePayload);
					const moduleId = createdModule.module?.id || createdModule.id || createdModule.data?.id;

					if (!moduleId) {
						logger.error(`[saveModulesAndLessons] Failed to create module, no ID returned:`, createdModule);
						continue;
					}

					savedModulesCount++;
					logger.debug(`[saveModulesAndLessons] ✅ Module created: ${moduleId} - ${moduleData.title}`);

					// Create lessons for this module
					if (moduleData.lessons && Array.isArray(moduleData.lessons) && moduleData.lessons.length > 0) {
						for (const lessonData of moduleData.lessons) {
							// Skip if lesson already has a real ID
							if (lessonData.id && !lessonData.id.toString().startsWith('temp-')) {
								continue;
							}

							const lessonPayload = {
								course_id: courseId,
								module_id: moduleId,
								title: lessonData.title || `Lecție ${(lessonData.order || 0) + 1}`,
								content: lessonData.description || lessonData.title || '',
								description: lessonData.description || '',
								content_type: lessonData.content_type || 'text',
								order: lessonData.order || 0,
								is_preview: lessonData.is_preview || false,
								duration_minutes: lessonData.duration_minutes || null,
							};

							try {
								await adminService.createLesson(lessonPayload);
								savedLessonsCount++;
								logger.debug(`[saveModulesAndLessons] ✅ Lesson created: ${lessonData.title}`);
							} catch (lessonErr) {
								handleApiError(lessonErr, 'createLesson');
							}
						}
					}
				} catch (moduleErr) {
					handleApiError(moduleErr, 'createModule');
				}
			}

			console.log(`[saveModulesAndLessons] ✅ Complete: ${savedModulesCount} modules, ${savedLessonsCount} lessons`);

			// Reload course data if we're on the course page
			if (window.location.pathname.includes(`/admin/courses/${courseId}`)) {
				await reloadCourseData(courseId);
			}

			return { success: true, savedModules: savedModulesCount, savedLessons: savedLessonsCount };
		} catch (err) {
			console.error('[saveModulesAndLessons] ❌ CRITICAL ERROR:', err);
			return { success: false, savedModules: 0, savedLessons: 0, error: err };
		}
	};

	/**
	 * Reload course data from server
	 */
	const reloadCourseData = async (courseId) => {
		try {
			const [course, modules] = await Promise.all([
				adminService.getCourse(courseId),
				adminService.getModules(courseId),
			]);

			setCourseData({
				...course,
				modules: (modules || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
			});
		} catch (err) {
			console.error('[reloadCourseData] Error:', err);
		}
	};

	/**
	 * Save course (create or update) - Centralized save function
	 */
	const saveCourse = async (data, options = {}) => {
		const {
			status = 'draft',
			saveModules = true,
			updateUrl = true,
			reloadAfterSave = false
		} = options;

		try {
			const formData = prepareCourseFormData(data, status);
			let courseId = id;
			let savedCourse = null;

			if (isEditMode && id) {
				// Update existing course
				await adminService.updateCourse(id, formData);
				savedCourse = { course: { id: parseInt(id) } };
			} else {
				// Create new course
				savedCourse = await adminService.createCourse(formData);
				courseId = savedCourse.course?.id;

				if (!courseId) {
					throw new Error('Course creation failed - no ID returned');
				}

				// Update URL if this is a new course
				if (updateUrl) {
					window.history.replaceState({}, '', `/admin/courses/${courseId}/builder`);
				}
			}

			// Save modules and lessons if requested and they exist
			if (saveModules && courseId && data.modules && Array.isArray(data.modules) && data.modules.length > 0) {
				console.log(`[saveCourse] Saving ${data.modules.length} modules for course ${courseId}`);
				await saveModulesAndLessons(courseId, data.modules);
			}

			// Reload course data if requested
			if (reloadAfterSave && courseId) {
				await reloadCourseData(courseId);
			}

			return { success: true, courseId, course: savedCourse.course };
		} catch (err) {
			console.error('[saveCourse] Error:', err);
			throw err;
		}
	};

	// ============================================
	// EVENT HANDLERS
	// ============================================

	/**
	 * Handle blueprint selection from wizard
	 */
	const handleBlueprintSelect = (selection) => {
		const selectedBlueprint = selection.blueprint;
		const selectedCreatorType = selection.creatorType;

		setBlueprint(selectedBlueprint);
		setCreatorType(selectedCreatorType);

		// Generate initial structure based on blueprint
		const initialModules = [];
		for (let i = 0; i < selectedBlueprint.structure.modules; i++) {
			const moduleLessons = [];
			for (let j = 0; j < selectedBlueprint.structure.lessonsPerModule; j++) {
				moduleLessons.push({
					title: `Lecție ${j + 1}`,
					description: '',
					content_type: 'text',
					duration_minutes: 10,
					order: j,
					is_preview: false,
					ai_suggested: true
				});
			}
			initialModules.push({
				title: `Modul ${i + 1}`,
				description: '',
				order: i,
				lessons: moduleLessons,
				ai_suggested: true
			});
		}

		setCourseData(prev => ({
			...prev,
			blueprint_type: selectedBlueprint.id,
			creator_type: selectedCreatorType,
			modules: initialModules
		}));

		// Move to step 2 (Course Intent) after blueprint selection
		setCurrentStep(2);
	};

	/**
	 * Auto-save function
	 */
	const autoSaveFn = async (data) => {
		// Don't auto-save if we don't have minimum required data
		const title = data.title;
		if (!title || typeof title !== 'string' || title.trim().length < 3) {
			return; // Skip auto-save if title is not valid
		}

		// Get current course ID from URL
		const currentCourseId = window.location.pathname.match(/\/admin\/courses\/(\d+)/)?.[1] || id;

		try {
			if (currentCourseId) {
				// Update existing course (don't save modules in auto-save)
				await saveCourse(data, {
					status: data.status || 'draft',
					saveModules: false,
					updateUrl: false,
					reloadAfterSave: false
				});
			} else {
				// Create new course and save modules if they exist
				const result = await saveCourse(data, {
					status: 'draft',
					saveModules: true,
					updateUrl: true,
					reloadAfterSave: false
				});
			}
		} catch (err) {
			console.error('[autoSaveFn] Error:', err);
			// Don't throw - auto-save failures shouldn't block the UI
		}
	};

	/**
	 * Fetch course data (for edit mode)
	 */
	const fetchCourseData = async () => {
		try {
			setLoading(true);
			const [course, modules] = await Promise.all([
				adminService.getCourse(id),
				adminService.getModules(id),
			]);

			setCourseData({
				...course,
				modules: (modules || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
			});
		} catch (err) {
			console.error('Error fetching course:', err);
			setError('Nu s-a putut încărca cursul');
		} finally {
			setLoading(false);
		}
	};

	/**
	 * Update course data
	 */
	const updateCourseData = (updates) => {
		setCourseData(prev => ({ ...prev, ...updates }));
		setValidationErrors({});
	};

	/**
	 * Validate current step
	 */
	const validateStep = (step) => {
		const errors = {};

		switch (step) {
			case 1:
				break;
			case 2:
				if (!courseData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				if (!courseData.level) {
					errors.level = 'Nivelul este obligatoriu';
				}
				break;
			case 3:
				break;
			case 4:
				break;
			case 5:
				if (!courseData.teacher_id) {
					errors.teacher_id = 'Instructorul este obligatoriu';
				}
				if (courseData.access_type === 'paid' && !courseData.price) {
					errors.price = 'Prețul este obligatoriu pentru cursurile plătite';
				}
				break;
			case 6:
				if (!courseData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				if (!courseData.modules || courseData.modules.length === 0) {
					errors.modules = 'Adaugă cel puțin un modul';
				}
				break;
		}

		setValidationErrors(errors);
		return {
			isValid: Object.keys(errors).length === 0,
			errors: errors
		};
	};

	/**
	 * Handle save draft
	 */
	const handleSaveDraft = async () => {
		try {
			setLoading(true);
			const result = await saveCourse(courseData, {
				status: 'draft',
				saveModules: true,
				updateUrl: !isEditMode,
				reloadAfterSave: false
			});

			if (result.success && result.courseId) {
				if (!isEditMode) {
					navigate(`/admin/courses/${result.courseId}/builder`);
				}
			}
		} catch (err) {
			logger.error('Error saving draft:', err);
			const errorMessage = err.response?.data?.message || err.message;
			showError('Eroare la salvarea draftului: ' + errorMessage);
		} finally {
			setLoading(false);
		}
	};

	/**
	 * Handle publish
	 */
	const handlePublish = async () => {
		const validationResult = validateStep(6);
		if (!validationResult.isValid) {
			setValidationErrors(validationResult.errors);
			return;
		}

		try {
			setLoading(true);
			const result = await saveCourse(courseData, {
				status: 'published',
				saveModules: true,
				updateUrl: !isEditMode,
				reloadAfterSave: false
			});

			if (result.success && result.courseId) {
				navigate(`/admin/courses/${result.courseId}`);
			}
		} catch (err) {
			logger.error('Error publishing course:', err);
			const errorMessage = err.response?.data?.message || err.message;
			showError('Eroare la publicare: ' + errorMessage);
		} finally {
			setLoading(false);
		}
	};

	// ============================================
	// AUTO-SAVE SETUP
	// ============================================

	const hasValidTitle = courseData.title && typeof courseData.title === 'string' && courseData.title.trim().length >= 3;
	const autoSaveEnabled = currentStep > 1 && hasValidTitle;
	const { saveStatus, manualSave } = useAutoSave(courseData, autoSaveFn, 2000, autoSaveEnabled);

	// ============================================
	// STEP NAVIGATION
	// ============================================

	useEffect(() => {
		const handleNavigateToStep = (e) => {
			const step = e.detail?.step;
			if (step && step >= 1 && step <= 6) {
				setCurrentStep(step);
			}
		};

		window.addEventListener('navigateToStep', handleNavigateToStep);
		return () => window.removeEventListener('navigateToStep', handleNavigateToStep);
	}, []);

	const handleNext = () => {
		const validationResult = validateStep(currentStep);
		if (validationResult.isValid && currentStep < 6) {
			setCurrentStep(currentStep + 1);
		} else {
			const firstError = Object.keys(validationResult.errors)[0];
			if (firstError) {
				const errorElement = document.querySelector(`[data-field="${firstError}"]`);
				if (errorElement) {
					errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
					errorElement.focus();
				}
			}
		}
	};

	const handlePrevious = () => {
		if (currentStep > 2) {
			setCurrentStep(currentStep - 1);
		}
	};

	// ============================================
	// RENDER
	// ============================================

	if (loading && isEditMode) {
		return (
			<div className="admin-container">
				<div className="admin-loading-state">
					<div className="admin-loading-spinner"></div>
					<p>Se încarcă cursul...</p>
				</div>
			</div>
		);
	}

	const steps = [
		{ number: 1, title: 'Entry Point', icon: '🚀', visible: false },
		{ number: 2, title: 'Course Intent', icon: '📝' },
		{ number: 3, title: 'Lesson Content', icon: '📚' },
		{ number: 4, title: 'AI Validation', icon: '✨' },
		{ number: 5, title: 'Publish Settings', icon: '⚙️' },
		{ number: 6, title: 'Post-Publish', icon: '🎉' },
	];

	const visibleSteps = steps.filter(s => s.visible !== false);

	// Unified Modal for Entry Flow, Wizard, and Course Builder
	if (showModal && !isEditMode) {
		return (
			<CourseCreationModal
				onClose={() => navigate('/admin/courses')}
				onSelectBlueprint={(selection) => {
					handleBlueprintSelect(selection);
				}}
				blueprint={blueprint}
				courseData={courseData}
				onUpdate={updateCourseData}
				currentStep={currentStep}
				onStepChange={setCurrentStep}
				onValidationErrors={setValidationErrors}
				validationErrors={validationErrors}
				onSaveDraft={handleSaveDraft}
				loading={loading}
				courseId={id}
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
			<div className="admin-container">
				{/* Header */}
				<div className="admin-page-header">
					<div>
						<h1 className="admin-page-title">
							{isEditMode ? 'Editează Curs' : 'Creează Curs Nou'}
						</h1>
						<p className="admin-page-subtitle">
							{isEditMode ? 'Modifică detaliile cursului' : 'Completează pașii pentru a crea cursul'}
						</p>
					</div>
					<div className="admin-page-header-actions">
						<UndoRedoControls
							undo={undo}
							redo={redo}
							canUndo={canUndo}
							canRedo={canRedo}
						/>
					</div>
				</div>

				{/* Steps Progress */}
				<div className="admin-steps-progress">
					{visibleSteps.map((step, index) => (
						<div
							key={step.number}
							className={`admin-step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
						>
							<div className="admin-step-icon">{step.icon}</div>
							<div className="admin-step-info">
								<div className="admin-step-number">Pasul {step.number}</div>
								<div className="admin-step-title">{step.title}</div>
							</div>
						</div>
					))}
				</div>

				{/* Step Content */}
				<div className="admin-step-content">
					{currentStep === 2 && (
						<Step2CourseIntent
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
							blueprint={blueprint}
							creatorType={creatorType}
						/>
					)}
					{currentStep === 3 && (
						<CourseBuilderStep3
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
							courseId={id}
						/>
					)}
					{currentStep === 4 && (
						<CourseQualityValidation
							courseData={courseData}
							onUpdate={updateCourseData}
						/>
					)}
					{currentStep === 5 && (
						<CourseBuilderStep5
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
						/>
					)}
					{currentStep === 6 && (
						<CourseBuilderStep9
							data={courseData}
							onUpdate={updateCourseData}
							onPublish={handlePublish}
							loading={loading}
						/>
					)}
				</div>

				{/* Navigation */}
				<div className="admin-step-navigation">
					<button
						className="admin-btn admin-btn-secondary"
						onClick={handlePrevious}
						disabled={currentStep <= 2}
					>
						← Înapoi
					</button>
					<div className="admin-step-navigation-center">
						{saveStatus && (
							<span className="admin-save-status">{saveStatus}</span>
						)}
					</div>
					<div className="admin-step-navigation-right">
						<button
							className="admin-btn admin-btn-secondary"
							onClick={handleSaveDraft}
							disabled={loading}
						>
							💾 Salvează Draft
						</button>
						{currentStep < 6 ? (
							<button
								className="admin-btn admin-btn-primary"
								onClick={handleNext}
							>
								Următorul →
							</button>
						) : (
							<button
								className="admin-btn admin-btn-primary"
								onClick={handlePublish}
								disabled={loading}
							>
								🚀 Publică Curs
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseBuilder;
