import React, { useState } from 'react';
import './Step4LessonDesign.css';

/**
 * PASUL 4: Lesson Design (Atomic Level)
 * Conform defacut.md:
 * - Grid cu carduri (un tip = un card)
 * - Icon + short description
 * - Selectare tip lecție pentru fiecare lecție
 */
const Step4LessonDesign = ({ data, onUpdate, errors }) => {
	const [selectedLessons, setSelectedLessons] = useState({}); // lessonId -> type

	const lessonTypes = [
		{
			id: 'video',
			title: 'Video',
			description: 'Lecție video cu player, chapters, și transcriere',
			icon: '🎥',
			features: ['Video player', 'Auto chapters', 'Transcription', 'Summary']
		},
		{
			id: 'text',
			title: 'Text',
			description: 'Lecție text cu editor Notion-like și AI rewrite',
			icon: '📝',
			features: ['Rich text editor', 'AI rewrite', 'Reading time', 'Difficulty score']
		},
		{
			id: 'assignment',
			title: 'Assignment / Practice',
			description: 'Temă sau exercițiu practic cu AI feedback',
			icon: '✍️',
			features: ['Exercise generation', 'Auto feedback', 'Scoring']
		},
		{
			id: 'quiz',
			title: 'Quiz',
			description: 'Întrebări cu răspunsuri multiple, AI generated',
			icon: '❓',
			features: ['AI questions', 'Multiple choice', 'Difficulty balance']
		},
		{
			id: 'live',
			title: 'Live Session',
			description: 'Sesiune live cu agenda și post-session summary',
			icon: '🔴',
			features: ['Schedule', 'AI agenda', 'Post-session summary']
		}
	];

	// Get all lessons from all modules
	const allLessons = (data.modules || []).flatMap((module, midx) =>
		(module.lessons || []).map((lesson, lidx) => ({
			...lesson,
			moduleId: module.id || midx,
			moduleTitle: module.title,
			lessonIndex: lidx
		}))
	);

	const handleSelectLessonType = (lessonId, type) => {
		setSelectedLessons(prev => ({
			...prev,
			[lessonId]: type
		}));

		// Update lesson in course data
		const updatedModules = (data.modules || []).map(module => ({
			...module,
			lessons: (module.lessons || []).map(lesson => {
				// Match by id or by temporary id (for lessons without id)
				const matches = lesson.id === lessonId || 
				               (lesson.id && lesson.id.toString() === lessonId.toString()) ||
				               (!lesson.id && `${module.id || ''}-${module.lessons?.indexOf(lesson) || ''}` === lessonId);
				
				if (matches) {
					return { ...lesson, content_type: type, type: type };
				}
				return lesson;
			})
		}));

		onUpdate({ modules: updatedModules });
	};

	if (allLessons.length === 0) {
		return (
			<div className="step4-lesson-design">
				<div className="step4-lesson-design-empty">
					<p>💡 Adaugă mai întâi lecții în pasul anterior (Course Structure)</p>
				</div>
			</div>
		);
	}

	return (
		<div className="step4-lesson-design">
			<div className="step4-lesson-design-header">
				<h2>Design Lecții</h2>
				<p className="step4-lesson-design-description">
					Selectează tipul de lecție pentru fiecare lecție din curs. Poți schimba tipul oricând.
				</p>
			</div>

			{/* Lessons by Module */}
			<div className="step4-lesson-design-lessons">
				{(data.modules || []).map((module, midx) => (
					<div key={module.id || midx} className="step4-lesson-design-module">
						<h3 className="step4-lesson-design-module-title">
							{module.title || `Module ${midx + 1}`}
						</h3>
						<div className="step4-lesson-design-module-lessons">
							{(module.lessons || []).filter(lesson => lesson).map((lesson, lidx) => {
								if (!lesson) return null;
								const lessonId = lesson.id || `${module.id || midx}-${lidx}`;
								const currentType = lesson.content_type || lesson.type || selectedLessons[lessonId] || 'text';
								
								return (
								<div key={lessonId} className="step4-lesson-design-lesson">
									<div className="step4-lesson-design-lesson-header">
										<h4>{lesson.title || `Lecție ${lidx + 1}`}</h4>
										<span className="step4-lesson-design-lesson-type-badge">
											{lessonTypes.find(t => t.id === currentType)?.icon} {lessonTypes.find(t => t.id === currentType)?.title}
										</span>
									</div>

									{/* Lesson Type Grid */}
									<div className="step4-lesson-design-types-grid">
										{lessonTypes.map(type => (
											<button
												key={type.id}
												type="button"
												className={`step4-lesson-design-type-card ${
													currentType === type.id ? 'selected' : ''
												}`}
												onClick={() => handleSelectLessonType(lessonId, type.id)}
											>
												<div className="step4-lesson-design-type-icon">{type.icon}</div>
												<div className="step4-lesson-design-type-content">
													<h5>{type.title}</h5>
													<p>{type.description}</p>
													<div className="step4-lesson-design-type-features">
														{type.features.map((feature, fidx) => (
															<span key={fidx} className="step4-lesson-design-type-feature">
																{feature}
															</span>
														))}
													</div>
												</div>
											</button>
										))}
									</div>
								</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default Step4LessonDesign;
