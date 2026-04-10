import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import AutoSaveIndicator from '../../components/common/AutoSaveIndicator';
import RichTextEditor from '../../components/RichTextEditor';
import AICourseChat from '../../components/admin/ai/AICourseChat';
import '../../styles/admin-course-builder.css';
import { courseCoverSrc } from '../../utils/imageUrl';
import { useAuth } from '../../contexts/AuthContext';

const INLINE_TEST_DEFAULT = {
	id: null,
	title: '',
	description: '',
	type: 'final',
	status: 'draft',
	question_source: 'direct',
	time_limit_minutes: null,
	max_attempts: null,
	passing_score: 70,
	randomize_questions: true,
	randomize_answers: true,
	show_results_immediately: true,
	show_correct_answers: true,
	allow_review: true,
	requires_manual_verification: false,
};

const INLINE_QUESTION_TYPES = [
	{ id: 'multiple_choice', label: 'Răspuns multiplu', short: 'A/B' },
	{ id: 'single_choice', label: 'Răspuns unic', short: '1' },
	{ id: 'true_false', label: 'Adevărat / Fals', short: 'T/F' },
	{ id: 'short_answer', label: 'Răspuns scurt', short: 'TXT' },
	{ id: 'essay', label: 'Eseu', short: 'ESEU' },
];

const getDefaultAnswersByType = (type) => {
	if (type === 'multiple_choice' || type === 'single_choice') {
		return [{ text: 'Răspuns A', is_correct: true }, { text: 'Răspuns B', is_correct: false }];
	}
	if (type === 'true_false') {
		return [{ text: 'Adevărat', is_correct: true }, { text: 'Fals', is_correct: false }];
	}
	return [];
};

/** Wizard / API vechi pot folosi answer_text; builder-ul folosește `text` în stare. */
const normalizeBuilderAnswer = (a) => {
	if (!a || typeof a !== 'object') return { text: '', is_correct: false };
	const text = a.text ?? a.answer_text ?? a.content ?? '';
	return { ...a, text };
};

const normalizeBuilderQuestion = (q) => {
	if (!q) return q;
	const rawId = q.id;
	let id = rawId;
	if (rawId != null && !(typeof rawId === 'string' && String(rawId).startsWith('temp-'))) {
		const n = Number(rawId);
		if (Number.isFinite(n)) id = n;
	}
	return {
		...q,
		id,
		answers: Array.isArray(q.answers) ? q.answers.map(normalizeBuilderAnswer) : [],
	};
};

/** Payload stabil pentru PUT /admin/questions — text + is_correct + order (fără resturi din spread). */
const serializeAnswersForQuestionApi = (answers) => {
	if (!Array.isArray(answers)) return [];
	return answers.map((a, idx) => {
		const raw = a && typeof a === 'object' ? a : {};
		const text = raw.text ?? raw.answer_text ?? raw.content ?? '';
		return {
			text: typeof text === 'string' ? text : String(text ?? ''),
			is_correct: Boolean(raw.is_correct),
			order: typeof raw.order === 'number' ? raw.order : idx,
		};
	});
};

const LESSON_DRAG_MIME = 'application/x-volta-course-lesson';

/** Index de inserare pentru op-ul builder moveLesson (lista destinație fără lecția mutată). */
function computeLessonInsertIndex(modulesList, toModuleId, movingLessonId, targetLessonId, position) {
	const mod = modulesList.find((m) => Number(m.id) === Number(toModuleId));
	if (!mod) return 0;
	const filtered = (mod.lessons || []).filter((l) => Number(l.id) !== Number(movingLessonId));
	if (targetLessonId == null || position === 'end') {
		return filtered.length;
	}
	const idx = filtered.findIndex((l) => Number(l.id) === Number(targetLessonId));
	if (idx === -1) return filtered.length;
	return position === 'before' ? idx : idx + 1;
}

const AdminCourseBuilderPage = () => {
	const { id } = useParams();
	const courseId = Number(id);
	const navigate = useNavigate();
	const { showToast } = useToast();
	const { canMutateInAdminArea } = useAuth();

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [structure, setStructure] = useState(null);
	const [selectedModuleId, setSelectedModuleId] = useState(null);
	const [selectedLessonId, setSelectedLessonId] = useState(null);
	const [lessonContent, setLessonContent] = useState('');
	const [lessonSaveStatus, setLessonSaveStatus] = useState(null);
	const [courseActionLoading, setCourseActionLoading] = useState(false);
	const [showCourseEditModal, setShowCourseEditModal] = useState(false);
	const [showVoltAssistant, setShowVoltAssistant] = useState(false);
	const [courseEditSaving, setCourseEditSaving] = useState(false);
	const [courseEditImageFile, setCourseEditImageFile] = useState(null);
	const [courseEditImagePreviewUrl, setCourseEditImagePreviewUrl] = useState(null);
	const [courseEditDraft, setCourseEditDraft] = useState({
		title: '',
		description: '',
		short_description: '',
		card_color: '#5b72ff',
		level: 'beginner',
		status: 'draft',
		visibility: 'public',
		estimated_duration_hours: '',
		sequential_unlock: true,
		min_test_score: 70,
		has_certificate: false,
	});

	const [quickAddMenuOpen, setQuickAddMenuOpen] = useState(false);
	const [quickCreateModuleOpen, setQuickCreateModuleOpen] = useState(false);
	const [quickModuleTitle, setQuickModuleTitle] = useState('');
	const [quickModuleLoading, setQuickModuleLoading] = useState(false);
	const [showTestCreator, setShowTestCreator] = useState(false);
	const [builderSidebarVisible, setBuilderSidebarVisible] = useState(true);
	const [creatingTest, setCreatingTest] = useState(false);
	const [showCreateTestModal, setShowCreateTestModal] = useState(false);
	const [createTestTitle, setCreateTestTitle] = useState('');
	const [createTestModuleId, setCreateTestModuleId] = useState(null);
	const [courseAttachedTests, setCourseAttachedTests] = useState([]);
	const [inlineTestTab, setInlineTestTab] = useState('questions');
	const [inlineTest, setInlineTest] = useState({ ...INLINE_TEST_DEFAULT });
	const [inlineQuestions, setInlineQuestions] = useState([]);
	const [inlineTestSaving, setInlineTestSaving] = useState(false);
	const [inlinePublishLoading, setInlinePublishLoading] = useState(false);
	const [addingQuestion, setAddingQuestion] = useState(false);
	const [expandedQuestionId, setExpandedQuestionId] = useState(null);
	const [openQuestionTypePickerId, setOpenQuestionTypePickerId] = useState(null);
	const [draggingSidebarTestId, setDraggingSidebarTestId] = useState(null);
	const [sidebarDropHint, setSidebarDropHint] = useState({ moduleId: null, targetId: null, position: null });
	const [lessonDropHint, setLessonDropHint] = useState(null);
	const lessonDragPayloadRef = useRef(null);
	const [editingModuleId, setEditingModuleId] = useState(null);
	const [editingModuleTitle, setEditingModuleTitle] = useState('');
	const lessonTitleRef = useRef(null);
	const quickAddRef = useRef(null);
	const questionTypeMenuRef = useRef(null);
	const contentSaveTimeoutRef = useRef(null);
	const pendingContentRef = useRef(null);
	const inlinePendingTestRef = useRef({});
	const inlineTestSaveTimeoutRef = useRef(null);
	const inlineQuestionPendingRef = useRef({});
	const inlineQuestionSaveTimersRef = useRef({});
	const flushAllInlineQuestionSavesRef = useRef(() => Promise.resolve());

	const course = structure?.course || null;
	const modules = useMemo(
		() => (Array.isArray(course?.modules) ? course.modules : Array.isArray(structure?.modules) ? structure.modules : []),
		[course?.modules, structure?.modules]
	);

	const rootLessons = useMemo(
		() => {
			const source = Array.isArray(structure?.root_lessons)
				? structure.root_lessons
				: Array.isArray(structure?.lessons)
					? structure.lessons.filter((lessonItem) => lessonItem?.module_id == null)
				: Array.isArray(course?.lessons)
					? course.lessons.filter((lessonItem) => lessonItem?.module_id == null)
					: [];

			return source.map((lessonItem) => ({
				...lessonItem,
				module_id: null,
				__moduleTitle: 'Fara modul',
			}));
		},
		[course?.lessons, structure?.lessons, structure?.root_lessons]
	);

	const allLessons = useMemo(
		() =>
			[
				...rootLessons,
				...modules.flatMap((moduleItem) =>
					(moduleItem.lessons || []).map((lessonItem) => ({
						...lessonItem,
						__moduleTitle: moduleItem.title,
					}))
				),
			],
		[modules, rootLessons]
	);

	const voltCourseSummary = useMemo(() => {
		const moduleLines = modules.slice(0, 6).map((moduleItem, index) => {
			const lessonTitles = (moduleItem.lessons || [])
				.slice(0, 4)
				.map((lessonItem) => `${lessonItem.id ?? 'nou'}: ${lessonItem.title || 'Lecție'}`)
				.join(', ');
			return `${index + 1}. [module_id=${moduleItem.id ?? 'nou'}] ${moduleItem.title || 'Modul fără titlu'}${lessonTitles ? ` | lecții: ${lessonTitles}` : ''}`;
		});
		const rootLessonTitles = rootLessons
			.slice(0, 6)
			.map((lessonItem) => `${lessonItem.id ?? 'nou'}: ${lessonItem.title || 'Lecție'}`)
			.join(', ');
		return [
			`Curs: ${course?.title || 'Curs curent'}`,
			course?.description ? `Descriere: ${course.description}` : null,
			moduleLines.length > 0 ? `Module existente:\n${moduleLines.join('\n')}` : 'Module existente: niciunul',
			rootLessonTitles ? `Lecții la rădăcină: ${rootLessonTitles}` : null,
		].filter(Boolean).join('\n\n');
	}, [course?.description, course?.title, modules, rootLessons]);

	const selectedLesson = useMemo(() => {
		if (!selectedLessonId) return null;
		return allLessons.find((lessonItem) => lessonItem.id === selectedLessonId) || null;
	}, [allLessons, selectedLessonId]);

	const getModuleAttachedTests = useCallback((moduleId) => (
		courseAttachedTests
			.filter((row) => row.scope === 'module' && Number(row.scope_id) === Number(moduleId))
			.sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
	), [courseAttachedTests]);

	const getCourseLevelAttachedTests = useCallback(
		() =>
			courseAttachedTests
				.filter((row) => row.scope === 'course')
				.sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
		[courseAttachedTests]
	);

	const getLessonAttachedTests = useCallback(
		(lessonId) =>
			courseAttachedTests
				.filter((row) => row.scope === 'lesson' && Number(row.scope_id) === Number(lessonId))
				.sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
		[courseAttachedTests]
	);

	useEffect(() => {
		document.body.classList.add('admin-course-builder-scroll-lock');
		return () => {
			document.body.classList.remove('admin-course-builder-scroll-lock');
		};
	}, []);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (!openQuestionTypePickerId) return;
			if (questionTypeMenuRef.current && !questionTypeMenuRef.current.contains(event.target)) {
				setOpenQuestionTypePickerId(null);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [openQuestionTypePickerId]);

	const flushPendingLessonContentSave = useCallback(async () => {
		if (contentSaveTimeoutRef.current) {
			clearTimeout(contentSaveTimeoutRef.current);
			contentSaveTimeoutRef.current = null;
		}
		const pending = pendingContentRef.current;
		if (!pending?.lessonId) return;
		const { lessonId, content } = pending;
		try {
			await adminService.builderUpdateLesson(courseId, lessonId, { content });
			// Șterge pending doar dacă nu s-a mai editat între timp (altfel păstrăm coada pentru următorul save)
			if (
				pendingContentRef.current?.lessonId === lessonId &&
				pendingContentRef.current?.content === content
			) {
				pendingContentRef.current = null;
			}
			setLessonSaveStatus('saved');
		} catch (e) {
			console.error('Lesson content save failed:', e);
			setLessonSaveStatus('error');
			showToast('Eroare la salvarea conținutului lecției.', 'error');
		}
	}, [courseId, showToast]);

	const fetchAttachedTests = useCallback(async () => {
		try {
			const response = await adminService.builderGetTests(courseId);
			const raw = response?.attached ?? response?.data?.attached;
			setCourseAttachedTests(Array.isArray(raw) ? raw : []);
		} catch (e) {
			console.error('Failed to load attached tests:', e);
			setCourseAttachedTests([]);
			showToast('Nu s-au putut încărca testele atașate cursului.', 'error');
		}
	}, [courseId, showToast]);

	const clearLessonDrag = useCallback(() => {
		lessonDragPayloadRef.current = null;
		setLessonDropHint(null);
	}, []);

	const handleLessonMove = useCallback(
		async (lessonId, toModuleId, toIndex) => {
			try {
				await flushPendingLessonContentSave();
				await flushAllInlineQuestionSavesRef.current();
				const data = await adminService.patchCourseBuilderStructure(courseId, [
					{
						op: 'moveLesson',
						lesson_id: Number(lessonId),
						to_module_id: Number(toModuleId),
						to_index: toIndex,
					},
				]);
				setStructure(data);
				await fetchAttachedTests();
				setSelectedModuleId(Number(toModuleId));
				setSelectedLessonId(Number(lessonId));
				setShowTestCreator(false);
				showToast('Lecția a fost mutată.', 'success');
			} catch (err) {
				console.error('moveLesson failed:', err);
				showToast(err?.response?.data?.message || 'Nu s-a putut muta lecția.', 'error');
			}
		},
		[courseId, fetchAttachedTests, flushPendingLessonContentSave, showToast]
	);

	const handleLessonDragStart = useCallback(
		(e, lessonItem, sourceModuleId) => {
			if (!canMutateInAdminArea) {
				e.preventDefault();
				return;
			}
			const payload = { lessonId: lessonItem.id, moduleId: sourceModuleId };
			lessonDragPayloadRef.current = payload;
			try {
				e.dataTransfer.setData(LESSON_DRAG_MIME, JSON.stringify(payload));
			} catch {
				// unele browsere pot restricționa setData
			}
			e.dataTransfer.effectAllowed = 'move';
		},
		[canMutateInAdminArea]
	);

	const handleLessonDragEnd = useCallback(() => {
		clearLessonDrag();
	}, [clearLessonDrag]);

	const handleLessonDragOverRow = useCallback((e, moduleItem, lessonItem) => {
		if (!lessonDragPayloadRef.current) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		const rect = e.currentTarget.getBoundingClientRect();
		const position = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
		setLessonDropHint({ moduleId: moduleItem.id, lessonId: lessonItem.id, position });
	}, []);

	const handleLessonDragOverModuleEnd = useCallback((e, moduleItem) => {
		if (!lessonDragPayloadRef.current) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		setLessonDropHint({ moduleId: moduleItem.id, zone: 'end' });
	}, []);

	const handleLessonDropOnLesson = useCallback(
		async (e, targetModuleItem, targetLessonItem) => {
			e.preventDefault();
			e.stopPropagation();
			let movingId = null;
			const raw = e.dataTransfer.getData(LESSON_DRAG_MIME);
			try {
				movingId = raw ? JSON.parse(raw).lessonId : lessonDragPayloadRef.current?.lessonId;
			} catch {
				movingId = lessonDragPayloadRef.current?.lessonId;
			}
			if (movingId == null) return;
			if (Number(movingId) === Number(targetLessonItem.id)) {
				clearLessonDrag();
				return;
			}
			const rect = e.currentTarget.getBoundingClientRect();
			const position = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
			const toIndex = computeLessonInsertIndex(
				modules,
				targetModuleItem.id,
				movingId,
				targetLessonItem.id,
				position
			);
			await handleLessonMove(movingId, targetModuleItem.id, toIndex);
			clearLessonDrag();
		},
		[modules, handleLessonMove, clearLessonDrag]
	);

	const handleLessonDropAtModuleEnd = useCallback(
		async (e, targetModuleItem) => {
			e.preventDefault();
			e.stopPropagation();
			let movingId = null;
			const raw = e.dataTransfer.getData(LESSON_DRAG_MIME);
			try {
				movingId = raw ? JSON.parse(raw).lessonId : lessonDragPayloadRef.current?.lessonId;
			} catch {
				movingId = lessonDragPayloadRef.current?.lessonId;
			}
			if (movingId == null) return;
			const toIndex = computeLessonInsertIndex(modules, targetModuleItem.id, movingId, null, 'end');
			await handleLessonMove(movingId, targetModuleItem.id, toIndex);
			clearLessonDrag();
		},
		[modules, handleLessonMove, clearLessonDrag]
	);

	const fetchStructure = async (background = false) => {
		try {
			if (!background) {
				setLoading(true);
				setError(null);
			}
			const data = await adminService.getCourseBuilderStructure(courseId);
			setStructure(data);
			await fetchAttachedTests();
		} catch (e) {
			console.error('Failed to load course builder structure:', e);
			if (!background) setError('Nu s-a putut încărca builder-ul cursului.');
		} finally {
			if (!background) setLoading(false);
		}
	};

	useEffect(() => {
		if (!Number.isFinite(courseId)) return;
		if (!canMutateInAdminArea) {
			navigate(`/admin/courses/${courseId}`, { replace: true });
			return;
		}
		fetchStructure();
		// Testele atașate se încarcă în fetchStructure (după structură), ca lista să fie sincronă
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [courseId, canMutateInAdminArea, navigate]);

	useEffect(() => {
		if (!courseEditImageFile) {
			setCourseEditImagePreviewUrl(null);
			return undefined;
		}
		const url = URL.createObjectURL(courseEditImageFile);
		setCourseEditImagePreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [courseEditImageFile]);

	useEffect(() => {
		const hasModules = modules.length > 0;
		const hasRootLessons = rootLessons.length > 0;

		if (!hasModules && !hasRootLessons) {
			setSelectedModuleId(null);
			setSelectedLessonId(null);
			return;
		}

		if (selectedModuleId != null && !modules.some((moduleItem) => moduleItem.id === selectedModuleId)) {
			setSelectedModuleId(hasModules ? modules[0].id : null);
		}

		const selectedLessonExists = selectedLessonId
			? allLessons.some((lessonItem) => lessonItem.id === selectedLessonId)
			: false;

		if (!selectedLessonExists) {
			const firstLesson = rootLessons[0] || modules.flatMap((moduleItem) => moduleItem.lessons || [])[0] || null;
			setSelectedLessonId(firstLesson?.id || null);
			setSelectedModuleId(firstLesson?.module_id ?? null);
		}
	}, [allLessons, modules, rootLessons, selectedLessonId, selectedModuleId]);

	// Doar la schimbarea lecției — nu la fiecare refresh al structurii (ex. moveLesson, fetch).
	// Altfel `selectedLesson.content` din snapshot poate fi gol/diferit și rescrie ce scrie utilizatorul.
	useLayoutEffect(() => {
		if (selectedLesson?.id == null) {
			setLessonContent('');
			setLessonSaveStatus(null);
			return;
		}
		setLessonContent(selectedLesson?.content || '');
		setLessonSaveStatus(null);
	}, [selectedLesson?.id]);

	useEffect(() => {
		if (!lessonTitleRef.current || !selectedLesson) return;
		lessonTitleRef.current.textContent = selectedLesson.title || 'Titlu lecție';
	}, [selectedLesson?.id, selectedLesson?.title]);

	useEffect(() => () => {
		if (inlineTestSaveTimeoutRef.current) {
			clearTimeout(inlineTestSaveTimeoutRef.current);
		}
	}, []);

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

	const handleLessonContentChange = (nextContent) => {
		if (!selectedLesson?.id) return;
		setLessonContent(nextContent);
		pendingContentRef.current = {
			lessonId: selectedLesson.id,
			content: nextContent || '',
		};
		setLessonSaveStatus('saving');
		if (contentSaveTimeoutRef.current) clearTimeout(contentSaveTimeoutRef.current);
		contentSaveTimeoutRef.current = setTimeout(async () => {
			const pending = pendingContentRef.current;
			if (!pending?.lessonId) return;
			const { lessonId, content } = pending;
			try {
				await adminService.builderUpdateLesson(courseId, lessonId, { content });
				if (
					pendingContentRef.current?.lessonId === lessonId &&
					pendingContentRef.current?.content === content
				) {
					pendingContentRef.current = null;
				}
				setLessonSaveStatus('saved');
			} catch (e) {
				console.error('Lesson content autosave failed:', e);
				setLessonSaveStatus('error');
				showToast('Autosave eșuat pentru conținutul lecției.', 'error');
			}
		}, 700);
	};

	useEffect(() => {
		if (!quickAddMenuOpen) return undefined;
		const onOutsideClick = (event) => {
			if (quickAddRef.current && !quickAddRef.current.contains(event.target)) {
				setQuickAddMenuOpen(false);
			}
		};
		document.addEventListener('click', onOutsideClick);
		return () => document.removeEventListener('click', onOutsideClick);
	}, [quickAddMenuOpen]);

	const handleQuickCreateModule = async () => {
		const title = quickModuleTitle.trim();
		if (!title || quickModuleLoading) return;
		setQuickModuleLoading(true);
		try {
			await adminService.builderCreateModule(courseId, {
				title,
				status: 'draft',
			});
			showToast('Modul creat', 'success');
			await fetchStructure(true);
			setQuickCreateModuleOpen(false);
			setQuickModuleTitle('');
		} catch (e) {
			console.error('Create module failed:', e);
			showToast(e?.response?.data?.message || 'Eroare la crearea modulului', 'error');
		} finally {
			setQuickModuleLoading(false);
		}
	};

	const handleQuickCreateLesson = async (targetModuleId = selectedModuleId ?? null) => {
		const moduleItem = targetModuleId != null ? modules.find((m) => Number(m.id) === Number(targetModuleId)) : null;
		const nextLessonOrder = targetModuleId != null ? (moduleItem?.lessons || []).length + 1 : rootLessons.length + 1;
		const fallbackTitle = `Lectie ${nextLessonOrder}`;

		try {
			const result = await adminService.builderCreateLesson(courseId, {
				module_id: targetModuleId,
				title: fallbackTitle,
				type: 'text',
				status: 'draft',
			});
			const lesson = result?.lesson ?? result;
			await fetchStructure(true);
			await flushAllInlineQuestionSavesRef.current();
			setSelectedModuleId(targetModuleId ?? null);
			if (lesson?.id) {
				setSelectedLessonId(lesson.id);
				setShowTestCreator(false);
			}
			showToast('Lectie noua adaugata.', 'success');
		} catch (err) {
			console.error('Quick create lesson failed:', err);
			showToast(err?.response?.data?.message || 'Nu am putut crea lectia.', 'error');
		}
	};

	const handleQuickModuleInputBlur = () => {
		if (quickModuleLoading) return;
		if (quickModuleTitle.trim()) {
			handleQuickCreateModule();
			return;
		}
		setQuickCreateModuleOpen(false);
		setQuickModuleTitle('');
	};

	const beginModuleRename = (moduleItem) => {
		setEditingModuleId(moduleItem.id);
		setEditingModuleTitle(moduleItem.title || '');
	};

	const handleSaveModuleRename = async (moduleId, currentTitle) => {
		const nextTitle = editingModuleTitle.trim();
		setEditingModuleId(null);
		if (!nextTitle || nextTitle === (currentTitle || '').trim()) return;
		try {
			await adminService.updateModule(moduleId, { title: nextTitle });
			showToast('Titlul modulului salvat', 'success');
			await fetchStructure(true);
		} catch (e) {
			console.error('Update module title failed:', e);
			showToast('Eroare la salvarea titlului modulului', 'error');
		}
	};

	const flushInlineTestPayloadForId = useCallback(async (testId, options = {}) => {
		const { manageSavingState = true } = options;
		if (!testId) return;
		const payload = { ...inlinePendingTestRef.current };
		inlinePendingTestRef.current = {};
		if (!Object.keys(payload).length) return;
		if (manageSavingState) setInlineTestSaving(true);
		try {
			await adminService.updateTest(testId, payload);
		} catch (err) {
			console.error('Inline test autosave failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la salvarea testului.', 'error');
		} finally {
			if (manageSavingState) setInlineTestSaving(false);
		}
	}, [showToast]);

	const flushInlineTestSave = useCallback(async () => {
		await flushInlineTestPayloadForId(inlineTest.id, { manageSavingState: true });
	}, [flushInlineTestPayloadForId, inlineTest.id]);

	const saveInlineTestPatch = useCallback((patch) => {
		setInlineTest((prev) => ({ ...prev, ...patch }));
		if (!inlineTest.id) return;
		Object.assign(inlinePendingTestRef.current, patch);
		if (inlineTestSaveTimeoutRef.current) clearTimeout(inlineTestSaveTimeoutRef.current);
		inlineTestSaveTimeoutRef.current = setTimeout(() => {
			flushInlineTestSave();
		}, 650);
	}, [flushInlineTestSave, inlineTest.id]);

	const ensureInlineTestCreated = useCallback(async () => {
		if (inlineTest.id) return inlineTest.id;
		const title = (inlineTest.title || '').trim();
		if (!title) {
			showToast('Adaugă titlul testului.', 'error');
			return null;
		}
		setCreatingTest(true);
		try {
			const created = await adminService.createTest({
				title,
				description: inlineTest.description?.trim() || null,
				type: 'final',
				status: 'draft',
				passing_score: inlineTest.passing_score ?? INLINE_TEST_DEFAULT.passing_score,
				time_limit_minutes: inlineTest.time_limit_minutes ?? null,
				max_attempts: inlineTest.max_attempts ?? null,
				randomize_questions: Boolean(inlineTest.randomize_questions),
				randomize_answers: Boolean(inlineTest.randomize_answers),
				show_results_immediately: Boolean(inlineTest.show_results_immediately),
				show_correct_answers: Boolean(inlineTest.show_correct_answers),
				allow_review: Boolean(inlineTest.allow_review),
				requires_manual_verification: Boolean(inlineTest.requires_manual_verification),
			});
			const newTestId = Number(created?.test?.id ?? created?.id);
			if (!newTestId) throw new Error('ID test invalid');

			// API link-to-course cere mereu `scope`; înainte nu era trimis → 422, iar .catch ascundea eroarea.
			const targetModuleId = selectedModuleId || modules[0]?.id;
			if (targetModuleId) {
				const moduleTests = courseAttachedTests.filter(
					(row) => row.scope === 'module' && Number(row.scope_id) === Number(targetModuleId)
				);
				await adminService.builderAttachTest(courseId, {
					test_id: newTestId,
					scope: 'module',
					scope_id: targetModuleId,
					order: moduleTests.length,
				});
			} else {
				await adminService.linkTestToCourse(newTestId, courseId, {
					scope: 'course',
					order: 0,
				});
			}

			setInlineTest((prev) => ({ ...prev, id: newTestId }));
			await fetchAttachedTests();
			showToast('Test creat și asociat cursului.', 'success');
			return newTestId;
		} catch (err) {
			console.error('Create inline test failed:', err);
			const msg =
				err?.response?.data?.message
				|| err?.response?.data?.error
				|| (typeof err?.response?.data === 'string' ? err.response.data : null);
			showToast(msg || 'Eroare la crearea sau atașarea testului.', 'error');
			return null;
		} finally {
			setCreatingTest(false);
		}
	}, [
		courseAttachedTests,
		courseId,
		fetchAttachedTests,
		inlineTest.description,
		inlineTest.id,
		inlineTest.title,
		inlineTest.type,
		modules,
		selectedModuleId,
		showToast,
	]);

	const handleCreateTestInline = async (e) => {
		e.preventDefault();
		await ensureInlineTestCreated();
	};

	const loadInlineTestById = useCallback(async (testId) => {
		try {
			const testData = await adminService.getTest(testId);
			const questions = await adminService.getQuestions(testId).catch(() => []);
			setInlineTest((prev) => ({
				...prev,
				...testData,
				id: testData.id,
			}));
			const list = Array.isArray(questions) ? questions : [];
			setInlineQuestions(list.map(normalizeBuilderQuestion));
			setInlineTestTab('questions');
			setShowTestCreator(true);
		} catch (e) {
			console.error('Failed to load inline test:', e);
			showToast('Nu am putut încărca testul.', 'error');
		}
	}, [showToast]);

	const handleOpenCreateTestModal = () => {
		const fallbackModuleId = selectedModuleId || modules[0]?.id || null;
		setCreateTestModuleId(fallbackModuleId);
		setCreateTestTitle('');
		setShowCreateTestModal(true);
	};

	const handleCreateTestFromModal = async (e) => {
		e.preventDefault();
		const title = createTestTitle.trim();
		if (!title) {
			showToast('Adaugă titlul testului.', 'error');
			return;
		}
		setCreatingTest(true);
		try {
			const created = await adminService.createTest({
				title,
				status: 'draft',
				type: 'final',
				passing_score: INLINE_TEST_DEFAULT.passing_score,
				randomize_questions: INLINE_TEST_DEFAULT.randomize_questions,
				randomize_answers: INLINE_TEST_DEFAULT.randomize_answers,
				show_results_immediately: INLINE_TEST_DEFAULT.show_results_immediately,
				show_correct_answers: INLINE_TEST_DEFAULT.show_correct_answers,
				allow_review: INLINE_TEST_DEFAULT.allow_review,
				requires_manual_verification: INLINE_TEST_DEFAULT.requires_manual_verification,
			});
			const newTestId = Number(created?.test?.id ?? created?.id);
			if (!newTestId) throw new Error('ID test invalid');

			if (createTestModuleId) {
				const moduleTests = getModuleAttachedTests(createTestModuleId);
				await adminService.builderAttachTest(courseId, {
					test_id: newTestId,
					scope: 'module',
					scope_id: createTestModuleId,
					order: moduleTests.length,
				});
			} else {
				await adminService.builderAttachTest(courseId, {
					test_id: newTestId,
					scope: 'course',
					order: 0,
				});
			}

			await fetchAttachedTests();
			await loadInlineTestById(newTestId);
			setShowCreateTestModal(false);
			showToast('Test creat. Setările detaliate sunt în panoul adițional.', 'success');
		} catch (err) {
			console.error('Create test from modal failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la crearea testului.', 'error');
		} finally {
			setCreatingTest(false);
		}
	};

	const handleMoveModuleTest = async (moduleId, courseTestId, direction) => {
		const list = getModuleAttachedTests(moduleId);
		const currentIndex = list.findIndex((item) => Number(item.id) === Number(courseTestId));
		if (currentIndex === -1) return;
		const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		if (targetIndex < 0 || targetIndex >= list.length) return;

		const swapped = [...list];
		const temp = swapped[currentIndex];
		swapped[currentIndex] = swapped[targetIndex];
		swapped[targetIndex] = temp;

		setCourseAttachedTests((prev) => prev.map((row) => {
			const idx = swapped.findIndex((item) => Number(item.id) === Number(row.id));
			if (idx === -1) return row;
			return { ...row, order: idx };
		}));

		try {
			for (let i = 0; i < swapped.length; i += 1) {
				const row = swapped[i];
				await adminService.builderAttachTest(courseId, {
					test_id: row.test_id,
					scope: 'module',
					scope_id: moduleId,
					order: i,
					required: row.required,
					passing_score: row.passing_score,
				});
			}
			await fetchAttachedTests();
		} catch (err) {
			console.error('Reorder module tests failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la mutarea testului.', 'error');
			fetchAttachedTests();
		}
	};

	const handleReorderModuleTests = async (moduleId, sourceCourseTestId, targetCourseTestId) => {
		if (Number(sourceCourseTestId) === Number(targetCourseTestId)) return;
		const list = getModuleAttachedTests(moduleId);
		const sourceIndex = list.findIndex((item) => Number(item.id) === Number(sourceCourseTestId));
		const targetIndex = list.findIndex((item) => Number(item.id) === Number(targetCourseTestId));
		if (sourceIndex === -1 || targetIndex === -1) return;

		const reordered = [...list];
		const [moved] = reordered.splice(sourceIndex, 1);
		reordered.splice(targetIndex, 0, moved);

		setCourseAttachedTests((prev) => prev.map((row) => {
			const idx = reordered.findIndex((item) => Number(item.id) === Number(row.id));
			if (idx === -1) return row;
			return { ...row, order: idx };
		}));

		try {
			for (let i = 0; i < reordered.length; i += 1) {
				const row = reordered[i];
				await adminService.builderAttachTest(courseId, {
					test_id: row.test_id,
					scope: 'module',
					scope_id: moduleId,
					order: i,
					required: row.required,
					passing_score: row.passing_score,
				});
			}
			await fetchAttachedTests();
		} catch (err) {
			console.error('Drag reorder module tests failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la mutarea testului.', 'error');
			fetchAttachedTests();
		}
	};

	const handleAddInlineQuestion = async (type = 'multiple_choice') => {
		const testId = await ensureInlineTestCreated();
		if (!testId) return;
		setAddingQuestion(true);
		try {
			const created = await adminService.createQuestion(testId, {
				type,
				content: 'Întrebare nouă',
				answers: getDefaultAnswersByType(type),
				points: 1,
			});
			const question = created?.question ?? created;
			if (question) {
				setInlineQuestions((prev) => [...prev, normalizeBuilderQuestion(question)]);
				setExpandedQuestionId(question.id);
			}
		} catch (err) {
			console.error('Add inline question failed:', err);
			const apiMsg = err?.response?.data?.message
				|| err?.response?.data?.error
				|| err?.response?.data?.errors?.answers?.[0];
			showToast(apiMsg || 'Eroare la adăugarea întrebării.', 'error');
		} finally {
			setAddingQuestion(false);
		}
	};

	const queueInlineQuestionPatchSave = useCallback(async (questionId, patch, immediate = false) => {
		const qid = Number(questionId);
		if (!Number.isFinite(qid)) {
			console.warn('Inline question save: id invalid', questionId);
			return;
		}
		const existingPatch = inlineQuestionPendingRef.current[qid] || {};
		inlineQuestionPendingRef.current[qid] = { ...existingPatch, ...patch };
		if (inlineQuestionSaveTimersRef.current[qid]) {
			clearTimeout(inlineQuestionSaveTimersRef.current[qid]);
			delete inlineQuestionSaveTimersRef.current[qid];
		}

		const flush = async () => {
			const pendingPatch = inlineQuestionPendingRef.current[qid];
			if (!pendingPatch || Object.keys(pendingPatch).length === 0) return;
			const snapshot = { ...pendingPatch };
			if (Array.isArray(snapshot.answers)) {
				snapshot.answers = serializeAnswersForQuestionApi(snapshot.answers);
			}
			delete inlineQuestionPendingRef.current[qid];
			try {
				await adminService.updateQuestion(qid, snapshot);
			} catch (err) {
				const cur = inlineQuestionPendingRef.current[qid] || {};
				inlineQuestionPendingRef.current[qid] = { ...snapshot, ...cur };
				console.error('Inline question update failed:', err);
				const apiMessage = err?.response?.data?.message
					|| err?.response?.data?.error
					|| Object.values(err?.response?.data?.errors || {})?.[0]?.[0];
				showToast(apiMessage || 'Eroare la salvarea întrebării.', 'error');
			}
		};

		if (immediate) {
			await flush();
			return;
		}

		inlineQuestionSaveTimersRef.current[qid] = setTimeout(flush, 350);
	}, [showToast]);

	const flushAllInlineQuestionSaves = useCallback(async () => {
		Object.keys(inlineQuestionSaveTimersRef.current).forEach((qid) => {
			clearTimeout(inlineQuestionSaveTimersRef.current[qid]);
			delete inlineQuestionSaveTimersRef.current[qid];
		});
		for (let safety = 0; safety < 24; safety += 1) {
			const pendingIds = Object.keys(inlineQuestionPendingRef.current).filter((questionIdStr) => {
				const p = inlineQuestionPendingRef.current[Number(questionIdStr)];
				return p && Object.keys(p).length > 0;
			});
			if (pendingIds.length === 0) break;
			for (const questionIdStr of pendingIds) {
				const questionId = Number(questionIdStr);
				if (!Number.isFinite(questionId)) continue;
				const pendingPatch = inlineQuestionPendingRef.current[questionId];
				if (!pendingPatch || Object.keys(pendingPatch).length === 0) continue;
				const snapshot = { ...pendingPatch };
				if (Array.isArray(snapshot.answers)) {
					snapshot.answers = serializeAnswersForQuestionApi(snapshot.answers);
				}
				delete inlineQuestionPendingRef.current[questionId];
				try {
					await adminService.updateQuestion(questionId, snapshot);
				} catch (err) {
					const cur = inlineQuestionPendingRef.current[questionId] || {};
					inlineQuestionPendingRef.current[questionId] = { ...snapshot, ...cur };
					console.error('Inline question flush failed:', err);
					const apiMessage = err?.response?.data?.message
						|| err?.response?.data?.error
						|| Object.values(err?.response?.data?.errors || {})?.[0]?.[0];
					showToast(apiMessage || 'Eroare la salvarea întrebării.', 'error');
				}
			}
		}
	}, [showToast]);

	flushAllInlineQuestionSavesRef.current = flushAllInlineQuestionSaves;

	useEffect(() => () => {
		flushPendingLessonContentSave();
		flushAllInlineQuestionSavesRef.current();
	}, [flushPendingLessonContentSave]);

	const handleInlineQuestionBlur = async (questionId, patch) => {
		const qid = Number(questionId);
		if (!Number.isFinite(qid)) return;
		const payload = patch?.answers ? { ...patch, answers: serializeAnswersForQuestionApi(patch.answers) } : patch;
		try {
			await queueInlineQuestionPatchSave(qid, payload, true);
		} catch (err) {
			console.error('Inline question update failed:', err);
			const apiMessage = err?.response?.data?.message
				|| err?.response?.data?.error
				|| Object.values(err?.response?.data?.errors || {})?.[0]?.[0];
			showToast(apiMessage || 'Eroare la salvarea întrebării.', 'error');
		}
	};

	const handleDeleteInlineQuestion = async (questionId) => {
		try {
			await adminService.deleteQuestion(questionId);
			setInlineQuestions((prev) => prev.filter((q) => q.id !== questionId));
			showToast('Întrebare ștearsă.', 'success');
		} catch (err) {
			console.error('Delete inline question failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la ștergere.', 'error');
		}
	};

	const handleAddDefaultInlineQuestion = async () => {
		await handleAddInlineQuestion('short_answer');
	};

	const handleInlineQuestionTypeChange = async (questionId, nextType) => {
		const id = Number(questionId);
		const q = inlineQuestions.find((row) => Number(row.id) === id);
		if (!q) {
			setOpenQuestionTypePickerId(null);
			return;
		}
		if (q.type === nextType) {
			setOpenQuestionTypePickerId(null);
			return;
		}
		const nextAnswers = getDefaultAnswersByType(nextType);
		setInlineQuestions((prev) => prev.map((row) => (Number(row.id) === id ? {
			...row,
			type: nextType,
			answers: nextAnswers,
		} : row)));
		await queueInlineQuestionPatchSave(id, { type: nextType, answers: nextAnswers }, true);
		setOpenQuestionTypePickerId(null);
	};

	const handleToggleQuestionTypePicker = (questionId) => {
		setOpenQuestionTypePickerId((prev) => (prev === questionId ? null : questionId));
	};

	const updateInlineAnswers = (questionId, updater, persistMode = 'debounced') => {
		const qNum = Number(questionId);
		if (!Number.isFinite(qNum)) return;
		setInlineQuestions((prev) =>
			prev.map((q) => {
				if (Number(q.id) !== qNum) return q;
				const currentAnswers = Array.isArray(q.answers) ? q.answers : [];
				const nextAnswers = updater(currentAnswers);
				queueMicrotask(() => {
					if (persistMode === 'immediate') {
						void handleInlineQuestionBlur(qNum, { answers: nextAnswers });
					} else if (persistMode === 'debounced') {
						void queueInlineQuestionPatchSave(qNum, { answers: nextAnswers }, false);
					}
				});
				return { ...q, answers: nextAnswers };
			})
		);
	};

	const handleInlineAnswerTextChange = (questionId, answerIndex, text) => {
		updateInlineAnswers(questionId, (currentAnswers) => currentAnswers.map((ans, idx) => (idx === answerIndex ? { ...ans, text } : ans)), 'debounced');
	};

	const handleInlineAnswerCorrectToggle = (questionId, answerIndex, singleChoice = false) => {
		updateInlineAnswers(
			questionId,
			(currentAnswers) => currentAnswers.map((ans, idx) => ({
				...ans,
				is_correct: singleChoice ? idx === answerIndex : (idx === answerIndex ? !ans.is_correct : ans.is_correct),
			})),
			'debounced'
		);
	};

	const handleInlineAddAnswer = (questionId) => {
		updateInlineAnswers(questionId, (currentAnswers) => [...currentAnswers, { text: 'Răspuns nou', is_correct: false }], 'immediate');
	};

	const handleInlineRemoveAnswer = (questionId, answerIndex) => {
		updateInlineAnswers(questionId, (currentAnswers) => currentAnswers.filter((_, idx) => idx !== answerIndex), 'immediate');
	};

	const handleSaveInlineTestNow = async () => {
		const testId = await ensureInlineTestCreated();
		if (!testId) return;
		if (inlineTestSaveTimeoutRef.current) {
			clearTimeout(inlineTestSaveTimeoutRef.current);
			inlineTestSaveTimeoutRef.current = null;
		}
		setInlineTestSaving(true);
		try {
			await flushInlineTestPayloadForId(testId, { manageSavingState: false });
			await flushAllInlineQuestionSaves();
			showToast('Test salvat.', 'success');
		} catch (err) {
			console.error('Save inline test failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la salvare.', 'error');
		} finally {
			setInlineTestSaving(false);
		}
	};

	const handlePublishInlineTest = async () => {
		const testId = await ensureInlineTestCreated();
		if (!testId) return;
		if (!inlineQuestions.length && inlineTest.question_source === 'direct') {
			showToast('Adaugă cel puțin o întrebare înainte de publicare.', 'error');
			return;
		}
		if (inlineTestSaveTimeoutRef.current) {
			clearTimeout(inlineTestSaveTimeoutRef.current);
			inlineTestSaveTimeoutRef.current = null;
		}
		setInlinePublishLoading(true);
		try {
			await flushInlineTestPayloadForId(testId, { manageSavingState: false });
			await flushAllInlineQuestionSaves();
			await adminService.publishTest(testId);
			setInlineTest((prev) => ({ ...prev, status: 'published' }));
			showToast('Test publicat.', 'success');
			await fetchAttachedTests();
		} catch (err) {
			console.error('Publish inline test failed:', err);
			showToast(err?.response?.data?.message || 'Eroare la publicare.', 'error');
		} finally {
			setInlinePublishLoading(false);
		}
	};

	const handleCourseStatusAction = async (action) => {
		if (!course?.id || courseActionLoading) return;
		setCourseActionLoading(true);
		try {
			if (action === 'publish') {
				await adminService.updateCourse(course.id, { status: 'published' });
				showToast('Cursul a fost publicat cu succes', 'success');
			} else if (action === 'unpublish') {
				await adminService.updateCourse(course.id, { status: 'draft' });
				showToast('Cursul a fost retras din publicare', 'success');
			}
			await fetchStructure(true);
		} catch (e) {
			console.error('Course status action failed:', e);
			showToast(e?.response?.data?.message || 'Nu am putut actualiza statusul cursului.', 'error');
		} finally {
			setCourseActionLoading(false);
		}
	};	const getLessonContentFromPlanItem = (lessonItem) => {
		if (!lessonItem || typeof lessonItem !== 'object') {
			return '';
		}

		return String(lessonItem.content ?? lessonItem.body ?? lessonItem.html ?? '').trim();
	};

	const countLessonContentLines = (content) => {
		const text = String(content ?? '').trim();
		if (!text) return 0;

		const normalized = text
			.replace(/<br\s*\/?>(?![^<]*>)/gi, '\n')
			.replace(/<br\s*\/?/gi, '\n')
			.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
			.replace(/\r\n/g, '\n')
			.replace(/\r/g, '\n');
		const plain = normalized.replace(/<[^>]*>/g, ' ');
		return plain
			.split(/\n+/)
			.map((line) => line.trim())
			.filter(Boolean)
			.length;
	};

	const validateVoltPlanStructure = (plan) => {
		if (!plan || typeof plan !== 'object') {
			return { valid: false, message: 'Volt nu a returnat un plan valid.' };
		}

		const operations = Array.isArray(plan.operations) ? plan.operations : [];
		const courseUpdates = plan.course_updates && typeof plan.course_updates === 'object' ? plan.course_updates : null;
		if (!courseUpdates && operations.length === 0) {
			return { valid: false, message: 'Planul Volt nu con?ine schimbari aplicabile.' };
		}

		const lessonOperations = operations.filter((op) => {
			if (!op || typeof op !== 'object') return false;
			const opType = String(op.op || '').trim();
			return (
				opType === 'create_lesson' ||
				opType === 'createLesson' ||
				opType === 'update_lesson' ||
				opType === 'updateLesson'
			);
		});

		for (const lessonOp of lessonOperations) {
			const opType = String(lessonOp.op || '').trim();
			const content = getLessonContentFromPlanItem(lessonOp);
			const lineCount = countLessonContentLines(content);
			if (opType === 'create_lesson' || opType === 'createLesson') {
				if (!content || lineCount < 4) {
					return {
						valid: false,
						message: `Lec?ia "${lessonOp.title || 'fara titlu'}" nu are con?inut suficient.`,
					};
				}
			}

			if (opType === 'update_lesson' || opType === 'updateLesson') {
				if (content && lineCount < 4) {
					return {
						valid: false,
						message: `Lec?ia "${lessonOp.title || 'fara titlu'}" are con?inut prea scurt.`,
					};
				}
			}
		}

		const moduleOperations = operations.filter((op) => {
			if (!op || typeof op !== 'object') return false;
			const opType = String(op.op || '').trim();
			return (
				opType === 'create_module' ||
				opType === 'createModule' ||
				opType === 'update_module' ||
				opType === 'updateModule'
			);
		});

		if (moduleOperations.length > 0 && lessonOperations.length === 0) {
			return {
				valid: false,
				message: 'Planul Volt modifica module, dar nu include lec?ii. Refuzam aplicarea pana prime?te con?inut real.',
			};
		}

		return { valid: true, operations, courseUpdates };
	};

	const handleApplyVoltPlan = async (planPayload) => {
		const plan = planPayload?.plan ?? planPayload;
		const validation = validateVoltPlanStructure(plan);
		if (!validation.valid) {
			showToast(validation.message, 'error');
			return;
		}

		const { operations, courseUpdates } = validation;

		const allowedCourseKeys = [
			'title',
			'description',
			'short_description',
			'card_color',
			'level',
			'status',
			'visibility',
			'estimated_duration_hours',
			'sequential_unlock',
			'min_test_score',
			'has_certificate',
			'marketing_tags',
		];
		const filteredCourseUpdates = courseUpdates
			? Object.fromEntries(
				Object.entries(courseUpdates).filter(([key, value]) => allowedCourseKeys.includes(key) && value !== undefined)
			)
			: null;

		const applyLessonsForModule = async (courseIdValue, moduleIdValue, lessons = []) => {
			if (!Number.isFinite(Number(moduleIdValue)) || !Array.isArray(lessons) || lessons.length === 0) {
				return 0;
			}

			let createdCount = 0;
			for (const lessonItem of lessons) {
				if (!lessonItem || typeof lessonItem !== 'object') continue;
				const lessonContent = getLessonContentFromPlanItem(lessonItem);
				if (!lessonContent) {
					throw new Error(`Lec?ia "${lessonItem.title || 'fara titlu'}" nu are con?inut.`);
				}
				if (countLessonContentLines(lessonContent) < 4) {
					throw new Error(`Lec?ia "${lessonItem.title || 'fara titlu'}" are con?inut prea scurt.`);
				}
				await adminService.builderCreateLesson(courseIdValue, {
					module_id: Number(moduleIdValue),
					title: lessonItem.title || 'Lec?ie noua',
					content: lessonContent,
					status: lessonItem.status || 'draft',
					order: lessonItem.order ?? undefined,
					is_preview: lessonItem.is_preview ?? undefined,
				});
				createdCount += 1;
			}

			return createdCount;
		};

		setCourseActionLoading(true);
		try {
			if (filteredCourseUpdates && Object.keys(filteredCourseUpdates).length > 0) {
				await adminService.updateCourse(courseId, filteredCourseUpdates);
			}

			const structureOps = [];
			let appliedSteps = 0;

			for (const rawOp of operations) {
				if (!rawOp || typeof rawOp !== 'object') continue;
				const opType = String(rawOp.op || '').trim();

				if (opType === 'create_module' || opType === 'createModule') {
					const modulePayload = {
						title: rawOp.title || 'Modul nou',
						description: rawOp.description || '',
						status: rawOp.status || 'draft',
						order: rawOp.order ?? undefined,
					};
					const createdModuleResponse = await adminService.builderCreateModule(courseId, modulePayload);
					const createdModule = createdModuleResponse?.module
						|| createdModuleResponse?.data?.module
						|| createdModuleResponse?.data
						|| createdModuleResponse;
					const createdModuleId = Number(createdModule?.id || createdModule?.module_id || createdModuleResponse?.id);
					appliedSteps++;

					if (Number.isFinite(createdModuleId) && Array.isArray(rawOp.lessons)) {
						for (const lessonItem of rawOp.lessons) {
							if (!lessonItem || typeof lessonItem !== 'object') continue;
							const lessonContent = getLessonContentFromPlanItem(lessonItem);
							if (!lessonContent) {
								throw new Error(`Lec?ia "${lessonItem.title || 'fara titlu'}" nu are con?inut.`);
							}
							if (countLessonContentLines(lessonContent) < 4) {
								throw new Error(`Lec?ia "${lessonItem.title || 'fara titlu'}" are con?inut prea scurt.`);
							}
							await adminService.builderCreateLesson(courseId, {
								module_id: createdModuleId,
								title: lessonItem.title || 'Lec?ie noua',
								content: lessonContent,
								status: lessonItem.status || 'draft',
								order: lessonItem.order ?? undefined,
								is_preview: lessonItem.is_preview ?? undefined,
							});
							appliedSteps++;
						}
					}
					continue;
				}

				if (opType === 'update_module' || opType === 'updateModule') {
					if (!rawOp.module_id) continue;
					const payload = {};
					if (rawOp.title !== undefined) payload.title = rawOp.title;
					if (rawOp.description !== undefined) payload.description = rawOp.description;
					if (rawOp.status !== undefined) payload.status = rawOp.status;
					if (rawOp.order !== undefined) payload.order = rawOp.order;
					if (Object.keys(payload).length > 0) {
						await adminService.updateModule(rawOp.module_id, payload);
						appliedSteps++;
					}
					if (Array.isArray(rawOp.lessons) && rawOp.lessons.length > 0) {
						appliedSteps += await applyLessonsForModule(courseId, rawOp.module_id, rawOp.lessons);
					}
					continue;
				}

				if (opType === 'delete_module' || opType === 'deleteModule') {
					if (!rawOp.module_id) continue;
					await adminService.deleteModule(rawOp.module_id);
					appliedSteps++;
					continue;
				}

				if (opType === 'create_lesson' || opType === 'createLesson') {
					const payload = {
						module_id: rawOp.module_id ?? null,
						title: rawOp.title || 'Lec?ie noua',
						content: getLessonContentFromPlanItem(rawOp),
						status: rawOp.status || 'draft',
						order: rawOp.order ?? undefined,
						is_preview: rawOp.is_preview ?? undefined,
					};
					if (!payload.content) {
						throw new Error(`Lec?ia "${payload.title}" nu are con?inut.`);
					}
					if (countLessonContentLines(payload.content) < 4) {
						throw new Error(`Lec?ia "${payload.title}" are con?inut prea scurt.`);
					}
					await adminService.builderCreateLesson(courseId, payload);
					appliedSteps++;
					continue;
				}

				if (opType === 'update_lesson' || opType === 'updateLesson') {
					if (!rawOp.lesson_id) continue;
					const payload = {};
					if (rawOp.title !== undefined) payload.title = rawOp.title;
					if (rawOp.content !== undefined || rawOp.body !== undefined || rawOp.html !== undefined) {
						payload.content = getLessonContentFromPlanItem(rawOp);
					}
					if (rawOp.status !== undefined) payload.status = rawOp.status;
					if (rawOp.is_preview !== undefined) payload.is_preview = rawOp.is_preview;
					if (rawOp.order !== undefined) payload.order = rawOp.order;
					if (payload.content === '') {
						throw new Error(`Lec?ia "${rawOp.title || 'fara titlu'}" nu are con?inut.`);
					}
					if (countLessonContentLines(payload.content) < 4) {
						throw new Error(`Lec?ia "${rawOp.title || 'fara titlu'}" are con?inut prea scurt.`);
					}
					if (Object.keys(payload).length > 0) {
						await adminService.builderUpdateLesson(courseId, rawOp.lesson_id, payload);
						appliedSteps++;
					}
					continue;
				}

				if (opType === 'delete_lesson' || opType === 'deleteLesson') {
					if (!rawOp.lesson_id) continue;
					await adminService.deleteLesson(rawOp.lesson_id);
					appliedSteps++;
					continue;
				}

				if (opType === 'reorderModules' || opType === 'reorder_modules') {
					if (Array.isArray(rawOp.module_ids) && rawOp.module_ids.length > 0) {
						structureOps.push({ op: 'reorderModules', module_ids: rawOp.module_ids });
					}
					continue;
				}

				if (opType === 'reorderLessons' || opType === 'reorder_lessons') {
					if (rawOp.module_id && Array.isArray(rawOp.lesson_ids) && rawOp.lesson_ids.length > 0) {
						structureOps.push({
							op: 'reorderLessons',
							module_id: rawOp.module_id,
							lesson_ids: rawOp.lesson_ids,
						});
					}
					continue;
				}

				if (opType === 'moveLesson' || opType === 'move_lesson') {
					if (rawOp.lesson_id && rawOp.to_module_id) {
						structureOps.push({
							op: 'moveLesson',
							lesson_id: rawOp.lesson_id,
							to_module_id: rawOp.to_module_id,
							to_index: rawOp.to_index ?? 0,
						});
					}
				}
			}

			if (structureOps.length > 0) {
				await adminService.patchCourseBuilderStructure(courseId, structureOps);
				appliedSteps += structureOps.length;
			}

			await fetchStructure(true);
			setShowVoltAssistant(false);
			showToast(`Volt a aplicat ${appliedSteps} schimbari in builder.`, 'success');
		} catch (e) {
			console.error('Volt plan apply failed:', e);
			showToast(e?.message || e?.response?.data?.message || 'Nu am putut aplica planul Volt.', 'error');
		} finally {
			setCourseActionLoading(false);
		}
	};

	const handleLessonStatusToggle = async (lessonId, nextStatus) => {
		try {
			await adminService.builderUpdateLesson(courseId, lessonId, { status: nextStatus });
			await fetchStructure(true);
			showToast(nextStatus === 'published' ? 'Lectia a fost publicata.' : 'Lectia a fost retrasa din publicare.', 'success');
		} catch (e) {
			console.error('Lesson status toggle failed:', e);
			showToast(e?.response?.data?.message || 'Nu am putut actualiza statusul lectiei.', 'error');
		}
	};

	const handleDeleteCourse = async () => {
		if (!course?.id) return;
		if (!window.confirm(`Stergi definitiv cursul "${course.title || 'fara titlu'}"?`)) return;
		setCourseActionLoading(true);
		try {
			await adminService.deleteCourse(course.id);
			showToast('Cursul a fost sters.', 'success');
			navigate('/admin/courses');
		} catch (e) {
			console.error('Delete course failed:', e);
			showToast(e?.response?.data?.message || 'Nu am putut sterge cursul.', 'error');
			setCourseActionLoading(false);
		}
	};

	const handleDeleteModule = async (moduleItem) => {
		if (!moduleItem?.id) return;
		if (!window.confirm(`Stergi modulul "${moduleItem.title || 'fara titlu'}" si toate lecsiile lui?`)) return;
		try {
			await adminService.deleteModule(moduleItem.id);
			await fetchStructure(true);
			showToast('Modulul a fost sters.', 'success');
		} catch (e) {
			console.error('Delete module failed:', e);
			showToast(e?.response?.data?.message || 'Nu am putut sterge modulul.', 'error');
		}
	};

	const handleDeleteLesson = async (lessonItem) => {
		if (!lessonItem?.id) return;
		if (!window.confirm(`Stergi lecsia "${lessonItem.title || 'fara titlu'}"?`)) return;
		try {
			await adminService.deleteLesson(lessonItem.id);
			await fetchStructure(true);
			showToast('Lectia a fost stearsa.', 'success');
		} catch (e) {
			console.error('Delete lesson failed:', e);
			showToast(e?.response?.data?.message || 'Nu am putut sterge lectia.', 'error');
		}
	};

	const handleDeleteTestFromBuilder = async (testId) => {
		if (!testId) return;
		if (!window.confirm('Stergi definitiv acest test din creatorul de curs?')) return;
		try {
			await adminService.deleteTest(testId);
			await fetchAttachedTests();
			if (Number(inlineTest.id) === Number(testId)) {
				setShowTestCreator(false);
				setInlineTest({ ...INLINE_TEST_DEFAULT });
				setInlineQuestions([]);
			}
			showToast('Testul a fost ?ters.', 'success');
		} catch (e) {
			console.error('Delete test failed:', e);
			showToast(e?.response?.data?.message || 'Nu am putut Sterge testul.', 'error');
		}
	};

	const handleOpenCourseEdit = () => {
		const tags = Array.isArray(course?.marketing_tags) ? course.marketing_tags : [];
		const colorTag = tags.find((tag) => String(tag).startsWith('card_color:'));
		const courseSettings = course?.settings || {};
		const certificateSettings = courseSettings?.certificate || {};
		const accessSettings = courseSettings?.access || {};
		const currentVisibility = course?.visibility || courseSettings?.visibility || 'public';
		const currentLevel = course?.level || 'beginner';
		const currentStatus = course?.status || 'draft';
		const currentDuration = course?.estimated_duration_hours ?? '';
		setCourseEditDraft({
			title: course?.title || '',
			description: course?.description || '',
			short_description: course?.short_description || '',
			card_color: course?.card_color || (colorTag ? String(colorTag).replace('card_color:', '') : '#5b72ff'),
			level: currentLevel,
			status: currentStatus,
			visibility: currentVisibility,
			estimated_duration_hours: currentDuration,
			sequential_unlock: course?.sequential_unlock !== false,
			min_test_score: course?.min_test_score ?? certificateSettings?.min_score ?? 70,
			has_certificate: course?.has_certificate === true || certificateSettings?.enabled === true,
			access_type: accessSettings?.type || course?.access_type || 'free',
			enrollment_type: accessSettings?.enrollment_type || course?.enrollment_type || 'open',
		});
		setCourseEditImageFile(null);
		setShowCourseEditModal(true);
	};

	const handleSaveCourseEdit = async () => {
		if (!course?.id || courseEditSaving) return;
		if (!courseEditDraft.title?.trim()) {
			showToast('Titlul cursului este obligatoriu.', 'error');
			return;
		}

		setCourseEditSaving(true);
		try {
			const payload = new FormData();
			payload.append('title', courseEditDraft.title.trim());
			payload.append('description', courseEditDraft.description || '');
			payload.append('short_description', courseEditDraft.short_description || '');
			payload.append('card_color', courseEditDraft.card_color || '#5b72ff');
			payload.append('level', courseEditDraft.level || 'beginner');
			payload.append('status', courseEditDraft.status || 'draft');
			payload.append('visibility', courseEditDraft.visibility || 'public');
			payload.append('sequential_unlock', courseEditDraft.sequential_unlock !== false ? '1' : '0');
			payload.append('min_test_score', String(courseEditDraft.min_test_score ?? 70));
			payload.append('has_certificate', courseEditDraft.has_certificate ? '1' : '0');
			if (courseEditDraft.estimated_duration_hours !== '' && courseEditDraft.estimated_duration_hours != null) {
				payload.append('estimated_duration_hours', String(courseEditDraft.estimated_duration_hours));
			}
			payload.append('access_type', courseEditDraft.access_type || 'free');
			payload.append('enrollment_type', courseEditDraft.enrollment_type || 'open');

			const existingTags = Array.isArray(course?.marketing_tags) ? [...course.marketing_tags] : [];
			const nonColorTags = existingTags.filter((tag) => !String(tag).startsWith('card_color:'));
			const nextTags = [...nonColorTags, `card_color:${courseEditDraft.card_color || '#5b72ff'}`];
			nextTags.forEach((tag, index) => payload.append(`marketing_tags[${index}]`, String(tag)));

			if (courseEditImageFile) {
				payload.append('image', courseEditImageFile);
			}

			await adminService.updateCourse(course.id, payload);
			await fetchStructure(true);
			setShowCourseEditModal(false);
			showToast('Datele cursului au fost actualizate.', 'success');
		} catch (err) {
			console.error('Course edit save failed:', err);
			showToast(err?.response?.data?.message || 'Nu am putut salva datele cursului.', 'error');
		} finally {
			setCourseEditSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
					<p>Se încarcă builder-ul...</p>
				</div>
			</div>
		);
	}

	if (error || !structure) {
		return (
			<div className="admin-container">
				<div className="lms-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error || 'Nu s-a putut încărca builder-ul.'}</p>
					<button className="lms-btn-primary" onClick={() => fetchStructure()}>
						Reîncearcă
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`admin-container admin-course-builder-page ${
				builderSidebarVisible ? 'has-detached-sidebar' : 'is-detached-sidebar-hidden'
			} ${
				openQuestionTypePickerId ? 'has-right-panel-expanded' : ''
			}`}
		>
			<div className="admin-course-builder-layout admin-course-builder-layout-clean">
				<aside
					className={`admin-course-builder-sidebar admin-course-builder-sidebar-clean admin-course-builder-sidebar-detached ${
						builderSidebarVisible ? 'is-visible' : 'is-hidden'
					}`}
				>
					<div className="admin-course-builder-sidebar-header">
						<div className="admin-course-builder-sidebar-header-top">
							<div className="admin-course-builder-sidebar-course-head">
								<button
									type="button"
									className="admin-course-builder-back"
									onClick={() => navigate('/admin/content?tab=courses')}
								>
									← Cursuri
								</button>
								<p className="admin-course-builder-sidebar-course-title">{course?.title || 'Builder curs'}</p>
							</div>
							<div className="admin-course-builder-sidebar-header-actions">
								<div className="admin-course-builder-quick-add-wrap" ref={quickAddRef}>
									<button
										type="button"
										className="admin-course-builder-quick-add-btn"
										onClick={() => setQuickAddMenuOpen((open) => !open)}
										aria-expanded={quickAddMenuOpen}
										aria-haspopup="true"
										title="Creează modul, lecție sau test"
									>
										<span className="admin-course-builder-icon-wrap" aria-hidden="true">
											<svg viewBox="0 0 24 24" aria-hidden="true">
												<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
											</svg>
										</span>
									</button>
									{quickAddMenuOpen && (
										<div className="admin-course-builder-quick-add-menu">
											<button
												type="button"
												onClick={() => {
													setQuickCreateModuleOpen(true);
													setQuickAddMenuOpen(false);
												}}
											>
												Mapă nouă
											</button>
											<button
												type="button"
												onClick={() => {
													setQuickAddMenuOpen(false);
													handleQuickCreateLesson();
												}}
											>
												Lecție nouă
											</button>
											<button
												type="button"
												onClick={() => {
													setQuickAddMenuOpen(false);
													handleQuickCreateLesson(null);
												}}
											>
												LecИ›ie fДѓrДѓ modul
											</button>
											<button
												type="button"
												onClick={() => {
													setQuickAddMenuOpen(false);
													handleOpenCreateTestModal();
												}}
											>
												Test nou
											</button>
										</div>
									)}
								</div>
								<button
									type="button"
									className="admin-course-builder-sidebar-toggle"
									onClick={() => setBuilderSidebarVisible(false)}
									aria-label="Ascunde meniul builder"
									title="Ascunde meniul builder"
								>
									<span className="admin-course-builder-icon-wrap" aria-hidden="true">
										<svg viewBox="0 0 24 24" aria-hidden="true">
											<path d="M15 7l-4 5 4 5M19 7l-4 5 4 5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									</span>
								</button>
							</div>
						</div>
						{quickCreateModuleOpen && (
							<div className="admin-course-builder-quick-module-create">
								<input
									type="text"
									className="admin-course-builder-quick-module-input"
									placeholder="Scrie titlu mapă + Enter"
									value={quickModuleTitle}
									onChange={(e) => setQuickModuleTitle(e.target.value)}
									disabled={quickModuleLoading}
									autoFocus
									onBlur={handleQuickModuleInputBlur}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											handleQuickCreateModule();
										}
										if (e.key === 'Escape') {
											setQuickCreateModuleOpen(false);
											setQuickModuleTitle('');
										}
									}}
								/>
							</div>
						)}
					</div>

					<div className="admin-course-builder-sidebar-nav">
						{getCourseLevelAttachedTests().length > 0 && (
							<div className="admin-course-builder-sidebar-course-tests-block">
								<p className="admin-course-builder-sidebar-course-tests-label">Teste la nivel de curs</p>
								<ul className="admin-course-builder-sidebar-tests">
									{getCourseLevelAttachedTests().map((courseTestItem) => (
										<li key={courseTestItem.id} className="admin-course-builder-sidebar-course-test-row">
											<button
												type="button"
												className={`admin-course-builder-sidebar-test-main admin-course-builder-sidebar-test-main-full ${showTestCreator && inlineTest.id === courseTestItem.test_id ? 'is-selected' : ''}`}
												onClick={() => loadInlineTestById(courseTestItem.test_id)}
											>
												<span className="admin-course-builder-sidebar-test-tag">Test</span>
												<span className="admin-course-builder-sidebar-test-title">
													{courseTestItem?.test?.title || `Test #${courseTestItem.test_id}`}
												</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						)}
						{rootLessons.length > 0 && (
							<div className="admin-course-builder-sidebar-course-tests-block">
								<p className="admin-course-builder-sidebar-course-tests-label">Lectii fara modul</p>
								<ul className="admin-course-builder-sidebar-lessons">
									{rootLessons.map((lessonItem, lessonIndex) => (
										<li key={lessonItem.id} className="admin-course-builder-sidebar-lesson-with-tests">
											<div className="admin-course-builder-sidebar-lesson-row">
												<button
													type="button"
													className={`admin-course-builder-sidebar-lesson ${selectedLessonId === lessonItem.id ? 'is-selected' : ''}`}
													onClick={async () => {
														await flushPendingLessonContentSave();
														await flushAllInlineQuestionSavesRef.current();
														setSelectedModuleId(null);
														setSelectedLessonId(lessonItem.id);
														setShowTestCreator(false);
													}}
												>
													<span className="admin-course-builder-sidebar-lesson-num">{lessonIndex + 1}</span>
													<span className="admin-course-builder-sidebar-lesson-title">{lessonItem.title || `Lectie ${lessonIndex + 1}`}</span>
												</button>
												<button
													type="button"
													className={`admin-course-builder-sidebar-lesson-icon-btn ${lessonItem.status === 'published' ? 'is-hide' : 'is-publish'}`}
													onClick={() => handleLessonStatusToggle(lessonItem.id, lessonItem.status === 'published' ? 'draft' : 'published')}
													title={lessonItem.status === 'published' ? 'Scoate din publicare lectia' : 'Publica lectia'}
													aria-label={lessonItem.status === 'published' ? 'Scoate din publicare lectia' : 'Publica lectia'}
												>
													{lessonItem.status === 'published' ? (
														<EyeOff aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#2563eb" />
													) : (
														<Eye aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#2563eb" />
													)}
												</button>
												<button
													type="button"
													className="admin-course-builder-sidebar-lesson-icon-btn is-danger is-delete"
													onClick={() => handleDeleteLesson(lessonItem)}
													title="Sterge lectia"
													aria-label="Sterge lectia"
												>
													<Trash2 aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#dc2626" />
												</button>
											</div>
										</li>
									))}
								</ul>
							</div>
						)}
						{modules.length === 0 && rootLessons.length === 0 ? (
							<div className="admin-course-builder-sidebar-empty-state">
								<p className="admin-course-builder-sidebar-empty">Începe prin a crea un modul.</p>
							</div>
						) : (
							<ul className="admin-course-builder-sidebar-list">
								{modules.map((moduleItem, moduleIndex) => (
									<li key={moduleItem.id} className="admin-course-builder-sidebar-module">
										<div className="admin-course-builder-sidebar-module-head">
											<span className="admin-course-builder-sidebar-module-num">{moduleIndex + 1}.</span>
											{editingModuleId === moduleItem.id ? (
												<input
													type="text"
													className="admin-course-builder-sidebar-module-input"
													value={editingModuleTitle}
													autoFocus
													onChange={(e) => setEditingModuleTitle(e.target.value)}
													onBlur={() => handleSaveModuleRename(moduleItem.id, moduleItem.title)}
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															handleSaveModuleRename(moduleItem.id, moduleItem.title);
														}
														if (e.key === 'Escape') {
															setEditingModuleId(null);
															setEditingModuleTitle('');
														}
													}}
												/>
											) : (
												<>
													<button
														type="button"
														className={`admin-course-builder-sidebar-module-title admin-course-builder-sidebar-link ${
															selectedModuleId === moduleItem.id ? 'is-active' : ''
														}`}
														onClick={async () => {
															await flushAllInlineQuestionSavesRef.current();
															setSelectedModuleId(moduleItem.id);
															setShowTestCreator(false);
														}}
														onDoubleClick={() => beginModuleRename(moduleItem)}
														title="Dublu-click pentru a modifica denumirea modulului"
													>
														{moduleItem.title || `Modul ${moduleIndex + 1}`}
													</button>
													<button
														type="button"
														className="admin-course-builder-sidebar-lesson-icon-btn is-danger is-delete"
														onClick={() => handleDeleteModule(moduleItem)}
														title="Sterge modul"
														aria-label="Sterge modul"
													>
														<Trash2 aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#dc2626" />
													</button>
												</>
											)}
										</div>
										<ul className="admin-course-builder-sidebar-lessons">
											{(moduleItem.lessons || []).map((lessonItem, lessonIndex) => {
												const rowDropClass =
													lessonDropHint?.moduleId === moduleItem.id &&
													lessonDropHint?.lessonId === lessonItem.id &&
													lessonDropHint?.position === 'before'
														? 'is-lesson-drop-before'
														: lessonDropHint?.moduleId === moduleItem.id &&
															lessonDropHint?.lessonId === lessonItem.id &&
															lessonDropHint?.position === 'after'
															? 'is-lesson-drop-after'
															: '';
												return (
												<li key={lessonItem.id} className="admin-course-builder-sidebar-lesson-with-tests">
													<div
														className={`admin-course-builder-sidebar-lesson-row ${rowDropClass}`}
														onDragOver={(e) => handleLessonDragOverRow(e, moduleItem, lessonItem)}
														onDrop={(e) => handleLessonDropOnLesson(e, moduleItem, lessonItem)}
													>
														{canMutateInAdminArea ? (
															<span
																className="admin-course-builder-sidebar-lesson-drag-handle"
																draggable
																onDragStart={(e) => handleLessonDragStart(e, lessonItem, moduleItem.id)}
																onDragEnd={handleLessonDragEnd}
																title="Trage pentru a muta lecția în alt modul sau poziție"
																aria-label="Trage lecția pentru mutare"
																role="button"
																tabIndex={0}
																onKeyDown={(e) => {
																	if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
																}}
															>
																⋮⋮
															</span>
														) : null}
														<button
															type="button"
															className={`admin-course-builder-sidebar-lesson ${selectedLessonId === lessonItem.id ? 'is-selected' : ''}`}
															onClick={async () => {
																await flushPendingLessonContentSave();
																await flushAllInlineQuestionSavesRef.current();
																setSelectedModuleId(moduleItem.id);
																setSelectedLessonId(lessonItem.id);
																setShowTestCreator(false);
															}}
														>
															<span className="admin-course-builder-sidebar-lesson-num">{lessonIndex + 1}</span>
															<span className="admin-course-builder-sidebar-lesson-title">{lessonItem.title || `Lecție ${lessonIndex + 1}`}</span>
														</button>
														<button
															type="button"
															className={`admin-course-builder-sidebar-lesson-icon-btn ${lessonItem.status === 'published' ? 'is-hide' : 'is-publish'}`}
															onClick={() => handleLessonStatusToggle(lessonItem.id, lessonItem.status === 'published' ? 'draft' : 'published')}
															title={lessonItem.status === 'published' ? 'Scoate din publicare lectia' : 'Publica lectia'}
															aria-label={lessonItem.status === 'published' ? 'Scoate din publicare lectia' : 'Publica lectia'}
														>
															{lessonItem.status === 'published' ? (
																<EyeOff aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#2563eb" />
															) : (
																<Eye aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#2563eb" />
															)}
														</button>
														<button
															type="button"
															className="admin-course-builder-sidebar-lesson-icon-btn is-danger is-delete"
															onClick={() => handleDeleteLesson(lessonItem)}
															title="Sterge lectia"
															aria-label="Sterge lectia"
														>
															<Trash2 aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#dc2626" />
														</button>
													</div>
													{getLessonAttachedTests(lessonItem.id).length > 0 && (
														<ul className="admin-course-builder-sidebar-lesson-tests">
															{getLessonAttachedTests(lessonItem.id).map((courseTestItem) => (
																<li key={courseTestItem.id} className="admin-course-builder-sidebar-course-test-row">
																	<button
																		type="button"
																		className={`admin-course-builder-sidebar-test-main admin-course-builder-sidebar-test-main-full ${showTestCreator && inlineTest.id === courseTestItem.test_id ? 'is-selected' : ''}`}
																		onClick={() => loadInlineTestById(courseTestItem.test_id)}
																	>
																		<span className="admin-course-builder-sidebar-test-tag">Test</span>
																		<span className="admin-course-builder-sidebar-test-title">
																			{courseTestItem?.test?.title || `Test #${courseTestItem.test_id}`}
																		</span>
																	</button>
																</li>
															))}
														</ul>
													)}
												</li>
												);
											})}
											{canMutateInAdminArea ? (
												<li
													className={`admin-course-builder-sidebar-lesson-drop-end ${
														lessonDropHint?.moduleId === moduleItem.id && lessonDropHint?.zone === 'end' ? 'is-active' : ''
													}`}
													onDragOver={(e) => handleLessonDragOverModuleEnd(e, moduleItem)}
													onDrop={(e) => handleLessonDropAtModuleEnd(e, moduleItem)}
												>
													<span className="admin-course-builder-sidebar-lesson-drop-end-label">Eliberă aici — la finalul modulului</span>
												</li>
											) : null}
										</ul>
										{getModuleAttachedTests(moduleItem.id).length > 0 && (
											<ul className="admin-course-builder-sidebar-tests">
												{getModuleAttachedTests(moduleItem.id).map((courseTestItem) => (
													<li key={courseTestItem.id}>
														<div
															className={`admin-course-builder-sidebar-test ${showTestCreator && inlineTest.id === courseTestItem.test_id ? 'is-selected' : ''} ${draggingSidebarTestId === courseTestItem.id ? 'is-dragging' : ''} ${
																sidebarDropHint.moduleId === moduleItem.id && sidebarDropHint.targetId === courseTestItem.id
																	? (sidebarDropHint.position === 'before' ? 'is-drop-before' : 'is-drop-after')
																	: ''
															}`}
															draggable
															onDragStart={(e) => {
																setDraggingSidebarTestId(courseTestItem.id);
																e.dataTransfer.effectAllowed = 'move';
																e.dataTransfer.setData('text/plain', String(courseTestItem.id));
															}}
															onDragEnd={() => {
																setDraggingSidebarTestId(null);
																setSidebarDropHint({ moduleId: null, targetId: null, position: null });
															}}
															onDragOver={(e) => {
																e.preventDefault();
																const rect = e.currentTarget.getBoundingClientRect();
																const position = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
																setSidebarDropHint({ moduleId: moduleItem.id, targetId: courseTestItem.id, position });
															}}
															onDragLeave={() => {
																if (sidebarDropHint.moduleId === moduleItem.id && sidebarDropHint.targetId === courseTestItem.id) {
																	setSidebarDropHint({ moduleId: null, targetId: null, position: null });
																}
															}}
															onDrop={(e) => {
																e.preventDefault();
																const sourceId = e.dataTransfer.getData('text/plain');
																if (!sourceId) return;
																const list = getModuleAttachedTests(moduleItem.id);
																const sourceIndex = list.findIndex((item) => Number(item.id) === Number(sourceId));
																const targetIndexRaw = list.findIndex((item) => Number(item.id) === Number(courseTestItem.id));
																if (sourceIndex === -1 || targetIndexRaw === -1) return;
																const insertAfter = sidebarDropHint.moduleId === moduleItem.id
																	&& sidebarDropHint.targetId === courseTestItem.id
																	&& sidebarDropHint.position === 'after';
																const targetIndex = insertAfter ? Math.min(targetIndexRaw + 1, list.length - 1) : targetIndexRaw;
																const targetId = list[targetIndex]?.id ?? courseTestItem.id;
																handleReorderModuleTests(moduleItem.id, Number(sourceId), Number(targetId));
																setSidebarDropHint({ moduleId: null, targetId: null, position: null });
															}}
														>
															<button
																type="button"
																className="admin-course-builder-sidebar-test-main"
																onClick={() => loadInlineTestById(courseTestItem.test_id)}
															>
																<span className="admin-course-builder-sidebar-test-tag">Test</span>
																<span className="admin-course-builder-sidebar-test-title">
																	{courseTestItem?.test?.title || `Test #${courseTestItem.test_id}`}
																</span>
															</button>
														</div>
													</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						)}
					</div>

					<div className="admin-course-builder-sidebar-footer">
						<div className="admin-course-builder-actions admin-course-builder-actions-in-sidebar">
							<button
								type="button"
								className="admin-btn admin-btn-secondary"
								onClick={handleOpenCourseEdit}
								disabled={courseActionLoading}
							>
								Editează curs
							</button>
							<span className={`admin-course-builder-course-status-badge is-${String(course?.status || 'draft')}`}>
								{course?.status === 'published' ? 'Publicat' : 'Ciornă'}
							</span>
							{course?.status !== 'published' && (
								<button
									type="button"
									className="admin-btn admin-btn-primary"
									onClick={() => handleCourseStatusAction('publish')}
									disabled={courseActionLoading}
								>
									{courseActionLoading ? 'Se procesează...' : 'Publică'}
								</button>
							)}
							{course?.status === 'published' && (
								<button
									type="button"
									className="admin-btn admin-btn-secondary"
									onClick={() => handleCourseStatusAction('unpublish')}
									disabled={courseActionLoading}
								>
									{courseActionLoading ? 'Se procesează...' : 'Retrage'}
								</button>
							)}
							<button
								type="button"
								className="admin-course-builder-sidebar-lesson-icon-btn is-danger is-delete"
								onClick={handleDeleteCourse}
								disabled={courseActionLoading}
								title="Sterge curs"
								aria-label="Sterge curs"
							>
								<Trash2 aria-hidden="true" size={17} strokeWidth={2.2} absoluteStrokeWidth color="#dc2626" />
							</button>
<AutoSaveIndicator status={lessonSaveStatus} />
						</div>
					</div>
				</aside>
				{!builderSidebarVisible && (
					<button
						type="button"
						className="admin-course-builder-sidebar-show-btn"
						onClick={() => setBuilderSidebarVisible(true)}
						aria-label="Afișează meniul builder"
						title="Afișează meniul builder"
					>
						<span className="admin-course-builder-icon-wrap" aria-hidden="true">
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M9 7l4 5-4 5M5 7l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						</span>
					</button>
				)}

				<div className="admin-course-builder-workspace admin-course-builder-workspace-clean">
					<div className="admin-course-builder-workspace-content">
						{showTestCreator ? (
							<div className="admin-course-builder-test-creator admin-course-builder-test-shell">
								<div className="admin-course-builder-test-overview-card">
									<div className="admin-course-builder-test-shell-header">
										<div>
											<h2>{(inlineTest.title || '').trim() || 'Test'}</h2>
											<p>Configurezi testul fără să părăsești pagina de creare curs.</p>
											<p className="admin-course-builder-test-status-line">
												<span
													className={`admin-course-builder-test-status-pill ${inlineTest.status === 'published' ? 'is-published' : 'is-draft'}`}
												>
													{inlineTest.status === 'published' ? 'Publicat' : 'Ciornă'}
												</span>
											</p>
										</div>
										{canMutateInAdminArea ? (
											<div className="admin-course-builder-test-shell-actions">
												<button
													type="button"
													className="admin-btn admin-btn-secondary"
													onClick={handleSaveInlineTestNow}
													disabled={creatingTest || inlineTestSaving || inlinePublishLoading}
												>
													{inlineTestSaving ? 'Se salvează…' : 'Salvează'}
												</button>
												{inlineTest.status !== 'published' ? (
													<button
														type="button"
														className="admin-btn admin-btn-primary"
														onClick={handlePublishInlineTest}
														disabled={creatingTest || inlineTestSaving || inlinePublishLoading}
													>
														{inlinePublishLoading ? 'Se publică…' : 'Publică'}
													</button>
												) : null}
											</div>
										) : null}
									</div>

									<div className="admin-course-builder-test-tabs">
										<button type="button" className={`admin-course-builder-test-tab ${inlineTestTab === 'questions' ? 'is-active' : ''}`} onClick={() => setInlineTestTab('questions')}>Întrebări</button>
										<button type="button" className={`admin-course-builder-test-tab ${inlineTestTab === 'settings' ? 'is-active' : ''}`} onClick={() => setInlineTestTab('settings')}>Setări</button>
									</div>
								</div>

								<div className="admin-course-builder-test-layout">
									<div className="admin-course-builder-test-main">
										{inlineTestTab === 'questions' && (
											<div className="admin-course-builder-test-questions admin-course-builder-test-questions-card">
												<div className="admin-course-builder-test-questions-header">
													<span>Întrebări ({inlineQuestions.length})</span>
													<div className="admin-course-builder-test-questions-actions">
														{inlineTestSaving ? <small>Se salvează…</small> : null}
													</div>
												</div>
												{inlineQuestions.length === 0 ? (
													<p className="admin-course-builder-test-empty">Nu ai încă întrebări. Apasă pe butonul de adăugare de mai jos.</p>
												) : (
													<ul className="admin-course-builder-test-question-list">
														{inlineQuestions.map((question, idx) => (
															<li
																key={question.id}
																className={`admin-course-builder-test-question-item ${expandedQuestionId === question.id ? 'is-expanded' : 'is-collapsed'}`}
															>
																<div className="admin-course-builder-test-question-topline">
																	<div className="admin-course-builder-test-question-type-picker">
																		<button
																			type="button"
																			className="admin-course-builder-test-question-badge admin-course-builder-test-question-badge-btn"
																			onClick={() => handleToggleQuestionTypePicker(question.id)}
																		>
																			{`Î${idx + 1}: ${INLINE_QUESTION_TYPES.find((t) => t.id === (question.type || 'short_answer'))?.label || 'Întrebare'}`}
																		</button>
																	</div>
																	<div className="admin-course-builder-test-question-top-actions">
																		<button
																			type="button"
																			className="admin-btn admin-btn-secondary"
																			onClick={() => setExpandedQuestionId((prev) => (prev === question.id ? null : question.id))}
																		>
																			{expandedQuestionId === question.id ? 'Strânge' : 'Deschide'}
																		</button>
																		<button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleDeleteInlineQuestion(question.id)}>Șterge</button>
																	</div>
																</div>
																{expandedQuestionId !== question.id && (
																	<p className="admin-course-builder-test-question-collapsed-preview">
																		{(question.content || '').trim() || 'Întrebare fără conținut'}
																	</p>
																)}
																{expandedQuestionId === question.id && (
																	<>

																		<textarea
																			className="admin-course-builder-test-question-input"
																			value={question.content || ''}
																			onChange={(e) => {
																				const nextContent = e.target.value;
																				setInlineQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, content: nextContent } : q)));
																				queueInlineQuestionPatchSave(question.id, { content: nextContent }, false);
																			}}
																			onBlur={(e) => handleInlineQuestionBlur(question.id, { content: e.target.value })}
																			placeholder="Adaugă întrebare"
																			rows={2}
																		/>

																		<textarea
																			className="admin-course-builder-test-question-desc"
																			value={question.explanation || ''}
																			onChange={(e) => {
																				const nextExplanation = e.target.value;
																				setInlineQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, explanation: nextExplanation } : q)));
																				queueInlineQuestionPatchSave(question.id, { explanation: nextExplanation }, false);
																			}}
																			onBlur={(e) => handleInlineQuestionBlur(question.id, { explanation: e.target.value })}
																			placeholder="Adaugă descriere..."
																			rows={2}
																		/>

																		{(question.type === 'multiple_choice' || question.type === 'single_choice' || question.type === 'true_false') && (
																			<div className="admin-course-builder-test-question-answers">
																				<p>Răspunsuri:</p>
																				{(Array.isArray(question.answers) ? question.answers : []).map((answer, answerIdx) => (
																					<div key={`${question.id}-answer-${answerIdx}`} className="admin-course-builder-test-answer-row">
																						<input
																							type={question.type === 'true_false' || question.type === 'single_choice' ? 'radio' : 'checkbox'}
																							checked={!!answer.is_correct}
																							onChange={() => handleInlineAnswerCorrectToggle(
																								question.id,
																								answerIdx,
																								question.type === 'true_false' || question.type === 'single_choice'
																							)}
																						/>
																						<input
																							type="text"
																							value={answer.text ?? answer.answer_text ?? ''}
																							onChange={(e) => handleInlineAnswerTextChange(question.id, answerIdx, e.target.value)}
																							placeholder="Introduce răspuns"
																						/>
																						{question.type !== 'true_false' && (
																							<button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleInlineRemoveAnswer(question.id, answerIdx)}>
																								×
																							</button>
																						)}
																					</div>
																				))}
																				{question.type !== 'true_false' && (
																					<button
																						type="button"
																						className="admin-btn admin-btn-secondary"
																						onClick={() => handleInlineAddAnswer(question.id)}
																					>
																						+ Adaugă răspuns
																					</button>
																				)}
																			</div>
																		)}
																	</>
																)}
															</li>
														))}
													</ul>
												)}
												<div className="admin-course-builder-test-add-bottom">
													<button
														type="button"
														className="admin-btn admin-btn-primary"
														onClick={handleAddDefaultInlineQuestion}
														disabled={addingQuestion}
													>
														{addingQuestion ? 'Se adaugă...' : 'Adaugă întrebare'}
													</button>
													<button
														type="button"
														className="admin-btn admin-btn-secondary"
														disabled
														title="Vom reveni ulterior cu importul de întrebări"
													>
														Importă întrebări
													</button>
												</div>
											</div>
										)}

										{inlineTestTab === 'settings' && (
											<div className="admin-course-builder-test-settings">
												<div className="admin-course-builder-test-field">
													<label htmlFor="course-test-title">Titlu test</label>
													<input
														id="course-test-title"
														type="text"
														value={inlineTest.title || ''}
														onChange={(e) => saveInlineTestPatch({ title: e.target.value })}
														placeholder="Ex.: Evaluare modul 1"
													/>
												</div>
												<div className="admin-course-builder-test-field">
													<label htmlFor="course-test-description">Descriere</label>
													<textarea
														id="course-test-description"
														value={inlineTest.description || ''}
														onChange={(e) => saveInlineTestPatch({ description: e.target.value })}
														placeholder="Instrucțiuni pentru test (opțional)"
														rows={4}
													/>
												</div>
												<div className="admin-course-builder-test-field">
													<label>Timp limită (minute)</label>
													<input
														type="number"
														min="1"
														value={inlineTest.time_limit_minutes ?? ''}
														onChange={(e) => saveInlineTestPatch({ time_limit_minutes: e.target.value ? Number(e.target.value) : null })}
													/>
												</div>
												<div className="admin-course-builder-test-field">
													<label>Încercări maxime</label>
													<input
														type="number"
														min="1"
														value={inlineTest.max_attempts ?? ''}
														onChange={(e) => saveInlineTestPatch({ max_attempts: e.target.value ? Number(e.target.value) : null })}
													/>
												</div>
												<div className="admin-course-builder-test-field">
													<label>Prag promovare (%)</label>
													<input
														type="number"
														min="0"
														max="100"
														value={inlineTest.passing_score ?? 70}
														onChange={(e) => saveInlineTestPatch({ passing_score: e.target.value === '' ? null : Number(e.target.value) })}
													/>
												</div>
												<div className="admin-course-builder-test-settings-section">
													<h3>Comportament test</h3>
													<div className="admin-course-builder-test-toggle-list">
														<label className="admin-course-builder-test-toggle">
															<input
																type="checkbox"
																checked={Boolean(inlineTest.randomize_questions)}
																onChange={(e) => saveInlineTestPatch({ randomize_questions: e.target.checked })}
															/>
															<span>
																<strong>Amestecă întrebările</strong>
																<small>Ordinea întrebărilor va fi randomizată pentru fiecare parcurgere.</small>
															</span>
														</label>
														<label className="admin-course-builder-test-toggle">
															<input
																type="checkbox"
																checked={Boolean(inlineTest.randomize_answers)}
																onChange={(e) => saveInlineTestPatch({ randomize_answers: e.target.checked })}
															/>
															<span>
																<strong>Amestecă răspunsurile</strong>
																<small>Opțiunile grilă se afișează în ordine diferită.</small>
															</span>
														</label>
														<label className="admin-course-builder-test-toggle">
															<input
																type="checkbox"
																checked={Boolean(inlineTest.show_results_immediately)}
																onChange={(e) => saveInlineTestPatch({ show_results_immediately: e.target.checked })}
															/>
															<span>
																<strong>Arată rezultatul imediat</strong>
																<small>Cursantul vede scorul imediat după trimitere.</small>
															</span>
														</label>
														<label className="admin-course-builder-test-toggle">
															<input
																type="checkbox"
																checked={Boolean(inlineTest.show_correct_answers)}
																onChange={(e) => saveInlineTestPatch({ show_correct_answers: e.target.checked })}
															/>
															<span>
																<strong>Arată răspunsurile corecte</strong>
																<small>După finalizare se pot vedea răspunsurile corecte.</small>
															</span>
														</label>
														<label className="admin-course-builder-test-toggle">
															<input
																type="checkbox"
																checked={Boolean(inlineTest.allow_review)}
																onChange={(e) => saveInlineTestPatch({ allow_review: e.target.checked })}
															/>
															<span>
																<strong>Permite revizuirea</strong>
																<small>Cursantul poate reveni să revadă testul după completare.</small>
															</span>
														</label>
														<label className="admin-course-builder-test-toggle">
															<input
																type="checkbox"
																checked={Boolean(inlineTest.requires_manual_verification)}
																onChange={(e) => saveInlineTestPatch({ requires_manual_verification: e.target.checked })}
															/>
															<span>
																<strong>Necesită verificare manuală</strong>
																<small>Rezultatul final rămâne în așteptare până la corectare.</small>
															</span>
														</label>
													</div>
												</div>
											</div>
										)}

									</div>

									<aside className={`admin-course-builder-test-sidepanel ${openQuestionTypePickerId ? 'is-open' : ''}`} ref={questionTypeMenuRef}>
										<div className="admin-course-builder-test-sidepanel-head">
											<h3>Tipuri întrebări</h3>
											<button type="button" onClick={() => setOpenQuestionTypePickerId(null)} aria-label="Închide panou">×</button>
										</div>
										<div className="admin-course-builder-test-type-grid">
											{INLINE_QUESTION_TYPES.map((typeOpt) => (
												<button
													key={typeOpt.id}
													type="button"
													className="admin-course-builder-test-type-card"
													onClick={() => openQuestionTypePickerId && handleInlineQuestionTypeChange(openQuestionTypePickerId, typeOpt.id)}
													disabled={addingQuestion || !openQuestionTypePickerId}
												>
													<span className="admin-course-builder-test-type-short">{typeOpt.short}</span>
													<span className="admin-course-builder-test-type-label">{typeOpt.label}</span>
												</button>
											))}
										</div>
									</aside>

								</div>
							</div>
						) : selectedLesson ? (
							<>
								<div className="admin-course-builder-lesson-heading-row">
									<div
										ref={lessonTitleRef}
										className="admin-course-builder-lesson-title-inline"
										contentEditable
										suppressContentEditableWarning
										dir="ltr"
										onBlur={(e) => {
											const nextTitle = e.currentTarget.textContent?.trim();
											if (nextTitle && nextTitle !== selectedLesson.title) {
												handleUpdateLessonTitle(selectedLesson.id, nextTitle);
											}
										}}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												e.currentTarget.blur();
											}
										}}
										role="textbox"
										aria-label="Titlu lecție"
									>
										{selectedLesson.title || 'Titlu lecție'}
									</div>
								</div>
								<div className="admin-course-builder-direct-editor-wrap admin-course-builder-direct-editor-wrap-full">
									<RichTextEditor
										key={selectedLesson.id}
										courseId={courseId}
										value={lessonContent}
										onChange={handleLessonContentChange}
										onBlur={() => {
											flushPendingLessonContentSave();
										}}
										placeholder="Scrie direct lecția aici, ca într-un document Word..."
										style={{ minHeight: '100%', height: '100%' }}
										toolbarVariant="side-only"
									/>
								</div>
							</>
						) : (
							<div className="admin-card">
								<div className="admin-card-body">Selectează o lecție din stânga.</div>
							</div>
						)}
					</div>
				</div>
			</div>

			<button
				type="button"
				className="admin-course-builder-volt-fab"
				onClick={() => setShowVoltAssistant(true)}
				title="Deschide Volt pentru acest curs"
				aria-label="Deschide Volt pentru acest curs"
			>
				<span className="admin-course-builder-volt-fab-label" aria-hidden="true">⚡</span>
				<span className="admin-course-builder-volt-fab-text">Volt</span>
			</button>

			{showVoltAssistant && (
				<div className="ai-chat-modal-overlay" onClick={() => setShowVoltAssistant(false)}>
					<div className="ai-chat-modal" onClick={(e) => e.stopPropagation()}>
						<AICourseChat
							initialCourseId={courseId}
							mode="assist"
							title="⚡ Volt pentru Builder"
                        welcomeMessage={`Sunt Volt. Lucrezi la cursul "${course?.title || 'cursul curent'}". Pot modifica și genera module, lecții și conținut complet. Dacă îmi lipsesc detalii, te întreb pe rând.`}
							showPlanPreview={false}
							autoApplyPlan={true}
							onPlanGenerated={() => {}}
							onApplyPlan={handleApplyVoltPlan}
							onClose={() => setShowVoltAssistant(false)}
						/>
					</div>
				</div>
			)}

			{showCreateTestModal && (
				<div className="admin-course-builder-test-modal-overlay" onClick={() => !creatingTest && setShowCreateTestModal(false)}>
					<div className="admin-course-builder-test-modal" onClick={(e) => e.stopPropagation()}>
						<h3>Creează test</h3>
						<form onSubmit={handleCreateTestFromModal} className="admin-course-builder-test-modal-form">
							<label htmlFor="inline-test-modal-title">Titlu test *</label>
							<input
								id="inline-test-modal-title"
								type="text"
								value={createTestTitle}
								onChange={(e) => setCreateTestTitle(e.target.value)}
								placeholder="Ex: Evaluare modul 1"
								autoFocus
							/>
							<div className="admin-course-builder-test-modal-actions">
								<button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowCreateTestModal(false)} disabled={creatingTest}>
									Anulează
								</button>
								<button type="submit" className="admin-btn admin-btn-primary" disabled={creatingTest}>
									{creatingTest ? 'Se creează...' : 'Continuă'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{showCourseEditModal && (
				<div className="admin-course-builder-test-modal-overlay" onClick={() => !courseEditSaving && setShowCourseEditModal(false)}>
					<div className="admin-course-builder-test-modal admin-course-builder-course-edit-modal" onClick={(e) => e.stopPropagation()}>
						<h3>Editare curs</h3>
						<div className="admin-course-builder-test-modal-form admin-course-builder-course-edit-form">
							<div className="admin-course-builder-course-edit-grid">
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-title">Titlu curs *</label>
									<input
										id="course-edit-title"
										type="text"
										value={courseEditDraft.title}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, title: e.target.value }))}
										placeholder="Titlu curs"
										disabled={courseEditSaving}
									/>
								</div>
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-card-color">Culoare cartonaș</label>
									<input
										id="course-edit-card-color"
										type="color"
										value={courseEditDraft.card_color || '#5b72ff'}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, card_color: e.target.value }))}
										disabled={courseEditSaving}
									/>
								</div>
							</div>

							<div className="admin-course-builder-course-edit-field">
								<label htmlFor="course-edit-description">Descriere</label>
								<textarea
									id="course-edit-description"
									rows={4}
									value={courseEditDraft.description}
									onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, description: e.target.value }))}
									placeholder="Descrierea cursului"
									disabled={courseEditSaving}
								/>
							</div>

							<div className="admin-course-builder-course-edit-field">
								<label htmlFor="course-edit-short-description">Descriere scurtă</label>
								<textarea
									id="course-edit-short-description"
									rows={2}
									value={courseEditDraft.short_description}
									onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, short_description: e.target.value }))}
									placeholder="Rezumatul care apare în carduri sau liste"
									disabled={courseEditSaving}
								/>
							</div>

							<div className="admin-course-builder-course-edit-grid">
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-level">Nivel</label>
									<select
										id="course-edit-level"
										value={courseEditDraft.level || 'beginner'}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, level: e.target.value }))}
										disabled={courseEditSaving}
									>
										<option value="beginner">Începător</option>
										<option value="intermediate">Intermediar</option>
										<option value="advanced">Avansat</option>
									</select>
								</div>
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-status">Status</label>
									<select
										id="course-edit-status"
										value={courseEditDraft.status || 'draft'}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, status: e.target.value }))}
										disabled={courseEditSaving}
									>
										<option value="draft">Draft</option>
										<option value="published">Publicat</option>
									</select>
								</div>
							</div>

							<div className="admin-course-builder-course-edit-grid">
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-visibility">Vizibilitate</label>
									<select
										id="course-edit-visibility"
										value={courseEditDraft.visibility || 'public'}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, visibility: e.target.value }))}
										disabled={courseEditSaving}
									>
										<option value="public">Public</option>
										<option value="private">Privat</option>
										<option value="hidden">Ascuns</option>
									</select>
								</div>
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-hours">Durată estimată (ore)</label>
									<input
										id="course-edit-hours"
										type="number"
										min={1}
										value={courseEditDraft.estimated_duration_hours}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, estimated_duration_hours: e.target.value ? parseInt(e.target.value, 10) : '' }))}
										placeholder="Ex: 12"
										disabled={courseEditSaving}
									/>
								</div>
							</div>

							<div className="admin-course-builder-course-edit-grid">
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-min-score">Scor minim quiz (%)</label>
									<input
										id="course-edit-min-score"
										type="number"
										min={0}
										max={100}
										value={courseEditDraft.min_test_score ?? 70}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, min_test_score: e.target.value ? parseInt(e.target.value, 10) : 70 }))}
										disabled={courseEditSaving}
									/>
								</div>
								<div className="admin-course-builder-course-edit-field">
									<label htmlFor="course-edit-image">Poză curs {courseCoverSrc(course) ? '' : '*'}</label>
									{(courseEditImagePreviewUrl || courseCoverSrc(course)) && (
										<div className="admin-course-edit-cover-preview">
											<img
												src={courseEditImagePreviewUrl || courseCoverSrc(course)}
												alt=""
											/>
										</div>
									)}
									<input
										id="course-edit-image"
										type="file"
										accept="image/*"
										onChange={(e) => setCourseEditImageFile(e.target.files?.[0] || null)}
										disabled={courseEditSaving}
									/>
								</div>
							</div>

							<div className="admin-course-builder-course-edit-checks">
								<label className="admin-course-builder-course-edit-check">
									<input
										type="checkbox"
										checked={courseEditDraft.sequential_unlock !== false}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, sequential_unlock: e.target.checked }))}
										disabled={courseEditSaving}
									/>
									<span>Deblocare secvențială</span>
								</label>
								<label className="admin-course-builder-course-edit-check">
									<input
										type="checkbox"
										checked={courseEditDraft.has_certificate === true}
										onChange={(e) => setCourseEditDraft((prev) => ({ ...prev, has_certificate: e.target.checked }))}
										disabled={courseEditSaving}
									/>
									<span>Certificat la finalizare</span>
								</label>
							</div>

							<p className="admin-course-builder-course-edit-note">
								Cursul rămâne gratuit și deschis implicit; aici ajustezi doar setările importante de publicare și finalizare.
							</p>
						</div>

						<div className="admin-course-builder-test-modal-actions">
							<button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowCourseEditModal(false)} disabled={courseEditSaving}>
								Anulează
							</button>
							<button type="button" className="admin-btn admin-btn-primary" onClick={handleSaveCourseEdit} disabled={courseEditSaving}>
								{courseEditSaving ? 'Se salvează...' : 'Salvează'}
							</button>
						</div>
					</div>
				</div>
			)}

		</div>
	);
};

export default AdminCourseBuilderPage;

