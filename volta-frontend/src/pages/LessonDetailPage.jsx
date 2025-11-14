import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLesson } from '../data/mockData';

const LessonDetailPage = () => {
	const { courseId, lessonId } = useParams();
	const lesson = getLesson(courseId, lessonId);

	if (!lesson) return <p>Lecția nu a fost găsită.</p>;

	return (
		<div className="va-stack">
			<h1 className="va-page-title">{lesson.title}</h1>
			<div className="va-prose">
				<p>{lesson.content}</p>
			</div>

			<div className="va-actions">
				<Link to={`/courses/${courseId}/lessons`} className="va-btn va-btn-secondary">Înapoi la lecții</Link>
				<Link to={`/courses/${courseId}/quiz`} className="va-btn va-btn-primary">Mergi la quiz</Link>
			</div>
		</div>
	);
};

export default LessonDetailPage;
