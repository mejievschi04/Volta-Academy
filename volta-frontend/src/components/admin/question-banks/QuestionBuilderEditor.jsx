import React, { useMemo, useState } from 'react';
import '../../../styles/admin-course-builder.css';

const INLINE_QUESTION_TYPES = [
  { id: 'multiple_choice', label: 'Răspuns multiplu', short: 'A/B' },
  { id: 'true_false', label: 'Adevărat / Fals', short: 'T/F' },
  { id: 'short_answer', label: 'Răspuns scurt', short: 'TXT' },
  { id: 'essay', label: 'Eseu', short: 'ESEU' },
];

const normalizeType = (type) => {
  if (type === 'single_choice') return 'multiple_choice';
  return INLINE_QUESTION_TYPES.some((t) => t.id === type) ? type : 'multiple_choice';
};

const getDefaultAnswersByType = (type) => {
  if (type === 'multiple_choice') {
    return [
      { text: 'Răspuns A', is_correct: true },
      { text: 'Răspuns B', is_correct: false },
    ];
  }
  if (type === 'true_false') {
    return [
      { text: 'Adevărat', is_correct: true },
      { text: 'Fals', is_correct: false },
    ];
  }
  return [];
};

const QuestionBuilderEditor = ({ question, onChange, questionNumber = 1 }) => {
  const [typePickerOpen, setTypePickerOpen] = useState(true);
  const currentType = normalizeType(question?.type);
  const answers = useMemo(
    () => (Array.isArray(question?.answers) ? question.answers : getDefaultAnswersByType(currentType)),
    [question?.answers, currentType]
  );
  const currentTypeLabel = INLINE_QUESTION_TYPES.find((t) => t.id === currentType)?.label || 'Întrebare';

  const update = (patch) => onChange({ ...question, ...patch });

  const setType = (type) => {
    const nextType = normalizeType(type);
    update({
      type: nextType,
      answers: getDefaultAnswersByType(nextType),
    });
    setTypePickerOpen(false);
  };

  const setAnswerText = (idx, text) => {
    const next = answers.map((a, i) => (i === idx ? { ...a, text } : a));
    update({ answers: next });
  };

  const toggleCorrect = (idx) => {
    const single = currentType === 'true_false';
    const next = answers.map((a, i) => ({
      ...a,
      is_correct: single ? i === idx : (i === idx ? !a.is_correct : a.is_correct),
    }));
    update({ answers: next });
  };

  const addAnswer = () => update({ answers: [...answers, { text: 'Răspuns nou', is_correct: false }] });
  const removeAnswer = (idx) => update({ answers: answers.filter((_, i) => i !== idx) });

  return (
    <div className="admin-course-builder-test-layout">
      <div className="admin-course-builder-test-main">
        <div className="admin-course-builder-test-questions admin-course-builder-test-questions-card">
          <ul className="admin-course-builder-test-question-list">
            <li className="admin-course-builder-test-question-item is-expanded">
              <div className="admin-course-builder-test-question-topline">
                <div className="admin-course-builder-test-question-type-picker">
                  <button
                    type="button"
                    className="admin-course-builder-test-question-badge admin-course-builder-test-question-badge-btn"
                    onClick={() => setTypePickerOpen((prev) => !prev)}
                  >
                    {`Î${questionNumber}: ${currentTypeLabel}`}
                  </button>
                </div>
              </div>
              <textarea
                className="admin-course-builder-test-question-input"
                value={question?.content || ''}
                onChange={(e) => update({ content: e.target.value })}
                placeholder="Adaugă întrebare"
                rows={2}
              />

              <textarea
                className="admin-course-builder-test-question-desc"
                value={question?.explanation || ''}
                onChange={(e) => update({ explanation: e.target.value })}
                placeholder="Adaugă descriere..."
                rows={2}
              />

              <div className="admin-course-builder-test-field">
                <label>Puncte</label>
                <input
                  type="number"
                  min="1"
                  value={question?.points ?? 1}
                  onChange={(e) => update({ points: Number(e.target.value) || 1 })}
                />
              </div>

              {(currentType === 'multiple_choice' || currentType === 'true_false') && (
                <div className="admin-course-builder-test-question-answers">
                  <p>Răspunsuri:</p>
                  {answers.map((answer, idx) => (
                    <div key={`ans-${idx}`} className="admin-course-builder-test-answer-row">
                      <input
                        type={currentType === 'true_false' ? 'radio' : 'checkbox'}
                        name={currentType === 'true_false' ? 'answer-correct' : undefined}
                        checked={!!answer.is_correct}
                        onChange={() => toggleCorrect(idx)}
                      />
                      <input
                        type="text"
                        value={answer.text || ''}
                        onChange={(e) => setAnswerText(idx, e.target.value)}
                        placeholder="Introduce răspuns"
                        disabled={currentType === 'true_false'}
                      />
                      {currentType !== 'true_false' && (
                        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => removeAnswer(idx)}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {currentType !== 'true_false' && (
                    <button type="button" className="admin-btn admin-btn-secondary" onClick={addAnswer}>
                      + Adaugă răspuns
                    </button>
                  )}
                </div>
              )}

              {(currentType === 'short_answer' || currentType === 'essay') && (
                <p className="step4-hint-manual">Răspunsul va fi notat manual de instructor.</p>
              )}
            </li>
          </ul>
        </div>
      </div>

      <aside className={`admin-course-builder-test-sidepanel ${typePickerOpen ? 'is-open' : ''}`}>
        <div className="admin-course-builder-test-sidepanel-head">
          <h3>Tipuri întrebări</h3>
        </div>
        <div className="admin-course-builder-test-type-grid">
          {INLINE_QUESTION_TYPES.map((typeOpt) => (
            <button
              key={typeOpt.id}
              type="button"
              className={`admin-course-builder-test-type-card ${currentType === typeOpt.id ? 'is-active' : ''}`}
              onClick={() => setType(typeOpt.id)}
            >
              <span className="admin-course-builder-test-type-short">{typeOpt.short}</span>
              <span className="admin-course-builder-test-type-label">{typeOpt.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default QuestionBuilderEditor;
