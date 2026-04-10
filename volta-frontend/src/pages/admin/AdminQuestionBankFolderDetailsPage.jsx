import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Modal from '../../components/common/Modal';
import { useToast } from '../../contexts/ToastContext';
import { adminService } from '../../services/api';
import Drawer from '../../components/admin/question-banks/Drawer';
import QuestionRow from '../../components/admin/question-banks/QuestionRow';
import Tag from '../../components/admin/question-banks/Tag';
import QuestionBuilderEditor from '../../components/admin/question-banks/QuestionBuilderEditor';
import AIGenerateQuestionsModal from '../../components/admin/question-banks/QuestionBankBuilderSteps/AIGenerateQuestionsModal';
import { useAuth } from '../../contexts/AuthContext';
import './AdminQuestionBanksPage.css';

const AdminQuestionBankFolderDetailsPage = () => {
  const { id } = useParams();
  const { canMutateInAdminArea } = useAuth();
  const readOnly = !canMutateInAdminArea;
  const { success, error } = useToast();
  const [folder, setFolder] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [drawerQuestion, setDrawerQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', tagsText: '' });
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false);
  const [questionEditorSaving, setQuestionEditorSaving] = useState(false);
  const [questionEditorNumber, setQuestionEditorNumber] = useState(1);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiCourses, setAiCourses] = useState([]);
  const [aiCoursesLoading, setAiCoursesLoading] = useState(false);
  const [aiSelectedCourseId, setAiSelectedCourseId] = useState('');
  const [aiReviewStarted, setAiReviewStarted] = useState(false);
  const [aiCurrentDraftQuestion, setAiCurrentDraftQuestion] = useState(null);
  const [aiApprovedQuestions, setAiApprovedQuestions] = useState([]);
  const [aiGeneratedCount, setAiGeneratedCount] = useState(0);
  const [aiGeneratedPreviews, setAiGeneratedPreviews] = useState([]);
  const [aiOptions, setAiOptions] = useState({
    numberOfQuestions: 10,
    difficulty: 'medium',
    questionTypes: ['multiple_choice'],
  });
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [folderData, questionData] = await Promise.all([
        adminService.getQuestionBank(id),
        adminService.getQuestionBankQuestions(id),
      ]);
      setFolder(folderData);
      setQuestions(Array.isArray(questionData) ? questionData : []);
      const tags = (folderData?.tags || []).map((t) => t.name).join(', ');
      setEditForm({
        title: folderData?.title || '',
        description: folderData?.description || '',
        tagsText: tags,
      });
    } catch {
      error('Nu am putut încărca folderul.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      setAiCoursesLoading(true);
      try {
        const res = await adminService.getCourses({ per_page: 500, status: 'all' });
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (!cancelled) {
          setAiCourses(list);
        }
      } catch (err) {
        console.error('Error fetching courses for Volt generation:', err);
        if (!cancelled) {
          setAiCourses([]);
        }
      } finally {
        if (!cancelled) {
          setAiCoursesLoading(false);
        }
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

  const resolveValidCourseId = (candidateId = aiSelectedCourseId) => {
    const parsed = Number.parseInt(String(candidateId), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const trimQuestionText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const toggleSelect = (questionId) => {
    setSelectedIds((prev) => (prev.includes(questionId) ? prev.filter((idv) => idv !== questionId) : [...prev, questionId]));
  };

  const toggleStar = async (questionId) => {
    try {
      const response = await adminService.toggleQuestionStar(questionId);
      const updated = response?.question;
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, is_starred: Boolean(updated?.is_starred) } : q))
      );
      await loadData();
    } catch {
      error('Nu am putut modifica steaua.');
    }
  };

  const runBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map((qid) => adminService.removeQuestionFromBank(id, qid)));
      success('Întrebările selectate au fost șterse.');
      setSelectedIds([]);
      await loadData();
    } catch {
      error('Bulk delete a eșuat.');
    }
  };

  const normalizedTags = useMemo(
    () =>
      editForm.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [editForm.tagsText]
  );

  const saveFolder = async () => {
    try {
      await adminService.updateQuestionBank(id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        tags: normalizedTags,
      });
      success('Folder actualizat.');
      setEditOpen(false);
      await loadData();
    } catch {
      error('Nu am putut salva folderul.');
    }
  };

  const fetchAiDraftQuestion = async (
    approvedQuestions = [],
    blockedQuestions = [],
    courseIdOverride = null,
    autoGenerate = false
  ) => {
    const validCourseId = resolveValidCourseId(courseIdOverride);
    if (!validCourseId) {
      throw new Error('Alege un curs valid înainte de generare.');
    }

    const result = await adminService.previewQuestionsWithVolt(id, {
      course_id: validCourseId,
      numberOfQuestions: Math.max(1, Number(aiOptions.numberOfQuestions) || 1),
      difficulty: aiOptions.difficulty,
      questionTypes: aiOptions.questionTypes,
      instructions: '',
      approvedQuestions: approvedQuestions.map((q) => q.content || q.text || '').filter(Boolean),
      blockedQuestions: blockedQuestions.map((q) => q.content || q.text || '').filter(Boolean),
      autoGenerate,
    });

    const draft = Array.isArray(result?.draft) ? result.draft : [];
    return draft;
  };

  const handleOpenAIModal = () => {
    setAiOptions({
      numberOfQuestions: 10,
      difficulty: 'medium',
      questionTypes: ['multiple_choice'],
    });
    setAiError(null);
    setAiReviewStarted(false);
    setAiCurrentDraftQuestion(null);
    setAiApprovedQuestions([]);
    setAiGeneratedCount(0);
    setAiGeneratedPreviews([]);
    if (!aiSelectedCourseId && aiCourses.length > 0) {
      setAiSelectedCourseId(String(aiCourses[0].id));
    }
    setShowAIModal(true);
  };

  const startAiReview = async (overrideCourseId = null) => {
    const effectiveCourseId = resolveValidCourseId(overrideCourseId);
    if (!effectiveCourseId) {
      error('Alege mai întâi un curs sursă.');
      return;
    }

    setAiReviewStarted(true);
    setAiCurrentDraftQuestion(null);
    try {
      setAiGenerating(true);
      setAiError(null);
      setAiGeneratedCount(0);
      setAiGeneratedPreviews([]);

      const draft = await fetchAiDraftQuestion([], [], effectiveCourseId);
      if (!draft) {
        throw new Error('Volt nu a returnat nicio întrebare.');
      }
      setAiCurrentDraftQuestion(draft);
      setAiGeneratedCount(1);
    } catch (err) {
      console.error('Error generating questions:', err);
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Eroare la generarea întrebărilor cu Volt';
      setAiError(message);
      setAiReviewStarted(false);
      error(message);
    } finally {
      setAiGenerating(false);
    }
  };

  const advanceAiDraft = async (shouldApprove = false) => {
    if (!aiCurrentDraftQuestion) return;

    const nextApproved = shouldApprove ? [...aiApprovedQuestions, aiCurrentDraftQuestion] : aiApprovedQuestions;
    const nextApprovedCount = nextApproved.length;

    if (shouldApprove && nextApprovedCount >= aiTargetCount) {
      try {
        setAiGenerating(true);
        await adminService.addQuestionsToBankBulk(id, nextApproved);
        success(`Au fost salvate ${nextApproved.length} întrebări aprobate.`);
        setShowAIModal(false);
        setAiReviewStarted(false);
        setAiCurrentDraftQuestion(null);
        setAiApprovedQuestions([]);
        setAiGeneratedCount(0);
        setAiError(null);
        await loadData();
      } catch (err) {
        console.error('Error saving approved Volt questions:', err);
        const message = err.response?.data?.message || err.message || 'Eroare la salvarea întrebărilor aprobate.';
        setAiError(message);
        error(message);
      } finally {
        setAiGenerating(false);
      }
      return;
    }

    try {
      setAiGenerating(true);
      setAiError(null);
      const blockedQuestions = shouldApprove
        ? nextApproved
        : [...aiApprovedQuestions, aiCurrentDraftQuestion].filter(Boolean);
      const draft = await fetchAiDraftQuestion(nextApproved, blockedQuestions, aiSelectedCourseId);
      if (!draft) {
        throw new Error('Volt nu a returnat următoarea întrebare.');
      }
      setAiApprovedQuestions(nextApproved);
      setAiCurrentDraftQuestion(draft);
      setAiGeneratedCount((prev) => prev + 1);
    } catch (err) {
      console.error('Error advancing Volt draft:', err);
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Eroare la generarea următoarei întrebări.';
      setAiError(message);
      error(message);
    } finally {
      setAiGenerating(false);
    }
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
      const generatedQuestions = [];
      const generatedPreviews = [];

      for (let index = 0; index < targetCount; index += 1) {
        const draft = await fetchAiDraftQuestion(generatedQuestions, generatedQuestions, effectiveCourseId, false);
        const candidate = Array.isArray(draft) ? draft[0] : null;
        const content = trimQuestionText(candidate?.content || candidate?.question || '');

        if (!candidate || !content) {
          throw new Error('Volt nu a returnat nicio întrebare.');
        }

        generatedQuestions.push(candidate);
        generatedPreviews.push({
          index: index + 1,
          content,
          type: candidate.type || 'multiple_choice',
        });
        setAiGeneratedCount(index + 1);
        setAiGeneratedPreviews([...generatedPreviews]);
      }

      await adminService.addQuestionsToBankBulk(id, generatedQuestions);
      success(`Au fost generate și salvate ${generatedQuestions.length} întrebări.`);
      setShowAIModal(false);
      setAiCurrentDraftQuestion(null);
      setAiApprovedQuestions([]);
      setAiGeneratedCount(0);
      setAiGeneratedPreviews([]);
      setAiReviewStarted(false);
      setAiError(null);
      await loadData();
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
    setQuestionEditorNumber((questions?.length || 0) + 1);
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
    setQuestionEditorNumber(indexInList >= 0 ? indexInList + 1 : 1);
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
      await loadData();
    } catch (e) {
      error(e?.response?.data?.error || 'Nu am putut salva întrebarea.');
    } finally {
      setQuestionEditorSaving(false);
    }
  };

  return (
    <div className="qb-page qb-page-v2">
      <div className="qb-shell qb-shell-detail">
        <header className="qb-details-header">
          <Link to="/admin/question-banks" className="qb-back-btn">
            ← Înapoi
          </Link>
          <div className="qb-details-title-wrap">
            <h1>{folder?.title || 'Detalii folder'}</h1>
            <div className="qb-folder-tags">
              {(folder?.tags || []).map((tag) => (
                <Tag key={tag.id}>{tag.name}</Tag>
              ))}
            </div>
          </div>
          <button type="button" className="lms-btn-secondary" onClick={() => setEditOpen(true)}>
            Editează
          </button>
        </header>

        <section className="qb-rows">
          {loading ? (
            <p>Se încarcă...</p>
          ) : (
            questions.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                selected={selectedIds.includes(question.id)}
                isActive={drawerQuestion?.id === question.id}
                onToggleSelect={toggleSelect}
                onToggleStar={toggleStar}
                onOpenDrawer={setDrawerQuestion}
                readOnly={readOnly}
              />
            ))
          )}
        </section>

        {!readOnly && (
          <footer className="qb-details-footer">
            <button type="button" className="lms-btn-secondary" onClick={openCreateQuestionEditor}>
              + Adaugă întrebare
            </button>
            <button type="button" className="lms-btn-primary" onClick={handleOpenAIModal}>
              ✨ Generează cu Volt
            </button>
            {!!selectedIds.length && (
              <button type="button" className="lms-btn-secondary va-btn-danger" onClick={runBulkDelete}>
                Șterge selecția
              </button>
            )}
          </footer>
        )}
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
          <label>Nume</label>
          <input className="admin-form-input" value={editForm.title} onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))} />
          <label>Descriere</label>
          <textarea className="admin-form-input" rows={3} value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} />
          <label>Tag-uri</label>
          <input className="admin-form-input" value={editForm.tagsText} onChange={(e) => setEditForm((prev) => ({ ...prev, tagsText: e.target.value }))} />
          <div className="qb-modal-actions">
            <button type="button" className="lms-btn-secondary" onClick={() => setEditOpen(false)}>
              Anulează
            </button>
            <button type="button" className="lms-btn-primary" onClick={saveFolder}>
              Salvează
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={questionEditorOpen && !readOnly} onClose={() => !questionEditorSaving && setQuestionEditorOpen(false)}>
        <div className="qb-modal qb-modal-question-editor">
          <h3>{questionDraft.id ? 'Editează întrebare' : 'Întrebare nouă'}</h3>
          <QuestionBuilderEditor question={questionDraft} onChange={setQuestionDraft} questionNumber={questionEditorNumber} />
          <div className="qb-modal-actions">
            <button type="button" className="lms-btn-secondary" onClick={() => setQuestionEditorOpen(false)} disabled={questionEditorSaving}>
              Anulează
            </button>
            <button type="button" className="lms-btn-primary" onClick={saveQuestionFromEditor} disabled={questionEditorSaving}>
              {questionEditorSaving ? 'Se salvează...' : 'Salvează'}
            </button>
          </div>
        </div>
      </Modal>

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
