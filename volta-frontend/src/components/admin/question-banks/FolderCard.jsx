import React from 'react';
import { Link } from 'react-router-dom';
import Tag from './Tag';

const FolderCard = ({ folder }) => {
  const tags = Array.isArray(folder?.tags) ? folder.tags : [];

  return (
    <Link className="qb-folder-card" to={`/admin/question-banks/${folder.id}`}>
      <div className="qb-folder-card-top">
        <strong>{folder.title}</strong>
        <span className="qb-folder-open">Deschide →</span>
      </div>
      <div className="qb-folder-meta">
        <span>{folder.questions_count || 0} întrebări</span>
        <span>⭐ {folder.starred_questions_count || 0}</span>
      </div>
      <div className="qb-folder-tags">
        {tags.map((tag) => (
          <Tag key={`${folder.id}-${tag.id}`}>{tag.name}</Tag>
        ))}
      </div>
    </Link>
  );
};

export default FolderCard;
