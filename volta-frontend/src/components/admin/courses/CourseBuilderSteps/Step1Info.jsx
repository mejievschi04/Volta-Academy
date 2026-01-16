import React, { useState } from 'react';
import { useToast } from '../../../../contexts/ToastContext';
import { logger } from '../../../../utils/logger';
import { openaiService } from '../../../../services/openaiService';

const CourseBuilderStep1 = ({ data, onUpdate, errors, blueprint, creatorType }) => {
	const { warning: showWarning, error: showError, success: showSuccess } = useToast();
	const [aiGenerating, setAiGenerating] = useState(false);
	const [aiSuggestion, setAiSuggestion] = useState(null);
	const [showAiSuggestion, setShowAiSuggestion] = useState(false);

	// Generate AI course outline based on intent
	const handleGenerateAIOutline = async () => {
		if (!data.title || !data.title.trim()) {
			showWarning('Te rugăm să introduci mai întâi titlul cursului');
			return;
		}

		setAiGenerating(true);
		setAiSuggestion(null);
		setShowAiSuggestion(false);

		try {
			const prompt = `Generează un outline complet pentru cursul "${data.title}". 
${data.short_description ? `Descriere: ${data.short_description}` : ''}
${data.level ? `Nivel: ${data.level}` : ''}
${data.estimated_duration_hours ? `Durată estimată: ${data.estimated_duration_hours} ore` : ''}

Generează:
1. Course outline (structură module + lecții)
2. Estimated duration (în ore)
3. Learning path (pași de învățare)

Răspunde în format JSON:
{
  "outline": {
    "modules": [
      {
        "title": "Nume modul",
        "objective": "Obiectiv modul",
        "lessons": [
          {
            "title": "Nume lecție",
            "type": "video|text|assignment",
            "duration_minutes": 15
          }
        ]
      }
    ]
  },
  "estimated_duration_hours": 10,
  "learning_path": ["Pas 1", "Pas 2", ...]
}`;

			let fullResponse = '';
			await openaiService.streamCourseGeneration(
				prompt,
				[],
				null,
				(chunk) => {
					if (chunk) {
						fullResponse += chunk;
					}
				},
				() => {}
			);

			// Try to parse JSON from response
			try {
				// Extract JSON from markdown code blocks if present
				const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
				                  fullResponse.match(/```\s*([\s\S]*?)\s*```/);
				const jsonStr = jsonMatch ? jsonMatch[1] : fullResponse;
				const parsed = JSON.parse(jsonStr);
				setAiSuggestion(parsed);
				setShowAiSuggestion(true);
			} catch (e) {
				// If JSON parsing fails, show raw response
				setAiSuggestion({
					raw: fullResponse,
					error: 'Nu s-a putut parsa răspunsul AI. Vezi răspunsul complet mai jos.'
				});
				setShowAiSuggestion(true);
			}
		} catch (error) {
			logger.error('Error generating AI outline:', error);
			showError('Eroare la generarea outline-ului AI: ' + (error.message || 'Eroare necunoscută'));
		} finally {
			setAiGenerating(false);
		}
	};

	const handleAcceptAIOutline = () => {
		if (aiSuggestion?.outline) {
			// Update course data with AI suggestions
			if (aiSuggestion.estimated_duration_hours) {
				onUpdate({ estimated_duration_hours: aiSuggestion.estimated_duration_hours });
			}
			// Store AI outline for use in Step 2
			onUpdate({ 
				ai_generated_outline: aiSuggestion.outline,
				ai_learning_path: aiSuggestion.learning_path 
			});
			setShowAiSuggestion(false);
			showSuccess('Outline-ul AI a fost acceptat! Vei putea să-l folosești în pasul următor.');
		}
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Bazele Cursului</h2>
			<p className="admin-course-builder-step-description">
				Completează informațiile de bază despre curs. AI-ul poate genera un outline complet după ce introduci titlul și descrierea.
			</p>

			<div className="admin-course-builder-form">
				{/* Title */}
				<div className="admin-form-group">
					<label className="admin-form-label">
						Titlu Curs <span className="admin-form-required">*</span>
					</label>
					<input
						type="text"
						className={`admin-form-input ${errors.title ? 'error' : ''}`}
						value={data.title || ''}
						onChange={(e) => onUpdate({ title: e.target.value })}
						placeholder="Ex: Introducere în React"
						data-field="title"
					/>
					{errors.title && <span className="admin-form-error">{errors.title}</span>}
				</div>

				{/* Short Description */}
				<div className="admin-form-group">
					<label className="admin-form-label">
						Descriere Scurtă <span className="admin-form-required">*</span>
					</label>
					<textarea
						className={`admin-form-textarea ${errors.short_description ? 'error' : ''}`}
						value={data.short_description || ''}
						onChange={(e) => onUpdate({ short_description: e.target.value })}
						placeholder="O scurtă descriere a cursului (max 200 caractere)..."
						rows={3}
						maxLength={200}
						data-field="short_description"
					/>
					<div className="admin-form-hint">
						{data.short_description?.length || 0} / 200 caractere
					</div>
					{errors.short_description && <span className="admin-form-error">{errors.short_description}</span>}
				</div>

				{/* Full Description */}
				<div className="admin-form-group">
					<label className="admin-form-label">Descriere Completă</label>
					<textarea
						className={`admin-form-textarea ${errors.description ? 'error' : ''}`}
						value={data.description || ''}
						onChange={(e) => onUpdate({ description: e.target.value })}
						placeholder="Descrierea detaliată a cursului..."
						rows={6}
						data-field="description"
					/>
					{errors.description && <span className="admin-form-error">{errors.description}</span>}
				</div>

				{/* Level */}
				<div className="admin-form-group">
					<label className="admin-form-label">Nivel</label>
					<select
						className="admin-form-select"
						value={data.level || ''}
						onChange={(e) => onUpdate({ level: e.target.value || null })}
					>
						<option value="">Selectează nivel</option>
						<option value="beginner">Începător</option>
						<option value="intermediate">Intermediar</option>
						<option value="advanced">Avansat</option>
					</select>
				</div>

				{/* Language and Duration Row */}
				<div className="admin-form-row">
					<div className="admin-form-group">
						<label className="admin-form-label">Limbă</label>
						<select
							className="admin-form-select"
							value={data.language || 'ro'}
							onChange={(e) => onUpdate({ language: e.target.value })}
						>
							<option value="ro">Română</option>
							<option value="en">English</option>
							<option value="ru">Русский</option>
						</select>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Durată Estimată (ore)</label>
						<input
							type="number"
							className="admin-form-input"
							value={data.estimated_duration_hours || ''}
							onChange={(e) => onUpdate({ estimated_duration_hours: parseInt(e.target.value) || null })}
							placeholder="Ex: 10"
							min="1"
						/>
					</div>
				</div>

				{/* Status */}
				<div className="admin-form-group">
					<label className="admin-form-label">Status</label>
					<select
						className="admin-form-select"
						value={data.status || 'draft'}
						onChange={(e) => onUpdate({ status: e.target.value })}
					>
						<option value="draft">Draft (implicit)</option>
						<option value="published">Publicat</option>
						<option value="archived">Arhivat</option>
					</select>
					<p className="admin-form-hint">
						Cursul va fi salvat ca draft până când îl publici în pasul final
					</p>
				</div>

				{/* Image Upload */}
				<div className="admin-form-group">
					<label className="admin-form-label">Imagine Curs</label>
					<div className="admin-image-upload-container">
						{data.image_url ? (
							<div className="admin-image-preview">
								<img src={data.image_url} alt="Course preview" />
								<button
									type="button"
									className="admin-image-remove"
									onClick={() => onUpdate({ image: null, image_url: null })}
								>
									×
								</button>
							</div>
						) : (
							<label className="admin-image-upload-label">
								<input
									type="file"
									accept="image/jpeg,image/png,image/jpg,image/gif,image/webp"
									onChange={(e) => {
										const file = e.target.files[0];
										if (file) {
											const reader = new FileReader();
											reader.onload = (event) => {
												onUpdate({ 
													image: file,
													image_url: event.target.result 
												});
											};
											reader.readAsDataURL(file);
										}
									}}
									className="admin-image-upload-input"
								/>
								<div className="admin-image-upload-placeholder">
									<span className="admin-image-upload-icon">📷</span>
									<span className="admin-image-upload-text">Click pentru a încărca imagine</span>
									<span className="admin-image-upload-hint">JPEG, PNG, GIF, WebP (max 2MB)</span>
								</div>
							</label>
						)}
					</div>
				</div>

				{/* AI Course Intent Generation */}
				<div className="admin-form-group">
					<label className="admin-form-label">
						🤖 Generare AI Outline
					</label>
					<div className="ai-outline-generator">
						<button
							type="button"
							className="admin-btn admin-btn-secondary"
							onClick={handleGenerateAIOutline}
							disabled={aiGenerating || !data.title?.trim()}
						>
							{aiGenerating ? '⏳ Generează...' : '✨ Generează Outline cu AI'}
						</button>
						<p className="admin-form-hint">
							AI-ul va genera un outline complet (module, lecții, durată estimată) pe baza informațiilor introduse
						</p>
					</div>

					{/* AI Suggestion Display */}
					{showAiSuggestion && aiSuggestion && (
						<div className="ai-suggestion-panel">
							<div className="ai-suggestion-header">
								<h4>✨ Sugestie AI</h4>
								<button
									type="button"
									className="ai-suggestion-close"
									onClick={() => setShowAiSuggestion(false)}
								>
									×
								</button>
							</div>
							<div className="ai-suggestion-content">
								{aiSuggestion.error ? (
									<div className="ai-suggestion-error">
										<p>{aiSuggestion.error}</p>
										<pre>{aiSuggestion.raw}</pre>
									</div>
								) : (
									<>
										{aiSuggestion.estimated_duration_hours && (
											<div className="ai-suggestion-item">
												<strong>Durată estimată:</strong> {aiSuggestion.estimated_duration_hours} ore
											</div>
										)}
										{aiSuggestion.learning_path && (
											<div className="ai-suggestion-item">
												<strong>Learning Path:</strong>
												<ul>
													{aiSuggestion.learning_path.map((step, idx) => (
														<li key={idx}>{step}</li>
													))}
												</ul>
											</div>
										)}
										{aiSuggestion.outline && (
											<div className="ai-suggestion-item">
												<strong>Outline:</strong>
												<div className="ai-outline-preview">
													{aiSuggestion.outline.modules?.map((module, mIdx) => (
														<div key={mIdx} className="ai-outline-module">
															<h5>{module.title}</h5>
															{module.objective && <p className="ai-outline-objective">{module.objective}</p>}
															{module.lessons && (
																<ul className="ai-outline-lessons">
																	{module.lessons.map((lesson, lIdx) => (
																		<li key={lIdx}>
																			{lesson.title} ({lesson.type}, {lesson.duration_minutes} min)
																		</li>
																	))}
																</ul>
															)}
														</div>
													))}
												</div>
											</div>
										)}
										<div className="ai-suggestion-actions">
											<button
												type="button"
												className="admin-btn admin-btn-primary"
												onClick={handleAcceptAIOutline}
											>
												✓ Acceptă Outline
											</button>
											<button
												type="button"
												className="admin-btn admin-btn-secondary"
												onClick={() => {
													setShowAiSuggestion(false);
													setAiSuggestion(null);
												}}
											>
												Editează manual
											</button>
											<button
												type="button"
												className="admin-btn admin-btn-secondary"
												onClick={handleGenerateAIOutline}
												disabled={aiGenerating}
											>
												🔄 Regenerare
											</button>
										</div>
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default CourseBuilderStep1;

