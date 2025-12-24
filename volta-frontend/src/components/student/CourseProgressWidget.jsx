import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressIndicator from './ProgressIndicator';

const CourseProgressWidget = ({ course }) => {
	const navigate = useNavigate();

	const handleViewCourse = () => {
		navigate(`/courses/${course.id}`);
	};

	const progressColor = course.progress >= 100 
		? '#10b981' 
		: course.progress >= 50 
		? '#ffd700' 
		: '#f59e0b';

	return (
		<div className="student-course-progress-card">
			<div className="student-course-progress-header">
				{course.thumbnail && (
					<img 
						src={course.thumbnail} 
						alt={course.title}
						className="student-course-progress-thumbnail"
					/>
				)}
				<div className="student-course-progress-info">
					<h4 className="student-course-progress-title">{course.title}</h4>
					{course.teacher && (
						<p className="student-course-progress-teacher">👤 {course.teacher}</p>
					)}
				</div>
			</div>
			<div className="student-course-progress-body">
				<ProgressIndicator 
					progress={course.progress}
					size="large"
					showPercentage={true}
					animated={true}
				/>
				{course.next_module && (
					<div className="student-course-progress-next">
						<span className="student-course-progress-next-label">Următorul modul:</span>
						<span className="student-course-progress-next-module">{course.next_module.title}</span>
					</div>
				)}
			</div>
			<div className="student-course-progress-footer">
				<button 
					className="student-btn student-btn-secondary"
					onClick={handleViewCourse}
				>
					Vezi curs →
				</button>
			</div>
		</div>
	);
};

export default CourseProgressWidget;

