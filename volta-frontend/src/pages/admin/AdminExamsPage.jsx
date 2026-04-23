import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { downloadSimpleExcel, statisticsExcelFilename } from '../../utils/statisticsExcelExport';
import './AdminTestsPage.css';
import './AdminExamsPage.css';

/** Id-uri stabile pentru logică; etichete cu diacritice în UI. */
const EXAM_BUILDER_SECTIONS = [
  { id: 'settings', label: 'Setări' },
  { id: 'questions', label: 'Întrebări' },
  { id: 'access', label: 'Acces' },
  { id: 'statistics', label: 'Statistici' },
];
const DEFAULT_EXAM_SECTION = EXAM_BUILDER_SECTIONS[0].id;

const FILTERS = [
  { value: 'all', label: 'Toate' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Publicat' },
  { value: 'archived', label: 'Arhivat' },
];
const DEFAULT_SETTINGS = {
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
  deadlineAt: '',
  deadlineDays: 7,
  contentBankId: null,
  selectionMode: 'folders',
  selectedFolderIds: [],
  selectedTags: [],
  includeStarred: true,
  questionCount: 10,
};

const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};
const typeLabel = (type) => ({
  multiple_choice: 'Grilă',
  single_choice: 'Alegere unică',
  true_false: 'Adevărat / fals',
  matching: 'Asocieri',
  ordering: 'Ordonare',
}[type] || type);

function examStatusLabelRo(status) {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'published') return 'Publicat';
  if (s === 'archived') return 'Arhivat';
  return 'Draft';
}

export default function AdminExamsPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { canMutateInAdminArea } = useAuth();
  const [viewMode, setViewMode] = useState('list');
  const [activeSection, setActiveSection] = useState(DEFAULT_EXAM_SECTION);
  const [published, setPublished] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [examSettings, setExamSettings] = useState(DEFAULT_SETTINGS);
  const [showContentModal, setShowContentModal] = useState(false);
  const [contentBanks, setContentBanks] = useState([]);
  const [questionTags, setQuestionTags] = useState([]);
  const [contentBanksLoading, setContentBanksLoading] = useState(false);
  const [contentBanksError, setContentBanksError] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [contentSort, setContentSort] = useState('questions_desc');
  const [contentOnlyWithQuestions, setContentOnlyWithQuestions] = useState(false);
  const [contentConfirmLoading, setContentConfirmLoading] = useState(false);
  const [examAccess, setExamAccess] = useState({ mode: 'all_students', selectedStudents: [] });
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [studentsSearch, setStudentsSearch] = useState('');
  const [studentsList, setStudentsList] = useState([]);
  const [studentsDraftSelected, setStudentsDraftSelected] = useState([]);
  const [manualReviewState, setManualReviewState] = useState({ reviewMode: 'after_complete' });
  const [statisticsRows, setStatisticsRows] = useState([]);
  const [statisticsQuestionRows, setStatisticsQuestionRows] = useState([]);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsTab, setStatisticsTab] = useState('students');
  const [statisticsStatusFilter, setStatisticsStatusFilter] = useState('all');
  const [statisticsDateFrom, setStatisticsDateFrom] = useState('');
  const [statisticsDateTo, setStatisticsDateTo] = useState('');

  const selectedBank = useMemo(() => contentBanks.find((bank) => String(bank.id) === String(examSettings.contentBankId)), [contentBanks, examSettings.contentBankId]);
  const selectedFoldersStarred = useMemo(() => contentBanks.filter((bank) => examSettings.selectedFolderIds.includes(bank.id)).reduce((acc, bank) => acc + Number(bank?.starred_questions_count || 0), 0), [contentBanks, examSettings.selectedFolderIds]);
  const selectedStudentsPreview = useMemo(() => studentsList.filter((student) => examAccess.selectedStudents.includes(student.id)).slice(0, 8), [studentsList, examAccess.selectedStudents]);
  const listStats = useMemo(() => {
    const counts = { all: items.length, draft: 0, published: 0, archived: 0 };
    items.forEach((item) => {
      const status = String(item?.status || 'draft').toLowerCase();
      if (status in counts) counts[status] += 1;
    });
    return counts;
  }, [items]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = listStatusFilter === 'all' || String(item?.status || 'draft').toLowerCase() === listStatusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return String(item?.title || '').toLowerCase().includes(query) || String(item?.course_title || '').toLowerCase().includes(query);
    });
  }, [items, listStatusFilter, search]);
  const filteredContentBanks = useMemo(() => {
    const query = contentSearch.trim().toLowerCase();
    let rows = Array.isArray(contentBanks) ? [...contentBanks] : [];
    if (query) rows = rows.filter((bank) => String(bank?.title || '').toLowerCase().includes(query) || String(bank?.description || '').toLowerCase().includes(query));
    if (contentOnlyWithQuestions) rows = rows.filter((bank) => Number(bank?.questions_count || 0) > 0);
    rows.sort((a, b) => {
      const countA = Number(a?.questions_count || 0);
      const countB = Number(b?.questions_count || 0);
      const titleCompare = String(a?.title || '').localeCompare(String(b?.title || ''), 'ro', { sensitivity: 'base' });
      if (contentSort === 'title_asc') return titleCompare;
      if (contentSort === 'title_desc') return -titleCompare;
      if (contentSort === 'questions_asc') return countA - countB;
      return countB - countA;
    });
    return rows;
  }, [contentBanks, contentOnlyWithQuestions, contentSearch, contentSort]);
  const filteredStatisticsRows = useMemo(() => statisticsRows.filter((row) => {
    if (statisticsStatusFilter !== 'all' && String(row?.status || '') !== statisticsStatusFilter) return false;
    const completedAt = row?.completed_at ? new Date(row.completed_at) : null;
    if (statisticsDateFrom) {
      const from = new Date(`${statisticsDateFrom}T00:00:00`);
      if (!completedAt || completedAt < from) return false;
    }
    if (statisticsDateTo) {
      const to = new Date(`${statisticsDateTo}T23:59:59`);
      if (!completedAt || completedAt > to) return false;
    }
    return true;
  }), [statisticsRows, statisticsStatusFilter, statisticsDateFrom, statisticsDateTo]);
  const builderHeroTitle = examSettings.title?.trim() || activeExamDraft.title || 'Examen nou';
  const builderHeroSubtitle = 'Setări, întrebări, acces și statistici într-un layout clar.';
  const builderHeroAccent = published ? 'var(--color-success)' : 'var(--color-warning)';

  const deleteConfirmTitle = deleteConfirmExam?.title || 'Examen';
  const contentSelectionLabel = examSettings.selectionMode === 'folders' ? 'Foldere' : 'Tag-uri';
  const contentSelectionCount = examSettings.selectionMode === 'folders'
    ? examSettings.selectedFolderIds.length
    : examSettings.selectedTags.length;
  const studentsDraftCount = studentsDraftSelected.length;
  const previewQuestionCount = Array.isArray(previewData?.questions) ? previewData.questions.length : 0;
  const activeBuilderSection = EXAM_BUILDER_SECTIONS.find((section) => section.id === activeSection) || EXAM_BUILDER_SECTIONS[0];
  const builderSidecarConfig = {
    settings: {
      eyebrow: 'Focus pe identitate',
      title: 'Pui la punct prima impresie',
      description: 'Stabilește titlul examenului și regulile de notare, timp și comportament din această secțiune.',
      facts: [
        { label: 'Review', value: examSettings.manualReview ? 'Manual' : 'Auto' },
        { label: 'Timp', value: examSettings.timeLimitEnabled ? `${examSettings.timeLimitMinutes} min` : 'Nelimitat' },
        { label: 'Deadline', value: examSettings.deadlineType === 'none' ? 'Fara' : 'Setat' },
      ],
    },
    questions: {
      eyebrow: 'Focus pe continut',
      title: 'Alegi sursa de intrebari',
      description: 'Schimbi intre foldere si tag-uri, vezi imediat cate intrebari intra si cata informatie vei acoperi.',
      facts: [
        { label: 'Mod', value: contentSelectionLabel },
        { label: 'Selectate', value: String(contentSelectionCount) },
        { label: 'In examen', value: String(Number(examSettings.questionCount || 0)) },
        { label: 'Stele', value: String(examSettings.includeStarred ? selectedFoldersStarred : 0) },
      ],
    },
    access: {
      eyebrow: 'Focus pe distributie',
      title: 'Controlezi cine vede examenul',
      description: 'Alegi intre acces pentru toti elevii sau doar o selectie precisa, fara sa iesi din builder.',
      facts: [
        { label: 'Mod acces', value: examAccess.mode === 'selected_students' ? 'Selectat' : 'General' },
        { label: 'Elevi', value: examAccess.mode === 'selected_students' ? String(examAccess.selectedStudents.length) : 'Toti' },
        { label: 'Preview', value: String(selectedStudentsPreview.length) },
        { label: 'Plus', value: examAccess.selectedStudents.length > selectedStudentsPreview.length ? `+${examAccess.selectedStudents.length - selectedStudentsPreview.length}` : '0' },
      ],
    },
    statistics: {
      eyebrow: 'Focus pe analiza',
      title: 'Vezi ce functioneaza si ce nu',
      description: 'Rezultatele si analizele pe intrebari te ajuta sa ajustezi examenul fara sa iesi din pagina.',
      facts: [
        { label: 'Rezultate', value: String(filteredStatisticsRows.length) },
        { label: 'Intrebari', value: String(statisticsQuestionRows.length) },
        { label: 'Tab activ', value: statisticsTab === 'students' ? 'Elevi' : 'Intrebari' },
        { label: 'Export', value: statisticsRows.length ? 'Disponibil' : 'Gol' },
      ],
    },
  }[activeSection] || {
    eyebrow: activeBuilderSection?.label || 'Builder',
    title: builderHeroTitle,
    description: builderHeroSubtitle,
    facts: [],
  };

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminService.getExams();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load exams:', e);
      setItems([]);
      setError('Nu s-a putut încărca lista de examene.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { if (!canMutateInAdminArea && viewMode !== 'list') setViewMode('list'); }, [canMutateInAdminArea, viewMode]);

  const handleRefreshStatistics = useCallback(async (notify = false) => {
    if (viewMode !== 'create' || activeSection !== 'statistics') return;
    if (!activeExamDraft.id) { setStatisticsRows([]); setStatisticsQuestionRows([]); return; }
    try {
      setStatisticsLoading(true);
      const [resultsData, questionData] = await Promise.all([adminService.getExamResults(activeExamDraft.id), adminService.getExamQuestionAnalytics(activeExamDraft.id)]);
      setStatisticsRows(Array.isArray(resultsData) ? resultsData : []);
      setStatisticsQuestionRows(Array.isArray(questionData) ? questionData : []);
      if (notify) toastSuccess('Statisticile au fost actualizate.');
    } catch (e) {
      console.error('Failed to refresh statistics:', e);
      setStatisticsRows([]); setStatisticsQuestionRows([]);
      if (notify) toastError('Nu s-au putut actualiza statisticile.');
    } finally { setStatisticsLoading(false); }
  }, [activeExamDraft.id, activeSection, viewMode, toastSuccess, toastError]);

  useEffect(() => { handleRefreshStatistics(); }, [handleRefreshStatistics]);

  const handleOpenCreateModal = () => { setCreateTitle(''); setCreateDescription(''); setCreateError(''); setShowCreateModal(true); };
  const handleConfirmCreate = async () => {
    const title = createTitle.trim();
    if (!title) { setCreateError('Titlul este obligatoriu.'); return; }
    setCreateError(''); setCreatingExam(true);
    try {
      const response = await adminService.createExam({ title, description: createDescription.trim(), max_score: 100 });
      const createdExam = response?.exam || response;
      if (createdExam?.id) setItems((prev) => [createdExam, ...prev]);
      setActiveExamDraft({ id: createdExam?.id || null, title, description: createDescription.trim(), course_id: null });
      setExamSettings({ ...DEFAULT_SETTINGS, title, description: createDescription.trim() });
      setExamAccess({ mode: 'all_students', selectedStudents: [] });
      setPublished(false); setShowCreateModal(false); setViewMode('create'); setActiveSection(DEFAULT_EXAM_SECTION);
    } catch (e) {
      console.error('Failed to create exam:', e);
      setCreateError(e?.response?.data?.message || 'Nu s-a putut crea examenul.');
    } finally { setCreatingExam(false); }
  };

  const handleDuplicateExam = async (item) => {
    if (!item?.id) return;
    setDuplicatingExamId(item.id);
    try {
      const data = await adminService.duplicateExam(item.id);
      const exam = data?.exam;
      if (exam?.id) setItems((prev) => [exam, ...prev]);
      toastSuccess(data?.message || 'Examen duplicat.');
    } catch (e) {
      console.error('Failed to duplicate exam:', e);
      toastError(e?.response?.data?.message || 'Nu s-a putut duplica examenul.');
    } finally { setDuplicatingExamId(null); }
  };

  const patchExamListStatus = async (item, status) => {
    if (!item?.id || !canMutateInAdminArea) return;
    setListActionId(item.id);
    try {
      await adminService.updateExam(item.id, { status, title: item.title || 'Examen' });
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status } : row)));
      toastSuccess(status === 'published' ? 'Examen publicat.' : status === 'archived' ? 'Examen arhivat.' : 'Examen mutat in draft.');
    } catch (e) {
      console.error('Failed to patch exam status:', e);
      toastError(e?.response?.data?.message || 'Nu s-a putut actualiza statusul.');
    } finally { setListActionId(null); }
  };

  const handleConfirmDeleteExam = async () => {
    if (!deleteConfirmExam?.id || !canMutateInAdminArea) return;
    setListActionId(deleteConfirmExam.id);
    try {
      await adminService.deleteExam(deleteConfirmExam.id);
      setItems((prev) => prev.filter((row) => row.id !== deleteConfirmExam.id));
      toastSuccess('Examen sters.'); setDeleteConfirmExam(null);
    } catch (e) {
      console.error('Failed to delete exam:', e);
      toastError(e?.response?.data?.message || 'Nu s-a putut sterge examenul.');
    } finally { setListActionId(null); }
  };
  const handleOpenExistingExam = (item, options = {}) => {
    setActiveExamDraft({ id: item?.id || null, title: item?.title || '', description: item?.description || '', course_id: item?.course_id || null });
    setExamSettings({
      ...DEFAULT_SETTINGS,
      title: item?.title || '', description: item?.description || '', instructions: item?.settings?.instructions || '',
      attempts: Number(item?.max_attempts ?? 1) || 1, passingScore: Number(item?.passing_score ?? 0) || 0,
      timeLimitEnabled: Boolean(item?.time_limit_minutes), timeLimitMinutes: Number(item?.time_limit_minutes || 60),
      shuffleQuestions: Boolean(item?.settings?.shuffle_questions), manualReview: Boolean(item?.settings?.manual_review),
      showFeedbackInstant: Boolean(item?.settings?.show_feedback_instant), showCorrectAnswers: Boolean(item?.settings?.show_correct_answers),
      navigationMode: item?.settings?.navigation_mode || 'sequential', deadlineType: item?.settings?.deadline_type || 'none',
      deadlineAt: localDateTime(item?.settings?.deadline_at), deadlineDays: Number(item?.settings?.deadline_days ?? 7) || 7,
      contentBankId: item?.settings?.question_bank_id || null, selectionMode: item?.settings?.selection_mode || 'folders',
      selectedFolderIds: Array.isArray(item?.settings?.folder_ids) ? item.settings.folder_ids : [],
      selectedTags: Array.isArray(item?.settings?.tags) ? item.settings.tags : [], includeStarred: item?.settings?.include_starred !== false,
      questionCount: Number(item?.settings?.question_count ?? item?.question_selection?.count ?? 10) || 10,
    });
    setExamAccess({ mode: item?.settings?.access_mode || 'all_students', selectedStudents: Array.isArray(item?.settings?.selected_students) ? item.settings.selected_students.map((id) => Number(id)).filter(Boolean) : [] });
    setManualReviewState({ reviewMode: item?.settings?.manual_review_mode || 'after_complete' });
    setPublished(String(item?.status || 'draft').toLowerCase() === 'published');
    setSaveState({ loading: false, message: '', type: '' });
    setViewMode('create');
    setActiveSection(
      options.initialSection && EXAM_BUILDER_SECTIONS.some((s) => s.id === options.initialSection)
        ? options.initialSection
        : DEFAULT_EXAM_SECTION,
    );
  };

  const handleOpenStudentsModal = async () => {
    setShowStudentsModal(true); setStudentsError(''); setStudentsSearch(''); setStudentsLoading(true);
    setStudentsDraftSelected(Array.isArray(examAccess.selectedStudents) ? [...examAccess.selectedStudents] : []);
    try {
      const rows = await adminService.getUsers({ role: 'student', per_page: 500 });
      setStudentsList(Array.isArray(rows) ? rows.map((user) => ({ id: Number(user?.id), name: user?.name || 'Elev', email: user?.email || '' })).filter((user) => Number.isFinite(user.id)) : []);
    } catch (e) {
      console.error('Failed to load students:', e);
      setStudentsList([]); setStudentsError('Nu s-au putut incarca elevii.');
    } finally { setStudentsLoading(false); }
  };
  const handleToggleStudentDraft = (studentId) => setStudentsDraftSelected((prev) => prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]);
  const handleApplyStudentsSelection = () => { setExamAccess((prev) => ({ ...prev, selectedStudents: [...studentsDraftSelected] })); setShowStudentsModal(false); };

  const handleSaveExam = async (options = {}) => {
    const forcedPublished = Object.prototype.hasOwnProperty.call(options, 'published') ? Boolean(options.published) : null;
    const effectivePublished = forcedPublished === null ? published : forcedPublished;
    const title = (examSettings.title || activeExamDraft.title || '').trim();
    if (!title) { setSaveState({ loading: false, message: 'Titlul examenului este obligatoriu.', type: 'error' }); return false; }
    setSaveState({ loading: true, message: '', type: '' });
    try {
      const payload = {
        title,
        description: examSettings.description || null,
        max_score: 100,
        max_attempts: Number(examSettings.attempts || 1),
        time_limit_minutes: examSettings.timeLimitEnabled ? Math.max(1, Number(examSettings.timeLimitMinutes || 60)) : null,
        passing_score: Number(examSettings.passingScore || 0),
        is_required: Boolean(effectivePublished),
        status: effectivePublished ? 'published' : 'draft',
        settings: {
          shuffle_questions: Boolean(examSettings.shuffleQuestions), manual_review: Boolean(examSettings.manualReview),
          show_feedback_instant: Boolean(examSettings.showFeedbackInstant), show_correct_answers: Boolean(examSettings.showCorrectAnswers),
          manual_review_mode: manualReviewState.reviewMode, navigation_mode: examSettings.navigationMode,
          deadline_type: examSettings.deadlineType,
          deadline_at: examSettings.deadlineType === 'fixed' && examSettings.deadlineAt ? new Date(examSettings.deadlineAt).toISOString() : null,
          deadline_days: examSettings.deadlineType === 'relative' ? Math.max(1, Number(examSettings.deadlineDays || 1)) : null,
          question_bank_id: examSettings.contentBankId || null,
          instructions: examSettings.instructions || null, access_mode: examAccess.mode, selected_students: examAccess.selectedStudents,
          selection_mode: examSettings.selectionMode, folder_ids: examSettings.selectedFolderIds, tags: examSettings.selectedTags,
          include_starred: examSettings.includeStarred, question_count: Number(examSettings.questionCount || 0),
        },
        question_selection: { mode: 'random', count: Number(examSettings.questionCount || 0), folder_ids: examSettings.selectedFolderIds, tags: examSettings.selectedTags, include_starred: examSettings.includeStarred },
      };
      if (activeExamDraft.id) {
        const response = await adminService.updateExam(activeExamDraft.id, payload);
        const updatedExam = response?.exam || response;
        setItems((prev) => prev.map((item) => (item.id === updatedExam.id ? { ...item, ...updatedExam } : item)));
      } else {
        const response = await adminService.createExam(payload);
        const createdExam = response?.exam || response;
        setItems((prev) => [createdExam, ...prev]);
        setActiveExamDraft((prev) => ({ ...prev, id: createdExam?.id || prev.id, title }));
      }
      setPublished(effectivePublished);
      setSaveState({ loading: false, message: forcedPublished === null ? 'Examen salvat cu succes.' : effectivePublished ? 'Examen publicat cu succes.' : 'Examen retras in draft.', type: 'success' });
      return true;
    } catch (e) {
      console.error('Failed to save exam:', e);
      setSaveState({ loading: false, message: e?.response?.data?.message || 'Nu s-a putut salva examenul.', type: 'error' });
      return false;
    }
  };

  const handleTogglePublishedNow = async () => {
    const nextPublished = !published; setPublished(nextPublished); setPublishToggleLoading(true);
    try { const ok = await handleSaveExam({ published: nextPublished }); if (!ok) setPublished(!nextPublished); } finally { setPublishToggleLoading(false); }
  };
  const handleOpenPreview = async () => {
    if (!activeExamDraft.id) { toastError('Salveaza examenul inainte de previzualizare.'); return; }
    setShowPreviewModal(true); setPreviewLoading(true); setPreviewError(''); setPreviewData(null);
    try { setPreviewData(await adminService.previewExam(activeExamDraft.id)); }
    catch (e) { console.error('Failed to preview exam:', e); setPreviewError(e?.response?.data?.message || 'Nu s-a putut incarca previzualizarea examenului.'); }
    finally { setPreviewLoading(false); }
  };  const handleOpenContentModal = async () => {
    setShowContentModal(true); setContentBanksLoading(true); setContentBanksError('');
    try {
      const [banks, tags] = await Promise.all([adminService.getQuestionBanks(), adminService.getQuestionTagSuggestions()]);
      setContentBanks(Array.isArray(banks) ? banks : []); setQuestionTags(Array.isArray(tags) ? tags : []);
    } catch (e) {
      console.error('Failed to load content sources:', e);
      setContentBanks([]); setQuestionTags([]); setContentBanksError('Nu s-au putut incarca bancile de intrebari.');
    } finally { setContentBanksLoading(false); }
  };
  const handleConfirmContentSelection = async () => { setContentConfirmLoading(true); try { const ok = await handleSaveExam(); if (ok) setShowContentModal(false); } finally { setContentConfirmLoading(false); } };

  const exportStatistics = () => {
    downloadSimpleExcel(
      statisticsExcelFilename(`examen-${activeExamDraft.id || 'export'}`),
      'Statistici examen',
      ['Data susținerii', 'Nume complet', 'Email', 'Status', 'Scor'],
      filteredStatisticsRows.map((row) => [
        row.completed_at ? new Date(row.completed_at).toLocaleDateString('ro-RO') : '-',
        row.user?.name || '-',
        row.user?.email || '-',
        row.status || '-',
        row.percentage != null ? `${row.percentage}%` : '-',
      ]),
    );
  };
  const listView = (
    <div className="admin-tests-page admin-exams-modern-page admin-exams-page">
      <header className="admin-exams-list-hero va-card-shell va-card-shell--uniform">
        <div className="admin-exams-list-hero-copy">
          <div className="admin-exams-list-hero-top">
            <div className="admin-exams-list-hero-title-wrap">
              <span className="admin-exams-list-hero-kicker">Examene</span>
              <h1>Examene</h1>
            </div>
            <div className="admin-tests-header-actions admin-exams-list-hero-actions">
              {canMutateInAdminArea ? (
                <button type="button" className="admin-tests-primary-btn" onClick={handleOpenCreateModal}>
                  + Creează examen
                </button>
              ) : null}
            </div>
          </div>
          <p className="admin-exams-header-lead">Builder pentru examene: selecție întrebări, acces și statistici.</p>
          <div className="admin-exams-list-hero-metrics" aria-label="Rezumat examene">
            <div>
              <span>Total</span>
              <strong>{listStats.all}</strong>
            </div>
            <div>
              <span>Draft</span>
              <strong>{listStats.draft}</strong>
            </div>
            <div>
              <span>Publicate</span>
              <strong>{listStats.published}</strong>
            </div>
            <div>
              <span>Arhivate</span>
              <strong>{listStats.archived}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="admin-exams-modern-toolbar">
        <div className="admin-tests-search admin-exams-modern-search">
          <input
            type="search"
            placeholder="Caută după titlu sau curs…"
            aria-label="Caută examene"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-exams-modern-filter-select-wrap">
          <label htmlFor="admin-exams-status-filter" className="admin-exams-modern-filter-label">Status</label>
          <select
            id="admin-exams-status-filter"
            className="admin-exams-modern-status-select"
            value={listStatusFilter}
            onChange={(e) => setListStatusFilter(e.target.value)}
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-exams-modern-skeleton-grid" aria-busy="true" aria-label="Se încarcă examenele">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="admin-exams-list-skeleton-card" />
          ))}
        </div>
      ) : error ? (
        <div className="admin-tests-empty">{error}</div>
      ) : filteredItems.length === 0 ? (
        <div className="admin-tests-empty admin-exams-modern-empty">
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
            {items.length === 0 ? 'Niciun examen încă' : 'Niciun rezultat'}
          </p>
          <p className="admin-exams-list-empty-hint" style={{ marginTop: '0.5rem' }}>
            {items.length === 0
              ? 'Creează primul examen sau verifică mai târziu.'
              : 'Schimbă filtrul sau termenii de căutare.'}
          </p>
        </div>
      ) : (
        <div className="admin-tests-grid admin-exams-modern-grid">
          {filteredItems.map((item) => {
            const status = String(item?.status || 'draft').toLowerCase();
            const busy = listActionId === item.id;
            return (
              <article
                key={item.id}
                className={`admin-tests-card admin-exams-modern-card admin-exams-modern-card--${status} va-card-shell va-card-shell--uniform`}
              >
                <div className="admin-exams-modern-card-body va-card-content">
                  <div className="admin-tests-card-head admin-exams-modern-card-head">
                    <h3>{item.title || 'Examen fără titlu'}</h3>
                    <span className="admin-exams-modern-card-context">
                      {item.course_title ? item.course_title : 'Examen independent'}
                    </span>
                  </div>
                  <p className="admin-exams-modern-card-desc va-card-subtitle">{item.description || 'Fără descriere.'}</p>
                  <div className="admin-exams-modern-meta-grid">
                    <div className="admin-exams-modern-meta-item">
                      <span>Întrebări</span>
                      <strong>{item.questions_count ?? 0}</strong>
                    </div>
                    <div className="admin-exams-modern-meta-item">
                      <span>Prag minim</span>
                      <strong>{Number(item.passing_score ?? 0)}%</strong>
                    </div>
                    <div className="admin-exams-modern-meta-item">
                      <span>Încercări</span>
                      <strong>{item.max_attempts != null ? item.max_attempts : '—'}</strong>
                    </div>
                    <div className="admin-exams-modern-meta-item">
                      <span>Status</span>
                      <strong>{examStatusLabelRo(item.status)}</strong>
                    </div>
                  </div>
                  {canMutateInAdminArea ? (
                    <div className="admin-exams-modern-card-actions">
                      <div className="admin-tests-actions-primary admin-exams-modern-card-primary-row">
                        <button type="button" className="is-wide admin-exams-modern-card-primary-btn" disabled={busy} onClick={() => handleOpenExistingExam(item)}>
                          Deschide builder-ul
                        </button>
                      </div>
                      <div className="admin-exams-modern-card-actions-grid">
                        <button
                          type="button"
                          className="admin-exams-modern-card-action"
                          disabled={busy || duplicatingExamId === item.id}
                          onClick={() => handleDuplicateExam(item)}
                        >
                          {duplicatingExamId === item.id ? 'Se duplică...' : 'Duplică'}
                        </button>
                        {status !== 'published' ? (
                          <button
                            type="button"
                            className="admin-exams-modern-card-action is-emphasis"
                            disabled={busy}
                            onClick={() => patchExamListStatus(item, 'published')}
                          >
                            Publică
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-exams-modern-card-action"
                            disabled={busy}
                            onClick={() => patchExamListStatus(item, 'archived')}
                          >
                            Arhivează
                          </button>
                        )}
                        {status === 'archived' ? (
                          <button
                            type="button"
                            className="admin-exams-modern-card-action"
                            disabled={busy}
                            onClick={() => patchExamListStatus(item, 'draft')}
                          >
                            În draft
                          </button>
                        ) : null}
                      </div>
                      <button type="button" className="admin-exams-modern-card-danger-btn" disabled={busy} onClick={() => setDeleteConfirmExam(item)}>
                        Șterge
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const sectionBody = activeSection === 'settings' ? (
    <div className="admin-exams-modern-section admin-exams-builder-form-root">
      <div className="admin-exams-builder-panel">
        <section className="admin-exams-builder-card va-card-shell va-card-shell--uniform">
          <h3 className="admin-exams-builder-card-title">Identitate</h3>
          <p className="admin-exams-builder-card-lead">Titlul examenului așa cum apare pentru elevi.</p>
          <div className="admin-exams-builder-field-grid">
            <label className="admin-exams-builder-field-span2">
              Titlu examen
              <input type="text" value={examSettings.title} onChange={(e) => setExamSettings((prev) => ({ ...prev, title: e.target.value }))} />
            </label>
          </div>
        </section>

        <section className="admin-exams-builder-card va-card-shell va-card-shell--uniform">
          <h3 className="admin-exams-builder-card-title">Notare, timp și încercări</h3>
          <p className="admin-exams-builder-card-lead">Pragul de promovare, reluările și limita de timp pentru întreg examenul.</p>
          <div className="admin-exams-builder-field-grid">
            <label>
              Prag de promovare (%)
              <input type="number" min={0} max={100} value={examSettings.passingScore} onChange={(e) => setExamSettings((prev) => ({ ...prev, passingScore: Number(e.target.value || 0) }))} />
            </label>
            <label>
              Număr maxim de încercări
              <input type="number" min={1} max={20} value={examSettings.attempts} onChange={(e) => setExamSettings((prev) => ({ ...prev, attempts: Number(e.target.value || 1) }))} />
            </label>
            <label className="admin-exams-builder-field-span2 admin-exams-builder-toggle-row">
              <input
                type="checkbox"
                checked={examSettings.timeLimitEnabled}
                onChange={(e) => setExamSettings((prev) => ({ ...prev, timeLimitEnabled: e.target.checked }))}
              />
              <span>Activează limită de timp pentru întreg examenul</span>
            </label>
            {examSettings.timeLimitEnabled ? (
              <label>
                Durată (minute)
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={examSettings.timeLimitMinutes}
                  onChange={(e) => setExamSettings((prev) => ({ ...prev, timeLimitMinutes: Math.max(1, Number(e.target.value || 1)) }))}
                />
              </label>
            ) : null}
            <label>
              Termen limită
              <select value={examSettings.deadlineType} onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineType: e.target.value }))}>
                <option value="none">Fără termen</option>
                <option value="fixed">Dată fixă</option>
                <option value="relative">Zile de la începere</option>
              </select>
            </label>
            {examSettings.deadlineType === 'fixed' ? (
              <label>
                Dată și oră limită
                <input type="datetime-local" value={examSettings.deadlineAt} onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineAt: e.target.value }))} />
              </label>
            ) : null}
            {examSettings.deadlineType === 'relative' ? (
              <label>
                Zile disponibile
                <input type="number" min={1} max={365} value={examSettings.deadlineDays} onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineDays: Math.max(1, Number(e.target.value || 1)) }))} />
              </label>
            ) : null}
          </div>
        </section>

        <section className="admin-exams-builder-card va-card-shell va-card-shell--uniform">
          <h3 className="admin-exams-builder-card-title">Comportament în timpul examenului</h3>
          <p className="admin-exams-builder-card-lead">Navigare între întrebări și modul de revizuire manuală.</p>
          <div className="admin-exams-builder-field-grid">
            <label>
              Navigare între întrebări
              <select value={examSettings.navigationMode} onChange={(e) => setExamSettings((prev) => ({ ...prev, navigationMode: e.target.value }))}>
                <option value="sequential">Secvențială (una câte una)</option>
                <option value="free">Liberă (salt între întrebări)</option>
              </select>
            </label>
            <label>
              Revizuire manuală
              <select value={manualReviewState.reviewMode} onChange={(e) => setManualReviewState((prev) => ({ ...prev, reviewMode: e.target.value }))}>
                <option value="after_complete">După finalizare</option>
                <option value="partial">Parțial</option>
              </select>
            </label>
          </div>
          <div className="admin-exams-builder-checks">
            <label>
              <input type="checkbox" checked={examSettings.shuffleQuestions} onChange={(e) => setExamSettings((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))} />
              Amestecă întrebările la fiecare încercare
            </label>
            <label>
              <input type="checkbox" checked={examSettings.manualReview} onChange={(e) => setExamSettings((prev) => ({ ...prev, manualReview: e.target.checked }))} />
              Necesită verificare manuală
            </label>
            <label>
              <input type="checkbox" checked={examSettings.showFeedbackInstant} onChange={(e) => setExamSettings((prev) => ({ ...prev, showFeedbackInstant: e.target.checked }))} />
              Afișează rezultatul imediat după trimitere
            </label>
            <label>
              <input type="checkbox" checked={examSettings.showCorrectAnswers} onChange={(e) => setExamSettings((prev) => ({ ...prev, showCorrectAnswers: e.target.checked }))} />
              Afișează răspunsurile corecte (unde e cazul)
            </label>
          </div>
        </section>
      </div>
    </div>
  ) : activeSection === 'questions' ? (
    <div className="admin-exams-modern-section admin-exams-builder-form-root">
      <div className="admin-exams-builder-panel">
        <section className="admin-exams-builder-card va-card-shell va-card-shell--uniform">
          <div className="admin-exams-builder-card-head">
            <div>
              <h3 className="admin-exams-builder-card-title">Întrebări în examen</h3>
              <p className="admin-exams-builder-card-lead">Alegi sursa din banca de întrebări, apoi salvezi examenul. Poți deschide selectorul ori de câte ori ai nevoie.</p>
            </div>
            <button type="button" className="admin-exams-builder-primary-outline" onClick={handleOpenContentModal}>
              Deschide selectorul
            </button>
          </div>
          <div className="admin-exams-builder-field-grid">
            <label>
              Mod de selecție
              <select value={examSettings.selectionMode} onChange={(e) => setExamSettings((prev) => ({ ...prev, selectionMode: e.target.value }))}>
                <option value="folders">Foldere</option>
                <option value="tags">Etichete (tag-uri)</option>
              </select>
            </label>
            <label>
              Număr de întrebări în examen
              <input type="number" min={1} max={200} value={examSettings.questionCount} onChange={(e) => setExamSettings((prev) => ({ ...prev, questionCount: Math.max(1, Number(e.target.value || 1)) }))} />
            </label>
            <label className="admin-exams-builder-toggle-row admin-exams-builder-field-span2">
              <input type="checkbox" checked={examSettings.includeStarred} onChange={(e) => setExamSettings((prev) => ({ ...prev, includeStarred: e.target.checked }))} />
              <span>Include întrebările marcate cu stea din folderele alese</span>
            </label>
          </div>
          <div className="admin-exams-builder-summary-inline" aria-label="Rezumat selecție">
            <div>
              <span className="admin-exams-modern-summary-label">Selecție</span>
              <strong>{examSettings.selectionMode === 'folders' ? `${examSettings.selectedFolderIds.length} foldere` : `${examSettings.selectedTags.length} etichete`}</strong>
            </div>
            <div>
              <span className="admin-exams-modern-summary-label">În examen</span>
              <strong>{Number(examSettings.questionCount || 0)} întrebări</strong>
            </div>
            <div>
              <span className="admin-exams-modern-summary-label">Cu stea (estimare)</span>
              <strong>{examSettings.includeStarred ? selectedFoldersStarred : 0}</strong>
            </div>
            <div>
              <span className="admin-exams-modern-summary-label">Bancă activă</span>
              <strong>{selectedBank?.title || '—'}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  ) : activeSection === 'access' ? (
    <div className="admin-exams-modern-section admin-exams-builder-form-root">
      <div className="admin-exams-builder-panel">
        <section className="admin-exams-builder-card va-card-shell va-card-shell--uniform">
          <div className="admin-exams-builder-card-head">
            <div>
              <h3 className="admin-exams-builder-card-title">Acces la examen</h3>
              <p className="admin-exams-builder-card-lead">Poți deschide examenul tuturor elevilor sau doar unei liste pe care o alegi.</p>
            </div>
            {examAccess.mode === 'selected_students' ? (
              <button type="button" className="admin-exams-builder-primary-outline" onClick={handleOpenStudentsModal}>
                Alege elevii
              </button>
            ) : null}
          </div>
          <div className="admin-exams-builder-field-grid">
            <label>
              Mod acces
              <select value={examAccess.mode} onChange={(e) => setExamAccess((prev) => ({ ...prev, mode: e.target.value }))}>
                <option value="all_students">Toți elevii</option>
                <option value="selected_students">Doar elevii selectați</option>
              </select>
            </label>
            <label>
              Rezumat
              <input
                type="text"
                readOnly
                value={examAccess.mode === 'selected_students' ? `${examAccess.selectedStudents.length} elevi selectați` : 'Acces general'}
              />
            </label>
          </div>
          {examAccess.mode === 'selected_students' ? (
            <div className="admin-exams-modern-student-chips admin-exams-builder-student-chips">
              {selectedStudentsPreview.length > 0 ? (
                selectedStudentsPreview.map((student) => (
                  <span key={student.id} className="admin-exams-modern-student-chip">
                    {student.name}
                  </span>
                ))
              ) : (
                <span className="admin-exams-modern-empty-note">Nicio selecție încă — apasă „Alege elevii”.</span>
              )}
              {examAccess.selectedStudents.length > selectedStudentsPreview.length ? (
                <span className="admin-exams-modern-student-chip is-muted">
                  +{examAccess.selectedStudents.length - selectedStudentsPreview.length} în plus
                </span>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  ) : activeSection === 'statistics' ? (
    <div className="admin-exams-modern-section admin-exams-builder-form-root">
      <div className="admin-exams-builder-panel">
        <div className="admin-exams-statistics admin-exams-builder-statistics-card">
          <div className="admin-exams-statistics-head">
            <h2>Statistici</h2>
            <p>Rezultate pe elevi și analiză pe întrebări pentru examenul curent.</p>
            <button
              type="button"
              className="admin-exams-section-refresh-btn"
              onClick={() => handleRefreshStatistics(true)}
              disabled={statisticsLoading || !activeExamDraft.id}
            >
              {statisticsLoading ? 'Se încarcă…' : 'Actualizează'}
            </button>
          </div>

          {!activeExamDraft.id ? (
            <div className="admin-exams-statistics-empty">Salvează sau deschide un examen pentru a vedea statisticile.</div>
          ) : (
            <>
              <div className="admin-exams-statistics-tabs">
                <button type="button" className={statisticsTab === 'students' ? 'is-active' : ''} onClick={() => setStatisticsTab('students')}>
                  Elevi
                </button>
                <button type="button" className={statisticsTab === 'questions' ? 'is-active' : ''} onClick={() => setStatisticsTab('questions')}>
                  Întrebări
                </button>
              </div>

              {statisticsTab === 'students' ? (
                <>
                  <div className="admin-exams-statistics-filters">
                    <select value={statisticsStatusFilter} onChange={(e) => setStatisticsStatusFilter(e.target.value)}>
                      <option value="all">Toate statusurile</option>
                      <option value="pending">În așteptare</option>
                      <option value="approved">Aprobat</option>
                      <option value="rejected">Respins</option>
                      <option value="completed">Finalizat</option>
                    </select>
                    <input type="date" value={statisticsDateFrom} onChange={(e) => setStatisticsDateFrom(e.target.value)} />
                    <input type="date" value={statisticsDateTo} onChange={(e) => setStatisticsDateTo(e.target.value)} />
                    <button type="button" onClick={exportStatistics}>Export Excel</button>
                  </div>

                  {filteredStatisticsRows.length === 0 ? (
                    <div className="admin-exams-statistics-empty">Nu există rezultate pentru filtrele actuale.</div>
                  ) : (
                    <div className="admin-exams-statistics-table-wrap">
                      <table className="admin-exams-statistics-table">
                        <thead>
                          <tr>
                            <th>Elev</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Scor</th>
                            <th>Finalizat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStatisticsRows.map((row) => (
                            <tr key={row.id}>
                              <td>{row.user?.name || '-'}</td>
                              <td>{row.user?.email || '-'}</td>
                              <td>{row.status || '-'}</td>
                              <td>{row.percentage != null ? `${row.percentage}%` : '-'}</td>
                              <td>{row.completed_at ? new Date(row.completed_at).toLocaleString('ro-RO') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : statisticsQuestionRows.length === 0 ? (
                <div className="admin-exams-statistics-empty">Nu există analize pe întrebări.</div>
              ) : (
                <div className="admin-exams-question-analytics-list">
                  {statisticsQuestionRows.map((question, index) => (
                    <article key={question.question_id || index} className="admin-exams-question-analytics-card">
                      <div className="admin-exams-question-analytics-head">
                        <h4>{question.question_text || `Întrebarea ${index + 1}`}</h4>
                        <span>{typeLabel(question.question_type || question.type || 'multiple_choice')}</span>
                      </div>
                      <div className="admin-exams-question-analytics-metrics">
                        <span>Rată corect: {question.correct_rate != null ? `${Math.round(question.correct_rate)}%` : '-'}</span>
                        <span>Încercări: {question.attempts_count ?? 0}</span>
                        <span>Scor mediu: {question.average_score != null ? Number(question.average_score).toFixed(2) : '-'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const createView = (
    <div className="admin-tests-page admin-exams-modern-page admin-exams-page">
      <div className="admin-exams-builder-shell">
        <header
          className="admin-exams-builder-top va-card-shell"
          style={{
            '--admin-exams-builder-accent': builderHeroAccent,
          }}
        >
          <div className="admin-exams-builder-top-main">
            <div className="admin-exams-builder-top-left">
              <button
                type="button"
                className="admin-exams-builder-back-btn admin-tests-secondary-link"
                onClick={() => setViewMode('list')}
              >
                ← Înapoi la listă
              </button>
              <div className="admin-exams-builder-title-wrap">
                <h1 className="admin-exams-builder-title">
                  {builderHeroTitle}
                </h1>
                <p className="admin-exams-builder-subtitle">
                  {builderHeroSubtitle}
                </p>
              </div>
            </div>
            <div className="admin-exams-builder-actions">
              <div className="admin-exams-builder-publish">
                <span>{published ? 'Publicat' : 'Draft'}</span>
                <button
                  type="button"
                  className="admin-view-switcher admin-exams-header-switch"
                  onClick={handleTogglePublishedNow}
                  aria-pressed={published}
                  disabled={publishToggleLoading || saveState.loading}
                >
                  <div
                    className="admin-view-switcher-slider"
                    style={{ transform: published ? 'translateX(27px)' : 'translateX(0)' }}
                    aria-hidden
                  />
                </button>
              </div>
              <button
                type="button"
                className="admin-tests-secondary-link"
                onClick={handleOpenPreview}
                disabled={!activeExamDraft.id || previewLoading}
              >
                Previzualizare
              </button>
              {canMutateInAdminArea ? (
                <button
                  type="button"
                  className="admin-tests-primary-btn"
                  onClick={() => handleSaveExam()}
                  disabled={saveState.loading || publishToggleLoading}
                >
                  {saveState.loading ? 'Se salvează…' : 'Salvează'}
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <nav className="admin-exams-builder-tabs-rail" aria-label="Secțiuni builder examen">
          <div className="admin-exams-builder-tabs">
            {EXAM_BUILDER_SECTIONS.map((section, idx) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? 'is-active' : ''}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="admin-exams-builder-tab-num" aria-hidden>
                  {idx + 1}
                </span>
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="admin-exams-builder-summary admin-exams-builder-strip va-card-shell" aria-label="Rezumat rapid examen">
          <div className="admin-exams-builder-strip-inner">
            <span className="admin-exams-builder-strip-item">
              <span className="admin-exams-modern-summary-label">Status</span>
              <strong>{published ? 'Publicat' : 'Draft'}</strong>
            </span>
            <span className="admin-exams-builder-strip-sep" aria-hidden />
            <span className="admin-exams-builder-strip-item">
              <span className="admin-exams-modern-summary-label">Întrebări</span>
              <strong>{Number(examSettings.questionCount || 0)}</strong>
            </span>
            <span className="admin-exams-builder-strip-sep" aria-hidden />
            <span className="admin-exams-builder-strip-item">
              <span className="admin-exams-modern-summary-label">Acces</span>
              <strong>{examAccess.mode === 'selected_students' ? `${examAccess.selectedStudents.length} elevi` : 'Toți'}</strong>
            </span>
            <span className="admin-exams-builder-strip-sep" aria-hidden />
            <span className="admin-exams-builder-strip-item">
              <span className="admin-exams-modern-summary-label">Review</span>
              <strong>{examSettings.manualReview ? 'Manual' : 'Auto'}</strong>
            </span>
          </div>
          {saveState.message ? (
            <p className={`admin-exams-save-message is-${saveState.type}`}>{saveState.message}</p>
          ) : null}
        </section>

        <main className="admin-exams-builder-main">
          <div className="admin-exams-builder-canvas">
            <div className="admin-exams-builder-stage">{sectionBody}</div>
            <aside className="admin-exams-builder-sidecar">
              <div
                className="admin-exams-builder-sidecar-preview"
                style={{
                  '--admin-exams-builder-sidecar-accent': builderHeroAccent,
                }}
              >
                <span className="admin-exams-builder-sidecar-kicker">{builderSidecarConfig.eyebrow}</span>
                <strong>{builderSidecarConfig.title}</strong>
                <p>{builderSidecarConfig.description}</p>
              </div>
              <div className="admin-exams-builder-sidecar-card">
                <div className="admin-exams-builder-sidecar-card-head">
                  <span className="admin-exams-modern-summary-label">Rezumat curent</span>
                  <span className="admin-exams-content-summary-chip">{activeBuilderSection?.label || 'Builder'}</span>
                </div>
                <div className="admin-exams-builder-sidecar-facts">
                  {builderSidecarConfig.facts.map((fact) => (
                    <div key={fact.label} className="admin-exams-builder-sidecar-fact">
                      <span>{fact.label}</span>
                      <strong>{fact.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
  return (
    <>
      {viewMode === 'list' ? listView : createView}
      {deleteConfirmExam ? (
        <div className="admin-exams-create-modal-overlay" onClick={() => !listActionId && setDeleteConfirmExam(null)}>
          <div className="admin-exams-delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-exams-delete-confirm-hero">
              <span className="admin-exams-delete-confirm-icon" aria-hidden="true">!</span>
              <div>
                <span className="admin-exams-delete-confirm-kicker">Actiune ireversibila</span>
                <h3>Stergi examenul?</h3>
              </div>
            </div>
            <p className="admin-exams-delete-confirm-lead">
              <strong>{deleteConfirmTitle}</strong> va fi eliminat definitiv impreuna cu istoricul lui.
            </p>
            <p className="admin-exams-delete-confirm-hint">
              Actiunea nu poate fi anulata. Daca vrei doar sa il ascunzi, arhiveaza-l.
            </p>
            <div className="admin-exams-delete-confirm-note">
              Se vor sterge si datele aferente rezultatelor, daca exista.
            </div>
            <div className="admin-exams-delete-confirm-actions">
              <button type="button" className="admin-exams-list-btn-secondary" disabled={listActionId} onClick={() => setDeleteConfirmExam(null)}>
                Anuleaza
              </button>
              <button type="button" className="admin-exams-list-btn-danger-solid" disabled={listActionId} onClick={handleConfirmDeleteExam}>
                {listActionId ? 'Se sterge...' : 'Da, sterge'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showCreateModal ? (
        <div className="admin-exams-create-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="admin-exams-create-modal" onClick={(e) => e.stopPropagation()}>
            <aside className="admin-exams-create-modal-aside">
              <span className="admin-exams-create-modal-kicker">Pasul 1</span>
              <h3>Creeaza examen</h3>
              <p>Stabilesti numele si descrierea. Restul se construieste imediat dupa.</p>
              <div className="admin-exams-create-modal-aside-stats">
                <div className="admin-exams-create-modal-aside-stat">
                  <span>Titlu</span>
                  <strong>obligatoriu</strong>
                </div>
                <div className="admin-exams-create-modal-aside-stat">
                  <span>Descriere</span>
                  <strong>optional</strong>
                </div>
              </div>
            </aside>
            <div className="admin-exams-create-modal-form">
              <label htmlFor="exam-create-title">Titlu examen</label>
              <input id="exam-create-title" type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Ex: Examen final modul 1" />
              <label htmlFor="exam-create-description">Descriere</label>
              <textarea id="exam-create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} placeholder="Descriere scurta pentru examen" />
              {createError ? <p className="admin-exams-create-modal-error">{createError}</p> : null}
              <div className="admin-exams-create-modal-actions">
                <button type="button" className="cancel" onClick={() => setShowCreateModal(false)} disabled={creatingExam}>Anuleaza</button>
                <button type="button" className="confirm" onClick={handleConfirmCreate} disabled={!createTitle.trim() || creatingExam}>
                  {creatingExam ? 'Se creeaza...' : 'Continua'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showStudentsModal ? (
        <div className="admin-exams-create-modal-overlay" onClick={() => setShowStudentsModal(false)}>
          <div className="admin-exams-create-modal admin-exams-students-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-exams-students-modal-head">
              <div>
                <span className="admin-exams-content-subtitle">Alegi cui ii deschizi examenul.</span>
                <h3>Selecteaza elevi</h3>
              </div>
              <span className="admin-exams-content-summary-chip">{studentsDraftCount} selectati</span>
            </div>
            <input type="text" placeholder="Cauta dupa nume sau email..." value={studentsSearch} onChange={(e) => setStudentsSearch(e.target.value)} />
            {studentsError ? <p className="admin-exams-create-modal-error">{studentsError}</p> : null}
            <div className="admin-exams-students-list">
              {studentsLoading ? (
                <p>Se incarca elevii...</p>
              ) : (
                studentsList.filter((student) => {
                  const query = studentsSearch.trim().toLowerCase();
                  if (!query) return true;
                  return String(student.name).toLowerCase().includes(query) || String(student.email).toLowerCase().includes(query);
                }).map((student) => (
                  <label key={student.id} className="admin-exams-students-row">
                    <input type="checkbox" checked={studentsDraftSelected.includes(student.id)} onChange={() => handleToggleStudentDraft(student.id)} />
                    <span>{student.name}</span>
                    <small>{student.email}</small>
                  </label>
                ))
              )}
            </div>
            <div className="admin-exams-create-modal-actions">
              <button type="button" className="cancel" onClick={() => setShowStudentsModal(false)}>Anuleaza</button>
              <button type="button" className="confirm" onClick={handleApplyStudentsSelection}>Aplica selectia</button>
            </div>
          </div>
        </div>
      ) : null}
      {showContentModal ? (
        <div className="admin-exams-create-modal-overlay" onClick={() => setShowContentModal(false)}>
          <div className="admin-exams-content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-exams-content-modal-head">
              <div>
                <span className="admin-exams-content-subtitle">Construiesti sursa de intrebari pentru examen.</span>
                <h3>Selecteaza intrebari</h3>
              </div>
              <div className="admin-exams-content-mode-option">
                <span>Mod activ</span>
                <strong>{contentSelectionLabel}</strong>
              </div>
            </div>
            <div className="admin-exams-content-summary-row">
              <span className="admin-exams-content-summary-chip">{contentSelectionCount} selectate</span>
              <span className="admin-exams-content-summary-chip">{Number(examSettings.questionCount || 0)} intrebari in examen</span>
              <span className="admin-exams-content-summary-chip">{contentOnlyWithQuestions ? 'Doar cu intrebari' : 'Toate bancile'}</span>
            </div>
            <div className="admin-exams-content-toolbar">
              <input type="search" placeholder="Cauta banca sau tag..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} />
              <select value={contentSort} onChange={(e) => setContentSort(e.target.value)}>
                <option value="questions_desc">Cele mai multe intrebari</option>
                <option value="questions_asc">Cele mai putine intrebari</option>
                <option value="title_asc">Titlu A-Z</option>
                <option value="title_desc">Titlu Z-A</option>
              </select>
              <label className="admin-exams-modern-inline-check">
                <span>Doar banci cu intrebari</span>
                <input type="checkbox" checked={contentOnlyWithQuestions} onChange={(e) => setContentOnlyWithQuestions(e.target.checked)} />
              </label>
            </div>
            <div className="admin-exams-content-meta">
              <span>{filteredContentBanks.length} banci filtrate</span>
              <span>{contentSelectionCount} selectie curenta</span>
            </div>
            <div className="admin-tests-modal-grid">
              <label>
                Mod selectie
                <select value={examSettings.selectionMode} onChange={(e) => setExamSettings((prev) => ({ ...prev, selectionMode: e.target.value }))}>
                  <option value="folders">Foldere</option>
                  <option value="tags">Tag-uri</option>
                </select>
              </label>
              <label>
                Numar intrebari
                <input type="number" min={1} max={200} value={examSettings.questionCount} onChange={(e) => setExamSettings((prev) => ({ ...prev, questionCount: Math.max(1, Number(e.target.value || 1)) }))} />
              </label>
            </div>
            {contentBanksError ? <p className="admin-exams-create-modal-error">{contentBanksError}</p> : null}
            {contentBanksLoading ? (
              <p>Se incarca bancile...</p>
            ) : (
              <div className="admin-exams-content-banks">
                {examSettings.selectionMode === 'folders'
                  ? filteredContentBanks.map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      className={`admin-exams-content-bank-item ${examSettings.selectedFolderIds.includes(bank.id) ? 'is-active' : ''}`}
                      onClick={() => setExamSettings((prev) => {
                        const exists = prev.selectedFolderIds.includes(bank.id);
                        const selectedFolderIds = exists
                          ? prev.selectedFolderIds.filter((folderId) => folderId !== bank.id)
                          : [...prev.selectedFolderIds, bank.id];
                        return { ...prev, contentBankId: bank.id, selectedFolderIds };
                      })}
                    >
                      <div className="admin-exams-content-bank-main">
                        <strong>{bank.title}</strong>
                        <p>{bank.description || 'Fara descriere'}</p>
                      </div>
                      <span className="admin-exams-content-bank-count">{bank.questions_count || 0} intrebari</span>
                    </button>
                  ))
                  : questionTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`admin-exams-content-bank-item ${examSettings.selectedTags.includes(tag) ? 'is-active' : ''}`}
                      onClick={() => setExamSettings((prev) => ({
                        ...prev,
                        selectedTags: prev.selectedTags.includes(tag)
                          ? prev.selectedTags.filter((value) => value !== tag)
                          : [...prev.selectedTags, tag],
                      }))}
                    >
                      <div className="admin-exams-content-bank-main">
                        <strong>{tag}</strong>
                        <p>Tag de selectie</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}
            <div className="admin-exams-create-modal-actions admin-exams-content-modal-actions">
              <button type="button" className="cancel" onClick={() => setShowContentModal(false)}>Inchide</button>
              <button type="button" className="confirm" onClick={handleConfirmContentSelection} disabled={contentConfirmLoading}>
                {contentConfirmLoading ? 'Se salveaza...' : 'Confirma selectia'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showPreviewModal ? (
        <div className="admin-exams-create-modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="admin-exams-content-modal admin-exams-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-exams-content-modal-head">
              <div>
                <span className="admin-exams-content-subtitle">Verifici exact cum se vede pentru elev.</span>
                <h3>Previzualizare examen</h3>
              </div>
              {previewData ? (
                <div className="admin-exams-content-mode-option">
                  <span>Intrebari</span>
                  <strong>{previewQuestionCount}</strong>
                </div>
              ) : null}
            </div>
            {previewLoading ? (
              <p>Se incarca previzualizarea...</p>
            ) : previewError ? (
              <p className="admin-exams-create-modal-error">{previewError}</p>
            ) : previewData ? (
              <div className="admin-exams-preview-body">
                <h4>{previewData.title || 'Examen fara titlu'}</h4>
                {previewData.description ? <p>{previewData.description}</p> : null}
                {previewData.instructions ? (
                  <div className="admin-exams-preview-instructions">
                    <strong>Instructiuni elev:</strong>
                    <p>{previewData.instructions}</p>
                  </div>
                ) : null}
                <div className="admin-exams-preview-meta">
                  <span>Prag: {previewData.passing_score ?? 70}%</span>
                  <span>Timp: {previewData.time_limit_minutes ? `${previewData.time_limit_minutes} min` : 'nelimitat'}</span>
                  <span>Incercari: {previewData.max_attempts ?? '-'}</span>
                </div>
                <div className="admin-exams-preview-questions">
                  {(Array.isArray(previewData.questions) ? previewData.questions : []).map((question, index) => (
                    <article key={question.id || index} className="admin-exams-preview-question">
                      <h5>{index + 1}. {question.text}</h5>
                      {Array.isArray(question.options) && question.options.length > 0 ? (
                        <ul>
                          {question.options.map((option, optionIndex) => <li key={`${question.id || index}-${optionIndex}`}>{option}</li>)}
                        </ul>
                      ) : (
                        <small>Raspuns deschis</small>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p>Nu exista date de previzualizare.</p>
            )}
            <div className="admin-exams-create-modal-actions admin-exams-content-modal-actions">
              <button type="button" className="cancel" onClick={() => setShowPreviewModal(false)}>Inchide</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
