import React from 'react';
import Tag from './Tag';

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeAnswers = (answers) => {
  if (!Array.isArray(answers)) return [];
  return answers.map((answer, index) => {
    if (typeof answer === 'string') {
      return { text: answer, is_correct: false, order: index };
    }
    if (!answer || typeof answer !== 'object') {
      return { text: '', is_correct: false, order: index };
    }
    return {
      text: answer.text ?? answer.answer_text ?? answer.content ?? '',
      is_correct: Boolean(answer.is_correct),
      order: typeof answer.order === 'number' ? answer.order : index,
    };
  });
};

const Drawer = ({ open, question, onClose, onEdit }) => {
  if (!open || !question) return null;

  const tags = question?.tags || question?.metadata?.tags || [];
  const answers = normalizeAnswers(question?.answers);
  const hasAnswers = answers.length > 0;

  return (
    <div className="qb-drawer-backdrop" onClick={onClose}>
      <aside className="qb-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="qb-drawer-header">
          <h3>Detalii întrebare</h3>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <p>{stripHtml(question?.content)}</p>
        {hasAnswers && (
          <div className="qb-drawer-answers">
            <h4>Răspunsuri</h4>
            <ul className="qb-drawer-answer-list">
              {answers.map((answer, index) => (
                <li key={`${question.id}-answer-${index}`} className={`qb-drawer-answer-item ${answer.is_correct ? 'is-correct' : ''}`}>
                  <span className="qb-drawer-answer-marker">{answer.is_correct ? '✓' : index + 1}</span>
                  <span className="qb-drawer-answer-text">{answer.text || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="qb-drawer-tags">
          {Array.isArray(tags) && tags.map((tag) => <Tag key={`${question.id}-${tag}`}>{tag}</Tag>)}
        </div>
        {typeof onEdit === 'function' && (
          <div className="qb-modal-actions">
            <button type="button" className="lms-btn-primary" onClick={() => onEdit(question)}>
              Editează
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export default Drawer;
