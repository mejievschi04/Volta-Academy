import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useAutoSave } from '../../../hooks/useAutoSave';
import CourseBuilderStep1 from './CourseBuilderSteps/Step1Info';
import CourseBuilderStep2 from './CourseBuilderSteps/Step2Structure';
import CourseBuilderStep3 from './CourseBuilderSteps/Step3Content';
import CourseBuilderStep4 from './CourseBuilderSteps/Step4Tests';
import CourseBuilderStep5 from './CourseBuilderSteps/Step5Price';
import CourseBuilderStep9 from './CourseBuilderSteps/Step9Preview';

const CourseBuilder = () => {
	const params = useParams();
	const navigate = useNavigate();
	// Handle both /admin/courses/new and /admin/courses/:id/builder or /admin/courses/:id/edit
	// When route is /admin/courses/new, params.id will be "new"
	const id = params.id && params.id !== 'new' ? params.id : null;
	const isEditMode = !!id;

	const [currentStep, setCurrentStep] = useState(1);
	const [courseData, setCourseData] = useState({
		// Step 1: Course Basics
		title: '',
		short_description: '',
		description: '',
		level: null,
		language: 'ro',
		image: null,
		image_url: null,
		estimated_duration_hours: null,
		status: 'draft',

		// Step 2: Structure (modules, lessons, exams)
		modules: [],

		// Step 3: Lesson Content (handled in Step3)

		// Step 4: Evaluation & Progress
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

		// Step 5: Access & Monetization
		access_type: 'free',
		price: null,
		currency: 'RON',
		access_duration_days: null, // null = unlimited
		drip_content: false,
		drip_schedule: null,
		teacher_id: null,
		role_based_visibility: [],

		// Advanced Features (collapsed by default)
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
	});

	const [loading, setLoading] = useState(isEditMode);
	const [error, setError] = useState(null);
	const [validationErrors, setValidationErrors] = useState({});

	// Load course data if editing
	useEffect(() => {
		if (isEditMode) {
			fetchCourseData();
		}
	}, [id]);

	// Auto-save
	const autoSaveFn = async (data) => {
		// Don't auto-save if we don't have minimum required data
		const title = data.title;
		if (!title || typeof title !== 'string' || !title.trim() || title.trim().length < 3) {
			console.log('Auto-save skipped: title is required and must be at least 3 characters', { 
				title, 
				type: typeof title,
				hasTitle: !!title,
				titleLength: title ? title.length : 0,
				trimmedLength: title ? title.trim().length : 0
			});
			return; // Skip auto-save if title is not valid
		}

		// Get current course ID from URL (in case it was updated after course creation)
		const currentCourseId = window.location.pathname.match(/\/admin\/courses\/(\d+)/)?.[1] || id;

		// Prepare form data for image upload
		const formData = new FormData();
		
		// Ensure title is added first
		formData.append('title', title.trim());
		
		// Add all fields except image
		Object.keys(data).forEach(key => {
			if (key === 'title') {
				// Already added above
				return;
			} else if (key === 'image' && data[key] instanceof File) {
				formData.append('image', data[key]);
			} else if (key === 'image_url') {
				// Skip image_url, it's just for preview
			} else if (key === 'modules') {
				// Skip modules, they're managed separately
			} else if (Array.isArray(data[key])) {
				// Handle arrays (meta_keywords, marketing_tags, etc.)
				if (data[key].length > 0) {
					data[key].forEach((item, index) => {
						formData.append(`${key}[${index}]`, item);
					});
				}
			} else if (typeof data[key] === 'object' && data[key] !== null) {
				// Handle objects (permissions)
				Object.keys(data[key]).forEach(subKey => {
					const value = data[key][subKey];
					// Convert boolean values in objects
					if (typeof value === 'boolean') {
						formData.append(`${key}[${subKey}]`, value ? '1' : '0');
					} else {
						formData.append(`${key}[${subKey}]`, value);
					}
				});
			} else if (typeof data[key] === 'boolean') {
				// Convert boolean to '1' or '0' for Laravel
				formData.append(key, data[key] ? '1' : '0');
			} else if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
				formData.append(key, data[key]);
			}
		});
		
		// Debug: Log what we're sending
		console.log('Auto-save: Sending data with title:', title.trim());

		if (currentCourseId) {
			// Update existing course
			await adminService.updateCourse(currentCourseId, formData);
		} else {
			// For new courses, save as draft
			try {
				formData.append('status', 'draft');
				// Ensure currency is 3 characters if provided
				if (data.currency && data.currency.length !== 3) {
					formData.set('currency', 'RON'); // Default to RON if invalid
				} else if (!data.currency) {
					formData.append('currency', 'RON'); // Default to RON if missing
				}
				const saved = await adminService.createCourse(formData);
				if (saved.course?.id) {
					// Update URL without navigation or reload
					window.history.replaceState({}, '', `/admin/courses/${saved.course.id}/builder`);
					// Don't reload - just continue with current step
				}
			} catch (err) {
				console.error('Auto-save error:', err);
				console.error('Auto-save error details:', err.response?.data);
				// Don't throw error, just log it - auto-save failures shouldn't block the UI
			}
		}
	};

	// Only enable auto-save after step 1 and if we have a valid title
	const hasValidTitle = courseData.title && typeof courseData.title === 'string' && courseData.title.trim().length >= 3;
	const autoSaveEnabled = currentStep > 1 && hasValidTitle;
	
	// Debug logging
	if (currentStep > 1 && !hasValidTitle) {
		console.log('Auto-save disabled:', { 
			currentStep, 
			hasTitle: !!courseData.title,
			titleType: typeof courseData.title,
			titleValue: courseData.title,
			titleLength: courseData.title ? courseData.title.length : 0
		});
	}
	
	const { saveStatus, manualSave } = useAutoSave(courseData, autoSaveFn, 2000, autoSaveEnabled);

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

	const updateCourseData = (updates) => {
		setCourseData(prev => ({ ...prev, ...updates }));
		setValidationErrors({});
	};

	const validateStep = (step) => {
		const errors = {};

		switch (step) {
			case 1:
				if (!courseData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				if (!courseData.short_description?.trim()) {
					errors.short_description = 'Descrierea scurtă este obligatorie';
				}
				break;
			case 2:
				// Modules are required
				if (!courseData.modules || courseData.modules.length === 0) {
					errors.modules = 'Adaugă cel puțin un modul';
				}
				break;
			case 3:
				// Validate content for each module/lesson
				break;
			case 4:
				// Evaluation validation
				if (courseData.has_certificate && (courseData.min_exam_score < 0 || courseData.min_exam_score > 100)) {
					errors.min_exam_score = 'Scorul minim trebuie să fie între 0 și 100';
				}
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
				// Final validation - all required fields
				if (!courseData.title?.trim()) {
					errors.title = 'Titlul este obligatoriu';
				}
				if (!courseData.modules || courseData.modules.length === 0) {
					errors.modules = 'Adaugă cel puțin un modul';
				}
				if (!courseData.teacher_id) {
					errors.teacher_id = 'Instructorul este obligatoriu';
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
		const isValid = validationResult.isValid;
		const errors = validationResult.errors;
		
		if (isValid) {
			if (currentStep < 6) {
				setCurrentStep(currentStep + 1);
			}
		} else {
			// Scroll to first error
			const firstError = Object.keys(errors)[0];
			if (firstError) {
				const errorElement = document.querySelector(`[data-field="${firstError}"]`) || 
					document.querySelector(`.admin-form-input.error`) ||
					document.querySelector(`.admin-form-select.error`);
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
		const validationResult = validateStep(6);
		if (!validationResult.isValid) {
			setValidationErrors(validationResult.errors);
			return;
		}

		try {
			setLoading(true);
			
			// Prepare form data for image upload
			const formData = new FormData();
			
			// Add all fields except image_url and modules
			Object.keys(courseData).forEach(key => {
				if (key === 'image' && courseData[key] instanceof File) {
					formData.append('image', courseData[key]);
				} else if (key === 'image_url') {
					// Skip image_url, it's just for preview
				} else if (key === 'modules') {
					// Skip modules, they're managed separately
				} else if (Array.isArray(courseData[key])) {
					// Handle arrays (meta_keywords, marketing_tags, etc.)
					courseData[key].forEach((item, index) => {
						formData.append(`${key}[${index}]`, item);
					});
				} else if (typeof courseData[key] === 'object' && courseData[key] !== null) {
					// Handle objects (permissions)
					Object.keys(courseData[key]).forEach(subKey => {
						const value = courseData[key][subKey];
						// Convert boolean values in objects
						if (typeof value === 'boolean') {
							formData.append(`${key}[${subKey}]`, value ? '1' : '0');
						} else {
							formData.append(`${key}[${subKey}]`, value);
						}
					});
				} else if (typeof courseData[key] === 'boolean') {
					// Convert boolean to '1' or '0' for Laravel
					formData.append(key, courseData[key] ? '1' : '0');
				} else if (courseData[key] !== null && courseData[key] !== undefined && courseData[key] !== '') {
					formData.append(key, courseData[key]);
				}
			});
			
			formData.append('status', 'published');
			// Ensure currency is 3 characters if provided
			if (courseData.currency && courseData.currency.length !== 3) {
				formData.set('currency', 'RON');
			} else if (!courseData.currency) {
				formData.append('currency', 'RON');
			}
			
			let courseId = id;
			if (isEditMode) {
				await adminService.updateCourse(id, formData);
			} else {
				const saved = await adminService.createCourse(formData);
				courseId = saved.course?.id;
			}
				if (courseId) {
					navigate(`/admin/courses/${courseId}`);
				}
			} catch (err) {
				console.error('Error publishing course:', err);
				console.error('Error details:', err.response?.data);
				const errorMessage = err.response?.data?.message || err.message;
				const errorDetails = err.response?.data?.errors ? 
					Object.entries(err.response.data.errors).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n') 
					: '';
				alert('Eroare la publicare: ' + errorMessage + (errorDetails ? '\n\nDetalii:\n' + errorDetails : ''));
			} finally {
				setLoading(false);
			}
		};

	const handleSaveDraft = async () => {
		try {
			setLoading(true);
			
			// Prepare form data for image upload
			const formData = new FormData();
			
			// Add all fields except image_url and modules
			Object.keys(courseData).forEach(key => {
				if (key === 'image' && courseData[key] instanceof File) {
					formData.append('image', courseData[key]);
				} else if (key === 'image_url') {
					// Skip image_url, it's just for preview
				} else if (key === 'modules') {
					// Skip modules, they're managed separately
				} else if (Array.isArray(courseData[key])) {
					// Handle arrays (meta_keywords, marketing_tags, etc.)
					courseData[key].forEach((item, index) => {
						formData.append(`${key}[${index}]`, item);
					});
				} else if (typeof courseData[key] === 'object' && courseData[key] !== null) {
					// Handle objects (permissions)
					Object.keys(courseData[key]).forEach(subKey => {
						const value = courseData[key][subKey];
						// Convert boolean values in objects
						if (typeof value === 'boolean') {
							formData.append(`${key}[${subKey}]`, value ? '1' : '0');
						} else {
							formData.append(`${key}[${subKey}]`, value);
						}
					});
				} else if (typeof courseData[key] === 'boolean') {
					// Convert boolean to '1' or '0' for Laravel
					formData.append(key, courseData[key] ? '1' : '0');
				} else if (courseData[key] !== null && courseData[key] !== undefined && courseData[key] !== '') {
					formData.append(key, courseData[key]);
				}
			});
			
			formData.append('status', 'draft');
			// Ensure currency is 3 characters if provided
			if (courseData.currency && courseData.currency.length !== 3) {
				formData.set('currency', 'RON');
			} else if (!courseData.currency) {
				formData.append('currency', 'RON');
			}
			
			if (isEditMode) {
				await adminService.updateCourse(id, formData);
			} else {
				const saved = await adminService.createCourse(formData);
				if (saved.course?.id) {
					navigate(`/admin/courses/${saved.course.id}/builder`);
				}
			}
		} catch (err) {
			console.error('Error saving draft:', err);
			console.error('Error details:', err.response?.data);
			const errorMessage = err.response?.data?.message || err.message;
			const errorDetails = err.response?.data?.errors ? 
				Object.entries(err.response.data.errors).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n') 
				: '';
			alert('Eroare la salvarea draftului: ' + errorMessage + (errorDetails ? '\n\nDetalii:\n' + errorDetails : ''));
		} finally {
			setLoading(false);
		}
	};

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
		{ number: 1, title: 'Bazele Cursului', icon: '📝' },
		{ number: 2, title: 'Structură', icon: '🏗️' },
		{ number: 3, title: 'Conținut Lecții', icon: '📚' },
		{ number: 4, title: 'Evaluare & Progres', icon: '📋' },
		{ number: 5, title: 'Acces & Monetizare', icon: '💰' },
		{ number: 6, title: 'Revizuire & Publicare', icon: '✅' },
	];

	return (
		<div className="admin-course-builder">
			<div className="admin-course-builder-container">
				{/* Header */}
				<div className="admin-course-builder-header">
					<div className="admin-course-builder-header-left">
						<button
							className="admin-btn admin-btn-back"
							onClick={() => navigate('/admin/courses')}
						>
							← Înapoi
						</button>
						<h1 className="admin-course-builder-title">
							{isEditMode ? 'Editează Curs' : 'Creează Curs Nou'}
						</h1>
					</div>
					<div className="admin-course-builder-header-right">
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

					{currentStep === 1 && (
						<CourseBuilderStep1
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
						/>
					)}

					{currentStep === 2 && (
						<CourseBuilderStep2
							courseId={id}
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
						/>
					)}

					{currentStep === 3 && (
						<CourseBuilderStep3
							courseId={id}
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
						/>
					)}

					{currentStep === 4 && (
						<CourseBuilderStep4
							courseId={id}
							data={courseData}
							onUpdate={updateCourseData}
							errors={validationErrors}
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
							courseId={id}
							data={courseData}
							onPublish={handlePublish}
							loading={loading}
						/>
					)}
				</div>

				{/* Navigation */}
				<div className="admin-course-builder-navigation">
					<button
						className="admin-btn admin-btn-secondary"
						onClick={handlePrevious}
						disabled={currentStep === 1 || loading}
					>
						← Anterior
					</button>
					<div className="admin-course-builder-step-indicator">
						Pas {currentStep} din {steps.length}
					</div>
					{currentStep < 6 ? (
						<button
							className="admin-btn admin-btn-primary"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								handleNext();
							}}
							disabled={loading}
							type="button"
						>
							Următor →
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
	);
};

const AutoSaveIndicator = ({ status }) => {
	const getStatusConfig = () => {
		switch (status) {
			case 'saving':
				return { text: 'Se salvează...', icon: '⏳', color: '#9FE22F' };
			case 'saved':
				return { text: 'Salvat', icon: '✓', color: '#09A86B' };
			case 'error':
				return { text: 'Eroare salvare', icon: '⚠️', color: '#ef4444' };
			default:
				return { text: '', icon: '', color: '' };
		}
	};

	const config = getStatusConfig();

	if (!config.text) return null;

	return (
		<div
			className="admin-auto-save-indicator"
			style={{ color: config.color }}
		>
			<span>{config.icon}</span>
			<span>{config.text}</span>
		</div>
	);
};

export default CourseBuilder;

