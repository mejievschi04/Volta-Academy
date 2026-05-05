import React from 'react';
import { Link } from 'react-router-dom';
import Folder from '../../ui/Folder';
import Tag from './Tag';

const FolderCard = ({ folder }) => {
	const tags = Array.isArray(folder?.tags) ? folder.tags : [];
	const questionCount = folder.questions_count || 0;
	const starredCount = folder.starred_questions_count || 0;
	const folderItems = [
		<span className="qb-folder-paper-metric">{questionCount}</span>,
		<span className="qb-folder-paper-metric">{starredCount}</span>,
		tags[0]?.name ? <span className="qb-folder-paper-tag">{tags[0].name}</span> : null,
	];

	return (
		<Link
			className="qb-folder-card qb-folder-card--react-bits"
			to={`/admin/question-banks/${folder.id}`}
		>
			<div className="qb-folder-card-top">
				<Folder
					size={1.25}
					color="#e6d800"
					items={folderItems}
					className="qb-folder-visual"
				/>
			</div>
			<strong className="qb-folder-title">{folder.title}</strong>
			<div className="qb-folder-meta va-card-subtitle">
				<span>{questionCount} întrebări</span>
				<span>⭐ {starredCount}</span>
			</div>
			<div className="qb-folder-tags">
				{tags.map((tag) => (
					<Tag key={`${folder.id}-${tag.id}`}>{tag.name}</Tag>
				))}
			</div>
			<div className="qb-folder-card-footer" aria-hidden>
				<span className="va-card-cta-label">Deschide</span>
				<span className="va-card-cta-icon">→</span>
			</div>
		</Link>
	);
};

export default FolderCard;
