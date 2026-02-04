import React from 'react';
import { useNavigate } from 'react-router-dom';
import CourseCreationWizard from '../../components/admin/courses/CourseCreationWizard';

const CourseCreationPage = () => {
	const navigate = useNavigate();

	const handleClose = () => {
		navigate('/admin/courses');
	};

	const handleSuccess = (courseId) => {
		if (courseId) {
			navigate(`/admin/courses/${courseId}/builder`);
		} else {
			navigate('/admin/courses');
		}
	};

	return (
		<div className="admin-container">
			<CourseCreationWizard onClose={handleClose} onSuccess={handleSuccess} />
		</div>
	);
};

export default CourseCreationPage;
