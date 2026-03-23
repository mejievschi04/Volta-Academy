import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import { toImageUrl } from '../../utils/imageUrl';
import { useToast } from '../../contexts/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import AutoSaveIndicator from '../../components/common/AutoSaveIndicator';
import CourseStructureBuilder from '../../components/admin/courses/CourseStructureBuilder';
import ContentBlocksPanel from '../../components/admin/content-blocks/ContentBlocksPanel';
import ValidationChecklist from '../../components/admin/courses/ValidationChecklist';
import PublishCourseModal from '../../components/admin/courses/PublishCourseModal';
import AddLessonModal from '../../components/admin/courses/AddLessonModal';
import AddModuleModal from '../../components/admin/courses/AddModuleModal';
import VoltInstructor from '../../components/admin/VoltInstructor';

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
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [versionsLoading, setVersionsLoading] = useState(false);
	const [versions, setVersions] = useState([]);
	const [testsOpen, setTestsOpen] = useState(false);
	const [testsLoading, setTestsLoading] = useState(false);
	const [testsLoaded, setTestsLoaded] = useState(false);
	const [availableTests, setAvailableTests] = useState([]);
	const [attachedTests, setAttachedTests] = useState([]);
	const [attachForm, setAttachForm] = useState({
		test_id: '',
		scope: 'course',
		scope_id: '',
		required: true,
		passing_score: 70,
	});
	const [activeTab, setActiveTab] = useState('structure'); // structure | lesson | workflow
	const [editingLessonTitle, setEditingLessonTitle] = useState(null); // lessonId when editing
	const [publishModalOpen, setPublishModalOpen] = useState(false);
	const [confirmAction, setConfirmAction] = useState(null); // { type, ...payload }
	const [confirmLoading, setConfirmLoading] = useState(false);
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const [addLessonModuleId, setAddLessonModuleId] = useState(null);
	const [addLessonLoading, setAddLessonLoading] = useState(false);
	const [addModuleModalOpen, setAddModuleModalOpen] = useState(false);
	const [addModuleLoading, setAddModuleLoading] = useState(false);

	const pendingOpsRef = useRef([]);
	const debounceRef = useRef(null);
	const runPendingOpsPromiseRef = useRef(null);

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

	useEffect(() => {
		if (activeTab === 'lesson' && !selectedLessonId) {
			setActiveTab('structure');
		}
	}, [activeTab, selectedLessonId]);

	useEffect(() => {
		setEditingLessonTitle(null);
	}, [selectedLessonId]);

	const runPendingOps = async () => {
		const opsToSend = pendingOpsRef.current;
		pendingOpsRef.current = [];
		if (opsToSend.length === 0) return null;
		try {
			const next = await adminService.patchCourseBuilderStructure(courseId, opsToSend);
			setStructure(next);
			setSaveStatus('saved');
			return next;
		} catch (e) {
			console.error('Builder autosave failed:', e);
			setSaveStatus('error');
			return null;
		} finally {
			runPendingOpsPromiseRef.current = null;
		}
	};

	const enqueueOps = (ops, immediate = false) => {
		pendingOpsRef.current = [...pendingOpsRef.current, ...ops];
		setSaveStatus('saving');

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}

		if (immediate) {
			runPendingOpsPromiseRef.current = runPendingOps();
		} else {
			debounceRef.current = setTimeout(() => {
				runPendingOpsPromiseRef.current = runPendingOps();
			}, debounceMs);
		}
	};

	/** Trimite imediat orice operații în așteptare (reordonare etc.) înainte de refresh */
	const flushPendingOps = async () => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
		// Așteaptă dacă există deja un PATCH în curs (ex: reordonare module)
		if (runPendingOpsPromiseRef.current) {
			await runPendingOpsPromiseRef.current;
		}
		await runPendingOps();
	};

	const fetchStructure = async (background = false) => {
		try {
			await flushPendingOps();
			if (!background) {
				setLoading(true);
				setError(null);
			}
			const data = await adminService.getCourseBuilderStructure(courseId);
			setStructure(data);
		} catch (e) {
			console.error('Failed to load course builder structure:', e);
			if (!background) setError('Nu s-a putut încărca builder-ul cursului.');
		} finally {
			if (!background) setLoading(false);
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
		// Actualizare optimistă - utilizatorul vede imediat noua ordine
		setStructure((prev) => {
			if (!prev) return prev;
			const newCourse = { ...prev.course, modules: newModules };
			return { ...prev, course: newCourse, modules: newModules };
		});
		enqueueOps([{ op: 'reorderModules', module_ids: moduleIds }], true);
	};

	const handleReorderLessons = (moduleId, lessonIds) => {
		enqueueOps([{ op: 'reorderLessons', module_id: moduleId, lesson_ids: lessonIds }], true);
	};

	const handleMoveLesson = (lessonId, toModuleId, toIndex) => {
		enqueueOps([{ op: 'moveLesson', lesson_id: lessonId, to_module_id: toModuleId, to_index: toIndex }], true);
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

	const handleUpdateLessonTitle = async (lessonId, newTitle) => {
		if (!newTitle?.trim()) return;
		try {
			await adminService.builderUpdateLesson(courseId, lessonId, { title: newTitle.trim() });
			showToast('Titlul lecției salvat', 'success');
			await fetchStructure(true);
		} catch (e) {
			console.error('Update lesson title failed:', e);
			showToast('Eroare la salvarea titlului', 'error');
		}
	};

	/** Adaugă modul: din VoltInstructor (AI) cu voltData, sau din builder deschide modal. */
	const handleAddModule = async (voltData) => {
		const fromAI = Array.isArray(voltData?.answers) && voltData.answers.length > 0;
		if (fromAI) {
			const title = voltData.answers[0]?.trim() || 'Modul nou';
			const [desc, lec, det, fis] = voltData.answers.slice(1) || [];
			const parts = [desc].filter(Boolean);
			if (lec) parts.push(`Lecții: ${lec}`);
			if (det) parts.push(`Nivel detaliu: ${det}`);
			if (fis) parts.push(`Fișier brut: ${fis}`);
			const description = parts.join('\n\n');
			try {
				const response = await adminService.builderCreateModule(courseId, {
					title,
					description: description || undefined,
					status: 'draft',
				});
				showToast('Modul creat', 'success');
				await fetchStructure(true);
				return response;
			} catch (e) {
				console.error('Create module failed:', e);
				showToast('Eroare la crearea modulului', 'error');
			}
			return;
		}
		setAddModuleModalOpen(true);
	};

	const handleAddModuleSubmit = async ({ title, description }) => {
		setAddModuleLoading(true);
		try {
			await adminService.builderCreateModule(courseId, {
				title,
				description: description || undefined,
				status: 'draft',
			});
			showToast('Modul creat', 'success');
			await fetchStructure(true);
			setAddModuleModalOpen(false);
		} catch (e) {
			console.error('Create module failed:', e);
			showToast(e?.response?.data?.message || 'Eroare la crearea modulului', 'error');
		} finally {
			setAddModuleLoading(false);
		}
	};

	/** Deschide modalul Adaugă lecție (flux modern: titlu + tip înainte de creare) */
	const handleAddLessonClick = (moduleId) => {
		setAddLessonModuleId(moduleId);
	};

	const handleAddLessonSubmit = async (moduleId, { title, type }) => {
		setAddLessonLoading(true);
		try {
			const res = await adminService.builderCreateLesson(courseId, {
				module_id: moduleId,
				title,
				type: type || 'text',
				status: 'draft',
				is_preview: false,
				content: '',
			});
			showToast('Lecție creată', 'success');
			await fetchStructure(true);
			setAddLessonModuleId(null);
			const newLessonId = res?.lesson?.id;
			if (newLessonId) {
				setSelectedLessonId(newLessonId);
				setActiveTab('lesson');
			}
		} catch (e) {
			console.error('Create lesson failed:', e);
			showToast(e?.response?.data?.message || 'Eroare la crearea lecției', 'error');
		} finally {
			setAddLessonLoading(false);
		}
	};

	const handleGenerateLesson = async (voltData) => {
		const moduleId = modules[0]?.id;
		if (!moduleId) return;
		const title = voltData?.answers?.[0]?.trim() || 'Lecție generată';
		let content = voltData?.chatData || '';
		if (voltData?.pdfFile) {
			content += `\n\n[PDF atașat: ${voltData.pdfFile.name}]`;
		}
		try {
			const lesson = await adminService.builderCreateLesson(courseId, {
				module_id: moduleId,
				title,
				type: 'text',
				status: 'draft',
				is_preview: false,
				content: content ? `[Brief pentru generare conținut]\n\n${content}` : '',
			});
			showToast('Lecție creată. Conținutul va fi generat.', 'success');
			await fetchStructure(true);
			if (lesson?.lesson?.id) {
				setSelectedLessonId(lesson.lesson.id);
				setActiveTab('lesson');
			}
		} catch (e) {
			console.error('Generate lesson failed:', e);
			showToast('Eroare la generarea lecției', 'error');
		}
	};

	const handleDeleteModuleClick = (moduleId) => {
		setConfirmAction({ type: 'deleteModule', moduleId });
	};

	const handleDeleteModule = async (moduleId) => {
		try {
			await adminService.deleteModule(moduleId);
			showToast('Modul șters', 'success');
			setSelectedLessonId(null);
			await fetchStructure(true);
		} catch (e) {
			console.error('Delete module failed:', e);
			showToast('Eroare la ștergerea modulului', 'error');
		}
	};

	const handleDeleteLessonClick = (lessonId) => {
		setConfirmAction({ type: 'deleteLesson', lessonId });
	};

	const handleDeleteLesson = async (lessonId) => {
		try {
			await adminService.deleteLesson(lessonId);
			showToast('Lecție ștearsă', 'success');
			if (selectedLessonId === lessonId) setSelectedLessonId(null);
			await fetchStructure(true);
		} catch (e) {
			console.error('Delete lesson failed:', e);
			showToast('Eroare la ștergerea lecției', 'error');
		}
	};

	const handlePreviewAsStudent = () => {
		if (!courseId) return;
		sessionStorage.setItem('studentPreviewFromAdmin', 'true');
		navigate(`/courses/${courseId}/detail`);
	};

	const handleValidate = async () => {
		try {
			const report = await adminService.builderValidateCourse(courseId);
			setValidationReport(report);
			if (report?.ok) {
				showToast('Validare reușită', 'success');
			} else {
				showToast('Cursul are probleme de validare', 'error');
			}
			return report;
		} catch (e) {
			console.error('Validate failed:', e);
			const report = e?.response?.data;
			if (report && (report.errors || report.warnings)) {
				setValidationReport(report);
			}
			showToast(report?.errors?.[0]?.message || 'Eroare la validare', 'error');
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
			const firstError = Array.isArray(report?.errors) && report.errors[0] ? (report.errors[0].message || report.errors[0]) : null;
			showToast(firstError ? `Trimitere la review eșuată: ${firstError}` : 'Trimiterea la review a eșuat (verifică validarea)', 'error');
		}
	};

	const handlePublish = () => {
		setPublishModalOpen(true);
	};

	const handlePublished = async (res) => {
		setValidationReport(null);
		const count = res?.notified_count ?? 0;
		showToast(count > 0 ? `Curs publicat. ${count} studenți notificați.` : 'Curs publicat', 'success');
		await fetchStructure();
	};

	const openTests = async (prefill = {}) => {
		try {
			const normalizedPrefill = { ...prefill };
			if (
				normalizedPrefill.scope_id !== undefined &&
				normalizedPrefill.scope_id !== null &&
				normalizedPrefill.scope_id !== ''
			) {
				normalizedPrefill.scope_id = String(normalizedPrefill.scope_id);
			}

			const base = {
				test_id: '',
				scope: selectedLessonId ? 'lesson' : 'course',
				scope_id: selectedLessonId ? String(selectedLessonId) : '',
				required: true,
				passing_score: 70,
				...normalizedPrefill,
			};
			setAttachForm(base);
			setTestsOpen(true);
			setTestsLoading(true);
			const res = await adminService.builderGetTests(courseId);
			setAvailableTests(Array.isArray(res?.tests) ? res.tests : []);
			setAttachedTests(Array.isArray(res?.attached) ? res.attached : []);
			setTestsLoaded(true);
		} catch (e) {
			console.error('Load builder tests failed:', e);
			showToast('Nu s-au putut încărca testele', 'error');
			setAvailableTests([]);
			setAttachedTests([]);
		} finally {
			setTestsLoading(false);
		}
	};

	const attachTest = async () => {
		try {
			const payload = {
				test_id: Number(attachForm.test_id),
				scope: attachForm.scope,
				scope_id: attachForm.scope === 'course' ? null : Number(attachForm.scope_id || 0) || null,
				required: !!attachForm.required,
				passing_score: Number(attachForm.passing_score ?? 70),
			};
			await adminService.builderAttachTest(courseId, payload);
			showToast('Test atașat', 'success');
			const res = await adminService.builderGetTests(courseId);
			setAttachedTests(Array.isArray(res?.attached) ? res.attached : []);
			setTestsLoaded(true);
		} catch (e) {
			console.error('Attach test failed:', e);
			showToast('Atașarea testului a eșuat', 'error');
		}
	};

	const detachTestClick = (courseTestId, testId, scope, scopeId) => {
		setConfirmAction({ type: 'detachTest', courseTestId, testId, scope, scopeId });
	};

	const detachTest = async (courseTestId, testId, scope, scopeId) => {
		try {
			const response = await adminService.builderDetachTest(courseId, testId, {
				course_test_id: courseTestId ?? null,
				scope,
				scope_id: scopeId ?? null,
			});
			if (!response?.deleted) {
				throw new Error('Detach returned deleted=false');
			}
			showToast('Test detașat', 'success');
			const res = await adminService.builderGetTests(courseId);
			setAttachedTests(Array.isArray(res?.attached) ? res.attached : []);
			setTestsLoaded(true);
		} catch (e) {
			console.error('Detach test failed:', e);
			showToast('Detașarea a eșuat', 'error');
		}
	};

	const openVersions = async () => {
		try {
			setVersionsOpen(true);
			setVersionsLoading(true);
			const res = await adminService.builderGetVersions(courseId);
			setVersions(Array.isArray(res?.versions) ? res.versions : []);
		} catch (e) {
			console.error('Load versions failed:', e);
			showToast('Nu s-a putut încărca istoricul versiunilor', 'error');
			setVersions([]);
		} finally {
			setVersionsLoading(false);
		}
	};

	const restoreVersionClick = (versionId) => {
		setConfirmAction({ type: 'restoreVersion', versionId });
	};

	const restoreVersion = async (versionId) => {
		try {
			const res = await adminService.builderRestoreVersion(courseId, versionId, true);
			const newCourseId = res?.course?.id;
			if (newCourseId) {
				showToast('Versiune restaurată (curs nou creat)', 'success');
				setVersionsOpen(false);
				navigate(`/admin/courses/${newCourseId}/builder`);
			} else {
				showToast('Cursul restaurat nu are ID', 'error');
			}
		} catch (e) {
			console.error('Restore version failed:', e);
			showToast('Restaurarea a eșuat', 'error');
		}
	};

	const handleConfirmAction = async () => {
		if (!confirmAction) return;
		setConfirmLoading(true);
		try {
			switch (confirmAction.type) {
				case 'deleteModule':
					await handleDeleteModule(confirmAction.moduleId);
					break;
				case 'deleteLesson':
					await handleDeleteLesson(confirmAction.lessonId);
					break;
				case 'detachTest':
					await detachTest(confirmAction.courseTestId, confirmAction.testId, confirmAction.scope, confirmAction.scopeId);
					break;
				case 'restoreVersion':
					await restoreVersion(confirmAction.versionId);
					break;
				default:
					break;
			}
			setConfirmAction(null);
		} finally {
			setConfirmLoading(false);
		}
	};

	const getConfirmConfig = () => {
		if (!confirmAction) return { title: '', message: '', confirmLabel: 'Confirmă', variant: 'primary' };
		switch (confirmAction.type) {
			case 'deleteModule':
				return { title: 'Șterge modul', message: 'Ștergi acest modul și toate lecțiile din el?', confirmLabel: 'Șterge', variant: 'danger' };
			case 'deleteLesson':
				return { title: 'Șterge lecție', message: 'Ștergi această lecție?', confirmLabel: 'Șterge', variant: 'danger' };
			case 'detachTest':
				return { title: 'Detașează test', message: 'Detașezi testul de la curs?', confirmLabel: 'Detașează', variant: 'danger' };
			case 'restoreVersion':
				return { title: 'Restaurare versiune', message: 'Restaurarea va crea un curs NOU (ciornă) din această versiune. Continui?', confirmLabel: 'Restaurare', variant: 'primary' };
			default:
				return { title: '', message: '', confirmLabel: 'Confirmă', variant: 'primary' };
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă constructorul cursului...</p>
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
		<div className="admin-container admin-course-builder-page">
			{/* Header - simplificat: acțiuni principale vizibile, rest în "Mai multe" */}
			<header className="admin-course-builder-header">
				<div className="admin-course-builder-header-left">
					<button
						type="button"
						className="admin-course-builder-back"
						onClick={() => navigate('/admin/courses')}
						aria-label="Înapoi la cursuri"
						title="Înapoi la lista de cursuri"
					>
						← Cursuri
					</button>
					<div>
						<h1 className="admin-course-builder-title">
							{course?.title || 'Constructor curs'}
						</h1>
						<p className="admin-course-builder-title-meta">
							<span className="admin-course-builder-status-dot" data-status={course?.status || 'draft'} />
							{course?.status === 'published' ? 'Publicat' : 'Ciornă'}
							{course?.workflow_status ? ` · ${course.workflow_status}` : ''}
						</p>
					</div>
				</div>
				<div className="admin-course-builder-actions">
					<AutoSaveIndicator status={saveStatus} />
					<button
						type="button"
						className="admin-btn admin-btn-secondary admin-course-builder-btn-preview"
						onClick={handlePreviewAsStudent}
						title="Vezi cursul cum îl văd cursanții"
					>
						Previzualizare
					</button>
					<button
						type="button"
						className="admin-btn admin-btn-primary"
						onClick={handlePublish}
						title="Publică cursul pentru cursanți"
					>
						Publică
					</button>
					<div className="admin-course-builder-more-wrap">
						<button
							type="button"
							className="admin-btn admin-btn-secondary admin-course-builder-more-btn"
							onClick={() => setMoreMenuOpen((v) => !v)}
							aria-expanded={moreMenuOpen}
							aria-haspopup="true"
							title="Detalii curs, teste, istoric, validare"
						>
							Mai multe
						</button>
						{moreMenuOpen && (
							<>
								<div className="admin-course-builder-more-backdrop" onClick={() => setMoreMenuOpen(false)} aria-hidden="true" />
								<div className="admin-course-builder-more-menu" role="menu">
									<button type="button" role="menuitem" title="Informații și setări curs" onClick={() => { navigate(`/admin/courses/${courseId}`); setMoreMenuOpen(false); }}>Detalii curs</button>
									<button type="button" role="menuitem" title="Gestionează testele atașate cursului sau lecțiilor" onClick={() => { openTests(); setMoreMenuOpen(false); }}>Teste atașate</button>
									<button type="button" role="menuitem" title="Snapshot-uri și versiuni anterioare" onClick={() => { openVersions(); setMoreMenuOpen(false); }}>Istoric versiuni</button>
									<button type="button" role="menuitem" title="Verifică dacă cursul respectă regulile" onClick={() => { handleValidate(); setMoreMenuOpen(false); }}>Verifică validare</button>
									<button type="button" role="menuitem" title="Trimite cursul spre revizuire" onClick={() => { handleSubmitForReview(); setMoreMenuOpen(false); }}>Trimite la revizuire</button>
								</div>
							</>
						)}
					</div>
				</div>
			</header>
			<PublishCourseModal
				open={publishModalOpen}
				onClose={() => setPublishModalOpen(false)}
				courseId={courseId}
				onPublished={handlePublished}
				validationReport={validationReport}
				onValidate={handleValidate}
			/>
			{addLessonModuleId != null && (
				<AddLessonModal
					moduleTitle={modules.find((m) => m.id === addLessonModuleId)?.title}
					onClose={() => setAddLessonModuleId(null)}
					onSubmit={(payload) => handleAddLessonSubmit(addLessonModuleId, payload)}
					loading={addLessonLoading}
				/>
			)}
			{addModuleModalOpen && (
				<AddModuleModal
					onClose={() => setAddModuleModalOpen(false)}
					onSubmit={handleAddModuleSubmit}
					loading={addModuleLoading}
				/>
			)}

			<div className="admin-course-builder-layout">
				{/* Sidebar stânga: Curriculum (outline) + acțiuni */}
				<aside className="admin-course-builder-sidebar">
					<div className="admin-course-builder-sidebar-header">
						<h2 className="admin-course-builder-sidebar-title">Curriculum</h2>
						<button
							type="button"
							className={`admin-course-builder-sidebar-link ${activeTab === 'structure' ? 'is-active' : ''}`}
							onClick={() => { setActiveTab('structure'); setSelectedLessonId(null); }}
							title="Vizualizare carduri module și lecții"
						>
							Structură
						</button>
						<button type="button" className="admin-course-builder-sidebar-add-module" onClick={() => handleAddModule()} title="Adaugă un modul nou în curriculum">
							+ Modul
						</button>
					</div>
					<nav className="admin-course-builder-sidebar-nav" aria-label="Structura cursului">
						{modules.length === 0 ? (
							<div className="admin-course-builder-sidebar-empty-state">
								<p className="admin-course-builder-sidebar-empty">Adaugă primul modul pentru a structura cursul.</p>
								<button type="button" className="admin-course-builder-sidebar-empty-btn" onClick={() => handleAddModule()}>
									+ Adaugă modul
								</button>
							</div>
						) : (
							<ul className="admin-course-builder-sidebar-list">
								{modules.map((m, mIdx) => (
									<li key={m.id} className="admin-course-builder-sidebar-module">
										<div className="admin-course-builder-sidebar-module-head">
											<span className="admin-course-builder-sidebar-module-num">{mIdx + 1}</span>
											<span className="admin-course-builder-sidebar-module-title">{m.title || 'Modul'}</span>
										</div>
										<button
											type="button"
											className="admin-course-builder-sidebar-add-lesson"
											onClick={() => handleAddLessonClick(m.id)}
											title={`Adaugă lecție în "${m.title || 'Modul'}"`}
										>
											+ Lecție
										</button>
										{Array.isArray(m.lessons) && m.lessons.length > 0 && (
											<ul className="admin-course-builder-sidebar-lessons">
												{m.lessons.map((l, lIdx) => (
													<li key={l.id}>
														<button
															type="button"
															className={`admin-course-builder-sidebar-lesson ${selectedLessonId === l.id ? 'is-selected' : ''}`}
															onClick={() => {
																setSelectedLessonId(l.id);
																setActiveTab('lesson');
															}}
															title={selectedLessonId === l.id ? `Editezi: ${l.title || 'Lecție'}` : `Deschide pentru editare: ${l.title || 'Lecție'}`}
														>
															<span className="admin-course-builder-sidebar-lesson-num">{mIdx + 1}.{lIdx + 1}</span>
															<span className="admin-course-builder-sidebar-lesson-title">{l.title || 'Lecție'}</span>
														</button>
													</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						)}
					</nav>
					<div className="admin-course-builder-sidebar-footer">
						<button
							type="button"
							className={`admin-course-builder-sidebar-link ${activeTab === 'workflow' ? 'is-active' : ''}`}
							onClick={() => setActiveTab('workflow')}
							title="Validare, revizuire și publicare"
						>
							Pregătire publicare
						</button>
					</div>
				</aside>

				{/* Zona principală: structură (carduri) sau conținut lecție sau workflow */}
				<div className="admin-course-builder-main">
					{activeTab === 'structure' && (
					<CourseStructureBuilder
						course={course}
						modules={modules}
						validationReport={validationReport}
						onReorderModules={handleReorderModules}
						onReorderLessons={handleReorderLessons}
						onMoveLesson={handleMoveLesson}
						onEditModule={(moduleId) => navigate(`/admin/modules/${moduleId}`)}
						onDeleteModule={handleDeleteModuleClick}
						onToggleModuleLock={() => showToast('Blocarea modulelor va fi activată în builder', 'info')}
						onDeleteLesson={handleDeleteLessonClick}
						onToggleModuleStatus={handleToggleModuleStatus}
						onToggleLessonStatus={handleToggleLessonStatus}
						onToggleLessonPreview={handleToggleLessonPreview}
						onSelectLesson={(lessonId) => {
							setSelectedLessonId(lessonId);
							setActiveTab('lesson');
						}}
						onAddModule={handleAddModule}
						onAddLesson={handleAddLessonClick}
						onAddTest={(prefill) => openTests(prefill || { scope: 'module' })}
						loading={loading}
					/>
					)}

					{activeTab === 'lesson' && selectedLesson && (
						<>
							<div className="admin-course-builder-lesson-settings">
								<div className="admin-course-builder-lesson-settings-header">
									<input
										type="text"
										className="admin-course-builder-lesson-title-inline"
										value={editingLessonTitle !== null ? editingLessonTitle : selectedLesson.title}
										onChange={(e) => setEditingLessonTitle(e.target.value)}
										onBlur={(e) => {
											const v = e.target.value?.trim();
											setEditingLessonTitle(null);
											if (v && v !== selectedLesson.title) handleUpdateLessonTitle(selectedLesson.id, v);
										}}
										onFocus={() => setEditingLessonTitle(selectedLesson.title)}
										placeholder="Titlu lecție"
										aria-label="Titlu lecție"
									/>
									<span className="admin-course-builder-lesson-module-badge">{selectedLesson.__moduleTitle || 'Modul'}</span>
									<button
										type="button"
										className="admin-course-builder-done-editing-btn"
										onClick={() => { setSelectedLessonId(null); setActiveTab('structure'); }}
										title="Înapoi la structură"
									>
										Înapoi la structură
									</button>
								</div>
								<div className="admin-course-builder-lesson-steps" aria-hidden="true">
									<span className="admin-course-builder-lesson-step">1. Titlu lecție</span>
									<span className="admin-course-builder-lesson-step-sep">→</span>
									<span className="admin-course-builder-lesson-step">2. Conținut (blocuri)</span>
								</div>
							</div>
							<ContentBlocksPanel courseId={courseId} lesson={selectedLesson} onRefresh={() => fetchStructure(true)} />
						</>
					)}

					{activeTab === 'workflow' && (
						<div className="admin-course-builder-workflow">
							<h3 className="admin-course-builder-workflow-title">Flux și validare</h3>
							<p className="admin-course-builder-workflow-hint">
								Verifică înainte de publish. La review/publish se creează automat snapshot-uri (Istoric).
							</p>

							<div className="admin-course-builder-workflow-actions">
								<button className="admin-btn admin-btn-secondary" onClick={handleValidate} title="Verifică dacă cursul respectă toate regulile">
									Verifică
								</button>
								<button className="admin-btn admin-btn-secondary" onClick={handleSubmitForReview} title="Trimite cursul spre revizuire">
									Trimite la review
								</button>
								<button className="admin-btn admin-btn-primary" onClick={handlePublish} title="Publică cursul pentru cursanți">
									Publică
								</button>
								<button className="admin-btn admin-btn-secondary" onClick={openVersions} title="Snapshot-uri și versiuni anterioare">
									Vezi Istoric
								</button>
							</div>

							{validationReport && (
								<ValidationChecklist
									report={validationReport}
									modules={modules}
									lessons={allLessons}
									onGoToLesson={(lessonId) => {
										setSelectedLessonId(lessonId);
										setActiveTab('lesson');
									}}
									onGoToModule={(moduleId) => {
										const el = document.querySelector(`[data-module-id="${moduleId}"]`);
										if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
									}}
								/>
							)}
						</div>
					)}
				</div>

				<aside className="admin-creator-preview-panel admin-course-builder-preview-panel">
					<div className="admin-creator-preview-header">
						<h3>Rezumat curs</h3>
						<p>Status și statistici</p>
					</div>
					<div className="admin-creator-preview-content">
						<div className="admin-course-builder-preview-card">
							{course?.image_url && (
								<div className="admin-course-builder-preview-thumb-wrap">
									<img src={toImageUrl(course.image_url)} alt={course?.title} className="admin-course-builder-preview-thumb" loading="lazy" decoding="async" />
								</div>
							)}
							<div className="module-preview-body">
								<h4 className="module-preview-title">{course?.title || 'Curs'}</h4>
								<p className="module-preview-description">
									{course?.short_description || course?.description || 'Fără descriere'}
								</p>
								<div className="admin-course-builder-preview-tags">
									<span className={`admin-course-builder-status-badge ${course?.status === 'published' ? 'published' : 'draft'}`}>
										{course?.status === 'published' ? '🟢 Publicat' : '⚪ Ciornă'}
									</span>
									{course?.workflow_status && (
										<span className="admin-course-builder-workflow-badge">{course.workflow_status}</span>
									)}
									{selectedLesson && (
										<span className="admin-course-builder-lesson-badge" title={selectedLesson.title}>
											📝 {selectedLesson.title}
										</span>
									)}
								</div>
								<div className="admin-course-builder-stats-grid">
									<div className="admin-course-builder-stat">
										<span className="admin-course-builder-stat-value">{modules.length}</span>
										<span className="admin-course-builder-stat-label">Module</span>
									</div>
									<div className="admin-course-builder-stat">
										<span className="admin-course-builder-stat-value">
											{modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)}
										</span>
										<span className="admin-course-builder-stat-label">Lecții</span>
									</div>
									<div className="admin-course-builder-stat">
										<span className="admin-course-builder-stat-value">
											{testsLoaded ? (Array.isArray(attachedTests) ? attachedTests.length : 0) : '—'}
										</span>
										<span className="admin-course-builder-stat-label">Teste</span>
									</div>
								</div>
							</div>
						</div>

						{validationReport && (
							<div style={{ marginTop: 'var(--space-6)' }}>
								<div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
									Raport validare (ultimul)
								</div>
								{validationReport.ok ? (
									<div style={{ color: 'var(--color-success)' }}>În regulă</div>
								) : (
									<div style={{ color: 'var(--color-error)' }}>Are erori</div>
								)}
							</div>
						)}
					</div>
				</aside>
			</div>

			{versionsOpen && (
				<div
					className="admin-team-modal-overlay"
					onClick={() => setVersionsOpen(false)}
					style={{ zIndex: 10000 }}
				>
					<div className="admin-team-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(980px, calc(100vw - 32px))' }}>
						<div className="admin-team-modal-header">
							<div>
								<h2 className="admin-team-modal-title">Istoric versiuni</h2>
								<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
									La publish/review se creează snapshot-uri. Restaurarea creează un curs nou (ciornă) din snapshot.
								</p>
							</div>
							<button type="button" className="admin-team-modal-close" onClick={() => setVersionsOpen(false)}>
								×
							</button>
						</div>

						<div className="admin-team-modal-body">
							{versionsLoading ? (
								<div className="lms-dashboard-loading">
									<div className="lms-spinner"></div>
									<p>Se încarcă...</p>
								</div>
							) : versions.length === 0 ? (
								<div className="lms-empty-state">
									<p>Nu există versiuni încă. (Creează una: Trimite la review sau Publică.)</p>
								</div>
							) : (
								<div style={{ display: 'grid', gap: 'var(--space-3)' }}>
									{versions.map((v) => (
										<div key={v.id} className="admin-card">
											<div className="admin-card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'center' }}>
												<div style={{ minWidth: 0 }}>
													<div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
														v{v.version} • {v.status}
													</div>
													<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
														{v.created_at ? new Date(v.created_at).toLocaleString() : '—'}{v.creator?.email ? ` • ${v.creator.email}` : ''}
													</div>
												</div>

												<div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
													<button className="admin-btn admin-btn-secondary" onClick={() => restoreVersionClick(v.id)}>
														Restaurare
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{testsOpen && (
				<div className="admin-team-modal-overlay" onClick={() => setTestsOpen(false)} style={{ zIndex: 10000 }}>
					<div className="admin-team-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(980px, calc(100vw - 32px))' }}>
						<div className="admin-team-modal-header">
							<div>
								<h2 className="admin-team-modal-title">Teste atașate cursului</h2>
								<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
									Atașează un test la curs (domeniu: curs/modul/lecție). Doar testele publicate pot fi atașate.
								</p>
							</div>
							<button type="button" className="admin-team-modal-close" onClick={() => setTestsOpen(false)}>
								×
							</button>
						</div>

						<div className="admin-team-modal-body">
							{testsLoading ? (
								<div className="lms-dashboard-loading">
									<div className="lms-spinner"></div>
									<p>Se încarcă...</p>
								</div>
							) : (
								<>
									<div className="admin-card" style={{ marginBottom: 'var(--space-4)' }}>
										<div className="admin-card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
											<div style={{ display: 'grid', gap: 'var(--space-2)' }}>
												<label className="admin-settings-label">Test</label>
												<select
													className="admin-settings-select"
													value={attachForm.test_id}
													onChange={(e) => setAttachForm((p) => ({ ...p, test_id: e.target.value }))}
												>
													<option value="">Alege un test…</option>
													{availableTests.map((t) => (
														<option key={t.id} value={t.id}>
															{t.title}
														</option>
													))}
												</select>
											</div>

											<div className="admin-settings-form-row">
												<div className="admin-settings-form-group">
													<label className="admin-settings-label">Domeniu</label>
													<select
														className="admin-settings-select"
														value={attachForm.scope}
														onChange={(e) => setAttachForm((p) => ({ ...p, scope: e.target.value, scope_id: '' }))}
													>
														<option value="course">Curs</option>
														<option value="module">Modul</option>
														<option value="lesson">Lecție</option>
													</select>
												</div>

												{attachForm.scope === 'module' && (
													<div className="admin-settings-form-group">
														<label className="admin-settings-label">Modul</label>
														<select
															className="admin-settings-select"
															value={attachForm.scope_id}
															onChange={(e) => setAttachForm((p) => ({ ...p, scope_id: e.target.value }))}
														>
															<option value="">Alege modul…</option>
															{modules.map((m) => (
																<option key={m.id} value={m.id}>
																	{m.title}
																</option>
															))}
														</select>
													</div>
												)}

												{attachForm.scope === 'lesson' && (
													<div className="admin-settings-form-group">
														<label className="admin-settings-label">Lecție</label>
														<select
															className="admin-settings-select"
															value={attachForm.scope_id}
															onChange={(e) => setAttachForm((p) => ({ ...p, scope_id: e.target.value }))}
														>
															<option value="">Alege lecție…</option>
															{allLessons.map((l) => (
																<option key={l.id} value={l.id}>
																	{l.__moduleTitle ? `${l.__moduleTitle} — ` : ''}{l.title}
																</option>
															))}
														</select>
													</div>
												)}
											</div>

											<div className="admin-settings-form-row">
												<div className="admin-settings-form-group">
													<label className="admin-settings-label">Punctaj minim (%)</label>
													<input
														className="admin-settings-input"
														type="number"
														min="0"
														max="100"
														value={attachForm.passing_score}
														onChange={(e) => setAttachForm((p) => ({ ...p, passing_score: e.target.value }))}
													/>
												</div>
												<div className="admin-settings-form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
													<label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
														<input
															type="checkbox"
															checked={!!attachForm.required}
															onChange={(e) => setAttachForm((p) => ({ ...p, required: e.target.checked }))}
														/>
														Obligatoriu
													</label>
												</div>
											</div>

											<div style={{ display: 'flex', gap: 'var(--space-2)' }}>
												<button
													className="admin-btn admin-btn-primary"
													onClick={attachTest}
													disabled={
														!attachForm.test_id ||
														(attachForm.scope !== 'course' && !attachForm.scope_id)
													}
												>
													Atașează
												</button>
											</div>
										</div>
									</div>

									<div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
										Deja atașate
									</div>
									{attachedTests.length === 0 ? (
										<div className="lms-empty-state">
											<p>Nu există teste atașate încă.</p>
										</div>
									) : (
										<div style={{ display: 'grid', gap: 'var(--space-3)' }}>
											{attachedTests.map((ct) => (
												<div key={ct.id} className="admin-card">
													<div className="admin-card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'center' }}>
														<div style={{ minWidth: 0 }}>
															<div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
																{ct.test?.title || `Test #${ct.test_id}`}
															</div>
															<div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
																Domeniu: {ct.scope === 'course' ? 'Curs' : ct.scope === 'module' ? 'Modul' : 'Lecție'}{ct.scope_id ? ` (${ct.scope_id})` : ''} • Punctaj: {ct.passing_score ?? 70}% • {ct.required ? 'Obligatoriu' : 'Opțional'}
															</div>
														</div>
														<div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
															<button className="admin-btn admin-btn-secondary" onClick={() => detachTestClick(ct.id, ct.test_id, ct.scope, ct.scope_id)}>
																Detașează
															</button>
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</>
							)}
						</div>
					</div>
				</div>
			)}

			<VoltInstructor
				questions={[
					'Ce titlu vrei pentru modul?',
					'Descrie pe scurt conținutul modulului.',
					'Câte lecții aproximativ în acest modul?',
					'Cât de desfășurată să fie informația? (pe scurt / mediu / detaliat)',
					'Încarcă un fișier PDF cu informația brută (opțional)',
				]}
				pdfUploadQuestionIndex={4}
				actions={[
					{ label: '+ Modul', onClick: handleAddModule, primary: true },
					{
						label: 'Generează lecție',
						onClick: handleGenerateLesson,
						disabled: !modules?.length,
						questions: [
							'Ce titlu vrei pentru lecție?',
							'Despre ce temă/subiect este lecția? Descrie în detaliu.',
							'Ce nivel de detaliu? (intro pentru începători / mediu / avansat)',
							'Ce tip de conținut preferi? (text explicativ, pași practici, exemple, definiții, mixt)',
							'Ce structură preferi? (secțiuni cu titluri, liste, paragrafe, puncte cheie)',
							'Ce obiective de învățare trebuie să atingă studentul după lecție?',
							'Ai material sursă în PDF? Încarcă sau scrie „nu”.',
						],
						pdfUploadQuestionIndex: 6,
					},
				]}
			/>

			<ConfirmModal
				open={!!confirmAction}
				onClose={() => setConfirmAction(null)}
				onConfirm={handleConfirmAction}
				title={getConfirmConfig().title}
				message={getConfirmConfig().message}
				confirmLabel={getConfirmConfig().confirmLabel}
				cancelLabel="Anulare"
				variant={getConfirmConfig().variant}
				loading={confirmLoading}
			/>
		</div>
	);
};

export default AdminCourseBuilderPage;

