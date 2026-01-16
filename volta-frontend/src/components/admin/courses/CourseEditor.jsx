import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../../services/api';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useUndoRedo } from '../../../hooks/useUndoRedo';
import { useToast } from '../../../contexts/ToastContext';
import { logger } from '../../../utils/logger';
import { handleApiError } from '../../../utils/errorHandler';
import UndoRedoControls from '../../common/UndoRedoControls';
import Step2CourseIntent from './CourseBuilderSteps/Step2CourseIntent';
import CourseBuilderStep3 from './CourseBuilderSteps/Step3Content';
import CourseBuilderStep4 from './CourseBuilderSteps/Step4Tests';
import CourseBuilderStep5 from './CourseBuilderSteps/Step5Price';
import CourseQualityValidation from './CourseQualityValidation';
import CourseTestsManager from './CourseTestsManager';
import './CourseEditor.css';

const CourseEditor = () => {
	const params = useParams();
	const navigate = useNavigate();
	const { success: showSuccess, error: showError } = useToast();
	const id = params.id;

	const [activeSection, setActiveSection] = useState('info');
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

	// Load course data
	useEffect(() => {
		if (id) {
			fetchCourseData();
		}
	}, [id]);

	// ============================================
	// HELPER FUNCTIONS
	// ============================================

	/**
	 * Prepare FormData from course data (excludes modules and image_url)
	 */
	const prepareCourseFormData = (data, status = null) => {
		const formData = new FormData();
		
		Object.keys(data).forEach(key => {
			if (key === 'image' && data[key] instanceof File) {
				formData.append('image', data[key]);
			} else if (key === 'image_url' || key === 'modules') {
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

		if (data.currency && data.currency.length !== 3) {
			formData.set('currency', 'RON');
		} else if (!data.currency) {
			formData.append('currency', 'RON');
		}

		if (status) {
			formData.append('status', status);
		}

		return formData;
	};

	/**
	 * Save course (update)
	 */
	const saveCourse = async (data, options = {}) => {
		const {
			status = data.status || 'draft',
			saveModules = false,
			reloadAfterSave = false
		} = options;

		try {
			const formData = prepareCourseFormData(data, status);
			await adminService.updateCourse(id, formData);

			if (reloadAfterSave) {
				await fetchCourseData();
			}

			return { success: true, courseId: id };
		} catch (err) {
			handleApiError(err, 'saveCourse');
			throw err;
		}
	};

	/**
	 * Fetch course data
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
			handleApiError(err, 'fetchCourse');
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
	 * Handle save draft
	 */
	const handleSaveDraft = async () => {
		try {
			setLoading(true);
			await saveCourse(courseData, {
				status: 'draft',
				saveModules: false,
				reloadAfterSave: false
			});
			showSuccess('Draft salvat cu succes!');
		} catch (err) {
			const errorMessage = handleApiError(err, 'saveDraft');
			showError('Eroare la salvarea draftului: ' + errorMessage);
		} finally {
			setLoading(false);
		}
	};

	/**
	 * Handle publish
	 */
	const handlePublish = async () => {
		try {
			setLoading(true);
			await saveCourse(courseData, {
				status: 'published',
				saveModules: false,
				reloadAfterSave: false
			});
			navigate(`/admin/courses/${id}`);
		} catch (err) {
			const errorMessage = handleApiError(err, 'publishCourse');
			showError('Eroare la publicare: ' + errorMessage);
		} finally {
			setLoading(false);
		}
	};

	// ============================================
	// AUTO-SAVE SETUP
	// ============================================

	const hasValidTitle = courseData.title && typeof courseData.title === 'string' && courseData.title.trim().length >= 3;
	const autoSaveEnabled = hasValidTitle;
	const { saveStatus, manualSave } = useAutoSave(courseData, async (data) => {
		if (!hasValidTitle) return;
		try {
			await saveCourse(data, {
				status: data.status || 'draft',
				saveModules: false,
				reloadAfterSave: false
			});
		} catch (err) {
			handleApiError(err, 'autoSave');
		}
	}, 2000, autoSaveEnabled);

	// ============================================
	// SECTIONS CONFIG
	// ============================================

	const sections = [
		{ id: 'info', title: 'Informații Curs', icon: '📝' },
		{ id: 'content', title: 'Conținut Lecții', icon: '📚' },
		{ id: 'tests', title: 'Teste & Evaluări', icon: '✨' },
		{ id: 'settings', title: 'Setări Publicare', icon: '⚙️' },
	];

	// ============================================
	// RENDER
	// ============================================

	if (loading && !courseData.title) {
		return (
			<div className="admin-container">
				<div className="admin-loading-state">
					<div className="admin-loading-spinner"></div>
					<p>Se încarcă cursul...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-course-editor">
			<div className="admin-container">
				{/* Header */}
				<div className="admin-page-header">
					<div>
						<h1 className="admin-page-title">Editează Curs</h1>
						<p className="admin-page-subtitle">{courseData.title || 'Modifică detaliile cursului'}</p>
					</div>
					<div className="admin-page-header-actions">
						<UndoRedoControls
							undo={undo}
							redo={redo}
							canUndo={canUndo}
							canRedo={canRedo}
						/>
						<button
							className="admin-btn admin-btn-secondary"
							onClick={handleSaveDraft}
							disabled={loading}
						>
							💾 Salvează Draft
						</button>
						<button
							className="admin-btn admin-btn-primary"
							onClick={handlePublish}
							disabled={loading}
						>
							🚀 Publică
						</button>
					</div>
				</div>

				{/* Editor Layout */}
				<div className="course-editor-layout">
					{/* Sidebar - Sections */}
					<div className="course-editor-sidebar">
						<div className="course-editor-sidebar-header">
							<h3>Secțiuni</h3>
							{saveStatus && (
								<span className="course-editor-save-status">{saveStatus}</span>
							)}
						</div>
						<nav className="course-editor-sections">
							{sections.map((section) => (
								<button
									key={section.id}
									className={`course-editor-section-btn ${activeSection === section.id ? 'active' : ''}`}
									onClick={() => setActiveSection(section.id)}
								>
									<span className="course-editor-section-icon">{section.icon}</span>
									<span className="course-editor-section-title">{section.title}</span>
								</button>
							))}
						</nav>
					</div>

					{/* Main Content */}
					<div className="course-editor-content">
						{activeSection === 'info' && (
							<Step2CourseIntent
								data={courseData}
								onUpdate={updateCourseData}
								errors={validationErrors}
							/>
						)}
						{activeSection === 'content' && (
							<CourseBuilderStep3
								data={courseData}
								onUpdate={updateCourseData}
								errors={validationErrors}
								courseId={id}
							/>
						)}
						{activeSection === 'tests' && (
							<div>
								<CourseTestsManager
									courseId={id}
									courseData={courseData}
									onUpdate={updateCourseData}
								/>
								<div style={{ marginTop: 'var(--space-6)' }}>
									<CourseQualityValidation
										courseData={courseData}
										onValidationComplete={(results) => {
											console.log('Validation complete:', results);
										}}
									/>
								</div>
							</div>
						)}
						{activeSection === 'settings' && (
							<CourseBuilderStep5
								data={courseData}
								onUpdate={updateCourseData}
								errors={validationErrors}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseEditor;
