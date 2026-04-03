import React from 'react';
import Tag from './Tag';

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const Drawer = ({ open, question, onClose, onEdit }) => {
  if (!open || !question) return null;

  const tags = question?.tags || question?.metadata?.tags || [];

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
