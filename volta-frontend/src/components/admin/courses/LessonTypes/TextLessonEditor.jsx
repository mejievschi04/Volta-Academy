import React, { useState } from 'react';
import RichTextEditor from '../../../RichTextEditor';
import { openaiService } from '../../../../services/openaiService';

/**
 * Text Lesson Editor - Conform defacut.md secțiunea 5.2
 * Features:
 * - Notion-like editor
 * - AI rewrite / simplify / expand
 * - Reading time calculation
 * - Difficulty score (AI)
 */
const TextLessonEditor = ({ lesson, onUpdate }) => {
	const [aiProcessing, setAiProcessing] = useState(false);
	const [readingTime, setReadingTime] = useState(null);
	const [difficultyScore, setDifficultyScore] = useState(null);

	// Calculate reading time
	const calculateReadingTime = (content) => {
		if (!content) return null;
		const text = content.replace(/<[^>]*>/g, ''); // Strip HTML
		const words = text.split(/\s+/).filter(word => word.length > 0);
		const wordsPerMinute = 200; // Average reading speed
		const minutes = Math.ceil(words.length / wordsPerMinute);
		setReadingTime(minutes);
		return minutes;
	};

	// AI rewrite/simplify/expand
	const handleAITransform = async (action) => {
		if (!lesson.content || !lesson.content.trim()) {
			alert('Te rugăm să adaugi mai întâi conținut');
			return;
		}

		setAiProcessing(true);
		try {
			const actionPrompts = {
				rewrite: 'Reformulează și îmbunătățește textul, păstrând sensul original dar făcându-l mai clar și mai captivant.',
				simplify: 'Simplifică textul pentru a fi mai ușor de înțeles, fără a pierde informațiile esențiale.',
				expand: 'Extinde textul cu mai multe detalii, exemple și explicații pentru a fi mai complet.'
			};

			const prompt = `${actionPrompts[action]}

Text original:
${lesson.content.replace(/<[^>]*>/g, '').substring(0, 2000)}

Generează versiunea ${action === 'rewrite' ? 'reformulată' : action === 'simplify' ? 'simplificată' : 'extinsă'} a textului.`;

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

			// Extract text from response (remove markdown code blocks if present)
			let transformedText = fullResponse.replace(/```[\s\S]*?```/g, '').trim();
			
			// Update lesson content
			onUpdate({ content: transformedText });
			calculateReadingTime(transformedText);
		} catch (error) {
			console.error(`Error ${action} text:`, error);
			alert(`Eroare la ${action} text: ` + (error.message || 'Eroare necunoscută'));
		} finally {
			setAiProcessing(false);
		}
	};

	// Calculate difficulty score with AI
	const handleCalculateDifficulty = async () => {
		if (!lesson.content || !lesson.content.trim()) {
			alert('Te rugăm să adaugi mai întâi conținut');
			return;
		}

		setAiProcessing(true);
		try {
			const prompt = `Analizează dificultatea acestui text pentru lecție și oferă un scor de dificultate (1-10, unde 1 = foarte ușor, 10 = foarte dificil).

Text:
${lesson.content.replace(/<[^>]*>/g, '').substring(0, 2000)}

Răspunde în format JSON:
{
  "difficulty_score": 5,
  "reasoning": "Explicație scurtă de ce acest scor..."
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

			// Parse response
			try {
				const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
				                  fullResponse.match(/```\s*([\s\S]*?)\s*```/);
				const jsonStr = jsonMatch ? jsonMatch[1] : fullResponse;
				const parsed = JSON.parse(jsonStr);
				
				setDifficultyScore(parsed.difficulty_score);
				onUpdate({ 
					difficulty_score: parsed.difficulty_score,
					difficulty_reasoning: parsed.reasoning
				});
			} catch (e) {
				console.error('Error parsing difficulty response:', e);
				// Try to extract number from response
				const scoreMatch = fullResponse.match(/(\d+)/);
				if (scoreMatch) {
					const score = parseInt(scoreMatch[1]);
					if (score >= 1 && score <= 10) {
						setDifficultyScore(score);
						onUpdate({ difficulty_score: score });
					}
				}
			}
		} catch (error) {
			console.error('Error calculating difficulty:', error);
			alert('Eroare la calcularea dificultății: ' + (error.message || 'Eroare necunoscută'));
		} finally {
			setAiProcessing(false);
		}
	};

	// Handle content change
	const handleContentChange = (content) => {
		onUpdate({ content });
		calculateReadingTime(content);
	};

	return (
		<div className="text-lesson-editor">
			{/* AI Actions Toolbar */}
			<div className="admin-form-group">
				<div className="ai-actions-toolbar">
					<button
						type="button"
						className="admin-btn admin-btn-sm admin-btn-secondary"
						onClick={() => handleAITransform('rewrite')}
						disabled={aiProcessing || !lesson.content}
						title="Reformulează textul cu AI"
					>
						🤖 Reformulează
					</button>
					<button
						type="button"
						className="admin-btn admin-btn-sm admin-btn-secondary"
						onClick={() => handleAITransform('simplify')}
						disabled={aiProcessing || !lesson.content}
						title="Simplifică textul cu AI"
					>
						🤖 Simplifică
					</button>
					<button
						type="button"
						className="admin-btn admin-btn-sm admin-btn-secondary"
						onClick={() => handleAITransform('expand')}
						disabled={aiProcessing || !lesson.content}
						title="Extinde textul cu AI"
					>
						🤖 Extinde
					</button>
					<button
						type="button"
						className="admin-btn admin-btn-sm admin-btn-secondary"
						onClick={handleCalculateDifficulty}
						disabled={aiProcessing || !lesson.content}
						title="Calculează dificultatea cu AI"
					>
						📊 Dificultate
					</button>
				</div>
			</div>

			{/* Content Editor */}
			<div className="admin-form-group">
				<label className="admin-form-label">
					Conținut Text <span className="admin-form-required">*</span>
				</label>
				<RichTextEditor
					value={lesson.content || ''}
					onChange={handleContentChange}
					placeholder="Scrie conținutul lecției aici..."
					style={{ minHeight: '400px' }}
				/>
			</div>

			{/* Stats */}
			<div className="text-lesson-stats">
				{readingTime && (
					<div className="stat-item">
						<span className="stat-label">⏱️ Reading Time:</span>
						<span className="stat-value">{readingTime} min</span>
					</div>
				)}
				{difficultyScore && (
					<div className="stat-item">
						<span className="stat-label">📊 Difficulty Score:</span>
						<span className="stat-value">{difficultyScore}/10</span>
					</div>
				)}
			</div>

			{/* Mobile-ready validation */}
			{readingTime && readingTime > 10 && (
				<div className="admin-form-warning">
					⚠️ Reading time depășește 10 minute ({readingTime} min). Pentru mobile-ready, recomandăm lecții sub 10 minute.
				</div>
			)}
		</div>
	);
};

export default TextLessonEditor;
