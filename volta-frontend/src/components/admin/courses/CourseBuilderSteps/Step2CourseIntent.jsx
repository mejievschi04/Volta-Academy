import React, { useState, useEffect } from 'react';
import { openaiService } from '../../../../services/openaiService';
import { useToast } from '../../../../contexts/ToastContext';
import './Step2CourseIntent.css';

/**
 * PASUL 2: Course Intent (Foundation)
 * Conform defacut.md:
 * - Two-column layout: input fields stânga, AI Preview Card dreapta (live)
 * - AI analizează inputul în timp real
 * - Afișează preview: Suggested structure, Estimated duration, Learning outcome
 */
const Step2CourseIntent = ({ data, onUpdate, errors }) => {
	const { showToast } = useToast();
	const [aiPreview, setAiPreview] = useState(null);
	const [aiLoading, setAiLoading] = useState(false);
	const [debounceTimer, setDebounceTimer] = useState(null);

	// Debounced AI preview generation
	useEffect(() => {
		// Clear existing timer
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Only generate preview if we have title and at least one other field
		const hasEnoughData = data.title && data.title.trim().length > 3 && 
			(data.target_audience || data.level || data.learning_goal);

		if (!hasEnoughData) {
			setAiPreview(null);
			return;
		}

		// Set new timer
		const timer = setTimeout(() => {
			generateAIPreview();
		}, 1500); // 1.5s debounce

		setDebounceTimer(timer);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	}, [data.title, data.target_audience, data.level, data.learning_goal]);

	const generateAIPreview = async () => {
		setAiLoading(true);
		try {
			const prompt = `Analizează intent-ul acestui curs și generează un preview rapid:

Titlu: ${data.title || 'N/A'}
Audiență: ${data.target_audience || 'N/A'}
Nivel: ${data.level || 'N/A'}
Obiectiv învățare: ${data.learning_goal || 'N/A'}

Generează un preview JSON cu:
{
  "suggested_structure": {
    "modules_count": 3-5,
    "lessons_per_module": 3-6,
    "structure_summary": "Scurtă descriere structură"
  },
  "estimated_duration": "X ore",
  "learning_outcome": "Ce vor învăța studenții",
  "key_topics": ["Topic 1", "Topic 2", ...]
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

			// Try to parse JSON
			try {
				const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
				                  fullResponse.match(/```\s*([\s\S]*?)\s*```/);
				const jsonStr = jsonMatch ? jsonMatch[1] : fullResponse;
				const parsed = JSON.parse(jsonStr);
				setAiPreview(parsed);
			} catch (e) {
				// Fallback: create preview from text
				setAiPreview({
					suggested_structure: {
						structure_summary: fullResponse.substring(0, 200)
					},
					estimated_duration: 'To be determined',
					learning_outcome: 'Students will learn key concepts',
					key_topics: []
				});
			}
		} catch (error) {
			console.error('Error generating AI preview:', error);
			setAiPreview(null);
		} finally {
			setAiLoading(false);
		}
	};

	const handleGenerateStructure = async () => {
		if (!data.title || !data.title.trim()) {
			showToast('Te rugăm să introduci mai întâi titlul cursului', 'error');
			return;
		}

		setAiLoading(true);
		try {
			const prompt = `Generează structura completă pentru cursul "${data.title}".

${data.target_audience ? `Audiență: ${data.target_audience}` : ''}
${data.level ? `Nivel: ${data.level}` : ''}
${data.learning_goal ? `Obiectiv: ${data.learning_goal}` : ''}

Generează structură JSON cu module și lecții:
{
  "modules": [
    {
      "title": "Nume modul",
      "objective": "Obiectiv modul",
      "lessons": [
        {
          "title": "Nume lecție",
          "type": "video|text|assignment|quiz",
          "duration_minutes": 15
        }
      ]
    }
  ],
  "estimated_duration_hours": 10
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

			// Parse and apply structure
			try {
				const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
				                  fullResponse.match(/```\s*([\s\S]*?)\s*```/);
				const jsonStr = jsonMatch ? jsonMatch[1] : fullResponse;
				const parsed = JSON.parse(jsonStr);

				// Update course data with generated structure
				if (parsed.modules) {
					onUpdate({
						modules: parsed.modules.map((mod, idx) => ({
							title: mod.title,
							description: mod.objective || '',
							order: idx,
							lessons: (mod.lessons || []).map((lesson, lidx) => ({
								title: lesson.title,
								content_type: lesson.type || 'text',
								duration_minutes: lesson.duration_minutes || 10,
								order: lidx,
								is_preview: false
							}))
						})),
						estimated_duration_hours: parsed.estimated_duration_hours || null
					});

					showToast('Structura cursului a fost generată cu succes!', 'success');
				}
			} catch (e) {
				console.error('Error parsing AI structure:', e);
				showToast('Eroare la parsarea structurii generate. Vezi consola pentru detalii.', 'error');
			}
		} catch (error) {
			console.error('Error generating structure:', error);
			showToast('Eroare la generarea structurii: ' + (error.message || 'Eroare necunoscută'), 'error');
		} finally {
			setAiLoading(false);
		}
	};

	return (
		<div className="step2-course-intent">
			<div className="step2-course-intent-header">
				<h2>Intent Curs</h2>
				<p className="step2-course-intent-description">
					Completează informațiile de bază despre curs. AI-ul va genera un preview în timp real.
				</p>
			</div>

			<div className="step2-course-intent-layout">
				{/* Left Column: Input Fields */}
				<div className="step2-course-intent-inputs">
					<div className="admin-form-group">
						<label className="admin-form-label">
							Titlu Curs <span className="required">*</span>
						</label>
						<input
							type="text"
							className={`admin-form-input ${errors.title ? 'error' : ''}`}
							value={data.title || ''}
							onChange={(e) => onUpdate({ title: e.target.value })}
							placeholder="ex: React Fundamentals for Beginners"
							data-field="title"
						/>
						{errors.title && (
							<span className="admin-form-error">{errors.title}</span>
						)}
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">
							Pentru cine este acest curs?
						</label>
						<input
							type="text"
							className="admin-form-input"
							value={data.target_audience || ''}
							onChange={(e) => onUpdate({ target_audience: e.target.value })}
							placeholder="ex: Beginners with no programming experience"
						/>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">
							Nivel <span className="required">*</span>
						</label>
						<select
							className={`admin-form-select ${errors.level ? 'error' : ''}`}
							value={data.level || ''}
							onChange={(e) => onUpdate({ level: e.target.value })}
							data-field="level"
						>
							<option value="">Selectează nivelul</option>
							<option value="beginner">Începător</option>
							<option value="intermediate">Intermediar</option>
							<option value="advanced">Avansat</option>
						</select>
						{errors.level && (
							<span className="admin-form-error">{errors.level}</span>
						)}
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">
							Obiectiv de Învățare (1-2 propoziții)
						</label>
						<textarea
							className="admin-form-textarea"
							value={data.learning_goal || ''}
							onChange={(e) => onUpdate({ learning_goal: e.target.value })}
							placeholder="Ce vor învăța studenții până la finalul acestui curs?"
							rows={4}
						/>
					</div>

					<div className="step2-course-intent-actions">
						<button
							type="button"
							className="admin-btn admin-btn-primary"
							onClick={handleGenerateStructure}
							disabled={aiLoading || !data.title}
						>
							{aiLoading ? '⏳ Se generează...' : '🤖 Generează Structura Cursului'}
						</button>
					</div>
				</div>

				{/* Right Column: AI Preview Card (Live) */}
				<div className="step2-course-intent-preview">
					<div className="ai-preview-card">
						<div className="ai-preview-card-header">
							<span className="ai-preview-card-icon">✨</span>
							<h3>Preview AI</h3>
							{aiLoading && (
								<span className="ai-preview-card-loading">⏳ Se analizează...</span>
							)}
						</div>

						{aiPreview ? (
							<div className="ai-preview-card-content">
								{/* Suggested Structure */}
								<div className="ai-preview-section">
									<h4>Structură Sugerată</h4>
									<p>{aiPreview.suggested_structure?.structure_summary || 'Structura va fi generată'}</p>
									{aiPreview.suggested_structure?.modules_count && (
										<div className="ai-preview-stats">
											<span>{aiPreview.suggested_structure.modules_count} module</span>
											<span>•</span>
											<span>{aiPreview.suggested_structure.lessons_per_module} lecții/modul</span>
										</div>
									)}
								</div>

								{/* Estimated Duration */}
								<div className="ai-preview-section">
									<h4>Durată Estimată</h4>
									<p className="ai-preview-duration">{aiPreview.estimated_duration || 'De determinat'}</p>
								</div>

								{/* Learning Outcome */}
								<div className="ai-preview-section">
									<h4>Rezultat Învățare</h4>
									<p>{aiPreview.learning_outcome || 'Studenții vor învăța concepte cheie'}</p>
								</div>

								{/* Key Topics */}
								{aiPreview.key_topics && aiPreview.key_topics.length > 0 && (
									<div className="ai-preview-section">
										<h4>Subiecte Cheie</h4>
										<div className="ai-preview-topics">
											{aiPreview.key_topics.map((topic, idx) => (
												<span key={idx} className="ai-preview-topic-tag">{topic}</span>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="ai-preview-card-empty">
								<p>Completează câmpurile pentru a vedea preview-ul AI</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Step2CourseIntent;
