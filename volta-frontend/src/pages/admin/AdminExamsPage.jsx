import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminService } from '../../services/api';
import { toImageUrl } from '../../utils/imageUrl';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { downloadSimpleExcel, statisticsExcelFilename } from '../../utils/statisticsExcelExport';
import '../../styles/admin-course-builder.css';
import './AdminExamsPage.css';

const EXAM_SECTIONS = [
	'Creare examene',
	'Setari',
	'Acces',
	'Verificare manuala',
	'Statistica',
];

const LIST_STATUS_FILTERS = [
	{ value: 'all', label: 'Toate' },
	{ value: 'draft', label: 'Draft' },
	{ value: 'published', label: 'Publicat' },
	{ value: 'archived', label: 'Arhivat' },
];

const MANUAL_QUESTION_TYPES = ['open_text', 'short_answer', 'essay'];
const AUTO_MC_TYPES = ['multiple_choice', 'single_choice', 'true_false'];

function examQType(q) {
	return String(q?.question_type || q?.type || 'multiple_choice');
}

function examQText(q) {
	const t = String(q?.question_text || q?.text || '').trim();
	return t || 'Întrebare';
}

function sortExamQuestions(questions) {
	return [...(Array.isArray(questions) ? questions : [])].sort(
		(a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0)
	);
}

function getExamStoredAnswer(answers, questionId) {
	if (!answers || typeof answers !== 'object') return undefined;
	const n = Number(questionId);
	if (Object.prototype.hasOwnProperty.call(answers, n)) return answers[n];
	const k = String(questionId);
	if (Object.prototype.hasOwnProperty.call(answers, k)) return answers[k];
	return undefined;
}

function sortedQuestionAnswers(q) {
	const raw = q?.answers;
	if (!Array.isArray(raw)) return [];
	return [...raw].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
}

function isManualExamQuestion(q) {
	return MANUAL_QUESTION_TYPES.includes(examQType(q));
}

function examQuestionTypeLabelRo(t) {
	const map = {
		open_text: 'Răspuns deschis',
		short_answer: 'Răspuns scurt',
		essay: 'Eseu',
		multiple_choice: 'Grilă',
		single_choice: 'Alegere unică',
		true_false: 'Adevărat / fals',
		matching: 'Asocieri',
		ordering: 'Ordonare',
	};
	return map[t] || t;
}

function getMcCorrectIndex(sortedAnswers) {
	const idx = sortedAnswers.findIndex((a) => Boolean(a?.is_correct));
	return idx >= 0 ? idx : null;
}

function formatOpenAnswerDisplay(val) {
	if (val === null || val === undefined) return '— (fără răspuns)';
	if (typeof val === 'object') {
		try {
			const s = JSON.stringify(val, null, 2);
			return s || '— (fără răspuns)';
		} catch {
			return '— (fără răspuns)';
		}
	}
	const s = String(val);
	if (s.trim() === '') return '— (fără răspuns)';
	return s;
}

const AdminExamsPage = () => {
	const { success: showSuccessToast, error: showErrorToast } = useToast();
	const { canMutateInAdminArea } = useAuth();
	const [viewMode, setViewMode] = useState('list');
	const [activeSection, setActiveSection] = useState(EXAM_SECTIONS[0]);
	const [published, setPublished] = useState(false);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [search, setSearch] = useState('');
	const [listStatusFilter, setListStatusFilter] = useState('all');
	const [deleteConfirmExam, setDeleteConfirmExam] = useState(null);
	const [listActionId, setListActionId] = useState(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [createTitle, setCreateTitle] = useState('');
	const [createDescription, setCreateDescription] = useState('');
	const [creatingExam, setCreatingExam] = useState(false);
	const [duplicatingExamId, setDuplicatingExamId] = useState(null);
	const [createError, setCreateError] = useState('');
	const [activeExamDraft, setActiveExamDraft] = useState({ id: null, title: '', description: '', course_id: null });
	const [saveState, setSaveState] = useState({ loading: false, message: '', type: '' });
	const [publishToggleLoading, setPublishToggleLoading] = useState(false);
	const [showPreviewModal, setShowPreviewModal] = useState(false);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewData, setPreviewData] = useState(null);
	const [previewError, setPreviewError] = useState('');
	const [examSettings, setExamSettings] = useState({
		coverName: '',
		coverUrl: '',
		title: '',
		description: '',
		instructions: '',
		shuffleQuestions: false,
		manualReview: false,
		showFeedbackInstant: false,
		showCorrectAnswers: false,
		timeLimitEnabled: false,
		timeLimitMinutes: 60,
		attempts: 1,
		passingScore: 0,
		navigationMode: 'sequential',
		deadlineType: 'none',
		contentBankId: null,
		selectionMode: 'folders',
		selectedFolderIds: [],
		selectedTags: [],
		includeStarred: true,
		questionCount: 10,
	});
	const [showContentModal, setShowContentModal] = useState(false);
	const [contentBanks, setContentBanks] = useState([]);
	const [questionTags, setQuestionTags] = useState([]);
	const [contentBanksLoading, setContentBanksLoading] = useState(false);
	const [contentBanksError, setContentBanksError] = useState('');
	const [contentSearch, setContentSearch] = useState('');
	const [contentSort, setContentSort] = useState('questions_desc');
	const [contentOnlyWithQuestions, setContentOnlyWithQuestions] = useState(false);
	const [examAccess, setExamAccess] = useState({
		mode: 'all_students',
		selectedStudents: [],
	});
	const [showStudentsModal, setShowStudentsModal] = useState(false);
	const [studentsLoading, setStudentsLoading] = useState(false);
	const [studentsError, setStudentsError] = useState('');
	const [studentsSearch, setStudentsSearch] = useState('');
	const [studentsList, setStudentsList] = useState([]);
	const [studentsDraftSelected, setStudentsDraftSelected] = useState([]);
	const [manualReviewState, setManualReviewState] = useState({
		enabled: true,
		reviewMode: 'after_complete',
		tab: 'pending',
		counts: {
			pending: 0,
			approved: 0,
			rejected: 0,
		},
	});
	const [manualReviewItems, setManualReviewItems] = useState([]);
	const [manualReviewApprovedItems, setManualReviewApprovedItems] = useState([]);
	const [manualReviewRejectedItems, setManualReviewRejectedItems] = useState([]);
	const [manualReviewLoading, setManualReviewLoading] = useState(false);
	const [showManualReviewModal, setShowManualReviewModal] = useState(false);
	const [manualReviewTarget, setManualReviewTarget] = useState(null);
	const [manualReviewScores, setManualReviewScores] = useState({});
	const [manualReviewSubmitting, setManualReviewSubmitting] = useState(false);
	const [contentConfirmLoading, setContentConfirmLoading] = useState(false);
	const [statisticsRows, setStatisticsRows] = useState([]);
	const [statisticsQuestionRows, setStatisticsQuestionRows] = useState([]);
	const [statisticsLoading, setStatisticsLoading] = useState(false);
	const [statisticsTab, setStatisticsTab] = useState('students');
	const [statisticsStatusFilter, setStatisticsStatusFilter] = useState('all');
	const [statisticsDateFrom, setStatisticsDateFrom] = useState('');
	const [statisticsDateTo, setStatisticsDateTo] = useState('');

	const manualReviewSortedQuestions = useMemo(
		() => sortExamQuestions(manualReviewTarget?.exam?.questions),
		[manualReviewTarget]
	);

	useEffect(() => {
		if (!canMutateInAdminArea && viewMode !== 'list') {
			setViewMode('list');
		}
	}, [canMutateInAdminArea, viewMode]);

	useEffect(() => {
		const fetchExams = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await adminService.getExams();
				setItems(Array.isArray(data) ? data : []);
			} catch (e) {
				console.error('Failed to load exams list:', e);
				setError('Nu s-a putut incarca lista de examene.');
			} finally {
				setLoading(false);
			}
		};
		fetchExams();
	}, []);

	const listStats = useMemo(() => {
		const counts = { all: items.length, draft: 0, published: 0, archived: 0 };
		items.forEach((item) => {
			const s = String(item.status || 'draft').toLowerCase();
			if (s in counts) counts[s] += 1;
		});
		return counts;
	}, [items]);

	const filteredItems = useMemo(() => {
		let rows = items;
		if (listStatusFilter !== 'all') {
			rows = rows.filter((item) => String(item.status || 'draft').toLowerCase() === listStatusFilter);
		}
		const query = search.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter((item) => {
			const title = (item.title || '').toLowerCase();
			const course = (item.course_title || '').toLowerCase();
			return title.includes(query) || course.includes(query);
		});
	}, [items, search, listStatusFilter]);
	const filteredContentBanks = useMemo(() => {
		const needle = contentSearch.trim().toLowerCase();
		let rows = Array.isArray(contentBanks) ? [...contentBanks] : [];

		if (needle) {
			rows = rows.filter((bank) => {
				const title = String(bank?.title || '').toLowerCase();
				const description = String(bank?.description || '').toLowerCase();
				return title.includes(needle) || description.includes(needle);
			});
		}

		if (contentOnlyWithQuestions) {
			rows = rows.filter((bank) => Number(bank?.questions_count || 0) > 0);
		}

		rows.sort((a, b) => {
			const countA = Number(a?.questions_count || 0);
			const countB = Number(b?.questions_count || 0);
			const titleA = String(a?.title || '').localeCompare(String(b?.title || ''), 'ro', { sensitivity: 'base' });
			if (contentSort === 'title_asc') return titleA;
			if (contentSort === 'title_desc') return -titleA;
			if (contentSort === 'questions_asc') return countA - countB;
			return countB - countA;
		});

		return rows;
	}, [contentBanks, contentOnlyWithQuestions, contentSearch, contentSort]);

	const handleRefreshManualReviews = useCallback(async (notify = false) => {
		if (viewMode !== 'create' || activeSection !== 'Verificare manuala') return;
		if (!activeExamDraft.id) {
			setManualReviewItems([]);
			setManualReviewApprovedItems([]);
			setManualReviewRejectedItems([]);
			setManualReviewState((prev) => ({
				...prev,
				counts: {
					pending: 0,
					approved: 0,
					rejected: 0,
				},
			}));
			return;
		}
		try {
			setManualReviewLoading(true);
			const [pendingData, resultsData] = await Promise.all([
				adminService.getPendingExamReviews(),
				adminService.getExamResults(activeExamDraft.id),
			]);
			const rows = (Array.isArray(pendingData) ? pendingData : []).filter(
				(row) => Number(row?.exam_id || row?.exam?.id) === Number(activeExamDraft.id)
			);
			const results = Array.isArray(resultsData) ? resultsData : [];
			const approvedRows = results.filter((row) => String(row?.status || '') === 'approved');
			const rejectedRows = results.filter((row) => String(row?.status || '') === 'rejected');
			setManualReviewItems(rows);
			setManualReviewApprovedItems(approvedRows);
			setManualReviewRejectedItems(rejectedRows);
			setManualReviewState((prev) => ({
				...prev,
				counts: {
					pending: rows.length,
					approved: approvedRows.length,
					rejected: rejectedRows.length,
				},
			}));
			if (notify) {
				showSuccessToast('Verificările manuale au fost actualizate.');
			}
		} catch (e) {
			console.error('Failed to load pending exam reviews:', e);
			setManualReviewItems([]);
			setManualReviewApprovedItems([]);
			setManualReviewRejectedItems([]);
			setManualReviewState((prev) => ({
				...prev,
				counts: {
					pending: 0,
					approved: 0,
					rejected: 0,
				},
			}));
			if (notify) {
				showErrorToast('Nu s-au putut actualiza verificările manuale.');
			}
		} finally {
			setManualReviewLoading(false);
		}
	}, [activeExamDraft.id, activeSection, viewMode, showSuccessToast, showErrorToast]);

	useEffect(() => {
		handleRefreshManualReviews();
	}, [handleRefreshManualReviews]);

	const handleRefreshStatistics = useCallback(async (notify = false) => {
		if (viewMode !== 'create' || activeSection !== 'Statistica') return;
		if (!activeExamDraft.id) {
			setStatisticsRows([]);
			setStatisticsQuestionRows([]);
			return;
		}
		try {
			setStatisticsLoading(true);
			const [resultsData, questionsData] = await Promise.all([
				adminService.getExamResults(activeExamDraft.id),
				adminService.getExamQuestionAnalytics(activeExamDraft.id),
			]);
			setStatisticsRows(Array.isArray(resultsData) ? resultsData : []);
			setStatisticsQuestionRows(Array.isArray(questionsData) ? questionsData : []);
			if (notify) {
				showSuccessToast('Statistica a fost actualizată.');
			}
		} catch (e) {
			console.error('Failed to load exam statistics:', e);
			setStatisticsRows([]);
			setStatisticsQuestionRows([]);
			if (notify) {
				showErrorToast('Nu s-a putut actualiza statistica.');
			}
		} finally {
			setStatisticsLoading(false);
		}
	}, [activeExamDraft.id, activeSection, viewMode, showSuccessToast, showErrorToast]);

	useEffect(() => {
		handleRefreshStatistics();
	}, [handleRefreshStatistics]);

	const filteredStatisticsRows = useMemo(() => {
		return statisticsRows.filter((row) => {
			if (statisticsStatusFilter !== 'all' && (row.status || '') !== statisticsStatusFilter) {
				return false;
			}
			const completedAt = row.completed_at ? new Date(row.completed_at) : null;
			if (statisticsDateFrom) {
				const from = new Date(`${statisticsDateFrom}T00:00:00`);
				if (!completedAt || completedAt < from) return false;
			}
			if (statisticsDateTo) {
				const to = new Date(`${statisticsDateTo}T23:59:59`);
				if (!completedAt || completedAt > to) return false;
			}
			return true;
		});
	}, [statisticsRows, statisticsStatusFilter, statisticsDateFrom, statisticsDateTo]);

	const handleExportStatisticsExcel = () => {
		const headers = ['Data sustinerii', 'Nume complet', 'Email', 'Status', 'Scor'];
		const rows = filteredStatisticsRows.map((row) => [
			row.completed_at ? new Date(row.completed_at).toLocaleDateString('ro-RO') : '-',
			row.user?.name || '-',
			row.user?.email || '-',
			row.status || '-',
			row.percentage != null ? `${row.percentage}%` : '-',
		]);
		downloadSimpleExcel(
			statisticsExcelFilename(`examen-${activeExamDraft.id || 'export'}`),
			'Statistica examen',
			headers,
			rows
		);
	};

	const handleOpenCreateModal = () => {
		setCreateTitle('');
		setCreateDescription('');
		setCreateError('');
		setShowCreateModal(true);
	};

	const handleConfirmCreate = async () => {
		const title = createTitle.trim();
		if (!title) {
			setCreateError('Titlul este obligatoriu.');
			return;
		}
		setCreateError('');
		setCreatingExam(true);
		try {
			const payload = {
				title,
				description: createDescription.trim(),
				max_score: 100,
			};
			const response = await adminService.createExam(payload);
			const createdExam = response?.exam || response;
			if (createdExam?.id) {
				setItems((prev) => [createdExam, ...prev]);
			}
			setActiveExamDraft({
				id: createdExam?.id || null,
				title,
				description: createDescription.trim(),
				course_id: null,
			});
			setExamSettings((prev) => ({
				...prev,
				title,
				description: createDescription.trim(),
			}));
			setPublished(false);
			setShowCreateModal(false);
			setViewMode('create');
		} catch (e) {
			console.error('Create exam failed:', e);
			const message = e?.response?.data?.message || 'Nu s-a putut crea examenul.';
			setCreateError(message);
		} finally {
			setCreatingExam(false);
		}
	};

	const handleDuplicateExam = async (item) => {
		const id = item?.id;
		if (!id) return;
		setDuplicatingExamId(id);
		try {
			const data = await adminService.duplicateExam(id);
			const exam = data?.exam;
			if (exam?.id) {
				setItems((prev) => [
					{
						id: exam.id,
						course_id: exam.course_id,
						title: exam.title,
						description: exam.description,
						status: exam.status,
						max_score: exam.max_score,
						max_attempts: exam.max_attempts,
						time_limit_minutes: exam.time_limit_minutes,
						passing_score: exam.passing_score,
						settings: exam.settings,
						course_title: exam.course_title,
						questions_count: exam.questions_count,
						created_at: exam.created_at,
						updated_at: exam.updated_at,
					},
					...prev,
				]);
				showSuccessToast(data?.message || 'Examen duplicat.');
			}
		} catch (e) {
			console.error('Duplicate exam failed:', e);
			const message = e?.response?.data?.message || 'Nu s-a putut duplica examenul.';
			showErrorToast(message);
		} finally {
			setDuplicatingExamId(null);
		}
	};

	const patchExamListStatus = async (item, status) => {
		if (!item?.id || !canMutateInAdminArea) return;
		setListActionId(item.id);
		try {
			await adminService.updateExam(item.id, {
				status,
				title: item.title || 'Examen',
			});
			setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status } : row)));
			const msg =
				status === 'published'
					? 'Examen publicat.'
					: status === 'archived'
						? 'Examen arhivat.'
						: 'Examen mutat în draft.';
			showSuccessToast(msg);
		} catch (e) {
			console.error('Exam status update failed:', e);
			showErrorToast(e?.response?.data?.message || 'Nu s-a putut actualiza statusul.');
		} finally {
			setListActionId(null);
		}
	};

	const handleConfirmDeleteExam = async () => {
		if (!deleteConfirmExam?.id || !canMutateInAdminArea) return;
		setListActionId(deleteConfirmExam.id);
		try {
			await adminService.deleteExam(deleteConfirmExam.id);
			setItems((prev) => prev.filter((row) => row.id !== deleteConfirmExam.id));
			showSuccessToast('Examen șters.');
			setDeleteConfirmExam(null);
		} catch (e) {
			console.error('Delete exam failed:', e);
			showErrorToast(e?.response?.data?.message || 'Nu s-a putut șterge examenul.');
		} finally {
			setListActionId(null);
		}
	};

	const handleOpenExistingExam = (item, options = {}) => {
		setActiveExamDraft({
			id: item?.id || null,
			title: item?.title || '',
			description: item?.description || '',
			course_id: item?.course_id || null,
		});
		setExamSettings((prev) => ({
			...prev,
			title: item?.title || '',
			description: item?.description || '',
			instructions: item?.settings?.instructions || '',
			attempts: item?.max_attempts || 1,
			passingScore: item?.passing_score || 0,
			timeLimitEnabled: Boolean(item?.time_limit_minutes),
			timeLimitMinutes: Number(item?.time_limit_minutes || 60),
			shuffleQuestions: Boolean(item?.settings?.shuffle_questions),
			manualReview: Boolean(item?.settings?.manual_review),
			showFeedbackInstant: Boolean(item?.settings?.show_feedback_instant),
			showCorrectAnswers: Boolean(item?.settings?.show_correct_answers),
			navigationMode: item?.settings?.navigation_mode || 'sequential',
			deadlineType: item?.settings?.deadline_type || 'none',
			contentBankId: item?.settings?.question_bank_id || null,
			selectionMode: item?.settings?.selection_mode || 'folders',
			selectedFolderIds: Array.isArray(item?.settings?.folder_ids) ? item.settings.folder_ids : [],
			selectedTags: Array.isArray(item?.settings?.tags) ? item.settings.tags : [],
			includeStarred: item?.settings?.include_starred !== false,
			questionCount: Number(item?.settings?.question_count ?? item?.question_selection?.count ?? 10) || 10,
			coverName: item?.settings?.cover_name || '',
			coverUrl: item?.settings?.cover_url || '',
		}));
		setExamAccess({
			mode: item?.settings?.access_mode || 'all_students',
			selectedStudents: Array.isArray(item?.settings?.selected_students)
				? item.settings.selected_students.map((id) => Number(id)).filter(Boolean)
				: [],
		});
		setPublished((item?.status || 'draft') === 'published');
		setManualReviewState((prev) => ({
			...prev,
			enabled: Boolean(item?.settings?.manual_review),
			reviewMode: item?.settings?.manual_review_mode || 'after_complete',
		}));
		setSaveState({ loading: false, message: '', type: '' });
		setViewMode('create');
		const nextSection = options.initialSection;
		if (nextSection && EXAM_SECTIONS.includes(nextSection)) {
			setActiveSection(nextSection);
		} else {
			setActiveSection(EXAM_SECTIONS[0]);
		}
	};

	const handleOpenStudentsModal = async () => {
		setShowStudentsModal(true);
		setStudentsError('');
		setStudentsSearch('');
		setStudentsLoading(true);
		setStudentsDraftSelected(Array.isArray(examAccess.selectedStudents) ? [...examAccess.selectedStudents] : []);
		try {
			const rows = await adminService.getUsers({ role: 'student', per_page: 500 });
			const normalized = Array.isArray(rows)
				? rows.map((u) => ({
					id: Number(u?.id),
					name: u?.name || 'Elev',
					email: u?.email || '',
				})).filter((u) => Number.isFinite(u.id))
				: [];
			setStudentsList(normalized);
		} catch (e) {
			console.error('Nu am putut încărca elevii:', e);
			setStudentsError('Nu s-au putut încărca elevii.');
			setStudentsList([]);
		} finally {
			setStudentsLoading(false);
		}
	};

	const handleToggleStudentDraft = (studentId) => {
		setStudentsDraftSelected((prev) =>
			prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
		);
	};

	const handleApplyStudentsSelection = () => {
		setExamAccess((prev) => ({
			...prev,
			selectedStudents: [...studentsDraftSelected],
		}));
		setShowStudentsModal(false);
	};

	const handleSaveExam = async (options = {}) => {
		const forcedPublished = (options && typeof options === 'object' && Object.prototype.hasOwnProperty.call(options, 'published'))
			? Boolean(options.published)
			: null;
		const effectivePublished = forcedPublished === null ? published : forcedPublished;
		const title = (examSettings.title || activeExamDraft.title || '').trim();
		if (!title) {
			setSaveState({ loading: false, message: 'Titlul examenului este obligatoriu.', type: 'error' });
			return false;
		}

		setSaveState({ loading: true, message: '', type: '' });
		try {
			const payload = {
				title,
				description: examSettings.description || null,
				max_score: 100,
				max_attempts: Number(examSettings.attempts || 1),
				time_limit_minutes: examSettings.timeLimitEnabled
					? Math.max(1, Number(examSettings.timeLimitMinutes || 60))
					: null,
				passing_score: Number(examSettings.passingScore || 0),
				is_required: Boolean(effectivePublished),
				status: effectivePublished ? 'published' : 'draft',
				settings: {
					shuffle_questions: Boolean(examSettings.shuffleQuestions),
					manual_review: Boolean(examSettings.manualReview),
					show_feedback_instant: Boolean(examSettings.showFeedbackInstant),
					show_correct_answers: Boolean(examSettings.showCorrectAnswers),
					manual_review_mode: manualReviewState.reviewMode,
					navigation_mode: examSettings.navigationMode,
					deadline_type: examSettings.deadlineType,
					question_bank_id: examSettings.contentBankId || null,
					cover_name: examSettings.coverName || null,
					cover_url: examSettings.coverUrl || null,
					instructions: examSettings.instructions || null,
					access_mode: examAccess.mode,
					selected_students: examAccess.selectedStudents,
					selection_mode: examSettings.selectionMode,
					folder_ids: examSettings.selectedFolderIds,
					tags: examSettings.selectedTags,
					include_starred: examSettings.includeStarred,
					question_count: Number(examSettings.questionCount || 0),
				},
				question_selection: {
					mode: 'random',
					count: Number(examSettings.questionCount || 0),
					folder_ids: examSettings.selectedFolderIds,
					tags: examSettings.selectedTags,
					include_starred: examSettings.includeStarred,
				},
			};

			if (activeExamDraft.id) {
				const response = await adminService.updateExam(activeExamDraft.id, payload);
				const updatedExam = response?.exam || response;
				setItems((prev) => prev.map((item) => (item.id === updatedExam.id ? { ...item, ...updatedExam } : item)));
			} else {
				const response = await adminService.createExam(payload);
				const createdExam = response?.exam || response;
				setItems((prev) => [createdExam, ...prev]);
				setActiveExamDraft((prev) => ({ ...prev, id: createdExam?.id || prev.id }));
			}

			setPublished(effectivePublished);
			const successMessage = forcedPublished === null
				? 'Examen salvat cu succes.'
				: (effectivePublished ? 'Examen publicat cu succes.' : 'Examen retras în draft.');
			setSaveState({ loading: false, message: successMessage, type: 'success' });
			return true;
		} catch (e) {
			console.error('Save exam failed:', e);
			const message = e?.response?.data?.message || 'Nu s-a putut salva examenul.';
			setSaveState({ loading: false, message, type: 'error' });
			return false;
		}
	};

	const handleTogglePublishedNow = async () => {
		const nextPublished = !published;
		setPublished(nextPublished);
		setPublishToggleLoading(true);
		try {
			const ok = await handleSaveExam({ published: nextPublished });
			if (!ok) {
				setPublished(!nextPublished);
			}
		} finally {
			setPublishToggleLoading(false);
		}
	};

	const handleOpenPreview = async () => {
		if (!activeExamDraft.id) {
			showErrorToast('Salvează examenul înainte de previzualizare.');
			return;
		}
		setShowPreviewModal(true);
		setPreviewLoading(true);
		setPreviewError('');
		setPreviewData(null);
		try {
			const data = await adminService.previewExam(activeExamDraft.id);
			setPreviewData(data || null);
		} catch (e) {
			console.error('Preview exam failed:', e);
			setPreviewError(e?.response?.data?.message || 'Nu s-a putut încărca previzualizarea examenului.');
		} finally {
			setPreviewLoading(false);
		}
	};

	const handleUploadCover = async (file) => {
		if (!file) return;
		if (!activeExamDraft.id) {
			setSaveState({ loading: false, message: 'Salveaza examenul intai, apoi incarca coperta.', type: 'error' });
			return;
		}
		try {
			const formData = new FormData();
			formData.append('file', file);
			const response = await adminService.uploadExamCover(activeExamDraft.id, formData);
			setExamSettings((prev) => ({
				...prev,
				coverName: response?.filename || file.name,
				coverUrl: response?.url || '',
			}));
			setSaveState({ loading: false, message: 'Coperta incarcata cu succes.', type: 'success' });
		} catch (e) {
			console.error('Upload cover failed:', e);
			const message = e?.response?.data?.message || 'Nu s-a putut incarca coperta.';
			setSaveState({ loading: false, message, type: 'error' });
		}
	};

	const handleOpenContentModal = async () => {
		setShowContentModal(true);
		setContentBanksLoading(true);
		setContentBanksError('');
		try {
			const [data, tags] = await Promise.all([
				adminService.getQuestionBanks(),
				adminService.getQuestionTagSuggestions(),
			]);
			setContentBanks(Array.isArray(data) ? data : []);
			setQuestionTags(Array.isArray(tags) ? tags : []);
		} catch (e) {
			console.error('Failed to load question banks:', e);
			setContentBanksError('Nu s-au putut încărca băncile de întrebări.');
		} finally {
			setContentBanksLoading(false);
		}
	};

	const handleConfirmContentSelection = async () => {
		setContentConfirmLoading(true);
		try {
			const ok = await handleSaveExam();
			if (ok) {
				setShowContentModal(false);
			}
		} finally {
			setContentConfirmLoading(false);
		}
	};

	const openManualReviewModal = (row) => {
		const questions = Array.isArray(row?.exam?.questions) ? row.exam.questions : [];
		const manualQuestions = questions.filter((q) => isManualExamQuestion(q));
		const nextScores = {};
		manualQuestions.forEach((q) => {
			nextScores[q.id] = Number(q?.points || 0);
		});
		setManualReviewTarget(row);
		setManualReviewScores(nextScores);
		setShowManualReviewModal(true);
	};

	const submitManualReview = async () => {
		if (!manualReviewTarget?.id) return;
		const questions = Array.isArray(manualReviewTarget?.exam?.questions) ? manualReviewTarget.exam.questions : [];
		const manualRows = questions
			.filter((q) => isManualExamQuestion(q))
			.map((q) => ({
				question_id: q.id,
				score: Math.max(0, Number(manualReviewScores[q.id] || 0)),
			}));

		setManualReviewSubmitting(true);
		try {
			const response = await adminService.submitExamManualReview(manualReviewTarget.id, manualRows);
			const reviewed = response?.result || manualReviewTarget;
			setManualReviewItems((prev) => prev.filter((row) => row.id !== manualReviewTarget.id));
			setManualReviewApprovedItems((prev) => [reviewed, ...prev]);
			setManualReviewState((prev) => ({
				...prev,
				counts: {
					pending: Math.max(0, (prev.counts.pending || 0) - 1),
					approved: (prev.counts.approved || 0) + 1,
					rejected: prev.counts.rejected || 0,
				},
			}));
			setShowManualReviewModal(false);
			setManualReviewTarget(null);
			setSaveState({ loading: false, message: 'Verificarea manuală a fost salvată.', type: 'success' });
		} catch (e) {
			console.error('Manual review submit failed:', e);
			const message = e?.response?.data?.message || 'Nu s-a putut salva verificarea manuală.';
			setSaveState({ loading: false, message, type: 'error' });
		} finally {
			setManualReviewSubmitting(false);
		}
	};

	if (viewMode === 'list') {
		const emptyCopy =
			items.length === 0
				? 'Nu există examene încă. Creează primul examen sau duplică unul existent.'
				: 'Niciun examen nu se potrivește filtrelor. Încearcă alt status sau șterge căutarea.';

		return (
			<div className="admin-exams-list-page">
				<header className="admin-exams-list-header">
					<div>
						<h1>Examene</h1>
						<p className="admin-exams-list-header-lead">
							Examenele sunt o entitate separată de cursuri: le publici explicit aici: nu depind de „publică cursul”.
							Poți lega opțional un examen de un curs (pentru acces din curs), dar ciclul draft → publicat îl controlezi din această zonă.
						</p>
					</div>
					{canMutateInAdminArea ? (
						<button type="button" className="admin-exams-list-create-btn" onClick={handleOpenCreateModal}>
							+ Creează examen
						</button>
					) : null}
				</header>

				{!loading && !error && items.length > 0 ? (
					<div className="admin-exams-list-stats" role="group" aria-label="Rezumat examene">
						<div className="admin-exams-list-stat">
							<span className="admin-exams-list-stat-value">{listStats.all}</span>
							<span className="admin-exams-list-stat-label">Total</span>
						</div>
						<div className="admin-exams-list-stat is-draft">
							<span className="admin-exams-list-stat-value">{listStats.draft}</span>
							<span className="admin-exams-list-stat-label">Draft</span>
						</div>
						<div className="admin-exams-list-stat is-live">
							<span className="admin-exams-list-stat-value">{listStats.published}</span>
							<span className="admin-exams-list-stat-label">Publicat</span>
						</div>
						<div className="admin-exams-list-stat is-archived">
							<span className="admin-exams-list-stat-value">{listStats.archived}</span>
							<span className="admin-exams-list-stat-label">Arhivat</span>
						</div>
					</div>
				) : null}

				<div className="admin-exams-list-toolbar">
					<div className="admin-exams-list-search">
						<input
							type="search"
							placeholder="Caută după titlu sau curs..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							aria-label="Caută examene"
						/>
					</div>
					<div className="admin-exams-list-filter-chips" role="tablist" aria-label="Filtre status">
						{LIST_STATUS_FILTERS.map((f) => (
							<button
								key={f.value}
								type="button"
								role="tab"
								aria-selected={listStatusFilter === f.value}
								className={`admin-exams-list-chip ${listStatusFilter === f.value ? 'is-active' : ''}`}
								onClick={() => setListStatusFilter(f.value)}
							>
								{f.label}
								{f.value !== 'all' ? (
									<span className="admin-exams-list-chip-count">{listStats[f.value] ?? 0}</span>
								) : null}
							</button>
						))}
					</div>
				</div>

				{loading ? (
					<div className="admin-exams-list-empty">
						<div className="admin-exams-list-skeleton-grid" aria-hidden>
							{[1, 2, 3, 4, 5, 6].map((k) => (
								<div key={k} className="admin-exams-list-skeleton-card" />
							))}
						</div>
						<p className="admin-exams-list-empty-hint">Se încarcă examenele…</p>
					</div>
				) : error ? (
					<div className="admin-exams-list-empty">
						<p>{error}</p>
					</div>
				) : filteredItems.length === 0 ? (
					<div className="admin-exams-list-empty">
						<p>{emptyCopy}</p>
					</div>
				) : (
					<div className="admin-exams-list-grid">
						{filteredItems.map((item) => {
							const st = String(item.status || 'draft').toLowerCase();
							const busy = listActionId === item.id;
							return (
								<article
									key={item.id}
									className={`admin-exams-list-card admin-exams-list-card--${st}${item.course_title ? '' : ' admin-exams-list-card--standalone'}`}
								>
									<div className="admin-exams-list-card-top">
										<div className="admin-exams-list-card-title-row">
											<h3 id={`exam-card-title-${item.id}`}>{item.title || 'Examen fără titlu'}</h3>
											<span className={`admin-exams-list-card-status status ${st}`} aria-label={`Status: ${item.status || 'draft'}`}>
												{item.status || 'draft'}
											</span>
										</div>
										<div
											className={`admin-exams-list-card-context${item.course_title ? ' has-course' : ' is-standalone'}`}
											title={item.course_title || undefined}
										>
											{item.course_title ? (
												<>
													<span className="admin-exams-list-card-context-label">Curs</span>
													<span className="admin-exams-list-card-context-value">{item.course_title}</span>
												</>
											) : (
												<span className="admin-exams-list-card-context-standalone">Examen independent · fără curs</span>
											)}
										</div>
									</div>

									<div className="admin-exams-list-card-stats" role="group" aria-label="Parametri examen">
										<div className="admin-exams-list-stat-chip" title="Întrebări în examen">
											<span className="admin-exams-list-stat-chip-value">{item.questions_count ?? 0}</span>
											<span className="admin-exams-list-stat-chip-label">Întrebări</span>
										</div>
										<div className="admin-exams-list-stat-chip" title="Prag promovare">
											<span className="admin-exams-list-stat-chip-value">{Number(item.passing_score ?? 0)}%</span>
											<span className="admin-exams-list-stat-chip-label">Prag</span>
										</div>
										<div className="admin-exams-list-stat-chip" title="Încercări maxime">
											<span className="admin-exams-list-stat-chip-value">{item.max_attempts ?? '—'}</span>
											<span className="admin-exams-list-stat-chip-label">Încercări</span>
										</div>
									</div>

									{canMutateInAdminArea ? (
										<div className="admin-exams-list-card-footer" aria-labelledby={`exam-card-title-${item.id}`}>
											<div className="admin-exams-list-card-actions-main">
												<button
													type="button"
													className="admin-exams-list-btn-primary"
													disabled={busy}
													onClick={() => handleOpenExistingExam(item)}
												>
													Deschide editorul
												</button>
												<button
													type="button"
													className="admin-exams-list-btn-secondary"
													disabled={busy || duplicatingExamId === item.id}
													onClick={() => handleDuplicateExam(item)}
												>
													{duplicatingExamId === item.id ? 'Se duplică…' : 'Duplică'}
												</button>
											</div>
											<div className="admin-exams-list-card-actions-more">
												{st === 'draft' ? (
													<button
														type="button"
														className="admin-exams-list-btn-ghost is-emphasis"
														disabled={busy}
														onClick={() => patchExamListStatus(item, 'published')}
													>
														Publică
													</button>
												) : null}
												{st === 'published' ? (
													<button
														type="button"
														className="admin-exams-list-btn-ghost"
														disabled={busy}
														onClick={() => patchExamListStatus(item, 'archived')}
													>
														Arhivează
													</button>
												) : null}
												{st === 'archived' ? (
													<>
														<button
															type="button"
															className="admin-exams-list-btn-ghost"
															disabled={busy}
															onClick={() => patchExamListStatus(item, 'draft')}
														>
															În draft
														</button>
														<button
															type="button"
															className="admin-exams-list-btn-ghost is-emphasis"
															disabled={busy}
															onClick={() => patchExamListStatus(item, 'published')}
														>
															Publică din nou
														</button>
													</>
												) : null}
												<button
													type="button"
													className="admin-exams-list-btn-ghost"
													disabled={busy}
													onClick={() => handleOpenExistingExam(item, { initialSection: 'Verificare manuala' })}
												>
													Corectare manuală
												</button>
											</div>
											<div className="admin-exams-list-card-actions-danger">
												<button
													type="button"
													className="admin-exams-list-btn-danger"
													disabled={busy}
													onClick={() => setDeleteConfirmExam(item)}
												>
													Șterge examenul
												</button>
											</div>
										</div>
									) : null}
								</article>
							);
						})}
					</div>
				)}
				{deleteConfirmExam ? (
					<div
						className="admin-exams-create-modal-overlay"
						role="presentation"
						onClick={() => !listActionId && setDeleteConfirmExam(null)}
					>
						<div
							className="admin-exams-delete-confirm-modal"
							role="alertdialog"
							aria-modal="true"
							aria-labelledby="exam-delete-title"
							onClick={(e) => e.stopPropagation()}
						>
							<h3 id="exam-delete-title">Ștergi examenul?</h3>
							<p className="admin-exams-delete-confirm-lead">
								<strong>{deleteConfirmExam.title || 'Examen'}</strong> va fi eliminat definitiv împreună cu întrebările și
								istoricul asociat din baza de date.
							</p>
							<p className="admin-exams-delete-confirm-hint">Acțiunea nu poate fi anulată. Arhivează în loc dacă vrei să îl ascunzi de elevi.</p>
							<div className="admin-exams-delete-confirm-actions">
								<button type="button" className="admin-exams-list-btn-secondary" disabled={listActionId} onClick={() => setDeleteConfirmExam(null)}>
									Anulează
								</button>
								<button
									type="button"
									className="admin-exams-list-btn-danger-solid"
									disabled={listActionId}
									onClick={handleConfirmDeleteExam}
								>
									{listActionId ? 'Se șterge…' : 'Da, șterge'}
								</button>
							</div>
						</div>
					</div>
				) : null}
				{showCreateModal && (
					<div className="admin-exams-create-modal-overlay" role="presentation" onClick={() => setShowCreateModal(false)}>
						<div className="admin-exams-create-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
							<h3>Creare examen</h3>
							<label htmlFor="exam-create-title">Titlu examen</label>
							<input
								id="exam-create-title"
								type="text"
								value={createTitle}
								onChange={(e) => setCreateTitle(e.target.value)}
								placeholder="Ex: Examen final modul 1"
							/>
							<label htmlFor="exam-create-description">Descriere</label>
							<textarea
								id="exam-create-description"
								value={createDescription}
								onChange={(e) => setCreateDescription(e.target.value)}
								rows={4}
								placeholder="Descriere scurta pentru examen"
							/>
							{createError ? <p className="admin-exams-create-modal-error">{createError}</p> : null}
							<div className="admin-exams-create-modal-actions">
								<button type="button" className="cancel" onClick={() => setShowCreateModal(false)} disabled={creatingExam}>
									Anuleaza
								</button>
								<button
									type="button"
									className="confirm"
									onClick={handleConfirmCreate}
									disabled={!createTitle.trim() || creatingExam}
								>
									{creatingExam ? 'Se creeaza...' : 'Continua'}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	}

	const renderSectionContent = () => {
		const selectedBank = contentBanks.find((b) => String(b.id) === String(examSettings.contentBankId));
		const selectedFoldersStarred = contentBanks
			.filter((b) => examSettings.selectedFolderIds.includes(b.id))
			.reduce((acc, b) => acc + Number(b.starred_questions_count || 0), 0);

		if (activeSection === 'Setari') {
			return (
				<div className="admin-exams-settings">
					<div className="admin-exams-settings-head">
						<h2>Setari</h2>
						<p>Customizeaza setarile vizuale si functionale ale examenului.</p>
					</div>

					<div className="admin-exams-settings-top">
						<div className="admin-exams-settings-cover">
							<div className="admin-exams-cover-preview">
								{examSettings.coverUrl ? (
									<img src={toImageUrl(examSettings.coverUrl) || examSettings.coverUrl} alt="Coperta examen" />
								) : examSettings.coverName ? (
									<span>{examSettings.coverName}</span>
								) : (
									<span>Fara imagine</span>
								)}
							</div>
							<strong>Imagine coperta</strong>
							<small>Recomandat: 510 x 690 px</small>
							<label className="admin-exams-cover-upload">
								Incarca imagine
								<input
									type="file"
									accept="image/*"
									onChange={(e) => handleUploadCover(e.target.files?.[0])}
								/>
							</label>
						</div>

						<div className="admin-exams-settings-fields">
							<label>
								Nume
								<input
									type="text"
									maxLength={40}
									value={examSettings.title}
									onChange={(e) => setExamSettings((prev) => ({ ...prev, title: e.target.value }))}
									placeholder="Numele examenului"
								/>
							</label>
							<label>
								Descriere
								<textarea
									rows={4}
									value={examSettings.description}
									onChange={(e) => setExamSettings((prev) => ({ ...prev, description: e.target.value }))}
									placeholder="Descriere scurta"
								/>
							</label>
							<label>
								Instrucțiuni pentru elevi
								<textarea
									rows={4}
									value={examSettings.instructions}
									onChange={(e) => setExamSettings((prev) => ({ ...prev, instructions: e.target.value }))}
									placeholder="Reguli, materiale permise, metodă de notare etc."
								/>
							</label>
						</div>
					</div>

					<div className="admin-exams-settings-grid">
						<div className="admin-exams-settings-col">
							<div className="admin-exams-setting-row">
								<span>Amesteca intrebarile</span>
								<button
									type="button"
									className="admin-view-switcher admin-exams-header-switch"
									onClick={() => setExamSettings((prev) => ({ ...prev, shuffleQuestions: !prev.shuffleQuestions }))}
									aria-pressed={examSettings.shuffleQuestions}
									aria-label={examSettings.shuffleQuestions ? 'Amestecare întrebări: activată' : 'Amestecare întrebări: dezactivată'}
								>
									<div
										className="admin-view-switcher-slider"
										style={{ transform: examSettings.shuffleQuestions ? 'translateX(27px)' : 'translateX(0)' }}
										aria-hidden
									/>
								</button>
							</div>
							<div className="admin-exams-setting-row">
								<span>Limitare timp</span>
								<button
									type="button"
									className="admin-view-switcher admin-exams-header-switch"
									onClick={() => setExamSettings((prev) => ({ ...prev, timeLimitEnabled: !prev.timeLimitEnabled }))}
									aria-pressed={examSettings.timeLimitEnabled}
									aria-label={examSettings.timeLimitEnabled ? 'Limitare timp: activată' : 'Limitare timp: dezactivată'}
								>
									<div
										className="admin-view-switcher-slider"
										style={{ transform: examSettings.timeLimitEnabled ? 'translateX(27px)' : 'translateX(0)' }}
										aria-hidden
									/>
								</button>
							</div>
							{examSettings.timeLimitEnabled && (
								<div className="admin-exams-setting-row is-stack">
									<span>Timp limită (minute)</span>
									<input
										type="number"
										min={1}
										max={240}
										value={examSettings.timeLimitMinutes}
										onChange={(e) =>
											setExamSettings((prev) => ({
												...prev,
												timeLimitMinutes: Math.max(1, Number(e.target.value || 1)),
											}))
										}
									/>
								</div>
							)}
							<div className="admin-exams-setting-row is-stack">
								<span>Prag promovare</span>
								<input
									type="number"
									min={0}
									max={100}
									value={examSettings.passingScore}
									onChange={(e) =>
										setExamSettings((prev) => ({ ...prev, passingScore: Number(e.target.value || 0) }))
									}
								/>
							</div>
							<div className="admin-exams-setting-row is-stack">
								<span>Navigare intre intrebari</span>
								<div className="admin-exams-radio-row">
									<label>
										<input
											type="radio"
											name="nav-mode"
											checked={examSettings.navigationMode === 'sequential'}
											onChange={() => setExamSettings((prev) => ({ ...prev, navigationMode: 'sequential' }))}
										/>
										Secvential
									</label>
									<label>
										<input
											type="radio"
											name="nav-mode"
											checked={examSettings.navigationMode === 'free'}
											onChange={() => setExamSettings((prev) => ({ ...prev, navigationMode: 'free' }))}
										/>
										Liber
									</label>
								</div>
							</div>
						</div>

						<div className="admin-exams-settings-col">
							<div className="admin-exams-setting-row">
								<span>Verificare manuala</span>
								<button
									type="button"
									className="admin-view-switcher admin-exams-header-switch"
									onClick={() => {
										setExamSettings((prev) => ({ ...prev, manualReview: !prev.manualReview }));
										setManualReviewState((prev) => ({ ...prev, enabled: !prev.enabled }));
									}}
									aria-pressed={examSettings.manualReview}
									aria-label={examSettings.manualReview ? 'Verificare manuală: activată' : 'Verificare manuală: dezactivată'}
								>
									<div
										className="admin-view-switcher-slider"
										style={{ transform: examSettings.manualReview ? 'translateX(27px)' : 'translateX(0)' }}
										aria-hidden
									/>
								</button>
							</div>
							<div className="admin-exams-setting-row">
								<span>Feedback instant</span>
								<button
									type="button"
									className="admin-view-switcher admin-exams-header-switch"
									onClick={() => setExamSettings((prev) => ({ ...prev, showFeedbackInstant: !prev.showFeedbackInstant }))}
									aria-pressed={examSettings.showFeedbackInstant}
									aria-label={examSettings.showFeedbackInstant ? 'Feedback instant: activat' : 'Feedback instant: dezactivat'}
								>
									<div
										className="admin-view-switcher-slider"
										style={{ transform: examSettings.showFeedbackInstant ? 'translateX(27px)' : 'translateX(0)' }}
										aria-hidden
									/>
								</button>
							</div>
							<div className="admin-exams-setting-row">
								<span>Arată răspunsurile corecte</span>
								<button
									type="button"
									className="admin-view-switcher admin-exams-header-switch"
									onClick={() => setExamSettings((prev) => ({ ...prev, showCorrectAnswers: !prev.showCorrectAnswers }))}
									aria-pressed={examSettings.showCorrectAnswers}
									aria-label={examSettings.showCorrectAnswers ? 'Răspunsuri corecte: afișate' : 'Răspunsuri corecte: ascunse'}
								>
									<div
										className="admin-view-switcher-slider"
										style={{ transform: examSettings.showCorrectAnswers ? 'translateX(27px)' : 'translateX(0)' }}
										aria-hidden
									/>
								</button>
							</div>
							<div className="admin-exams-setting-row is-stack">
								<span>Numar incercari</span>
								<input
									type="number"
									min={1}
									max={20}
									value={examSettings.attempts}
									onChange={(e) => setExamSettings((prev) => ({ ...prev, attempts: Number(e.target.value || 1) }))}
								/>
							</div>
							<div className="admin-exams-setting-row is-stack">
								<span>Deadline</span>
								<select
									value={examSettings.deadlineType}
									onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineType: e.target.value }))}
								>
									<option value="none">Fara termen</option>
									<option value="fixed">Data fixa</option>
									<option value="relative">La X zile de la incepere</option>
								</select>
							</div>
						</div>
					</div>
				</div>
			);
		}

		if (activeSection === 'Acces') {
			return (
				<div className="admin-exams-access">
					<div className="admin-exams-access-head">
						<h2>Setari de acces</h2>
						<p>Alege daca examenul este disponibil pentru toti elevii sau doar pentru elevii selectati.</p>
					</div>

					<div className="admin-exams-access-controls">
						<div className="admin-exams-access-toggle-wrap" role="group" aria-label="Mod acces examen">
							<span className={`admin-exams-access-toggle-label ${examAccess.mode === 'all_students' ? 'is-active' : ''}`}>
								Toti elevii
							</span>
							<button
								type="button"
								className="admin-view-switcher admin-exams-header-switch"
								onClick={() =>
									setExamAccess((prev) => ({
										...prev,
										mode: prev.mode === 'selected_students' ? 'all_students' : 'selected_students',
									}))
								}
								aria-pressed={examAccess.mode === 'selected_students'}
							>
								<div
									className="admin-view-switcher-slider"
									style={{ transform: examAccess.mode === 'selected_students' ? 'translateX(27px)' : 'translateX(0)' }}
									aria-hidden
								/>
							</button>
							<span className={`admin-exams-access-toggle-label ${examAccess.mode === 'selected_students' ? 'is-active' : ''}`}>
								Elevi selectati
							</span>
						</div>

						<button
							type="button"
							className="admin-exams-access-add-btn"
							disabled={examAccess.mode !== 'selected_students'}
							onClick={handleOpenStudentsModal}
						>
							+ Adauga elevi
						</button>
					</div>

					{examAccess.mode === 'selected_students' && (
						<>
							<p className="admin-exams-access-hint">
								Selectati: {examAccess.selectedStudents.length} elevi
							</p>
							<div className="admin-exams-access-selected-list">
								{examAccess.selectedStudents.map((studentId) => {
									const student = studentsList.find((u) => u.id === studentId);
									return (
										<button
											key={studentId}
											type="button"
											className="admin-exams-access-selected-chip"
											onClick={() =>
												setExamAccess((prev) => ({
													...prev,
													selectedStudents: prev.selectedStudents.filter((id) => id !== studentId),
												}))
											}
											title="Elimină elev"
										>
											{student?.name || `Elev #${studentId}`} ×
										</button>
									);
								})}
							</div>
						</>
					)}
					{showStudentsModal && (
						<div className="admin-exams-create-modal-overlay" onClick={() => setShowStudentsModal(false)}>
							<div className="admin-exams-create-modal admin-exams-students-modal" onClick={(e) => e.stopPropagation()}>
								<h3>Selectează elevi</h3>
								<input
									type="text"
									placeholder="Caută după nume sau email..."
									value={studentsSearch}
									onChange={(e) => setStudentsSearch(e.target.value)}
								/>
								{studentsError ? <p className="admin-exams-create-modal-error">{studentsError}</p> : null}
								<div className="admin-exams-students-list">
									{studentsLoading ? (
										<p>Se încarcă elevii...</p>
									) : (
										studentsList
											.filter((u) => {
												const q = studentsSearch.trim().toLowerCase();
												if (!q) return true;
												return String(u.name).toLowerCase().includes(q) || String(u.email).toLowerCase().includes(q);
											})
											.map((u) => (
												<label key={u.id} className="admin-exams-students-row">
													<input
														type="checkbox"
														checked={studentsDraftSelected.includes(u.id)}
														onChange={() => handleToggleStudentDraft(u.id)}
													/>
													<span>{u.name}</span>
													<small>{u.email}</small>
												</label>
											))
									)}
								</div>
								<div className="admin-exams-create-modal-actions">
									<button type="button" className="cancel" onClick={() => setShowStudentsModal(false)}>
										Anulează
									</button>
									<button type="button" className="confirm" onClick={handleApplyStudentsSelection}>
										Aplică selecția
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			);
		}

		if (activeSection === 'Verificare manuala') {
			const tabs = [
				{ id: 'pending', label: 'Așteaptă verificare' },
				{ id: 'approved', label: 'Aprobat' },
				{ id: 'rejected', label: 'Respins' },
			];
			const attemptAnswers = manualReviewTarget?.answers;
			return (
				<div className="admin-exams-manual-review">
					<div className="admin-exams-manual-review-head admin-exams-manual-review-head--toolbar">
						<div>
							<h2>Verificare manuală</h2>
							<p>Politica de verificare și coada de lucrări sunt separate mai jos. La corectare vezi întregul test și răspunsurile elevului.</p>
						</div>
						<button
							type="button"
							className="admin-exams-section-refresh-btn"
							onClick={() => handleRefreshManualReviews(true)}
							disabled={manualReviewLoading}
						>
							{manualReviewLoading ? 'Se încarcă...' : 'Reîmprospătează'}
						</button>
					</div>
					{!activeExamDraft.id ? (
						<div className="admin-exams-manual-review-empty">
							<div className="admin-exams-manual-review-empty-icon">i</div>
							<p>Selectează mai întâi un examen din listă pentru verificare manuală.</p>
						</div>
					) : (
						<div className="admin-exams-manual-review-compartments">
							<section className="admin-exams-manual-compartment" aria-labelledby="admin-exams-manual-settings-title">
								<header className="admin-exams-manual-compartment-head">
									<h3 id="admin-exams-manual-settings-title">Setări verificare</h3>
									<p>Activează corectarea manuală pentru întrebări deschise și alege momentul în care intervine evaluatorul.</p>
								</header>
								<div className="admin-exams-manual-review-top">
									<div className="admin-exams-manual-review-switch-card">
										<span className={!manualReviewState.enabled ? 'is-active' : ''}>Verificare automată</span>
										<button
											type="button"
											className="admin-view-switcher admin-exams-header-switch"
											onClick={() => {
												setManualReviewState((prev) => ({ ...prev, enabled: !prev.enabled }));
												setExamSettings((prev) => ({ ...prev, manualReview: !prev.manualReview }));
											}}
											aria-pressed={manualReviewState.enabled}
										>
											<div
												className="admin-view-switcher-slider"
												style={{ transform: manualReviewState.enabled ? 'translateX(27px)' : 'translateX(0)' }}
												aria-hidden
											/>
										</button>
										<span className={manualReviewState.enabled ? 'is-active' : ''}>Verificare manuală</span>
									</div>

									<div className="admin-exams-manual-review-radios">
										<label>
											<input
												type="radio"
												name="manual-review-mode"
												checked={manualReviewState.reviewMode === 'after_complete'}
												onChange={() => {
													setManualReviewState((prev) => ({ ...prev, reviewMode: 'after_complete' }));
												}}
											/>
											După finalizare completă
										</label>
										<label>
											<input
												type="radio"
												name="manual-review-mode"
												checked={manualReviewState.reviewMode === 'partial'}
												onChange={() => {
													setManualReviewState((prev) => ({ ...prev, reviewMode: 'partial' }));
												}}
											/>
											Pe etape
										</label>
									</div>
								</div>
							</section>

							<section
								className="admin-exams-manual-compartment admin-exams-manual-compartment--queue"
								aria-labelledby="admin-exams-manual-queue-title"
							>
								<header className="admin-exams-manual-compartment-head">
									<h3 id="admin-exams-manual-queue-title">Lucrări și status</h3>
									<p>Încercări pentru examenul selectat: în așteptare, deja verificate sau respinse.</p>
								</header>

								<div className="admin-exams-manual-review-tabs">
									{tabs.map((tab) => (
										<button
											key={tab.id}
											type="button"
											className={manualReviewState.tab === tab.id ? 'is-active' : ''}
											onClick={() => setManualReviewState((prev) => ({ ...prev, tab: tab.id }))}
										>
											{tab.label} · {manualReviewState.counts[tab.id]}
										</button>
									))}
								</div>

								{manualReviewState.tab === 'pending' && manualReviewItems.length > 0 ? (
									<div className="admin-exams-manual-review-list">
										{manualReviewItems.map((row) => (
											<article key={row.id} className="admin-exams-manual-review-item">
												<div>
													<h4>{row?.user?.name || 'Elev'}</h4>
													<p>{row?.exam?.title || 'Examen fără titlu'}</p>
												</div>
												<div className="admin-exams-manual-review-item-meta">
													<span>Încercare #{row.attempt_number || 1}</span>
													<span>{row.completed_at ? new Date(row.completed_at).toLocaleString('ro-RO') : '—'}</span>
													<button type="button" className="admin-exams-manual-review-action" onClick={() => openManualReviewModal(row)}>
														Deschide lucrarea
													</button>
												</div>
											</article>
										))}
									</div>
								) : manualReviewState.tab === 'approved' && manualReviewApprovedItems.length > 0 ? (
									<div className="admin-exams-manual-review-list">
										{manualReviewApprovedItems.map((row) => (
											<article key={row.id} className="admin-exams-manual-review-item">
												<div>
													<h4>{row?.user?.name || 'Elev'}</h4>
													<p>{row?.exam?.title || 'Examen fără titlu'}</p>
												</div>
												<div className="admin-exams-manual-review-item-meta">
													<span>Verificat</span>
													<span>{row.reviewed_at ? new Date(row.reviewed_at).toLocaleString('ro-RO') : '—'}</span>
												</div>
											</article>
										))}
									</div>
								) : manualReviewState.tab === 'rejected' && manualReviewRejectedItems.length > 0 ? (
									<div className="admin-exams-manual-review-list">
										{manualReviewRejectedItems.map((row) => (
											<article key={row.id} className="admin-exams-manual-review-item">
												<div>
													<h4>{row?.user?.name || 'Elev'}</h4>
													<p>{row?.exam?.title || 'Examen fără titlu'}</p>
												</div>
												<div className="admin-exams-manual-review-item-meta">
													<span>Respins</span>
													<span>{row.reviewed_at ? new Date(row.reviewed_at).toLocaleString('ro-RO') : '—'}</span>
												</div>
											</article>
										))}
									</div>
								) : (
									<div className="admin-exams-manual-review-empty admin-exams-manual-review-empty--in-compartment">
										<div className="admin-exams-manual-review-empty-icon">{manualReviewLoading ? '…' : '✓'}</div>
										<p>{manualReviewLoading ? 'Se încarcă lucrările...' : 'Nu există lucrări în acest status.'}</p>
									</div>
								)}
							</section>
						</div>
					)}
					{showManualReviewModal && manualReviewTarget && (
						<div className="admin-exams-create-modal-overlay" onClick={() => !manualReviewSubmitting && setShowManualReviewModal(false)}>
							<div
								className="admin-exams-create-modal admin-exams-manual-modal admin-exams-manual-modal--full"
								onClick={(e) => e.stopPropagation()}
								role="dialog"
								aria-labelledby="admin-exams-manual-modal-title"
								aria-modal="true"
							>
								<div className="admin-exams-manual-modal-top">
									<div>
										<h3 id="admin-exams-manual-modal-title">Corectare lucrare</h3>
										<p className="admin-exams-manual-modal-sub">
											<strong>{manualReviewTarget?.user?.name || 'Elev'}</strong>
											<span className="admin-exams-manual-modal-dot" aria-hidden>
												·
											</span>
											<span>{manualReviewTarget?.exam?.title || 'Examen'}</span>
											<span className="admin-exams-manual-modal-dot" aria-hidden>
												·
											</span>
											<span>Încercare #{manualReviewTarget?.attempt_number || 1}</span>
										</p>
										<p className="admin-exams-manual-modal-summary">
											Punctaj automat (grilă):{' '}
											<strong>
												{Number(manualReviewTarget?.score ?? 0)} / {Number(manualReviewTarget?.total_points ?? 0)}
											</strong>{' '}
											puncte · Notați mai jos întrebările deschise, apoi salvați.
										</p>
									</div>
									<button
										type="button"
										className="admin-exams-manual-modal-close"
										onClick={() => !manualReviewSubmitting && setShowManualReviewModal(false)}
										disabled={manualReviewSubmitting}
										aria-label="Închide"
									>
										×
									</button>
								</div>

								<div className="admin-exams-manual-test-preview">
									{manualReviewSortedQuestions.map((q, idx) => {
										const qType = examQType(q);
										const manual = isManualExamQuestion(q);
										const pts = Number(q?.points ?? 1);
										const sortedAns = sortedQuestionAnswers(q);
										const userRaw = getExamStoredAnswer(attemptAnswers, q.id);
										const userIdx =
											userRaw === '' || userRaw === undefined || userRaw === null ? null : Number(userRaw);
										const correctIdx = getMcCorrectIndex(sortedAns);
										const hasMcOptions = sortedAns.length > 0;

										return (
											<article key={q.id} className={`admin-exams-manual-q-card ${manual ? 'is-manual' : 'is-auto'}`}>
												<header className="admin-exams-manual-q-card-head">
													<span className="admin-exams-manual-q-num">{idx + 1}</span>
													<div className="admin-exams-manual-q-head-text">
														<span className="admin-exams-manual-q-badge">{examQuestionTypeLabelRo(qType)}</span>
														<span className="admin-exams-manual-q-points">
															{pts} {pts === 1 ? 'punct' : 'puncte'}
														</span>
													</div>
												</header>
												<div className="admin-exams-manual-q-text">{examQText(q)}</div>

												{manual ? (
													<div className="admin-exams-manual-q-body">
														<div className="admin-exams-manual-student-answer">
															<span className="admin-exams-manual-student-answer-label">Răspunsul elevului</span>
															<div className="admin-exams-manual-student-answer-box">{formatOpenAnswerDisplay(userRaw)}</div>
														</div>
														<label className="admin-exams-manual-grade-row">
															<span>
																Notă (0–{pts})
															</span>
															<input
																type="number"
																min={0}
																max={pts}
																step={0.5}
																value={manualReviewScores[q.id] ?? 0}
																onChange={(e) =>
																	setManualReviewScores((prev) => ({
																		...prev,
																		[q.id]: Math.max(0, Math.min(pts, Number(e.target.value || 0))),
																	}))
																}
															/>
														</label>
													</div>
												) : AUTO_MC_TYPES.includes(qType) && hasMcOptions ? (
													<div className="admin-exams-manual-q-body">
														<ul className="admin-exams-manual-options" aria-label="Variante de răspuns">
															{sortedAns.map((ans, optIdx) => {
																const label = String(ans?.answer_text ?? ans?.text ?? `Varianta ${optIdx + 1}`);
																const isCorrect = correctIdx !== null && optIdx === correctIdx;
																const isSelected = userIdx !== null && !Number.isNaN(userIdx) && optIdx === userIdx;
																const wrongPick = isSelected && correctIdx !== null && !isCorrect;
																return (
																	<li
																		key={ans?.id ?? optIdx}
																		className={`admin-exams-manual-option ${isCorrect ? 'is-correct' : ''} ${isSelected ? 'is-selected' : ''} ${wrongPick ? 'is-wrong-pick' : ''}`}
																	>
																		<span className="admin-exams-manual-option-letter">{String.fromCharCode(65 + optIdx)}</span>
																		<span className="admin-exams-manual-option-text">{label}</span>
																		{isCorrect ? <span className="admin-exams-manual-option-tag">Corect</span> : null}
																		{isSelected ? <span className="admin-exams-manual-option-tag is-muted">Ales de elev</span> : null}
																	</li>
																);
															})}
														</ul>
														{userIdx === null || Number.isNaN(userIdx) ? (
															<p className="admin-exams-manual-mc-note">Elevul nu a bifat o variantă pentru această întrebare.</p>
														) : null}
													</div>
												) : (
													<div className="admin-exams-manual-q-body">
														<div className="admin-exams-manual-student-answer">
															<span className="admin-exams-manual-student-answer-label">Răspuns înregistrat</span>
															<pre className="admin-exams-manual-raw-answer">{formatOpenAnswerDisplay(userRaw)}</pre>
														</div>
													</div>
												)}
											</article>
										);
									})}
								</div>

								<div className="admin-exams-create-modal-actions admin-exams-manual-modal-actions">
									<button type="button" className="cancel" onClick={() => setShowManualReviewModal(false)} disabled={manualReviewSubmitting}>
										Anulează
									</button>
									<button type="button" className="confirm" onClick={submitManualReview} disabled={manualReviewSubmitting}>
										{manualReviewSubmitting ? 'Se salvează...' : 'Salvează verificarea'}
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			);
		}

		if (activeSection === 'Statistica') {
			return (
				<div className="admin-exams-statistics">
					<div className="admin-exams-statistics-head">
						<h2>Statistica</h2>
						<p>Statistica detaliata pentru examenul selectat.</p>
						<button type="button" className="admin-exams-section-refresh-btn" onClick={() => handleRefreshStatistics(true)} disabled={statisticsLoading || !activeExamDraft.id}>
							{statisticsLoading ? 'Se încarcă...' : 'Reîmprospătează'}
						</button>
					</div>
					{!activeExamDraft.id ? (
						<div className="admin-exams-statistics-empty">Selectează mai întâi un examen din listă pentru statistici.</div>
					) : (
						<>

					<div className="admin-exams-statistics-tabs">
						<button
							type="button"
							className={statisticsTab === 'students' ? 'is-active' : ''}
							onClick={() => setStatisticsTab('students')}
						>
							Statistica elevilor
						</button>
						<button
							type="button"
							className={statisticsTab === 'questions' ? 'is-active' : ''}
							onClick={() => setStatisticsTab('questions')}
						>
							Analiză întrebări
						</button>
					</div>

					{statisticsTab === 'students' && (
					<div className="admin-exams-statistics-filters">
						<select value={statisticsStatusFilter} onChange={(e) => setStatisticsStatusFilter(e.target.value)}>
							<option value="all">Toate statusurile</option>
							<option value="pending">In asteptare</option>
							<option value="approved">Aprobat</option>
							<option value="rejected">Respins</option>
							<option value="completed">Finalizat</option>
						</select>
						<input
							type="date"
							value={statisticsDateFrom}
							onChange={(e) => setStatisticsDateFrom(e.target.value)}
							aria-label="Data de inceput"
						/>
						<input
							type="date"
							value={statisticsDateTo}
							onChange={(e) => setStatisticsDateTo(e.target.value)}
							aria-label="Data de sfarsit"
						/>
						<button type="button" onClick={handleExportStatisticsExcel}>
							Export Excel
						</button>
					</div>
					)}

					{statisticsTab === 'students' ? (
					<div className="admin-exams-statistics-table-wrap">
						<table className="admin-exams-statistics-table">
							<thead>
								<tr>
									<th>Data sustinerii</th>
									<th>Nume complet</th>
									<th>Email</th>
									<th>Status</th>
									<th>Scor</th>
								</tr>
							</thead>
							<tbody>
								{filteredStatisticsRows.map((row) => (
									<tr key={row.id}>
										<td>{row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '-'}</td>
										<td>{row.user?.name || '-'}</td>
										<td>{row.user?.email || '-'}</td>
										<td>{row.status || '-'}</td>
										<td>{row.percentage != null ? `${row.percentage}%` : '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
						{statisticsLoading ? (
							<div className="admin-exams-statistics-empty">Se incarca statistica...</div>
						) : filteredStatisticsRows.length === 0 ? (
							<div className="admin-exams-statistics-empty">Inca nu exista date.</div>
						) : null}
					</div>
					) : (
					<div className="admin-exams-question-analytics-list">
						{statisticsLoading ? (
							<div className="admin-exams-statistics-empty">Se încarcă analiza întrebărilor...</div>
						) : statisticsQuestionRows.length === 0 ? (
							<div className="admin-exams-statistics-empty">Nu există încă date pentru analiza pe întrebări.</div>
						) : (
							statisticsQuestionRows.map((row, idx) => (
								<article key={row.question_id || idx} className="admin-exams-question-analytics-card">
									<div className="admin-exams-question-analytics-head">
										<h4>{idx + 1}. {row.question_text || 'Întrebare'}</h4>
										<span>{row.question_type || 'n/a'}</span>
									</div>
									<div className="admin-exams-question-analytics-metrics">
										<span>Încercări: {row.attempts ?? 0}</span>
										<span>Răspunsuri: {row.answered_count ?? 0}</span>
										<span>Sărite: {row.skipped_count ?? 0}</span>
										{row.correct_rate != null ? <span>Corect: {row.correct_rate}%</span> : null}
										{row.manual_avg_score != null ? <span>Scor mediu manual: {row.manual_avg_score}</span> : null}
									</div>
									{Array.isArray(row.option_stats) && row.option_stats.length > 0 ? (
										<div className="admin-exams-question-analytics-options">
											{row.option_stats.map((option) => (
												<div key={`${row.question_id}-${option.index}`} className={`admin-exams-question-analytics-option ${option.is_correct ? 'is-correct' : ''}`}>
													<div>
														<strong>{String.fromCharCode(65 + Number(option.index || 0))}.</strong> {option.text || '-'}
													</div>
													<div>{option.count} răspunsuri ({option.percentage}%)</div>
												</div>
											))}
										</div>
									) : (
										<p className="admin-exams-question-analytics-open-hint">Întrebare deschisă (fără variante).</p>
									)}
								</article>
							))
						)}
					</div>
					)}
						</>
					)}
				</div>
			);
		}

		return (
			<>
				<div className="admin-exams-content-head">
					<div>
						<h1>{activeExamDraft.title || 'Creare examene'}</h1>
						<p>{activeExamDraft.description || 'Configureaza examenul si adauga continutul.'}</p>
					</div>
				</div>

				<button type="button" className="admin-exams-primary-btn" onClick={handleOpenContentModal}>
					Alege continut
				</button>
				{selectedBank ? (
					<div className="admin-exams-content-selected">
						<p>Banca selectată: <strong>{selectedBank.title}</strong> ({selectedBank.questions_count || 0} întrebări)</p>
						{selectedBank.description ? <small>{selectedBank.description}</small> : null}
					</div>
				) : (
					<p className="admin-exams-content-selected">Nu ai selectat încă o bancă de întrebări.</p>
				)}
				<div className="admin-exams-content-selected">
					<p>
						În examen: <strong>{Number(examSettings.questionCount || 0)}</strong> întrebări variabile
						{examSettings.includeStarred ? (
							<> + <strong>{selectedFoldersStarred}</strong> marcate cu stea (obligatorii pentru toți)</>
						) : null}
					</p>
				</div>

				{showContentModal && (
					<div className="admin-exams-create-modal-overlay" onClick={() => setShowContentModal(false)}>
						<div className="admin-exams-content-modal" onClick={(e) => e.stopPropagation()}>
							<h3>Alege conținut din bănci de întrebări</h3>
							<p className="admin-exams-content-subtitle">
								Selectează sursa întrebărilor pentru examen: după foldere sau după tag-uri.
							</p>
							<div className="admin-exams-content-tools">
								<input
									type="text"
									placeholder="Caută bancă după nume sau descriere..."
									value={contentSearch}
									onChange={(e) => setContentSearch(e.target.value)}
								/>
							</div>
							<div className="admin-exams-content-meta">
								<span>Afișate {filteredContentBanks.length} din {contentBanks.length} bănci</span>
							</div>
							<div className="admin-exams-content-tools">
								<label className="admin-exams-content-mode-option">
									<input
										type="radio"
										name="selection-mode"
										checked={examSettings.selectionMode === 'folders'}
										onChange={() => setExamSettings((prev) => ({ ...prev, selectionMode: 'folders' }))}
									/>
									Selectare după foldere
								</label>
								<label className="admin-exams-content-mode-option">
									<input
										type="radio"
										name="selection-mode"
										checked={examSettings.selectionMode === 'tags'}
										onChange={() => setExamSettings((prev) => ({ ...prev, selectionMode: 'tags' }))}
									/>
									Selectare după tag-uri
								</label>
								<label className="admin-exams-content-toggle">
									<input
										type="checkbox"
										checked={examSettings.includeStarred}
										onChange={(e) => setExamSettings((prev) => ({ ...prev, includeStarred: e.target.checked }))}
									/>
									Include întrebările marcate cu stea
								</label>
								<label className="admin-exams-content-count">
									Număr întrebări în examen
									<input
										type="number"
										min={1}
										max={200}
										value={examSettings.questionCount}
										onChange={(e) =>
											setExamSettings((prev) => ({
												...prev,
												questionCount: Math.max(1, Number(e.target.value || 1)),
											}))
										}
									/>
								</label>
							</div>
							<div className="admin-exams-content-summary-row">
								<span className="admin-exams-content-summary-chip">
									Mod: {examSettings.selectionMode === 'folders' ? 'Foldere' : 'Tag-uri'}
								</span>
								<span className="admin-exams-content-summary-chip">
									Stea obligatorie: {examSettings.includeStarred ? 'Da' : 'Nu'}
								</span>
								<span className="admin-exams-content-summary-chip">
									Întrebări variabile: {Number(examSettings.questionCount || 0)}
								</span>
							</div>
							{contentBanksError ? <p className="admin-exams-create-modal-error">{contentBanksError}</p> : null}
							{contentBanksLoading ? (
								<p>Se încarcă băncile...</p>
							) : examSettings.selectionMode === 'folders' && filteredContentBanks.length === 0 ? (
								<p>Nu există încă bănci de întrebări.</p>
							) : (
								<div className="admin-exams-content-banks">
									{examSettings.selectionMode === 'folders' && filteredContentBanks.map((bank) => (
										<button
											key={bank.id}
											type="button"
											className={`admin-exams-content-bank-item ${examSettings.selectedFolderIds.includes(bank.id) ? 'is-active' : ''}`}
											onClick={() =>
												setExamSettings((prev) => {
													const exists = prev.selectedFolderIds.includes(bank.id);
													const selectedFolderIds = exists
														? prev.selectedFolderIds.filter((fid) => fid !== bank.id)
														: [...prev.selectedFolderIds, bank.id];
													return {
														...prev,
														contentBankId: bank.id,
														selectedFolderIds,
													};
												})
											}
										>
											<div className="admin-exams-content-bank-main">
												<strong>{bank.title}</strong>
												<p>{bank.description || 'Fără descriere'}</p>
											</div>
											<span className="admin-exams-content-bank-count">{bank.questions_count || 0} întrebări</span>
										</button>
									))}
									{examSettings.selectionMode === 'tags' && questionTags.map((tag) => (
										<button
											key={tag}
											type="button"
											className={`admin-exams-content-bank-item ${examSettings.selectedTags.includes(tag) ? 'is-active' : ''}`}
											onClick={() =>
												setExamSettings((prev) => ({
													...prev,
													selectedTags: prev.selectedTags.includes(tag)
														? prev.selectedTags.filter((t) => t !== tag)
														: [...prev.selectedTags, tag],
												}))
											}
										>
											<div className="admin-exams-content-bank-main">
												<strong>{tag}</strong>
												<p>Tag de selecție</p>
											</div>
										</button>
									))}
								</div>
							)}
							<div className="admin-exams-create-modal-actions admin-exams-content-modal-actions">
								<button type="button" className="cancel" onClick={() => setShowContentModal(false)}>Închide</button>
								<button type="button" className="confirm" onClick={handleConfirmContentSelection} disabled={contentConfirmLoading}>
									{contentConfirmLoading ? 'Se salvează...' : 'Confirmă selecția'}
								</button>
							</div>
						</div>
					</div>
				)}
			</>
		);
	};

	return (
		<>
		<div className="admin-exams-page admin-course-builder-page has-detached-sidebar">
			<div className="admin-course-builder-layout admin-course-builder-layout-clean">
				<aside className="admin-exams-sidebar admin-course-builder-sidebar admin-course-builder-sidebar-clean admin-course-builder-sidebar-detached is-visible">
				<button type="button" className="admin-exams-back-btn admin-exams-back-btn-sidebar" onClick={() => setViewMode('list')}>
					← Inapoi la lista
				</button>
				<nav className="admin-exams-nav">
					{EXAM_SECTIONS.map((section) => (
						<button
							key={section}
							type="button"
							className={`admin-exams-nav-item ${activeSection === section ? 'is-active' : ''}`}
							onClick={() => setActiveSection(section)}
						>
							{section}
						</button>
					))}
				</nav>

				<div className="admin-exams-sidebar-footer">
					{canMutateInAdminArea && (
					<div className="admin-exams-sidebar-publish">
						<span className="admin-exams-sidebar-publish-label">Publicat</span>
						<button
							type="button"
							className="admin-view-switcher admin-exams-header-switch"
							onClick={handleTogglePublishedNow}
							aria-pressed={published}
							aria-label={published ? 'Examen publicat — apasă pentru a retrage în draft' : 'Examen în draft — apasă pentru a publica'}
							disabled={publishToggleLoading || saveState.loading}
						>
							<div
								className="admin-view-switcher-slider"
								style={{ transform: published ? 'translateX(27px)' : 'translateX(0)' }}
								aria-hidden
							/>
						</button>
					</div>
					)}
					{canMutateInAdminArea && (
					<button
						type="button"
						className="admin-exams-save-btn admin-exams-preview-btn"
						onClick={handleOpenPreview}
						disabled={saveState.loading || publishToggleLoading}
					>
						Previzualizează
					</button>
					)}
					{canMutateInAdminArea && (
					<button type="button" className="admin-exams-save-btn" onClick={() => handleSaveExam()} disabled={saveState.loading || publishToggleLoading}>
						{saveState.loading ? 'Se salveaza...' : 'Salveaza'}
					</button>
					)}
					{saveState.message ? <p className={`admin-exams-save-message is-${saveState.type}`}>{saveState.message}</p> : null}
				</div>
				</aside>

				<section className="admin-exams-workspace admin-course-builder-workspace admin-course-builder-workspace-clean">
					<div className="admin-course-builder-workspace-content">
						<div
							className={`admin-exams-content ${activeSection !== 'Creare examene' ? 'is-pane-expanded' : ''}`}
						>
							{renderSectionContent()}
						</div>
					</div>
				</section>
			</div>

		</div>
		{showPreviewModal && (
			<div className="admin-exams-create-modal-overlay" onClick={() => setShowPreviewModal(false)}>
				<div className="admin-exams-content-modal admin-exams-preview-modal" onClick={(e) => e.stopPropagation()}>
					<h3>Previzualizare examen</h3>
					{previewLoading ? (
						<p>Se încarcă previzualizarea...</p>
					) : previewError ? (
						<p className="admin-exams-create-modal-error">{previewError}</p>
					) : previewData ? (
						<div className="admin-exams-preview-body">
							<h4>{previewData.title || 'Examen fără titlu'}</h4>
							{previewData.description ? <p>{previewData.description}</p> : null}
							{previewData.instructions ? (
								<div className="admin-exams-preview-instructions">
									<strong>Instrucțiuni elev:</strong>
									<p>{previewData.instructions}</p>
								</div>
							) : null}
							<div className="admin-exams-preview-meta">
								<span>Prag: {previewData.passing_score ?? 70}%</span>
								<span>Timp: {previewData.time_limit_minutes ? `${previewData.time_limit_minutes} min` : 'nelimitat'}</span>
								<span>Încercări: {previewData.max_attempts ?? '-'}</span>
							</div>
							<div className="admin-exams-preview-questions">
								{(Array.isArray(previewData.questions) ? previewData.questions : []).map((q, idx) => (
									<article key={q.id || idx} className="admin-exams-preview-question">
										<h5>{idx + 1}. {q.text}</h5>
										{Array.isArray(q.options) && q.options.length > 0 ? (
											<ul>
												{q.options.map((option, optionIdx) => (
													<li key={`${q.id || idx}-${optionIdx}`}>{option}</li>
												))}
											</ul>
										) : (
											<small>Răspuns deschis</small>
										)}
									</article>
								))}
							</div>
						</div>
					) : (
						<p>Nu există date de previzualizare.</p>
					)}
					<div className="admin-exams-create-modal-actions admin-exams-content-modal-actions">
						<button type="button" className="cancel" onClick={() => setShowPreviewModal(false)}>Închide</button>
					</div>
				</div>
			</div>
		)}
		</>
	);
};

export default AdminExamsPage;
