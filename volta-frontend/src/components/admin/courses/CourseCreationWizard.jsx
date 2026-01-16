import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CourseCreationWizard.css';

/**
 * Course Creation Wizard - Entry Point
 * Conform defacut.md: Creatorul NU începe de la zero - selectează un blueprint
 */
const CourseCreationWizard = ({ onClose, onSelectBlueprint }) => {
	const [step, setStep] = useState(1); // 1: Creator Type, 2: Blueprint Selection
	const [creatorType, setCreatorType] = useState(null);
	const [selectedBlueprint, setSelectedBlueprint] = useState(null);

	// Tipuri de creatori conform defacut.md secțiunea 1
	const creatorTypes = [
		{
			id: 'solo',
			title: 'Solo Creator',
			description: 'Creez cursuri individual, pentru audiență generală',
			icon: '👤',
			terminology: {
				students: 'Studenți',
				enrollments: 'Înscrieri'
			}
		},
		{
			id: 'team',
			title: 'Team / Company Trainer',
			description: 'Cursuri pentru echipă sau companie, training corporativ',
			icon: '👥',
			terminology: {
				students: 'Angajați',
				enrollments: 'Participanți'
			}
		},
		{
			id: 'academy',
			title: 'Academy / School',
			description: 'Academie sau școală, multiple cursuri, structură complexă',
			icon: '🏫',
			terminology: {
				students: 'Studenți',
				enrollments: 'Înscrieri'
			}
		}
	];

	// Blueprints conform defacut.md secțiunea 2
	const blueprints = [
		{
			id: 'video',
			title: 'Video Course',
			description: 'Curs bazat pe video-uri, cu transcrieri și capitole AI',
			icon: '🎥',
			structure: {
				modules: 3,
				lessonsPerModule: 5,
				lessonTypes: ['video'],
				assessments: ['lesson_quiz', 'final_exam']
			},
			aiRules: {
				transcription: true,
				chapters: true,
				highlights: true,
				summary: true
			}
		},
		{
			id: 'bootcamp',
			title: 'Bootcamp',
			description: 'Program intensiv, practic, cu proiecte și evaluări',
			icon: '🚀',
			structure: {
				modules: 5,
				lessonsPerModule: 8,
				lessonTypes: ['video', 'text', 'assignment'],
				assessments: ['module_test', 'final_exam']
			},
			aiRules: {
				exercises: true,
				feedback: true,
				projectSuggestions: true
			}
		},
		{
			id: 'certification',
			title: 'Certification Path',
			description: 'Cale de certificare cu examene și verificări stricte',
			icon: '🎓',
			structure: {
				modules: 6,
				lessonsPerModule: 6,
				lessonTypes: ['video', 'text'],
				assessments: ['module_test', 'final_exam']
			},
			aiRules: {
				questionGeneration: true,
				difficultyBalancing: true,
				antiPatternDetection: true
			}
		},
		{
			id: 'microlearning',
			title: 'Microlearning',
			description: 'Lecții scurte, fragmentate, perfecte pentru mobile',
			icon: '📱',
			structure: {
				modules: 4,
				lessonsPerModule: 3,
				lessonTypes: ['video', 'text'],
				assessments: ['lesson_quiz']
			},
			aiRules: {
				chunking: true,
				mobileOptimization: true,
				offlineReady: true
			}
		},
		{
			id: 'corporate',
			title: 'Corporate Training',
			description: 'Training corporativ, cu tracking și raportare',
			icon: '🏢',
			structure: {
				modules: 4,
				lessonsPerModule: 5,
				lessonTypes: ['video', 'text', 'live'],
				assessments: ['module_test']
			},
			aiRules: {
				agendaGeneration: true,
				postSessionSummary: true,
				complianceTracking: true
			}
		}
	];

	const handleCreatorTypeSelect = (type) => {
		setCreatorType(type);
		setStep(2);
	};

	const handleBlueprintSelect = (blueprint) => {
		setSelectedBlueprint(blueprint);
		if (onSelectBlueprint) {
			onSelectBlueprint({
				creatorType,
				blueprint,
				terminology: creatorTypes.find(ct => ct.id === creatorType)?.terminology
			});
		}
	};

	const handleBack = () => {
		if (step === 2) {
			setStep(1);
			setSelectedBlueprint(null);
		} else {
			onClose?.();
		}
	};

	return (
		<div className="course-creation-wizard-overlay" onClick={onClose}>
			<div className="course-creation-wizard" onClick={(e) => e.stopPropagation()}>
				<div className="course-creation-wizard-header">
					<h2>Creează Curs Nou</h2>
					<button className="course-creation-wizard-close" onClick={onClose}>×</button>
				</div>

				<div className="course-creation-wizard-content">
					{step === 1 && (
						<div className="course-creation-wizard-step">
							<h3>Ce tip de creator ești?</h3>
							<p className="course-creation-wizard-hint">
								Această selecție va adapta wizard-ul și terminologia pentru nevoile tale
							</p>
							<div className="creator-types-grid">
								{creatorTypes.map((type) => (
									<button
										key={type.id}
										className={`creator-type-card ${creatorType === type.id ? 'selected' : ''}`}
										onClick={() => handleCreatorTypeSelect(type.id)}
									>
										<div className="creator-type-icon">{type.icon}</div>
										<div className="creator-type-title">{type.title}</div>
										<div className="creator-type-description">{type.description}</div>
									</button>
								))}
							</div>
						</div>
					)}

					{step === 2 && (
						<div className="course-creation-wizard-step">
							<h3>Selectează un Blueprint</h3>
							<p className="course-creation-wizard-hint">
								Blueprint-ul definește structura inițială și tipurile de lecții
							</p>
							<div className="blueprints-grid">
								{blueprints.map((blueprint) => (
									<button
										key={blueprint.id}
										className={`blueprint-card ${selectedBlueprint?.id === blueprint.id ? 'selected' : ''}`}
										onClick={() => handleBlueprintSelect(blueprint)}
									>
										<div className="blueprint-icon">{blueprint.icon}</div>
										<div className="blueprint-title">{blueprint.title}</div>
										<div className="blueprint-description">{blueprint.description}</div>
										<div className="blueprint-structure">
											<div className="blueprint-structure-item">
												<span className="blueprint-structure-label">Module:</span>
												<span className="blueprint-structure-value">{blueprint.structure.modules}</span>
											</div>
											<div className="blueprint-structure-item">
												<span className="blueprint-structure-label">Lecții/modul:</span>
												<span className="blueprint-structure-value">{blueprint.structure.lessonsPerModule}</span>
											</div>
										</div>
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="course-creation-wizard-footer">
					<button className="admin-btn admin-btn-secondary" onClick={handleBack}>
						{step === 1 ? 'Anulează' : '← Înapoi'}
					</button>
					{step === 2 && selectedBlueprint && (
						<button
							className="admin-btn admin-btn-primary"
							onClick={() => handleBlueprintSelect(selectedBlueprint)}
						>
							Continuă cu {selectedBlueprint.title} →
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default CourseCreationWizard;
