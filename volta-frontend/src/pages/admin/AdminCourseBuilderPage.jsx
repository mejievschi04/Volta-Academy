import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import AutoSaveIndicator from '../../components/common/AutoSaveIndicator';
import CourseStructureBuilder from '../../components/admin/courses/CourseStructureBuilder';
import ContentBlocksPanel from '../../components/admin/content-blocks/ContentBlocksPanel';

const debounceMs = 900;

const AdminCourseBuilderPage = () => {
	const { id } = useParams();
	const courseId = Number(id);
	const navigate = useNavigate();
	const { showToast } = useToast();

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const [structure, setStructure] = useState(null); // { course, modules, lessons, content_blocks, meta }
	const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error' | null
	const [selectedLessonId, setSelectedLessonId] = useState(null);
	const [validationReport, setValidationReport] = useState(null);

	const pendingOpsRef = useRef([]);
	const debounceRef = useRef(null);

	const course = structure?.course || null;
	const modules = useMemo(() => {
		// Backend returns modules with nested lessons; keep that shape for now.
		return Array.isArray(course?.modules) ? course.modules : Array.isArray(structure?.modules) ? structure.modules : [];
	}, [course?.modules, structure?.modules]);

	const allLessons = useMemo(() => {
		return modules.flatMap((m) =>
			(m.lessons || []).map((l) => ({
				...l,
				__moduleTitle: m.title,
			}))
		);
	}, [modules]);

	const selectedLesson = useMemo(() => {
		if (!selectedLessonId) return null;
		return allLessons.find((l) => l.id === selectedLessonId) || null;
	}, [allLessons, selectedLessonId]);

	const enqueueOps = (ops) => {
		pendingOpsRef.current = [...pendingOpsRef.current, ...ops];
		setSaveStatus('saving');

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(async () => {
			const opsToSend = pendingOpsRef.current;
			pendingOpsRef.current = [];

			try {
				const next = await adminService.patchCourseBuilderStructure(courseId, opsToSend);
				setStructure(next);
				setSaveStatus('saved');
			} catch (e) {
				console.error('Builder autosave failed:', e);
				setSaveStatus('error');
			}
		}, debounceMs);
	};

	const fetchStructure = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await adminService.getCourseBuilderStructure(courseId);
			setStructure(data);
		} catch (e) {
			console.error('Failed to load course builder structure:', e);
			setError('Nu s-a putut încărca builder-ul cursului.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!Number.isFinite(courseId)) return;
		fetchStructure();
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [courseId]);

	const handleReorderModules = (newModules) => {
		const moduleIds = newModules.map((m) => m.id);
		enqueueOps([{ op: 'reorderModules', module_ids: moduleIds }]);
	};

	const handleReorderLessons = (moduleId, lessonIds) => {
		enqueueOps([{ op: 'reorderLessons', module_id: moduleId, lesson_ids: lessonIds }]);
	};

	const handleMoveLesson = (lessonId, toModuleId, toIndex) => {
		enqueueOps([{ op: 'moveLesson', lesson_id: lessonId, to_module_id: toModuleId, to_index: toIndex }]);
	};

	const handleToggleModuleStatus = (moduleId, status) => {
		enqueueOps([{ op: 'toggleModuleStatus', module_id: moduleId, status }]);
	};

	const handleToggleLessonStatus = (lessonId, status) => {
		enqueueOps([{ op: 'toggleLessonStatus', lesson_id: lessonId, status }]);
	};

	const handleToggleLessonPreview = (lessonId, isPreview) => {
		enqueueOps([{ op: 'toggleLessonPreview', lesson_id: lessonId, is_preview: isPreview }]);
	};

	const handleSetLessonPrerequisite = (lessonId, unlockAfterLessonId) => {
		enqueueOps([
			{
				op: 'setLessonPrerequisite',
				lesson_id: lessonId,
				unlock_after_lesson_id: unlockAfterLessonId || null,
			},
		]);
	};

	const handleAddModule = async () => {
		try {
			const response = await adminService.builderCreateModule(courseId, { title: 'Modul nou', status: 'draft' });
			showToast('Modul creat', 'success');
			await fetchStructure();
			return response;
		} catch (e) {
			console.error('Create module failed:', e);
			showToast('Eroare la crearea modulului', 'error');
		}
	};

	const handleAddLesson = async (moduleId) => {
		try {
			await adminService.builderCreateLesson(courseId, {
				module_id: moduleId,
				title: 'Lecție nouă',
				type: 'text',
				status: 'draft',
				duration_minutes: 5,
				is_preview: false,
				content: '',
			});
			showToast('Lecție creată', 'success');
			await fetchStructure();
		} catch (e) {
			console.error('Create lesson failed:', e);
			showToast('Eroare la crearea lecției', 'error');
		}
	};

	const handlePreviewAsStudent = () => {
		if (!courseId) return;
		window.open(`/courses/${courseId}/detail`, '_blank', 'noopener,noreferrer');
	};

	const handleValidate = async () => {
		try {
			const report = await adminService.builderValidateCourse(courseId);
			setValidationReport(report);
			if (report?.ok) {
				showToast('Validare OK', 'success');
			} else {
				showToast('Cursul are probleme de validare', 'error');
			}
			return report;
		} catch (e) {
			console.error('Validate failed:', e);
			showToast('Eroare la validare', 'error');
		}
	};

	const handleSubmitForReview = async () => {
		try {
			const res = await adminService.builderSubmitForReview(courseId);
			setValidationReport(res?.report || null);
			showToast('Trimis la review', 'success');
			await fetchStructure();
			return res;
		} catch (e) {
			console.error('Submit for review failed:', e);
			const report = e?.response?.data;
			if (report?.errors || report?.warnings) {
				setValidationReport(report);
			}
			showToast('Trimiterea la review a eșuat (verifică validarea)', 'error');
		}
	};

	const handlePublish = async () => {
		try {
			const res = await adminService.builderPublishCourse(courseId);
			setValidationReport(null);
			showToast('Curs publicat', 'success');
			await fetchStructure();
			return res;
		} catch (e) {
			console.error('Publish failed:', e);
			const report = e?.response?.data;
			if (report?.errors || report?.warnings) {
				setValidationReport(report);
			}
			showToast('Publicarea a eșuat (verifică validarea)', 'error');
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă Course Builder...</p>
				</div>
			</div>
		);
	}

	if (error || !structure) {
		return (
			<div className="admin-container">
				<div className="lms-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error || 'Nu s-a putut încărca builder-ul.'}</p>
					<div style={{ display: 'flex', gap: 'var(--space-3)' }}>
						<button className="lms-btn-secondary" onClick={() => navigate('/admin/courses')}>
							← Înapoi la Cursuri
						</button>
						<button className="lms-btn-primary" onClick={fetchStructure}>
							Reîncearcă
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Course Builder</h1>
					<p className="admin-page-subtitle">
						{course?.title ? `Editezi: ${course.title}` : 'Editează structura și conținutul cursului'}
						{course?.workflow_status ? ` • Workflow: ${course.workflow_status}` : ''}
					</p>
				</div>
				<div className="admin-page-header-actions">
					<AutoSaveIndicator status={saveStatus} />
					<button className="admin-btn admin-btn-secondary" onClick={() => navigate(`/admin/courses/${courseId}`)}>
						Detalii
					</button>
					<button className="admin-btn admin-btn-secondary" onClick={handlePreviewAsStudent}>
						👁️ Preview ca Student
					</button>
					<button className="admin-btn admin-btn-secondary" onClick={handleValidate}>
						Verifică
					</button>
					<button className="admin-btn admin-btn-secondary" onClick={handleSubmitForReview}>
						Trimite la review
					</button>
					<button className="admin-btn admin-btn-primary" onClick={handlePublish}>
						Publică
					</button>
				</div>
			</div>

			<div className="admin-creator-split">
				<div className="admin-creator-form-panel">
					<CourseStructureBuilder
						course={course}
						modules={modules}
						onReorderModules={handleReorderModules}
						onReorderLessons={handleReorderLessons}
						onMoveLesson={handleMoveLesson}
						onEditModule={(moduleId) => navigate(`/admin/modules/${moduleId}`)}
						onDeleteModule={() => showToast('Ștergerea modulelor va fi activată în builder', 'info')}
						onToggleModuleLock={() => showToast('Blocarea modulelor va fi activată în builder', 'info')}
						onToggleModuleStatus={handleToggleModuleStatus}
						onToggleLessonStatus={handleToggleLessonStatus}
						onToggleLessonPreview={handleToggleLessonPreview}
						onSelectLesson={(lessonId) => setSelectedLessonId(lessonId)}
						onAddModule={handleAddModule}
						onAddLesson={handleAddLesson}
						onAddTest={() => showToast('Atașarea testelor va fi activată în builder', 'info')}
						loading={loading}
					/>

					{selectedLesson && (
						<>
							<div className="admin-settings-section" style={{ marginTop: 'var(--space-6)' }}>
								<h3 className="admin-settings-section-title">Setări lecție</h3>
								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Lecție selectată</label>
									<div style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
										{selectedLesson.title}
									</div>
									<div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
										Modul: {selectedLesson.__moduleTitle || '—'}
									</div>
								</div>

								<div className="admin-settings-form-group">
									<label className="admin-settings-label">Prerechizit</label>
									<select
										className="admin-settings-select"
										value={selectedLesson.unlock_after_lesson_id || ''}
										onChange={(e) =>
											handleSetLessonPrerequisite(
												selectedLesson.id,
												e.target.value ? Number(e.target.value) : null
											)
										}
									>
										<option value="">Fără prerechizit</option>
										{allLessons
											.filter((l) => l.id !== selectedLesson.id)
											.map((l) => (
												<option key={l.id} value={l.id}>
													{l.__moduleTitle ? `${l.__moduleTitle} — ` : ''}{l.title}
												</option>
											))}
									</select>
									<div className="admin-settings-hint">
										Cursantul nu poate accesa această lecție până nu finalizează prerechizitul selectat.
									</div>
								</div>
							</div>

							<ContentBlocksPanel courseId={courseId} lesson={selectedLesson} onRefresh={fetchStructure} />
						</>
					)}
				</div>

				<aside className="admin-creator-preview-panel">
					<div className="admin-creator-preview-header">
						<h3>Preview structură</h3>
						<p>Rezumat rapid (cum va arăta pentru cursant)</p>
					</div>
					<div className="admin-creator-preview-content">
						<div className="module-preview-card">
							<div className="module-preview-body">
								<h4 className="module-preview-title">{course?.title || 'Curs'}</h4>
								<p className="module-preview-description">
									{course?.short_description || course?.description || 'Fără descriere'}
								</p>
								<div className="module-preview-meta">
									<div className="module-preview-meta-item">
										<span className="module-preview-meta-label">Module</span>
										<span className="module-preview-meta-value">{modules.length}</span>
									</div>
									<div className="module-preview-meta-item">
										<span className="module-preview-meta-label">Lecții</span>
										<span className="module-preview-meta-value">
											{modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)}
										</span>
									</div>
									<div className="module-preview-meta-item">
										<span className="module-preview-meta-label">Status</span>
										<span className="module-preview-meta-value">{course?.status || 'draft'}</span>
									</div>
								</div>
							</div>
						</div>
						<div style={{ marginTop: 'var(--space-4)' }}>
							{modules.map((m) => (
								<div key={m.id} style={{ marginBottom: 'var(--space-3)' }}>
									<div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
										{m.title || 'Modul'} {m.status === 'draft' ? '(Draft)' : ''}
									</div>
									<div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
										{(m.lessons || []).length} lecții
									</div>
								</div>
							))}
						</div>

						{validationReport && (
							<div style={{ marginTop: 'var(--space-6)' }}>
								<div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
									Raport validare
								</div>
								{validationReport.ok ? (
									<div style={{ color: 'var(--color-success)' }}>OK</div>
								) : (
									<div style={{ color: 'var(--color-error)' }}>Are erori</div>
								)}

								{Array.isArray(validationReport.errors) && validationReport.errors.length > 0 && (
									<div style={{ marginTop: 'var(--space-3)' }}>
										<div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
											Erori
										</div>
										<ul style={{ margin: 'var(--space-2) 0 0 0', paddingLeft: 'var(--space-4)' }}>
											{validationReport.errors.map((e, idx) => (
												<li key={`${e.code || 'err'}-${idx}`} style={{ marginBottom: 'var(--space-2)' }}>
													{e.message}
												</li>
											))}
										</ul>
									</div>
								)}

								{Array.isArray(validationReport.warnings) && validationReport.warnings.length > 0 && (
									<div style={{ marginTop: 'var(--space-3)' }}>
										<div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
											Avertismente
										</div>
										<ul style={{ margin: 'var(--space-2) 0 0 0', paddingLeft: 'var(--space-4)' }}>
											{validationReport.warnings.map((w, idx) => (
												<li key={`${w.code || 'warn'}-${idx}`} style={{ marginBottom: 'var(--space-2)' }}>
													{w.message}
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	);
};

export default AdminCourseBuilderPage;

