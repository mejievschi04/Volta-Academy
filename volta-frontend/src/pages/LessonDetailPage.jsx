import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { lessonsService } from '../services/api';

const LessonDetailPage = () => {
	const { courseId, lessonId } = useParams();
	const [lesson, setLesson] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchLesson = async () => {
			try {
				setLoading(true);
				const data = await lessonsService.getById(lessonId);
				setLesson(data);
			} catch (err) {
				console.error('Error fetching lesson:', err);
				setError('Lecția nu a fost găsită');
			} finally {
				setLoading(false);
			}
		};
		fetchLesson();
	}, [lessonId]);

	if (loading) { return null; }

	if (error || !lesson) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Lecția nu a fost găsită'}</p>
			</div>
		);
	}

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
