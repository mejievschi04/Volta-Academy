import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { downloadSimpleExcel, statisticsExcelFilename } from '../../utils/statisticsExcelExport';
import './AdminTestsPage.css';
import './AdminExamsPage.css';

const SECTIONS = ['Setari', 'Intrebari', 'Acces', 'Statistica'];
const FILTERS = [
  { value: 'all', label: 'Toate' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Publicat' },
  { value: 'archived', label: 'Arhivat' },
];
const DEFAULT_SETTINGS = {
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
  open_text: 'Raspuns deschis',
  short_answer: 'Raspuns scurt',
  essay: 'Eseu',
  multiple_choice: 'Grila',
  single_choice: 'Alegere unica',
  true_false: 'Adevarat / fals',
}[type] || type);

export default function AdminExamsPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const { canMutateInAdminArea } = useAuth();
  const [viewMode, setViewMode] = useState('list');
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);
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

  const loadExams = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminService.getExams();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load exams:', e);
      setItems([]);
      setError('Nu s-a putut incarca lista de examene.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { if (!canMutateInAdminArea && viewMode !== 'list') setViewMode('list'); }, [canMutateInAdminArea, viewMode]);

  const handleRefreshStatistics = useCallback(async (notify = false) => {
    if (viewMode !== 'create' || activeSection !== 'Statistica') return;
    if (!activeExamDraft.id) { setStatisticsRows([]); setStatisticsQuestionRows([]); return; }
    try {
      setStatisticsLoading(true);
      const [resultsData, questionData] = await Promise.all([adminService.getExamResults(activeExamDraft.id), adminService.getExamQuestionAnalytics(activeExamDraft.id)]);
      setStatisticsRows(Array.isArray(resultsData) ? resultsData : []);
      setStatisticsQuestionRows(Array.isArray(questionData) ? questionData : []);
      if (notify) toastSuccess('Statistica a fost actualizata.');
    } catch (e) {
      console.error('Failed to refresh statistics:', e);
      setStatisticsRows([]); setStatisticsQuestionRows([]);
      if (notify) toastError('Nu s-a putut actualiza statistica.');
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
      setPublished(false); setShowCreateModal(false); setViewMode('create'); setActiveSection(SECTIONS[0]);
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
      coverName: item?.settings?.cover_name || '', coverUrl: item?.settings?.cover_url || '',
    });
    setExamAccess({ mode: item?.settings?.access_mode || 'all_students', selectedStudents: Array.isArray(item?.settings?.selected_students) ? item.settings.selected_students.map((id) => Number(id)).filter(Boolean) : [] });
    setManualReviewState({ reviewMode: item?.settings?.manual_review_mode || 'after_complete' });
    setPublished(String(item?.status || 'draft').toLowerCase() === 'published');
    setSaveState({ loading: false, message: '', type: '' });
    setViewMode('create');
    setActiveSection(options.initialSection && SECTIONS.includes(options.initialSection) ? options.initialSection : SECTIONS[0]);
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
          question_bank_id: examSettings.contentBankId || null, cover_name: examSettings.coverName || null, cover_url: examSettings.coverUrl || null,
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
  };
  const handleUploadCover = async (file) => {
    if (!file) return;
    if (!activeExamDraft.id) { setSaveState({ loading: false, message: 'Salveaza mai intai examenul, apoi incarca coperta.', type: 'error' }); return; }
    try {
      const formData = new FormData(); formData.append('file', file);
      const response = await adminService.uploadExamCover(activeExamDraft.id, formData);
      setExamSettings((prev) => ({ ...prev, coverName: response?.filename || file.name, coverUrl: response?.url || '' }));
      setSaveState({ loading: false, message: 'Coperta incarcata cu succes.', type: 'success' });
    } catch (e) {
      console.error('Failed to upload cover:', e);
      setSaveState({ loading: false, message: e?.response?.data?.message || 'Nu s-a putut incarca coperta.', type: 'error' });
    }
  };
  const handleOpenContentModal = async () => {
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
    downloadSimpleExcel(statisticsExcelFilename(`examen-${activeExamDraft.id || 'export'}`), 'Statistica examen', ['Data sustinerii', 'Nume complet', 'Email', 'Status', 'Scor'], filteredStatisticsRows.map((row) => [row.completed_at ? new Date(row.completed_at).toLocaleDateString('ro-RO') : '-', row.user?.name || '-', row.user?.email || '-', row.status || '-', row.percentage != null ? `${row.percentage}%` : '-']));
  };
  const listView = (
    <div className="admin-tests-page admin-exams-modern-page admin-exams-page">
      <header className="admin-tests-header">
        <div>
          <h1>Examene</h1>
          <p className="admin-tests-header-lead">Builder pentru examene: selecție întrebări, acces și statistici. Verificarea manuală este în Content → Verificare manuală.</p>
        </div>
        {canMutateInAdminArea ? (
          <div className="admin-tests-header-actions">
            <button type="button" className="admin-tests-primary-btn" onClick={handleOpenCreateModal}>+ Creeaza examen</button>
          </div>
        ) : null}
      </header>

      {!loading && !error && items.length > 0 ? (
        <div className="admin-exams-modern-stats">
          <div className="admin-exams-modern-stat"><strong>{listStats.all}</strong><span>Total</span></div>
          <div className="admin-exams-modern-stat is-draft"><strong>{listStats.draft}</strong><span>Draft</span></div>
          <div className="admin-exams-modern-stat is-live"><strong>{listStats.published}</strong><span>Publicate</span></div>
          <div className="admin-exams-modern-stat is-archived"><strong>{listStats.archived}</strong><span>Arhivate</span></div>
        </div>
      ) : null}

      <div className="admin-exams-modern-toolbar">
        <div className="admin-tests-search admin-exams-modern-search">
          <input type="search" placeholder="Cauta dupa titlu sau curs..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="admin-exams-modern-filter-chips">
          {FILTERS.map((filter) => (
            <button key={filter.value} type="button" className={`admin-exams-modern-chip ${listStatusFilter === filter.value ? 'is-active' : ''}`} onClick={() => setListStatusFilter(filter.value)}>
              {filter.label}
              {filter.value !== 'all' ? <span>{listStats[filter.value] ?? 0}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="admin-tests-empty">Se incarca examenele...</div> : error ? <div className="admin-tests-empty">{error}</div> : filteredItems.length === 0 ? <div className="admin-tests-empty">{items.length === 0 ? 'Nu exista examene inca. Creeaza primul examen.' : 'Nu exista examene pentru filtrele curente.'}</div> : (
        <div className="admin-tests-grid admin-exams-modern-grid">
          {filteredItems.map((item) => {
            const status = String(item?.status || 'draft').toLowerCase();
            const busy = listActionId === item.id;
            return (
              <article key={item.id} className="admin-tests-card admin-exams-modern-card">
                <div className="admin-tests-card-head"><h3>{item.title || 'Examen fara titlu'}</h3><span className={`status ${status}`}>{item.status || 'draft'}</span></div>
                <p>{item.description || 'Fara descriere.'}</p>
                <div className="admin-tests-meta">
                  <span>Intrebari: {item.questions_count ?? 0}</span>
                  <span>Prag: {Number(item.passing_score ?? 0)}%</span>
                  <span>Incercari: {item.max_attempts ?? '-'}</span>
                  <span>{item.course_title ? `Curs: ${item.course_title}` : 'Examen independent'}</span>
                </div>
                {canMutateInAdminArea ? (
                  <div className="admin-exams-modern-card-actions">
                    <div className="admin-tests-actions-primary"><button type="button" className="is-wide" disabled={busy} onClick={() => handleOpenExistingExam(item)}>Deschide builder-ul</button></div>
                    <div className="admin-tests-actions-grid">
                      <button type="button" disabled={busy || duplicatingExamId === item.id} onClick={() => handleDuplicateExam(item)}>{duplicatingExamId === item.id ? 'Se duplica...' : 'Duplica'}</button>
                      {status !== 'published' ? <button type="button" className="is-emphasis" disabled={busy} onClick={() => patchExamListStatus(item, 'published')}>Publica</button> : <button type="button" disabled={busy} onClick={() => patchExamListStatus(item, 'archived')}>Arhiveaza</button>}
                      {status === 'archived' ? <button type="button" disabled={busy} onClick={() => patchExamListStatus(item, 'draft')}>In draft</button> : null}
                    </div>
                    <div className="admin-tests-actions-grid"><button type="button" disabled={busy} onClick={() => setDeleteConfirmExam(item)}>Sterge</button></div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const sectionBody = activeSection === 'Setari' ? (
    <div className="admin-exams-modern-section"><div className="admin-tests-modal"><div className="admin-tests-modal-grid"><label>Titlu<input type="text" value={examSettings.title} onChange={(e) => setExamSettings((prev) => ({ ...prev, title: e.target.value }))} /></label><label>Descriere<textarea rows={4} value={examSettings.description} onChange={(e) => setExamSettings((prev) => ({ ...prev, description: e.target.value }))} /></label><label>Instructiuni pentru elev<textarea rows={5} value={examSettings.instructions} onChange={(e) => setExamSettings((prev) => ({ ...prev, instructions: e.target.value }))} /></label><label>Coperta<div className="admin-exams-modern-cover-row"><input type="file" accept="image/*" onChange={(e) => handleUploadCover(e.target.files?.[0])} /><small>{examSettings.coverName || 'Nu exista coperta incarcata.'}</small></div></label><label>Prag de promovare<input type="number" min={0} max={100} value={examSettings.passingScore} onChange={(e) => setExamSettings((prev) => ({ ...prev, passingScore: Number(e.target.value || 0) }))} /></label><label>Numar maxim de incercari<input type="number" min={1} max={20} value={examSettings.attempts} onChange={(e) => setExamSettings((prev) => ({ ...prev, attempts: Number(e.target.value || 1) }))} /></label><label>Timp limita in minute<input type="number" min={1} max={300} placeholder="Gol = fara limita" value={examSettings.timeLimitEnabled ? examSettings.timeLimitMinutes : ''} onChange={(e) => setExamSettings((prev) => ({ ...prev, timeLimitEnabled: Boolean(e.target.value), timeLimitMinutes: Math.max(1, Number(e.target.value || 1)) }))} /></label><label>Deadline<select value={examSettings.deadlineType} onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineType: e.target.value }))}><option value="none">Fara termen</option><option value="fixed">Data fixa</option><option value="relative">X zile de la inscriere</option></select></label>{examSettings.deadlineType === 'fixed' ? <label>Data si ora limita<input type="datetime-local" value={examSettings.deadlineAt} onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineAt: e.target.value }))} /></label> : null}{examSettings.deadlineType === 'relative' ? <label>Zile disponibile<input type="number" min={1} max={365} value={examSettings.deadlineDays} onChange={(e) => setExamSettings((prev) => ({ ...prev, deadlineDays: Math.max(1, Number(e.target.value || 1)) }))} /></label> : null}<label>Navigare intre intrebari<select value={examSettings.navigationMode} onChange={(e) => setExamSettings((prev) => ({ ...prev, navigationMode: e.target.value }))}><option value="sequential">Secventiala</option><option value="free">Libera</option></select></label><label>Review manual<select value={manualReviewState.reviewMode} onChange={(e) => setManualReviewState((prev) => ({ ...prev, reviewMode: e.target.value }))}><option value="after_complete">Dupa finalizare</option><option value="partial">Partial</option></select></label></div><div className="admin-exams-modern-checks"><label><input type="checkbox" checked={examSettings.shuffleQuestions} onChange={(e) => setExamSettings((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))} /> Amesteca intrebarile</label><label><input type="checkbox" checked={examSettings.manualReview} onChange={(e) => setExamSettings((prev) => ({ ...prev, manualReview: e.target.checked }))} /> Necesita verificare manuala</label><label><input type="checkbox" checked={examSettings.showFeedbackInstant} onChange={(e) => setExamSettings((prev) => ({ ...prev, showFeedbackInstant: e.target.checked }))} /> Arata rezultatul imediat</label><label><input type="checkbox" checked={examSettings.showCorrectAnswers} onChange={(e) => setExamSettings((prev) => ({ ...prev, showCorrectAnswers: e.target.checked }))} /> Arata raspunsurile corecte</label></div></div></div>
  ) : activeSection === 'Intrebari' ? (
    <div className="admin-exams-modern-section"><div className="admin-tests-modal"><div className="admin-exams-modern-split-head"><div><h3>Selectie intrebari</h3><p>Alegi sursa intrebarilor separat si salvezi configuratia examenului.</p></div><button type="button" className="confirm" onClick={handleOpenContentModal}>Selecteaza intrebari</button></div><div className="admin-tests-modal-grid"><label>Mod de selectie<select value={examSettings.selectionMode} onChange={(e) => setExamSettings((prev) => ({ ...prev, selectionMode: e.target.value }))}><option value="folders">Foldere</option><option value="tags">Tag-uri</option></select></label><label>Numar de intrebari in examen<input type="number" min={1} max={200} value={examSettings.questionCount} onChange={(e) => setExamSettings((prev) => ({ ...prev, questionCount: Math.max(1, Number(e.target.value || 1)) }))} /></label><label className="admin-exams-modern-inline-check"><span>Include intrebarile marcate cu stea</span><input type="checkbox" checked={examSettings.includeStarred} onChange={(e) => setExamSettings((prev) => ({ ...prev, includeStarred: e.target.checked }))} /></label></div><div className="admin-exams-modern-summary-grid"><div><span className="admin-exams-modern-summary-label">Selectie</span><strong>{examSettings.selectionMode === 'folders' ? `${examSettings.selectedFolderIds.length} foldere` : `${examSettings.selectedTags.length} tag-uri`}</strong></div><div><span className="admin-exams-modern-summary-label">Volum examen</span><strong>{Number(examSettings.questionCount || 0)} intrebari</strong></div><div><span className="admin-exams-modern-summary-label">Intrebari cu stea</span><strong>{examSettings.includeStarred ? selectedFoldersStarred : 0}</strong></div><div><span className="admin-exams-modern-summary-label">Banca activa</span><strong>{selectedBank?.title || 'Nu este selectata'}</strong></div></div></div></div>
  ) : activeSection === 'Acces' ? (
    <div className="admin-exams-modern-section"><div className="admin-tests-modal"><div className="admin-exams-modern-split-head"><div><h3>Acces examen</h3><p>Controlezi daca examenul este deschis tuturor sau doar unei liste de elevi.</p></div>{examAccess.mode === 'selected_students' ? <button type="button" className="confirm" onClick={handleOpenStudentsModal}>Alege elevii</button> : null}</div><div className="admin-tests-modal-grid"><label>Mod acces<select value={examAccess.mode} onChange={(e) => setExamAccess((prev) => ({ ...prev, mode: e.target.value }))}><option value="all_students">Toti elevii</option><option value="selected_students">Doar elevii selectati</option></select></label><label>Rezumat acces<input type="text" readOnly value={examAccess.mode === 'selected_students' ? `${examAccess.selectedStudents.length} elevi selectati` : 'Acces general'} /></label></div>{examAccess.mode === 'selected_students' ? <div className="admin-exams-modern-student-chips">{selectedStudentsPreview.length > 0 ? selectedStudentsPreview.map((student) => <span key={student.id} className="admin-exams-modern-student-chip">{student.name}</span>) : <span className="admin-exams-modern-empty-note">Nu ai incarcat inca lista elevilor pentru acest examen.</span>}{examAccess.selectedStudents.length > selectedStudentsPreview.length ? <span className="admin-exams-modern-student-chip is-muted">+{examAccess.selectedStudents.length - selectedStudentsPreview.length} inca</span> : null}</div> : null}</div></div>
  ) : (
    <div className="admin-exams-statistics"><div className="admin-exams-statistics-head"><h2>Statistica</h2><p>Rezultate pe elevi si analiza pe intrebari pentru examenul curent.</p><button type="button" className="admin-exams-section-refresh-btn" onClick={() => handleRefreshStatistics(true)} disabled={statisticsLoading || !activeExamDraft.id}>{statisticsLoading ? 'Se incarca...' : 'Actualizeaza'}</button></div>{!activeExamDraft.id ? <div className="admin-exams-statistics-empty">Salveaza sau deschide un examen pentru a vedea statisticile.</div> : <><div className="admin-exams-statistics-tabs"><button type="button" className={statisticsTab === 'students' ? 'is-active' : ''} onClick={() => setStatisticsTab('students')}>Elevi</button><button type="button" className={statisticsTab === 'questions' ? 'is-active' : ''} onClick={() => setStatisticsTab('questions')}>Intrebari</button></div>{statisticsTab === 'students' ? <><div className="admin-exams-statistics-filters"><select value={statisticsStatusFilter} onChange={(e) => setStatisticsStatusFilter(e.target.value)}><option value="all">Toate statusurile</option><option value="pending">In asteptare</option><option value="approved">Aprobat</option><option value="rejected">Respins</option><option value="completed">Finalizat</option></select><input type="date" value={statisticsDateFrom} onChange={(e) => setStatisticsDateFrom(e.target.value)} /><input type="date" value={statisticsDateTo} onChange={(e) => setStatisticsDateTo(e.target.value)} /><button type="button" onClick={exportStatistics}>Export Excel</button></div>{filteredStatisticsRows.length === 0 ? <div className="admin-exams-statistics-empty">Nu exista rezultate pentru filtrele actuale.</div> : <div className="admin-exams-statistics-table-wrap"><table className="admin-exams-statistics-table"><thead><tr><th>Elev</th><th>Email</th><th>Status</th><th>Scor</th><th>Finalizat</th></tr></thead><tbody>{filteredStatisticsRows.map((row) => <tr key={row.id}><td>{row.user?.name || '-'}</td><td>{row.user?.email || '-'}</td><td>{row.status || '-'}</td><td>{row.percentage != null ? `${row.percentage}%` : '-'}</td><td>{row.completed_at ? new Date(row.completed_at).toLocaleString('ro-RO') : '-'}</td></tr>)}</tbody></table></div>}</> : statisticsQuestionRows.length === 0 ? <div className="admin-exams-statistics-empty">Nu exista analize pe intrebari.</div> : <div className="admin-exams-question-analytics-list">{statisticsQuestionRows.map((question, index) => <article key={question.question_id || index} className="admin-exams-question-analytics-card"><div className="admin-exams-question-analytics-head"><h4>{question.question_text || `Intrebarea ${index + 1}`}</h4><span>{typeLabel(question.question_type || question.type || 'multiple_choice')}</span></div><div className="admin-exams-question-analytics-metrics"><span>Rata corect: {question.correct_rate != null ? `${Math.round(question.correct_rate)}%` : '-'}</span><span>Incercari: {question.attempts_count ?? 0}</span><span>Scor mediu: {question.average_score != null ? Number(question.average_score).toFixed(2) : '-'}</span></div></article>)}</div>}</>}</div>
  );

  const createView = (
    <div className="admin-tests-page admin-exams-modern-page admin-exams-page">
      <div className="admin-exams-builder-shell">
        <header className="admin-exams-builder-top">
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
                {examSettings.title?.trim() || activeExamDraft.title || 'Examen nou'}
              </h1>
              <p className="admin-exams-builder-subtitle">
                Setări, întrebări, acces și statistici — verificarea manuală este în Content → Verificare manuală.
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
        </header>

        <nav className="admin-exams-builder-tabs-rail" aria-label="Secțiuni builder examen">
          <div className="admin-exams-builder-tabs">
            {SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                className={activeSection === section ? 'is-active' : ''}
                onClick={() => setActiveSection(section)}
              >
                {section}
              </button>
            ))}
          </div>
        </nav>

        <section className="admin-exams-builder-summary" aria-label="Rezumat rapid examen">
          <div className="admin-exams-modern-summary-grid">
            <div>
              <span className="admin-exams-modern-summary-label">Status</span>
              <strong>{published ? 'Publicat' : 'Draft'}</strong>
            </div>
            <div>
              <span className="admin-exams-modern-summary-label">Conținut</span>
              <strong>{Number(examSettings.questionCount || 0)} întrebări</strong>
            </div>
            <div>
              <span className="admin-exams-modern-summary-label">Acces</span>
              <strong>
                {examAccess.mode === 'selected_students'
                  ? `${examAccess.selectedStudents.length} elevi`
                  : 'Toți elevii'}
              </strong>
            </div>
            <div>
              <span className="admin-exams-modern-summary-label">Review</span>
              <strong>{examSettings.manualReview ? 'Manual activ' : 'Automat'}</strong>
            </div>
          </div>
          {saveState.message ? (
            <p className={`admin-exams-save-message is-${saveState.type}`}>{saveState.message}</p>
          ) : null}
        </section>

        <main className="admin-exams-builder-main">{sectionBody}</main>
      </div>
    </div>
  );
  return (
    <>
      {viewMode === 'list' ? listView : createView}
      {deleteConfirmExam ? <div className="admin-exams-create-modal-overlay" onClick={() => !listActionId && setDeleteConfirmExam(null)}><div className="admin-exams-delete-confirm-modal" onClick={(e) => e.stopPropagation()}><h3>Stergi examenul?</h3><p className="admin-exams-delete-confirm-lead"><strong>{deleteConfirmExam.title || 'Examen'}</strong> va fi eliminat definitiv impreuna cu istoricul lui.</p><p className="admin-exams-delete-confirm-hint">Actiunea nu poate fi anulata. Daca vrei doar sa il ascunzi, arhiveaza-l.</p><div className="admin-exams-delete-confirm-actions"><button type="button" className="admin-exams-list-btn-secondary" disabled={listActionId} onClick={() => setDeleteConfirmExam(null)}>Anuleaza</button><button type="button" className="admin-exams-list-btn-danger-solid" disabled={listActionId} onClick={handleConfirmDeleteExam}>{listActionId ? 'Se sterge...' : 'Da, sterge'}</button></div></div></div> : null}
      {showCreateModal ? <div className="admin-exams-create-modal-overlay" onClick={() => setShowCreateModal(false)}><div className="admin-exams-create-modal" onClick={(e) => e.stopPropagation()}><h3>Creeaza examen</h3><label htmlFor="exam-create-title">Titlu examen</label><input id="exam-create-title" type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Ex: Examen final modul 1" /><label htmlFor="exam-create-description">Descriere</label><textarea id="exam-create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} placeholder="Descriere scurta pentru examen" />{createError ? <p className="admin-exams-create-modal-error">{createError}</p> : null}<div className="admin-exams-create-modal-actions"><button type="button" className="cancel" onClick={() => setShowCreateModal(false)} disabled={creatingExam}>Anuleaza</button><button type="button" className="confirm" onClick={handleConfirmCreate} disabled={!createTitle.trim() || creatingExam}>{creatingExam ? 'Se creeaza...' : 'Continua'}</button></div></div></div> : null}
      {showStudentsModal ? <div className="admin-exams-create-modal-overlay" onClick={() => setShowStudentsModal(false)}><div className="admin-exams-create-modal admin-exams-students-modal" onClick={(e) => e.stopPropagation()}><h3>Selecteaza elevi</h3><input type="text" placeholder="Cauta dupa nume sau email..." value={studentsSearch} onChange={(e) => setStudentsSearch(e.target.value)} />{studentsError ? <p className="admin-exams-create-modal-error">{studentsError}</p> : null}<div className="admin-exams-students-list">{studentsLoading ? <p>Se incarca elevii...</p> : studentsList.filter((student) => { const query = studentsSearch.trim().toLowerCase(); if (!query) return true; return String(student.name).toLowerCase().includes(query) || String(student.email).toLowerCase().includes(query); }).map((student) => <label key={student.id} className="admin-exams-students-row"><input type="checkbox" checked={studentsDraftSelected.includes(student.id)} onChange={() => handleToggleStudentDraft(student.id)} /><span>{student.name}</span><small>{student.email}</small></label>)}</div><div className="admin-exams-create-modal-actions"><button type="button" className="cancel" onClick={() => setShowStudentsModal(false)}>Anuleaza</button><button type="button" className="confirm" onClick={handleApplyStudentsSelection}>Aplica selectia</button></div></div></div> : null}
      {showContentModal ? <div className="admin-exams-create-modal-overlay" onClick={() => setShowContentModal(false)}><div className="admin-exams-content-modal" onClick={(e) => e.stopPropagation()}><h3>Selecteaza intrebari</h3><div className="admin-exams-content-toolbar"><input type="search" placeholder="Cauta banca sau tag..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} /><select value={contentSort} onChange={(e) => setContentSort(e.target.value)}><option value="questions_desc">Cele mai multe intrebari</option><option value="questions_asc">Cele mai putine intrebari</option><option value="title_asc">Titlu A-Z</option><option value="title_desc">Titlu Z-A</option></select><label className="admin-exams-modern-inline-check"><span>Doar banci cu intrebari</span><input type="checkbox" checked={contentOnlyWithQuestions} onChange={(e) => setContentOnlyWithQuestions(e.target.checked)} /></label></div><div className="admin-tests-modal-grid"><label>Mod selectie<select value={examSettings.selectionMode} onChange={(e) => setExamSettings((prev) => ({ ...prev, selectionMode: e.target.value }))}><option value="folders">Foldere</option><option value="tags">Tag-uri</option></select></label><label>Numar intrebari<input type="number" min={1} max={200} value={examSettings.questionCount} onChange={(e) => setExamSettings((prev) => ({ ...prev, questionCount: Math.max(1, Number(e.target.value || 1)) }))} /></label></div>{contentBanksError ? <p className="admin-exams-create-modal-error">{contentBanksError}</p> : null}{contentBanksLoading ? <p>Se incarca bancile...</p> : <div className="admin-exams-content-banks">{examSettings.selectionMode === 'folders' ? filteredContentBanks.map((bank) => <button key={bank.id} type="button" className={`admin-exams-content-bank-item ${examSettings.selectedFolderIds.includes(bank.id) ? 'is-active' : ''}`} onClick={() => setExamSettings((prev) => { const exists = prev.selectedFolderIds.includes(bank.id); const selectedFolderIds = exists ? prev.selectedFolderIds.filter((folderId) => folderId !== bank.id) : [...prev.selectedFolderIds, bank.id]; return { ...prev, contentBankId: bank.id, selectedFolderIds }; })}><div className="admin-exams-content-bank-main"><strong>{bank.title}</strong><p>{bank.description || 'Fara descriere'}</p></div><span className="admin-exams-content-bank-count">{bank.questions_count || 0} intrebari</span></button>) : questionTags.map((tag) => <button key={tag} type="button" className={`admin-exams-content-bank-item ${examSettings.selectedTags.includes(tag) ? 'is-active' : ''}`} onClick={() => setExamSettings((prev) => ({ ...prev, selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter((value) => value !== tag) : [...prev.selectedTags, tag] }))}><div className="admin-exams-content-bank-main"><strong>{tag}</strong><p>Tag de selectie</p></div></button>)}</div>}<div className="admin-exams-create-modal-actions admin-exams-content-modal-actions"><button type="button" className="cancel" onClick={() => setShowContentModal(false)}>Inchide</button><button type="button" className="confirm" onClick={handleConfirmContentSelection} disabled={contentConfirmLoading}>{contentConfirmLoading ? 'Se salveaza...' : 'Confirma selectia'}</button></div></div></div> : null}
      {showPreviewModal ? <div className="admin-exams-create-modal-overlay" onClick={() => setShowPreviewModal(false)}><div className="admin-exams-content-modal admin-exams-preview-modal" onClick={(e) => e.stopPropagation()}><h3>Previzualizare examen</h3>{previewLoading ? <p>Se incarca previzualizarea...</p> : previewError ? <p className="admin-exams-create-modal-error">{previewError}</p> : previewData ? <div className="admin-exams-preview-body"><h4>{previewData.title || 'Examen fara titlu'}</h4>{previewData.description ? <p>{previewData.description}</p> : null}{previewData.instructions ? <div className="admin-exams-preview-instructions"><strong>Instructiuni elev:</strong><p>{previewData.instructions}</p></div> : null}<div className="admin-exams-preview-meta"><span>Prag: {previewData.passing_score ?? 70}%</span><span>Timp: {previewData.time_limit_minutes ? `${previewData.time_limit_minutes} min` : 'nelimitat'}</span><span>Incercari: {previewData.max_attempts ?? '-'}</span></div><div className="admin-exams-preview-questions">{(Array.isArray(previewData.questions) ? previewData.questions : []).map((question, index) => <article key={question.id || index} className="admin-exams-preview-question"><h5>{index + 1}. {question.text}</h5>{Array.isArray(question.options) && question.options.length > 0 ? <ul>{question.options.map((option, optionIndex) => <li key={`${question.id || index}-${optionIndex}`}>{option}</li>)}</ul> : <small>Raspuns deschis</small>}</article>)}</div></div> : <p>Nu exista date de previzualizare.</p>}<div className="admin-exams-create-modal-actions admin-exams-content-modal-actions"><button type="button" className="cancel" onClick={() => setShowPreviewModal(false)}>Inchide</button></div></div></div> : null}
    </>
  );
}
