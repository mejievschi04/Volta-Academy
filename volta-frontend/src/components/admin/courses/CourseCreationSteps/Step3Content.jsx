import React from 'react';
import './Step3Content.css';

/**
 * PAS 3: Adăugare Conținut (Content Assembly)
 * Conform TODO.md
 * - Conținut decuplat de lecție (reutilizabil)
 * - Tipuri: Video, Text, Audio, Fișiere, Linkuri, Live sessions
 * - Mai multe conținuturi per lecție
 * - Ordine configurabilă
 * - AI opțional: Draft text, rescriere, rezumat video
 */
const Step3Content = ({ data, onUpdate }) => {
	const modules = data.structure?.modules || [];
	
	const contentTypes = [
		{ id: 'video', label: 'Video', icon: '🎥' },
		{ id: 'text', label: 'Text', icon: '📄' },
		{ id: 'audio', label: 'Audio', icon: '🎵' },
		{ id: 'file', label: 'Fișier', icon: '📎' },
		{ id: 'link', label: 'Link extern', icon: '🔗' },
		{ id: 'live', label: 'Live Session', icon: '🔴' },
	];
	
	const handleAddContent = (lessonId, contentType) => {
		const contentBlocks = data.content_blocks || {};
		const lessonContents = contentBlocks[lessonId] || [];
		
		const newContent = {
			id: Date.now(),
			type: contentType,
			source: '',
			metadata: {},
			order: lessonContents.length,
			visible: true,
		};
		
		onUpdate({
			content_blocks: {
				...contentBlocks,
				[lessonId]: [...lessonContents, newContent]
			}
		});
	};
	
	const handleUpdateContent = (lessonId, contentId, updates) => {
		const contentBlocks = { ...data.content_blocks };
		const lessonContents = [...(contentBlocks[lessonId] || [])];
		const index = lessonContents.findIndex(c => c.id === contentId);
		
		if (index !== -1) {
			lessonContents[index] = { ...lessonContents[index], ...updates };
			contentBlocks[lessonId] = lessonContents;
			onUpdate({ content_blocks: contentBlocks });
		}
	};
	
	const handleDeleteContent = (lessonId, contentId) => {
		const contentBlocks = { ...data.content_blocks };
		const lessonContents = (contentBlocks[lessonId] || []).filter(c => c.id !== contentId);
		contentBlocks[lessonId] = lessonContents;
		onUpdate({ content_blocks: contentBlocks });
	};
	
	return (
		<div className="step3-content">
			<div className="step3-header">
				<h3>Adăugare Conținut</h3>
				<p className="step3-description">
					Adaugă conținut pentru fiecare lecție. Conținutul este reutilizabil și poate fi ordonat.
				</p>
			</div>
			
			<div className="step3-content-area">
				{modules.length === 0 ? (
					<div className="step3-empty">
						<div className="step3-empty-icon">📚</div>
						<p>Nu există lecții definite.</p>
						<p className="step3-empty-hint">Revino la pașii anteriori pentru a adăuga lecții.</p>
					</div>
				) : (
					<div className="step3-lessons">
						{modules.map((module) => (
							<div key={module.id} className="step3-module-section">
								<h4 className="step3-module-title">{module.title}</h4>
								
								{module.lessons && module.lessons.length > 0 && (
									<div className="step3-lessons-list">
										{module.lessons.map((lesson) => {
											const contents = data.content_blocks?.[lesson.id] || [];
											
											return (
												<div key={lesson.id} className="step3-lesson-card">
													<div className="step3-lesson-header">
														<h5 className="step3-lesson-title">{lesson.title}</h5>
														<div className="step3-content-count">
															{contents.length} conținut{contents.length !== 1 ? 'uri' : ''}
														</div>
													</div>
													
													<div className="step3-add-content">
														<span className="step3-add-content-label">Adaugă:</span>
														<div className="step3-content-type-buttons">
															{contentTypes.map(type => (
																<button
																	key={type.id}
																	type="button"
																	className="step3-content-type-btn"
																	onClick={() => handleAddContent(lesson.id, type.id)}
																	title={type.label}
																>
																	<span>{type.icon}</span>
																	<span>{type.label}</span>
																</button>
															))}
														</div>
													</div>
													
													{contents.length > 0 && (
														<div className="step3-contents-list">
															{contents.map((content, index) => (
																<div key={content.id} className="step3-content-item">
																	<div className="step3-content-item-header">
																		<div className="step3-content-item-number">{index + 1}</div>
																		<div className="step3-content-item-type">
																			{contentTypes.find(t => t.id === content.type)?.icon}
																			{contentTypes.find(t => t.id === content.type)?.label}
																		</div>
																		<button
																			type="button"
																			className="step3-btn-remove"
																			onClick={() => handleDeleteContent(lesson.id, content.id)}
																		>
																			🗑️
																		</button>
																	</div>
																	
																	<div className="step3-content-item-form">
																		{content.type === 'video' && (
																			<div className="step3-form-group">
																				<label>URL Video sau Upload</label>
																				<input
																					type="text"
																					placeholder="https://..."
																					value={content.source || ''}
																					onChange={(e) => handleUpdateContent(lesson.id, content.id, { source: e.target.value })}
																					className="step3-input"
																				/>
																			</div>
																		)}
																		
																		{content.type === 'text' && (
																			<div className="step3-form-group">
																				<label>Conținut text</label>
																				<textarea
																					placeholder="Scrie conținutul aici..."
																					value={content.source || ''}
																					onChange={(e) => handleUpdateContent(lesson.id, content.id, { source: e.target.value })}
																					rows={4}
																					className="step3-textarea"
																				/>
																			</div>
																		)}
																		
																		{content.type === 'file' && (
																			<div className="step3-form-group">
																				<label>Încarcă fișier</label>
																				<input
																					type="file"
																					onChange={(e) => {
																						if (e.target.files[0]) {
																							handleUpdateContent(lesson.id, content.id, { 
																								source: e.target.files[0].name,
																								file: e.target.files[0]
																							});
																						}
																					}}
																					className="step3-file-input"
																				/>
																			</div>
																		)}
																		
																		{content.type === 'link' && (
																			<div className="step3-form-group">
																				<label>URL</label>
																				<input
																					type="url"
																					placeholder="https://..."
																					value={content.source || ''}
																					onChange={(e) => handleUpdateContent(lesson.id, content.id, { source: e.target.value })}
																					className="step3-input"
																				/>
																			</div>
																		)}
																		
																		<div className="step3-form-group">
																			<label>
																				<input
																					type="checkbox"
																					checked={content.visible !== false}
																					onChange={(e) => handleUpdateContent(lesson.id, content.id, { visible: e.target.checked })}
																				/>
																				<span>Vizibil pentru cursanți</span>
																			</label>
																		</div>
																	</div>
																</div>
															))}
														</div>
													)}
												</div>
											);
										})}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default Step3Content;
