import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, getDefaultCurrency } from '../../utils/currency';

const TopCourses = ({ courses, loading }) => {
	const [currency, setCurrency] = useState(getDefaultCurrency());

	useEffect(() => {
		const handleCurrencyChange = (e) => {
			setCurrency(e.detail);
		};
		window.addEventListener('currencyChanged', handleCurrencyChange);
		setCurrency(getDefaultCurrency());
		return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
	}, []);

	if (loading) {
		return (
			<div className="admin-section-card">
				<div className="skeleton-card" style={{ height: '300px' }}></div>
			</div>
		);
	}

	if (!courses || courses.length === 0) {
		return (
			<div className="admin-section-card">
				<div className="admin-section-header">
					<h2>Top Cursuri</h2>
				</div>
				<div className="empty-state">
					<div className="empty-state-icon">📚</div>
					<div className="empty-state-title">Nu există date</div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-section-card">
			<div className="admin-section-header">
				<h2>Top Cursuri</h2>
				<p className="admin-section-subtitle">Cursurile cu cele mai bune performanțe</p>
			</div>
			<div className="admin-courses-list">
				{courses.map((course, index) => (
					<Link 
						key={course.id} 
						to={`/admin/courses/${course.id}`}
						className="admin-course-item"
					>
						<div className="admin-course-rank">#{index + 1}</div>
						<div className="admin-course-info">
							<div className="admin-course-title">{course.title}</div>
							<div className="admin-course-metrics">
								<span className="admin-course-metric">
									👥 {course.enrollments || 0} înscrieri
								</span>
								<span className="admin-course-metric">
									💰 {formatCurrency(course.revenue || 0, currency)}
								</span>
								<span className="admin-course-metric">
									✅ {course.completion_rate || 0}% finalizare
								</span>
							</div>
						</div>
						<div className="admin-course-arrow">→</div>
					</Link>
				))}
			</div>
		</div>
	);
};

export default TopCourses;

