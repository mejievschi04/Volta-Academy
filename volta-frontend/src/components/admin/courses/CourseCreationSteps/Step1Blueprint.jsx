import React, { useState } from 'react';
import './Step1Blueprint.css';

/**
 * PAS 1: Structura Pedagogică (Course Blueprint)
 * Conform TODO.md
 * - Structura: Course > Module > Lecții
 * - Pentru fiecare: Titlu, Obiectiv, Durată estimată, Tip de livrare
 * - AI opțional: Propune structură, detectează probleme
 */
const Step1Blueprint = ({ data, onUpdate }) => {
	const [expandedModules, setExpandedModules] = useState({});
	
	const modules = data.structure?.modules || [];
	
	const handleAddModule = () => {
		const newModule = {
			id: Date.now(),
			title: `Modul ${modules.length + 1}`,
			objective: '',
			duration_estimate: null,
			lessons: [],
		};
		
		onUpdate({
			structure: {
				...data.structure,
				modules: [...modules, newModule]
			}
		});
		setExpandedModules(prev => ({ ...prev, [newModule.id]: true }));
	};
	
	const handleUpdateModule = (moduleId, updates) => {
		const updatedModules = modules.map(m => 
			m.id === moduleId ? { ...m, ...updates } : m
		);
		
		onUpdate({
			structure: {
				...data.structure,
				modules: updatedModules
			}
		});
	};
	
	const handleDeleteModule = (moduleId) => {
		const updatedModules = modules.filter(m => m.id !== moduleId);
		onUpdate({
			structure: {
				...data.structure,
				modules: updatedModules
			}
		});
	};
	
	const handleAddLesson = (moduleId) => {
		const module = modules.find(m => m.id === moduleId);
		if (!module) return;
		
		const newLesson = {
			id: Date.now(),
			title: `Lecție ${(module.lessons || []).length + 1}`,
			objective: '',
			duration_estimate: null,
		};
		
		handleUpdateModule(moduleId, {
			lessons: [...(module.lessons || []), newLesson]
		});
	};
	
	const handleUpdateLesson = (moduleId, lessonId, updates) => {
		const module = modules.find(m => m.id === moduleId);
		if (!module) return;
		
		const updatedLessons = (module.lessons || []).map(l =>
			l.id === lessonId ? { ...l, ...updates } : l
		);
		
		handleUpdateModule(moduleId, { lessons: updatedLessons });
	};
	
	const handleDeleteLesson = (moduleId, lessonId) => {
		const module = modules.find(m => m.id === moduleId);
		if (!module) return;
		
		const updatedLessons = (module.lessons || []).filter(l => l.id !== lessonId);
		handleUpdateModule(moduleId, { lessons: updatedLessons });
	};
	
	
	return (
		<div className="step1-blueprint">
			<div className="step1-header">
				<h3>Structură Pedagogică</h3>
				<p className="step1-description">
					Definește structura cursului: module și lecții. Conținutul efectiv se adaugă mai târziu.
				</p>
			</div>
			
			<div className="step1-content">
				{/* Modules List */}
				<div className="step1-modules">
					{modules.length === 0 ? (
						<div className="step1-empty">
							<div className="step1-empty-icon">📐</div>
							<p>Nu există module încă.</p>
							<p className="step1-empty-hint">
								Adaugă primul modul pentru a începe.
							</p>
						</div>
					) : (
						modules.map((module, moduleIndex) => (
							<div key={module.id} className="step1-module-card">
								<div className="step1-module-header">
									<button
										type="button"
										className="step1-module-toggle"
										onClick={() => setExpandedModules(prev => ({
											...prev,
											[module.id]: !prev[module.id]
										}))}
									>
										<svg 
											className={`step1-module-arrow ${expandedModules[module.id] ? 'expanded' : ''}`}
											width="16" 
											height="16" 
											viewBox="0 0 16 16"
										>
											<path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" fill="none"/>
										</svg>
									</button>
									
									<div className="step1-module-number">{moduleIndex + 1}</div>
									
									<input
										type="text"
										value={module.title}
										onChange={(e) => handleUpdateModule(module.id, { title: e.target.value })}
										placeholder="Titlu modul"
										className="step1-module-title-input"
									/>
									
									<button
										type="button"
										className="step1-btn-remove"
										onClick={() => handleDeleteModule(module.id)}
									>
										🗑️
									</button>
								</div>
								
								{expandedModules[module.id] && (
									<div className="step1-module-content">
										<div className="step1-form-group">
											<label>Obiectiv modul</label>
											<textarea
												value={module.objective || ''}
												onChange={(e) => handleUpdateModule(module.id, { objective: e.target.value })}
												placeholder="Ce va învăța cursantul în acest modul?"
												rows={2}
												className="step1-textarea"
											/>
										</div>
										
										<div className="step1-form-row">
											<div className="step1-form-group">
												<label>Durată estimată (ore)</label>
												<input
													type="number"
													min="0"
													step="0.5"
													value={module.duration_estimate || ''}
													onChange={(e) => handleUpdateModule(module.id, { 
														duration_estimate: e.target.value ? parseFloat(e.target.value) : null 
													})}
													className="step1-input"
												/>
											</div>
											
										</div>
										
										{/* Lessons */}
										<div className="step1-lessons">
											<div className="step1-lessons-header">
												<label>Lecții</label>
												<button
													type="button"
													className="step1-btn-add"
													onClick={() => handleAddLesson(module.id)}
												>
													+ Adaugă lecție
												</button>
											</div>
											
											{module.lessons && module.lessons.length > 0 ? (
												<div className="step1-lessons-list">
													{module.lessons.map((lesson, lessonIndex) => (
														<div key={lesson.id} className="step1-lesson-item">
															<div className="step1-lesson-number">{lessonIndex + 1}</div>
															<div className="step1-lesson-content">
																<input
																	type="text"
																	value={lesson.title}
																	onChange={(e) => handleUpdateLesson(module.id, lesson.id, { title: e.target.value })}
																	placeholder="Titlu lecție"
																	className="step1-lesson-title-input"
																/>
																<div className="step1-lesson-meta">
																	<input
																		type="number"
																		min="0"
																		placeholder="Durată (min)"
																		value={lesson.duration_estimate || ''}
																		onChange={(e) => handleUpdateLesson(module.id, lesson.id, { 
																			duration_estimate: e.target.value ? parseInt(e.target.value) : null 
																		})}
																		className="step1-lesson-duration"
																	/>
																</div>
															</div>
															<button
																type="button"
																className="step1-btn-remove"
																onClick={() => handleDeleteLesson(module.id, lesson.id)}
															>
																🗑️
															</button>
														</div>
													))}
												</div>
											) : (
												<div className="step1-lessons-empty">
													Nu există lecții. Adaugă prima lecție.
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						))
					)}
				</div>
				
				{/* Add Module Button */}
				<button
					type="button"
					className="step1-btn-add-module"
					onClick={handleAddModule}
				>
					+ Adaugă modul
				</button>
			</div>
		</div>
	);
};

export default Step1Blueprint;
