import React, { useState, useEffect } from 'react';
import { openaiService } from '../../../services/openaiService';

/**
 * Course Quality Validation - Conform defacut.md secțiunea 8
 * AI checks:
 * - Lesson length
 * - Content gaps
 * - Difficulty spikes
 * - Engagement risk
 * Output:
 * - Readiness score
 * - Fix suggestions
 */
const CourseQualityValidation = ({ courseData, onValidationComplete }) => {
	const [validating, setValidating] = useState(false);
	const [validationResults, setValidationResults] = useState(null);
	const [readinessScore, setReadinessScore] = useState(null);

	// Run validation
	const handleValidate = async () => {
		if (!courseData || !courseData.modules || courseData.modules.length === 0) {
			alert('Cursul trebuie să aibă cel puțin un modul pentru validare');
			return;
		}

		setValidating(true);
		try {
			// Prepare course data for analysis
			const courseInfo = {
				title: courseData.title,
				description: courseData.description,
				level: courseData.level,
				modules: courseData.modules.map(module => ({
					title: module.title,
					objective: module.objective,
					lessons: (module.lessons || []).map(lesson => ({
						title: lesson.title,
						type: lesson.type || lesson.content_type,
						duration_minutes: lesson.duration_minutes,
						content_length: lesson.content ? lesson.content.replace(/<[^>]*>/g, '').length : 0
					}))
				}))
			};

			const prompt = `Validează calitatea acestui curs și calculează un readiness score.

Curs: ${courseInfo.title}
${courseInfo.description ? `Descriere: ${courseInfo.description}` : ''}
Nivel: ${courseInfo.level || 'nespecificat'}

Structură:
${JSON.stringify(courseInfo.modules, null, 2)}

Analizează:
1. **Lesson length**: Verifică dacă lecțiile sunt prea lungi (>10 min pentru mobile-ready)
2. **Content gaps**: Identifică goluri în conținut, lecții lipsă, module incomplete
3. **Difficulty spikes**: Detectează salturi bruște de dificultate între lecții/module
4. **Engagement risk**: Evaluează riscul de pierdere a atenției (lecții prea lungi, lipsă varietate, etc.)

Calculează un **Readiness Score** (0-100) bazat pe:
- Completitudinea conținutului (30%)
- Balanța dificultății (25%)
- Mobile-ready compliance (20%)
- Engagement potential (25%)

Răspunde în format JSON:
{
  "readiness_score": 75,
  "checks": {
    "lesson_length": {
      "status": "warning",
      "issues": [
        {
          "lesson": "Lecție 1",
          "duration": 15,
          "issue": "Lecție depășește 10 minute (mobile-ready)"
        }
      ],
      "passed": false
    },
    "content_gaps": {
      "status": "error",
      "issues": [
        {
          "type": "missing_lesson",
          "module": "Modul 1",
          "description": "Lipsește lecție de introducere"
        }
      ],
      "passed": false
    },
    "difficulty_spikes": {
      "status": "warning",
      "issues": [
        {
          "from": "Lecție 1",
          "to": "Lecție 2",
          "spike": "Salt de dificultate de la ușor la avansat"
        }
      ],
      "passed": true
    },
    "engagement_risk": {
      "status": "ok",
      "issues": [],
      "passed": true
    }
  },
  "fix_suggestions": [
    "Împarte lecția 1 în 2 lecții mai scurte",
    "Adaugă lecție de introducere în Modul 1",
    "Adaugă lecție intermediară între Lecție 1 și Lecție 2"
  ],
  "summary": "Cursul este aproape gata, dar necesită câteva ajustări pentru a fi optim..."
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
				
				setValidationResults(parsed);
				setReadinessScore(parsed.readiness_score);
				
				// Update course data with readiness score
				if (onValidationComplete) {
					onValidationComplete(parsed);
				}
			} catch (e) {
				console.error('Error parsing validation response:', e);
				alert('Eroare la parsarea răspunsului AI. Vezi consola pentru detalii.');
			}
		} catch (error) {
			console.error('Error validating course:', error);
			alert('Eroare la validarea cursului: ' + (error.message || 'Eroare necunoscută'));
		} finally {
			setValidating(false);
		}
	};

	// Get status color
	const getStatusColor = (status) => {
		switch (status) {
			case 'ok': return '#10b981';
			case 'warning': return '#f59e0b';
			case 'error': return '#ef4444';
			default: return '#6b7280';
		}
	};

	// Get status label
	const getStatusLabel = (status) => {
		switch (status) {
			case 'ok': return '✓ OK';
			case 'warning': return '⚠️ Warning';
			case 'error': return '❌ Error';
			default: return '?';
		}
	};

	return (
		<div className="course-quality-validation">
			<div className="validation-header">
				<h3>🔍 Validare Calitate Curs</h3>
				<button
					type="button"
					className="admin-btn admin-btn-primary"
					onClick={handleValidate}
					disabled={validating}
				>
					{validating ? '⏳ Validează...' : '🤖 Rulează Validare AI'}
				</button>
			</div>

			{/* Readiness Score */}
			{readinessScore !== null && (
				<div className="readiness-score-panel">
					<div className="readiness-score-header">
						<h4>Readiness Score</h4>
						<div className={`readiness-score-value ${readinessScore >= 80 ? 'excellent' : readinessScore >= 60 ? 'good' : 'needs-work'}`}>
							{readinessScore}/100
						</div>
					</div>
					<div className="readiness-score-bar">
						<div 
							className="readiness-score-fill"
							style={{ 
								width: `${readinessScore}%`,
								background: readinessScore >= 80 ? '#10b981' : readinessScore >= 60 ? '#f59e0b' : '#ef4444'
							}}
						/>
					</div>
					{readinessScore < 80 && (
						<p className="readiness-score-message">
							{readinessScore >= 60 
								? 'Cursul este aproape gata, dar necesită câteva îmbunătățiri.'
								: 'Cursul necesită lucru suplimentar înainte de publicare.'}
						</p>
					)}
				</div>
			)}

			{/* Validation Results */}
			{validationResults && (
				<div className="validation-results">
					{/* Lesson Length Check */}
					{validationResults.checks?.lesson_length && (
						<div className="validation-check">
							<div className="validation-check-header">
								<h5>📏 Lungime Lecții</h5>
								<span 
									className="validation-status"
									style={{ color: getStatusColor(validationResults.checks.lesson_length.status) }}
								>
									{getStatusLabel(validationResults.checks.lesson_length.status)}
								</span>
							</div>
							{validationResults.checks.lesson_length.issues?.length > 0 && (
								<ul className="validation-issues">
									{validationResults.checks.lesson_length.issues.map((issue, idx) => (
										<li key={idx}>
											<strong>{issue.lesson}:</strong> {issue.issue}
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					{/* Content Gaps Check */}
					{validationResults.checks?.content_gaps && (
						<div className="validation-check">
							<div className="validation-check-header">
								<h5>📚 Goluri în Conținut</h5>
								<span 
									className="validation-status"
									style={{ color: getStatusColor(validationResults.checks.content_gaps.status) }}
								>
									{getStatusLabel(validationResults.checks.content_gaps.status)}
								</span>
							</div>
							{validationResults.checks.content_gaps.issues?.length > 0 && (
								<ul className="validation-issues">
									{validationResults.checks.content_gaps.issues.map((issue, idx) => (
										<li key={idx}>
											<strong>{issue.module}:</strong> {issue.description}
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					{/* Difficulty Spikes Check */}
					{validationResults.checks?.difficulty_spikes && (
						<div className="validation-check">
							<div className="validation-check-header">
								<h5>📈 Salturi de Dificultate</h5>
								<span 
									className="validation-status"
									style={{ color: getStatusColor(validationResults.checks.difficulty_spikes.status) }}
								>
									{getStatusLabel(validationResults.checks.difficulty_spikes.status)}
								</span>
							</div>
							{validationResults.checks.difficulty_spikes.issues?.length > 0 && (
								<ul className="validation-issues">
									{validationResults.checks.difficulty_spikes.issues.map((issue, idx) => (
										<li key={idx}>
											<strong>{issue.from} → {issue.to}:</strong> {issue.spike}
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					{/* Engagement Risk Check */}
					{validationResults.checks?.engagement_risk && (
						<div className="validation-check">
							<div className="validation-check-header">
								<h5>🎯 Riscul de Pierdere a Atenției</h5>
								<span 
									className="validation-status"
									style={{ color: getStatusColor(validationResults.checks.engagement_risk.status) }}
								>
									{getStatusLabel(validationResults.checks.engagement_risk.status)}
								</span>
							</div>
							{validationResults.checks.engagement_risk.issues?.length > 0 && (
								<ul className="validation-issues">
									{validationResults.checks.engagement_risk.issues.map((issue, idx) => (
										<li key={idx}>{issue}</li>
									))}
								</ul>
							)}
						</div>
					)}

					{/* Fix Suggestions */}
					{validationResults.fix_suggestions && validationResults.fix_suggestions.length > 0 && (
						<div className="fix-suggestions-panel">
							<h5>💡 Sugestii de Îmbunătățire</h5>
							<ul className="fix-suggestions-list">
								{validationResults.fix_suggestions.map((suggestion, idx) => (
									<li key={idx}>{suggestion}</li>
								))}
							</ul>
						</div>
					)}

					{/* Summary */}
					{validationResults.summary && (
						<div className="validation-summary">
							<h5>📋 Rezumat</h5>
							<p>{validationResults.summary}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default CourseQualityValidation;
