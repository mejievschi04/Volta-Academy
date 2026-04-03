import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Modal from '../../components/common/Modal';
import { useToast } from '../../contexts/ToastContext';
import { adminService } from '../../services/api';
import Drawer from '../../components/admin/question-banks/Drawer';
import QuestionRow from '../../components/admin/question-banks/QuestionRow';
import Tag from '../../components/admin/question-banks/Tag';
import QuestionBuilderEditor from '../../components/admin/question-banks/QuestionBuilderEditor';
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
    <div className="qb-page">
      <header className="qb-details-header">
        <Link to="/admin/question-banks" className="qb-back-btn">
          ← Înapoi
        </Link>
        <div>
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
        <button type="button" className="lms-btn-primary">
          ✨ Generează cu AI
        </button>
        {!!selectedIds.length && (
          <button type="button" className="lms-btn-secondary va-btn-danger" onClick={runBulkDelete}>
            Șterge selecția
          </button>
        )}
      </footer>
      )}

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
    </div>
  );
};

export default AdminQuestionBankFolderDetailsPage;
