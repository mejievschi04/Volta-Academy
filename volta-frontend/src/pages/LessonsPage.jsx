import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { coursesService } from '../services/api';

const LessonsPage = () => {
	const { courseId } = useParams();
	const [course, setCourse] = useState(null);
	const [expandedLessons, setExpandedLessons] = useState(new Set());
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchCourse = async () => {
			try {
				setLoading(true);
				const data = await coursesService.getById(courseId);
				setCourse(data);
			} catch (err) {
				console.error('Error fetching course:', err);
				setError('Cursul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchCourse();
	}, [courseId]);

	if (loading) { return null; }

	if (error || !course) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Cursul nu a fost găsit'}</p>
			</div>
		);
	}

	const testSummary = 'Test final disponibil după finalizarea modulelor';

	const toggleLesson = (lessonId) => {
		const newExpanded = new Set(expandedLessons);
		if (newExpanded.has(lessonId)) {
			newExpanded.delete(lessonId);
		} else {
			newExpanded.add(lessonId);
		}
		setExpandedLessons(newExpanded);
	};

	return (
		<div className="va-stack">
			<div className="va-course-header-section">
				<h1 className="va-page-title">{course.title}</h1>
				<p className="va-muted">{course.description}</p>
				<div className="va-course-header-meta">
					<span>{course.lessons ? course.lessons.length : 0} module</span>
				</div>
			</div>

			<div className="va-lessons-structure">
				{/* Module Section */}
				<div className="va-lessons-section">
					<h2 className="va-lessons-section-title">Module</h2>
					<div className="va-lessons-list">
						{course.lessons && course.lessons.map((lesson, index) => {
							const isExpanded = expandedLessons.has(lesson.id);
							return (
								<div key={lesson.id} className="va-lesson-section">
									<button
										type="button"
										className="va-lesson-header"
										onClick={() => toggleLesson(lesson.id)}
										style={{
											borderColor: isExpanded
												? 'rgba(139, 93, 255, 0.3)'
												: 'transparent',
										}}
									>
										<div className="va-lesson-header-content">
											<div className="va-lesson-info">
												<div className="va-lesson-title-row">
													<div className="va-lesson-index">{index + 1}</div>
													<h3 className="va-lesson-title">{lesson.title}</h3>
												</div>
												{isExpanded && (
													<p className="va-lesson-content-preview">{lesson.content}</p>
												)}
											</div>
											<span className={`va-lesson-arrow ${isExpanded ? 'va-lesson-arrow-expanded' : ''}`}>
												↓
											</span>
										</div>
									</button>

									{isExpanded && (
										<div className="va-lesson-content">
											<div className="va-lesson-body">
												<p className="va-lesson-content-full">{lesson.content}</p>
											</div>
											<div className="va-lesson-actions">
												<Link
													to={`/courses/${courseId}/lessons/${lesson.id}`}
													className="va-btn va-btn-primary"
												>
													Deschide lecția
												</Link>
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* Test Section */}
				<div className="va-lessons-test-section">
					<h2 className="va-lessons-section-title">Test final</h2>
					<div className="va-test-card">
						<h3 className="va-test-title">Test final</h3>
						<p className="va-test-summary">{testSummary}</p>
						<div className="va-test-actions">
							<Link to={`/courses/${courseId}/quiz`} className="va-btn va-btn-primary">
								Susține testul
							</Link>
						</div>
					</div>
				</div>
			</div>

			<div className="va-lessons-footer-actions">
				<Link to={`/courses/${courseId}`} className="va-btn va-btn-link">
					Prezentare curs
				</Link>
				<Link to="/courses" className="va-btn va-btn-secondary">
					Înapoi la cursuri
				</Link>
			</div>
		</div>
	);
};

export default LessonsPage;
