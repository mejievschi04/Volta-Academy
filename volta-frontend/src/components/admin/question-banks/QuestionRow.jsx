import React from 'react';
import Tag from './Tag';

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const QUESTION_TYPE_LABELS = {
  single_choice: 'Răspuns unic',
  multiple_choice: 'Răspuns multiplu',
  true_false: 'Adevărat/Fals',
  matching: 'Potrivire',
  ordering: 'Ordonare',
  fill_in_blank: 'Completare spații',
};

const QuestionRow = ({ question, selected, isActive, onToggleSelect, onToggleStar, onOpenDrawer, readOnly = false }) => {
  const tags = question?.tags || question?.metadata?.tags || [];
  const questionText = stripHtml(question?.content || '');
  const questionTypeLabel = QUESTION_TYPE_LABELS[question?.type] || question?.type || 'N/A';

  return (
    <div className={`qb-question-row ${question?.is_starred ? 'is-starred' : ''} ${isActive ? 'is-active' : ''}`}>
      {!readOnly && (
        <label>
          <input type="checkbox" checked={selected} onChange={() => onToggleSelect(question.id)} />
        </label>
      )}
      {!readOnly ? (
        <button
          type="button"
          className={`qb-star-btn ${question?.is_starred ? 'is-starred' : ''}`}
          onClick={() => onToggleStar(question.id)}
          title="Marchează / Demarchează"
        >
          <span className={`qb-star-glyph ${question?.is_starred ? 'is-filled' : ''}`} aria-hidden="true">
            ★
          </span>
        </button>
      ) : (
        <span className={`qb-star-btn ${question?.is_starred ? 'is-starred' : ''}`} aria-hidden style={{ cursor: 'default' }}>
          <span className={`qb-star-glyph ${question?.is_starred ? 'is-filled' : ''}`}>★</span>
        </span>
      )}
      <button type="button" className="qb-question-main" onClick={() => onOpenDrawer(question)}>
        <span className="qb-question-text">{questionText}</span>
        <span className="qb-question-tags">
          {Array.isArray(tags) &&
            tags.map((tag) => (
              <Tag key={`${question.id}-${tag}`}>{tag}</Tag>
            ))}
        </span>
      </button>
      <div className="qb-question-right">
        <span className="qb-question-type">{questionTypeLabel}</span>
        <button type="button" className="qb-actions-btn" onClick={() => onOpenDrawer(question)}>
          ⋯
        </button>
      </div>
    </div>
  );
};

export default QuestionRow;
