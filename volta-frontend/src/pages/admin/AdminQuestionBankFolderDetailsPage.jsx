import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckSquare,
  Edit3,
  FolderInput,
  ListChecks,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Layers,
  Trash2,
} from 'lucide-react';
import { X } from '@phosphor-icons/react';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';

import { useToast } from '../../contexts/ToastContextShared.js';
import { adminService } from '../../services/api';
import Drawer from '../../components/admin/question-banks/Drawer';
import QuestionRow from '../../components/admin/question-banks/QuestionRow';
import QuestionBuilderEditor from '../../components/admin/question-banks/QuestionBuilderEditor';
import AIGenerateQuestionsModal from '../../components/admin/question-banks/QuestionBankBuilderSteps/AIGenerateQuestionsModal';
import { DEFAULT_AI_QUESTION_TYPES } from '../../components/admin/question-banks/QuestionBankBuilderSteps/AIGenerateQuestionsModalShared.js';
import { isVoltEnabled, notifyVoltComingSoon } from '../../utils/voltAvailability';

import { useAuth } from '../../contexts/AuthContextShared.js';
import './AdminQuestionBanksPage.css';

const QUESTION_TYPE_LABELS = {
  single_choice: 'Răspuns unic',
  multiple_choice: 'Răspuns multiplu',
  true_false: 'Adevărat/Fals',
  yes_no: 'Da / Nu',
  matching: 'Potrivire',
  image_matching: 'Denumire – imagine',
  ordering: 'Ordonare',
  fill_in_blank: 'Completare spații',
  open: 'Deschis',
};

const PAGE_SIZE = 50;
const EMPTY_STATS = { total: 0, starred: 0, points: 0, types: [] };

const AdminQuestionBankFolderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canMutateInAdminArea } = useAuth();
  const readOnly = !canMutateInAdminArea;
  const { success, error, showToast } = useToast();
  const [folder, setFolder] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [drawerQuestion, setDrawerQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  // Întrebările vin paginat de pe server (un folder poate avea zeci de mii); `stats` = tot folderul.
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ last_page: 1, total: 0 });
  const [stats, setStats] = useState(EMPTY_STATS);
  const questionsRequestRef = useRef(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false);
  const [questionEditorSaving, setQuestionEditorSaving] = useState(false);
  const [questionEditorNumber, setQuestionEditorNumber] = useState(1);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiCourses, setAiCourses] = useState([]);
  const [aiCoursesLoading, setAiCoursesLoading] = useState(false);
  const [aiSelectedCourseId, setAiSelectedCourseId] = useState('');
  const [aiGeneratedCount, setAiGeneratedCount] = useState(0);
  const [aiGeneratedPreviews, setAiGeneratedPreviews] = useState([]);
  const [aiOptions, setAiOptions] = useState({
    numberOfQuestions: 10,
    difficulty: 'medium',
    questionTypes: [...DEFAULT_AI_QUESTION_TYPES],
  });
  const [deleteConfirmQuestionId, setDeleteConfirmQuestionId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);
  const [deleteFolderLoading, setDeleteFolderLoading] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFolders, setMoveFolders] = useState([]);
  const [moveFoldersLoading, setMoveFoldersLoading] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);
  const [questionDraft, setQuestionDraft] = useState({
    id: null,
    type: 'single_choice',
    content: '',
    explanation: '',
    points: 1,
    answers: [
      { text: 'Răspuns A', is_correct: true },
      { text: 'Răspuns B', is_correct: false },
    ],
  });

  const loadFolder = useCallback(async () => {
    try {
      const folderData = await adminService.getQuestionBank(id);
      setFolder(folderData);
      setEditForm({
        title: folderData?.title || '',
        description: folderData?.description || '',
      });
    } catch {
      error('Nu am putut încărca folderul.');
    }
  }, [error, id]);

  const loadQuestions = useCallback(async () => {
    const requestId = ++questionsRequestRef.current;
    setLoading(true);
    try {
      const data = await adminService.getQuestionBankQuestionsPage(id, {
        page,
        per_page: PAGE_SIZE,
        search: debouncedSearch || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      if (requestId !== questionsRequestRef.current) return;
      // după o ștergere, pagina curentă poate să nu mai existe
      if (data?.last_page && page > data.last_page) {
        setPage(data.last_page);
        return;
      }
      setQuestions(Array.isArray(data?.data) ? data.data : []);
      setPageInfo({ last_page: data?.last_page || 1, total: data?.total || 0 });
      setStats({ ...EMPTY_STATS, ...(data?.stats || {}) });
    } catch {
      if (requestId === questionsRequestRef.current) error('Nu am putut încărca întrebările.');
    } finally {
      if (requestId === questionsRequestRef.current) setLoading(false);
    }
  }, [debouncedSearch, error, id, page, typeFilter]);

  const loadData = useCallback(async () => {
    await Promise.all([loadFolder(), loadQuestions()]);
  }, [loadFolder, loadQuestions]);

  useEffect(() => {
    loadFolder();
  }, [loadFolder]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      setAiCoursesLoading(true);
      try {
        const res = await adminService.getCourses({ per_page: 500, status: 'all' });
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (!cancelled) setAiCourses(list);
      } catch (err) {
        console.error('Error fetching courses for Volt generation:', err);
        if (!cancelled) setAiCourses([]);
      } finally {
        if (!cancelled) setAiCoursesLoading(false);
      }
    };

    loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showAIModal || aiSelectedCourseId || aiCourses.length === 0) return;
    setAiSelectedCourseId(String(aiCourses[0].id));
  }, [showAIModal, aiSelectedCourseId, aiCourses]);

  const aiTargetCount = Math.max(1, Number(aiOptions.numberOfQuestions) || 1);
  const starredCount = stats.starred;
  const totalPoints = stats.points;
  const uniqueTypes = stats.types;
  const filteredQuestions = questions;
  const questionNumberOffset = (page - 1) * PAGE_SIZE;

  const resolveValidCourseId = (candidateId = aiSelectedCourseId) => {
    const parsed = Number.parseInt(String(candidateId), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const toggleSelect = (questionId) => {
    setSelectedIds((prev) => (prev.includes(questionId) ? prev.filter((idv) => idv !== questionId) : [...prev, questionId]));
  };

  const toggleSelectVisible = () => {
    const visibleIds = filteredQuestions.map((question) => question.id);
    if (!visibleIds.length) return;
    const allSelected = visibleIds.every((questionId) => selectedIds.includes(questionId));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((questionId) => !visibleIds.includes(questionId)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleStar = async (questionId) => {
    try {
      const response = await adminService.toggleQuestionStar(questionId);
      const updated = response?.question;
      const starred = Boolean(updated?.is_starred);
      const wasStarred = Boolean(questions.find((q) => q.id === questionId)?.is_starred);
      // doar rândul și contorul se schimbă: fără reîncărcarea paginii
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, is_starred: starred } : q)));
      if (starred !== wasStarred) {
        setStats((prev) => ({ ...prev, starred: Math.max(0, prev.starred + (starred ? 1 : -1)) }));
      }
    } catch {
      error('Nu am putut modifica steaua.');
    }
  };

  const runBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(`Ștergi ${selectedIds.length} întrebări din acest folder?`);
    if (!confirmed) return;

    try {
      await Promise.all(selectedIds.map((qid) => adminService.removeQuestionFromBank(id, qid)));
      success('Întrebările selectate au fost șterse.');
      setSelectedIds([]);
      if (drawerQuestion && selectedIds.includes(drawerQuestion.id)) {
        setDrawerQuestion(null);
      }
      await loadQuestions();
    } catch {
      error('Nu am putut șterge selecția.');
    }
  };

  const requestDeleteQuestion = (questionId) => {
    setDeleteConfirmQuestionId(questionId);
  };

  const confirmDeleteQuestion = async () => {
    if (!deleteConfirmQuestionId) return;
    setDeleteLoading(true);
    try {
      await adminService.removeQuestionFromBank(id, deleteConfirmQuestionId);
      success('Întrebarea a fost ștearsă.');
      setSelectedIds((prev) => prev.filter((qid) => qid !== deleteConfirmQuestionId));
      if (drawerQuestion?.id === deleteConfirmQuestionId) {
        setDrawerQuestion(null);
      }
      setDeleteConfirmQuestionId(null);
      await loadQuestions();
    } catch {
      error('Nu am putut șterge întrebarea.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openMoveModal = async () => {
    if (!selectedIds.length) return;
    setMoveOpen(true);
    setMoveTargetId('');
    setMoveFoldersLoading(true);
    try {
      const banks = await adminService.getQuestionBanks();
      setMoveFolders(banks.filter((bank) => String(bank.id) !== String(id)));
    } catch {
      setMoveFolders([]);
      error('Nu am putut încărca folderele.');
    } finally {
      setMoveFoldersLoading(false);
    }
  };

  const runMove = async () => {
    if (!moveTargetId || !selectedIds.length) return;
    setMoveLoading(true);
    try {
      const result = await adminService.moveQuestionsToBank(selectedIds, Number(moveTargetId));
      const target = moveFolders.find((bank) => String(bank.id) === String(moveTargetId));
      success(`${result?.moved ?? selectedIds.length} întrebări mutate în „${target?.title || 'folderul ales'}”.`);
      if (drawerQuestion && selectedIds.includes(drawerQuestion.id)) {
        setDrawerQuestion(null);
      }
      setSelectedIds([]);
      setMoveOpen(false);
      await loadQuestions();
    } catch (e) {
      error(e?.response?.data?.error || e?.response?.data?.message || 'Nu am putut muta întrebările.');
    } finally {
      setMoveLoading(false);
    }
  };

  const confirmDeleteFolder = async () => {
    setDeleteFolderLoading(true);
    try {
      await adminService.deleteQuestionBank(id);
      success('Folderul a fost șters.');
      navigate('/admin/question-banks');
    } catch (e) {
      // ex. 422: folderul e folosit de un test
      error(e?.response?.data?.error || 'Nu am putut șterge folderul.');
      setDeleteFolderOpen(false);
    } finally {
      setDeleteFolderLoading(false);
    }
  };

  const saveFolder = async () => {
    try {
      await adminService.updateQuestionBank(id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
      });
      success('Folder actualizat.');
      setEditOpen(false);
      await loadFolder();
    } catch {
      error('Nu am putut salva folderul.');
    }
  };

  const handleOpenAIModal = () => {
    if (!isVoltEnabled()) {
      notifyVoltComingSoon(showToast);
      return;
    }
    setAiOptions({
      numberOfQuestions: 10,
      difficulty: 'medium',
      questionTypes: [...DEFAULT_AI_QUESTION_TYPES],
    });
    setAiError(null);
    setAiGeneratedCount(0);
    setAiGeneratedPreviews([]);
    if (!aiSelectedCourseId && aiCourses.length > 0) {
      setAiSelectedCourseId(String(aiCourses[0].id));
    }
    setShowAIModal(true);
  };

  const startAiAutoGenerate = async (overrideCourseId = null, requestedCount = null) => {
    const effectiveCourseId = resolveValidCourseId(overrideCourseId);
    if (!effectiveCourseId) {
      error('Alege mai întâi un curs sursă.');
      return;
    }

    try {
      setAiGenerating(true);
      setAiError(null);
      const targetCount = Math.max(1, Number(requestedCount) || aiTargetCount);
      setAiGeneratedCount(0);
      setAiGeneratedPreviews([]);

      const result = await adminService.previewQuestionsWithVolt(id, {
        course_id: effectiveCourseId,
        numberOfQuestions: targetCount,
        difficulty: aiOptions.difficulty,
        questionTypes: aiOptions.questionTypes,
        autoGenerate: true,
      });

      const generatedQuestions = Array.isArray(result?.draft) ? result.draft : [];
      if (!generatedQuestions.length) {
        throw new Error('Volt nu a returnat nicio întrebare.');
      }

      setAiGeneratedCount(generatedQuestions.length);
      setAiGeneratedPreviews(
        generatedQuestions.map((question, index) => ({
          index: index + 1,
          content: question.content || question.question || '',
          type: question.type || 'multiple_choice',
        }))
      );

      await adminService.addQuestionsToBankBulk(id, generatedQuestions);
      success(`Au fost generate și salvate ${generatedQuestions.length} întrebări.`);
      setShowAIModal(false);
      setAiGeneratedCount(0);
      setAiGeneratedPreviews([]);
      setAiError(null);
      await loadQuestions();
    } catch (err) {
      console.error('Error generating questions:', err);
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Eroare la generarea întrebărilor cu Volt';
      setAiError(message);
      error(message);
    } finally {
      setAiGenerating(false);
    }
  };

  const openCreateQuestionEditor = () => {
    setQuestionEditorNumber(stats.total + 1);
    setQuestionDraft({
      id: null,
      type: 'single_choice',
      content: '',
      explanation: '',
      points: 1,
      answers: [
        { text: 'Răspuns A', is_correct: true },
        { text: 'Răspuns B', is_correct: false },
      ],
    });
    setQuestionEditorOpen(true);
  };

  const openEditQuestionEditor = (question) => {
    const indexInList = questions.findIndex((q) => q.id === question?.id);
    setQuestionEditorNumber(indexInList >= 0 ? questionNumberOffset + indexInList + 1 : 1);
    const mappedAnswers = Array.isArray(question?.answers)
      ? question.answers.map((a) => ({
          text: typeof a === 'string' ? a : a?.text || '',
          is_correct: Boolean(typeof a === 'object' ? a?.is_correct : false),
        }))
      : [];
    setQuestionDraft({
      id: question?.id || null,
      type: question?.type || 'single_choice',
      content: question?.content || '',
      explanation: question?.explanation || '',
      points: Number(question?.points) > 0 ? Number(question.points) : 1,
      answers: mappedAnswers.length ? mappedAnswers : [
        { text: 'Răspuns A', is_correct: true },
        { text: 'Răspuns B', is_correct: false },
      ],
    });
    setDrawerQuestion(null);
    setQuestionEditorOpen(true);
  };

  const saveQuestionFromEditor = async () => {
    if (!questionDraft.content?.trim()) {
      error('Întrebarea este obligatorie.');
      return;
    }
    setQuestionEditorSaving(true);
    try {
      const payload = {
        type: questionDraft.type,
        content: questionDraft.content,
        explanation: questionDraft.explanation || null,
        answers: questionDraft.answers || [],
        points: Number(questionDraft.points) > 0 ? Number(questionDraft.points) : 1,
      };

      if (questionDraft.id) {
        await adminService.updateQuestionInBank(id, questionDraft.id, payload);
        success('Întrebarea a fost actualizată.');
      } else {
        await adminService.addQuestionToBank(id, payload);
        success('Întrebarea a fost adăugată.');
      }
      setQuestionEditorOpen(false);
      await loadQuestions();
    } catch (e) {
      error(e?.response?.data?.error || 'Nu am putut salva întrebarea.');
    } finally {
      setQuestionEditorSaving(false);
    }
  };

  const allVisibleSelected =
    filteredQuestions.length > 0 && filteredQuestions.every((question) => selectedIds.includes(question.id));

  return (
    <div className="qb-page qb-page-v2 qb-folder-detail-page">
      <div className="qb-shell qb-shell-detail">
        <header className="qb-detail-hero">
          <Link to="/admin/question-banks" className="va-btn-back qb-back-btn qb-detail-back va-btn-back admin-back-btn">
            <ArrowLeft size={18} aria-hidden />
            Înapoi
          </Link>

          <div className="qb-detail-title-area">
            <p className="qb-page-eyebrow">Folder întrebări</p>
            <h1>{folder?.title || 'Detalii folder'}</h1>
            {folder?.description ? <p className="qb-detail-description">{folder.description}</p> : null}
          </div>

          {!readOnly ? (
            <div className="qb-detail-actions">
              <button type="button" className="lms-btn-secondary qb-action-button" onClick={() => setEditOpen(true)}>
                <Edit3 size={17} aria-hidden />
                Editează
              </button>
              <button type="button" className="lms-btn-secondary qb-action-button" onClick={openCreateQuestionEditor}>
                <Plus size={17} aria-hidden />
                Întrebare
              </button>
              {isVoltEnabled() ? (
                <button type="button" className="lms-btn-primary qb-action-button" onClick={handleOpenAIModal}>
                  <Sparkles size={17} aria-hidden />
                  Generează cu Volt
                </button>
              ) : null}
              <button
                type="button"
                className="lms-btn-secondary va-btn-delete va-btn-danger qb-action-button"
                onClick={() => setDeleteFolderOpen(true)}
              >
                <Trash2 size={17} aria-hidden />
                Șterge folderul
              </button>
            </div>
          ) : null}
        </header>

        <section className="qb-detail-stats" aria-label="Rezumat folder">
          <div className="qb-overview-item">
            <ListChecks size={18} aria-hidden />
            <div>
              <strong>{loading && !stats.total ? '...' : stats.total}</strong>
              <span>întrebări</span>
            </div>
          </div>
          <div className="qb-overview-item">
            <Star size={18} aria-hidden />
            <div>
              <strong>{loading && !stats.total ? '...' : starredCount}</strong>
              <span>marcate cu stea</span>
            </div>
          </div>
          <div className="qb-overview-item">
            <Layers size={18} aria-hidden />
            <div>
              <strong>{loading && !stats.total ? '...' : uniqueTypes.length}</strong>
              <span>tipuri de întrebări</span>
            </div>
          </div>
          <div className="qb-overview-item">
            <CheckSquare size={18} aria-hidden />
            <div>
              <strong>{loading && !stats.total ? '...' : totalPoints}</strong>
              <span>puncte totale</span>
            </div>
          </div>
        </section>

        <main className="qb-workspace qb-detail-workspace">
          <div className="qb-detail-toolbar">
            <div className="qb-search-field">
              <Search size={18} aria-hidden />
              <label className="qb-sr-only" htmlFor="qb-folder-question-search">
                Caută întrebări
              </label>
              <input
                id="qb-folder-question-search"
                className="admin-form-input qb-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Caută întrebare sau tag"
              />
            </div>

            <select
              className="admin-form-input qb-type-filter"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filtru tip întrebare"
            >
              <option value="all">Toate tipurile</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>

            <button type="button" className="lms-btn-secondary qb-action-button" onClick={loadData}>
              <RefreshCcw size={17} aria-hidden />
              Actualizează
            </button>
          </div>

          {!readOnly ? (
            <div className={`qb-selection-bar ${selectedIds.length ? 'is-active' : ''}`}>
              <div className="qb-selection-main">
                <strong>{selectedIds.length}</strong>
                <span>selectate</span>
              </div>
              <div className="qb-catalog-toolbar-actions">
                <button
                  type="button"
                  className="lms-btn-secondary qb-action-button"
                  disabled={!filteredQuestions.length}
                  onClick={toggleSelectVisible}
                >
                  <CheckSquare size={16} aria-hidden />
                  {allVisibleSelected ? 'Deselectează vizibile' : 'Selectează vizibile'}
                </button>
                <button
                  type="button"
                  className="lms-btn-secondary qb-action-button"
                  disabled={!selectedIds.length}
                  onClick={() => setSelectedIds([])}
                >
                  Golește
                </button>
                <button
                  type="button"
                  className="lms-btn-secondary qb-action-button"
                  disabled={!selectedIds.length}
                  onClick={openMoveModal}
                >
                  <FolderInput size={16} aria-hidden />
                  Mută în alt folder
                </button>
                <button
                  type="button"
                  className="lms-btn-secondary va-btn-delete va-btn-danger qb-action-button"
                  disabled={!selectedIds.length}
                  onClick={runBulkDelete}
                >
                  <Trash2 size={16} aria-hidden />
                  Șterge
                </button>
              </div>
            </div>
          ) : null}

          <section className="qb-rows qb-detail-question-list" aria-label="Întrebări din folder">
            {loading ? (
              <div className="qb-catalog-loading qb-catalog-loading--inline">
                <span className="qb-spinner" aria-hidden />
                Se încarcă întrebările...
              </div>
            ) : filteredQuestions.length ? (
              filteredQuestions.map((question) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  selected={selectedIds.includes(question.id)}
                  isActive={drawerQuestion?.id === question.id}
                  onToggleSelect={toggleSelect}
                  onToggleStar={toggleStar}
                  onOpenDrawer={setDrawerQuestion}
                  onDelete={readOnly ? undefined : requestDeleteQuestion}
                  readOnly={readOnly}
                />
              ))
            ) : (
              <div className="qb-empty">
                <ListChecks size={30} aria-hidden />
                <p className="qb-empty-title">{stats.total ? 'Nicio întrebare pentru filtrul curent' : 'Folder gol'}</p>
                <p className="qb-empty-hint">
                  {stats.total ? 'Schimbă căutarea sau filtrul de tip.' : (isVoltEnabled() ? 'Adaugă manual o întrebare sau generează cu Volt.' : 'Adaugă o întrebare.')}
                </p>
              </div>
            )}
          </section>

          {pageInfo.last_page > 1 ? (
            <nav className="admin-activity-logs-pagination" aria-label="Pagini întrebări">
              <button type="button" className="lms-btn-secondary lms-btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Anterior
              </button>
              <span className="admin-activity-logs-pagination-info">
                Pagina {page} din {pageInfo.last_page} ({pageInfo.total} întrebări)
              </span>
              <button type="button" className="lms-btn-secondary lms-btn-sm" disabled={page >= pageInfo.last_page || loading} onClick={() => setPage((p) => p + 1)}>
                Următor →
              </button>
            </nav>
          ) : null}
        </main>
      </div>

      <Drawer
        open={Boolean(drawerQuestion)}
        question={drawerQuestion}
        onClose={() => setDrawerQuestion(null)}
        onEdit={readOnly ? undefined : openEditQuestionEditor}
      />

      <Modal isOpen={editOpen && !readOnly} onClose={() => setEditOpen(false)}>
        <div className="qb-modal">
          <h3>Editează folder</h3>
          <label htmlFor="qb-edit-folder-title">Nume</label>
          <input
            id="qb-edit-folder-title"
            className="admin-form-input"
            value={editForm.title}
            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <label htmlFor="qb-edit-folder-description">Descriere</label>
          <textarea
            id="qb-edit-folder-description"
            className="admin-form-input"
            rows={3}
            value={editForm.description}
            onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="qb-modal-actions">
            <button type="button" className="lms-btn-secondary" onClick={() => setEditOpen(false)}>
              Anulează
            </button>
            <button type="button" className="va-btn-save lms-btn-primary" onClick={saveFolder}>
              Salvează
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={questionEditorOpen && !readOnly}
        onClose={() => !questionEditorSaving && setQuestionEditorOpen(false)}
        closeOnEscape
        ariaLabelledby="qb-question-editor-title"
        className="va-dialog-overlay"
        unstyledContent
      >
        <div className="va-dialog va-qe-dialog">
          <header className="va-dialog__header">
            <h2 id="qb-question-editor-title" className="va-dialog__title">{questionDraft.id ? 'Editează întrebarea' : 'Întrebare nouă'}</h2>
            <button type="button" className="va-close-btn" onClick={() => setQuestionEditorOpen(false)} disabled={questionEditorSaving} aria-label="Închide">
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </header>
          <div className="va-dialog__body">
            <QuestionBuilderEditor question={questionDraft} onChange={setQuestionDraft} questionNumber={questionEditorNumber} />
          </div>
          <footer className="va-dialog__footer">
            <button type="button" className="lms-btn-secondary" onClick={() => setQuestionEditorOpen(false)} disabled={questionEditorSaving}>
              Anulează
            </button>
            <button type="button" className="va-btn-save lms-btn-primary" onClick={saveQuestionFromEditor} disabled={questionEditorSaving}>
              {questionEditorSaving ? 'Se salvează...' : 'Salvează'}
            </button>
          </footer>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteConfirmQuestionId != null}
        onClose={() => !deleteLoading && setDeleteConfirmQuestionId(null)}
        onConfirm={confirmDeleteQuestion}
        title="Șterge întrebarea"
        message="Întrebarea va fi eliminată din acest folder. Această acțiune nu poate fi anulată."
        confirmLabel="Șterge"
        cancelLabel="Anulare"
        variant="danger"
        loading={deleteLoading}
      />

      <Modal isOpen={moveOpen && !readOnly} onClose={() => !moveLoading && setMoveOpen(false)}>
        <div className="qb-modal">
          <h3>Mută {selectedIds.length} {selectedIds.length === 1 ? 'întrebare' : 'întrebări'}</h3>
          <label htmlFor="qb-move-target">Folderul în care le muți</label>
          {moveFoldersLoading ? (
            <p className="qb-empty-hint">Se încarcă folderele...</p>
          ) : moveFolders.length ? (
            <select
              id="qb-move-target"
              className="admin-form-input"
              value={moveTargetId}
              onChange={(e) => setMoveTargetId(e.target.value)}
            >
              <option value="">Alege folderul</option>
              {moveFolders.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.title || 'Folder fără nume'}
                </option>
              ))}
            </select>
          ) : (
            <p className="qb-empty-hint">Nu există alt folder. Creează mai întâi un folder nou.</p>
          )}
          <div className="qb-modal-actions">
            <button type="button" className="lms-btn-secondary" onClick={() => setMoveOpen(false)} disabled={moveLoading}>
              Anulează
            </button>
            <button type="button" className="lms-btn-primary" onClick={runMove} disabled={!moveTargetId || moveLoading}>
              {moveLoading ? 'Se mută...' : 'Mută'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteFolderOpen}
        onClose={() => !deleteFolderLoading && setDeleteFolderOpen(false)}
        onConfirm={confirmDeleteFolder}
        title="Șterge folderul"
        message={`Folderul „${folder?.title || ''}” și cele ${stats.total} întrebări din el nu vor mai apărea în aplicație. Un folder folosit într-un test nu poate fi șters.`}
        confirmLabel="Șterge folderul"
        cancelLabel="Anulare"
        variant="danger"
        loading={deleteFolderLoading}
      />

      <AIGenerateQuestionsModal
        open={showAIModal}
        aiGenerating={aiGenerating}
        courses={aiCourses}
        coursesLoading={aiCoursesLoading}
        selectedCourseId={aiSelectedCourseId}
        setSelectedCourseId={setAiSelectedCourseId}
        aiOptions={aiOptions}
        setAiOptions={setAiOptions}
        aiError={aiError}
        aiGeneratedCount={aiGeneratedCount}
        aiTargetCount={aiTargetCount}
        aiGeneratedPreviews={aiGeneratedPreviews}
        onClose={() => setShowAIModal(false)}
        onStartReview={startAiAutoGenerate}
      />
    </div>
  );
};

export default AdminQuestionBankFolderDetailsPage;
