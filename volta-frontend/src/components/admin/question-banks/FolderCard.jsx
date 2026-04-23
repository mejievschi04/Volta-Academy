import React from 'react';
import { Link } from 'react-router-dom';
import Tag from './Tag';

const FolderCard = ({ folder }) => {
  const tags = Array.isArray(folder?.tags) ? folder.tags : [];

  return (
    <Link className="qb-folder-card va-card-shell va-card-shell--interactive va-card-shell--uniform" to={`/admin/question-banks/${folder.id}`}>
      <div className="qb-folder-card-top">
        <strong className="va-card-title">{folder.title}</strong>
      </div>
      <div className="qb-folder-meta va-card-subtitle">
        <span>{folder.questions_count || 0} întrebări</span>
        <span>⭐ {folder.starred_questions_count || 0}</span>
      </div>
      <div className="qb-folder-tags">
        {tags.map((tag) => (
          <Tag key={`${folder.id}-${tag.id}`}>{tag.name}</Tag>
        ))}
      </div>
      <div className="qb-folder-card-footer va-card-footer" aria-hidden>
        <span className="va-card-cta-label">Deschide</span>
        <span className="va-card-cta-icon">→</span>
      </div>
    </Link>
  );
};

export default FolderCard;
