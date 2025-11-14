import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockCourseCategories, getCoursesForCategory } from '../data/mockData';

const CoursesPage = () => {
	const navigate = useNavigate();
	const [expandedCategories, setExpandedCategories] = useState(new Set());

	const toggleCategory = (categoryId) => {
		const newExpanded = new Set(expandedCategories);
		if (newExpanded.has(categoryId)) {
			newExpanded.delete(categoryId);
		} else {
			newExpanded.add(categoryId);
		}
		setExpandedCategories(newExpanded);
	};

	const modulesCountLabel = (count) => `Modul${count === 1 ? '' : 'e'} · ${count}`;

	return (
		<div className="va-stack">
			<h1 className="va-page-title">Toate cursurile</h1>
			<p className="va-muted">
				Explorează cursurile organizate pe tematici. Fiecare curs este împărțit pe module și include un test final.
			</p>

			<div className="va-courses-structure">
				{mockCourseCategories.map((category) => {
					const isCategoryExpanded = expandedCategories.has(category.id);
					const categoryCourses = getCoursesForCategory(category.id);

					return (
						<div key={category.id} className="va-category-section">
							<button
								type="button"
								className="va-category-header"
								onClick={() => toggleCategory(category.id)}
								style={{
									borderColor: isCategoryExpanded ? `${category.accent}66` : 'transparent',
									boxShadow: isCategoryExpanded ? `0 0 20px ${category.accent}33` : 'none',
								}}
							>
								<div className="va-category-header-content">
									<div className="va-category-info">
										<p className="va-category-eyebrow">
											{category.courseIds.length} curs{category.courseIds.length === 1 ? '' : 'uri'}
										</p>
										<h2 className="va-category-title">{category.title}</h2>
										<p className="va-category-description">{category.description}</p>
									</div>
									<span className={`va-category-arrow ${isCategoryExpanded ? 'va-category-arrow-expanded' : ''}`}>
										↓
									</span>
								</div>
							</button>

							{isCategoryExpanded && (
								<div className="va-category-content">
									{categoryCourses.map((course) => {
										return (
											<div key={course.id} className="va-course-section">
												<button
													type="button"
													className="va-course-header"
													onClick={() => {
														navigate(`/courses/${course.id}/lessons`);
													}}
												>
													<div className="va-course-header-content">
														<div className="va-course-info">
															<div className="va-course-title-row">
																<h3 className="va-course-title">{course.title}</h3>
																<div className="va-course-meta-inline">
																	<span>{modulesCountLabel(course.lessons.length)}</span>
																</div>
															</div>
															<p className="va-course-description">{course.description}</p>
														</div>
														<span className="va-course-arrow">→</span>
													</div>
												</button>
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default CoursesPage;
