import React, { useState, useRef, useEffect } from 'react';
import { openaiService } from '../../services/openaiService';
import { useAuth } from '../../contexts/AuthContext';
import './AITutor.css';

/**
 * AI Tutor - Conform defacut.md secțiunea 7
 * Per course, per user
 * Capabilities:
 * - Context aware (knows current lesson, course content)
 * - Progress aware (knows user progress)
 * - Mistake aware (knows user mistakes from assessments)
 * 
 * Creator Controls (from course settings):
 * - Tone (friendly, professional, encouraging, casual)
 * - Depth (basic, medium, advanced)
 * - Allowed topics
 * - Restricted topics
 */
const AITutor = ({ course, lesson, progress, assessmentMistakes = [], tutorSettings = {} }) => {
	const { user } = useAuth();
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [isTyping, setIsTyping] = useState(false);
	const [isMinimized, setIsMinimized] = useState(true);
	const messagesEndRef = useRef(null);
	const chatContainerRef = useRef(null);

	// Initialize with welcome message
	useEffect(() => {
		if (messages.length === 0) {
			if (course) {
				// Course-specific tutor
				setMessages([{
					role: 'assistant',
					content: `Bună! Sunt AI Tutor-ul tău pentru cursul "${course.title}". 

${lesson ? `Acum studiezi: **${lesson.title}**` : ''}
${progress ? `Progres curs: ${Math.round(progress.completion_percentage || 0)}%` : ''}

Cum te pot ajuta astăzi? Poți să mă întrebi despre:
- Concepte din lecția curentă
- Explicații suplimentare
- Sugestii pentru următoarea lecție
- Rezolvarea exercițiilor
${assessmentMistakes.length > 0 ? '- Corectarea greșelilor din teste' : ''}`
				}]);
			} else {
				// General tutor (no course context)
				setMessages([{
					role: 'assistant',
					content: `Bună! Sunt AI Tutor-ul tău. 

Sunt aici să te ajut cu:
- Întrebări generale despre învățare
- Ghidare în utilizarea platformei
- Explicații despre cursuri
- Sugestii pentru progresul tău academic

Cum te pot ajuta astăzi?`
				}]);
			}
		}
	}, [course, lesson, progress]);

	// Scroll to bottom when messages change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	// Build AI context
	const buildAIContext = () => {
		const context = {
			course: course ? {
				title: course.title,
				description: course.description,
				level: course.level
			} : null,
			lesson: lesson ? {
				title: lesson.title,
				content: lesson.content?.substring(0, 1000), // First 1000 chars
				type: lesson.type || lesson.content_type,
				duration: lesson.duration_minutes
			} : null,
			progress: progress ? {
				completion_percentage: progress.completion_percentage,
				completed_lessons: progress.modules?.flatMap(m => m.lessons || []).filter(l => l.completed).length,
				total_lessons: progress.modules?.flatMap(m => m.lessons || []).length
			} : null,
			mistakes: assessmentMistakes.map(m => ({
				question: m.question,
				user_answer: m.user_answer,
				correct_answer: m.correct_answer,
				explanation: m.explanation
			}))
		};

		return context;
	};

	// Handle send message
	const handleSend = async (e) => {
		e.preventDefault();
		if (!input.trim() || isTyping) return;

		const userMessage = { role: 'user', content: input.trim() };
		setMessages(prev => [...prev, userMessage]);
		setInput('');
		setIsTyping(true);

		try {
			// Build context-aware prompt with creator controls
			const context = buildAIContext();
			
			// Get tone description
			const toneDescriptions = {
				friendly: 'prietenos, relaxat și accesibil',
				professional: 'formal, profesional și respectuos',
				encouraging: 'motivațional, suportiv și încurajator',
				casual: 'lejer, conversațional și natural'
			};
			
			// Get depth description
			const depthDescriptions = {
				basic: 'explicații simple, directe, fără detalii tehnice complexe',
				medium: 'explicații detaliate cu exemple practice și context',
				advanced: 'explicații profunde, tehnice, cu context extins și conexiuni'
			};
			
			const tone = tutorSettings.tone || 'friendly';
			const depth = tutorSettings.depth || 'medium';
			const allowedTopics = tutorSettings.allowed_topics || [];
			const restrictedTopics = tutorSettings.restricted_topics || [];
			
			let contextPrompt = '';
			
			if (context.course) {
				// Course-specific prompt
				contextPrompt = `Ești un AI Tutor pentru un curs online. 

Context:
- Curs: ${context.course.title}
${context.lesson ? `- Lecție curentă: ${context.lesson.title}` : ''}
${context.progress ? `- Progres: ${context.progress.completion_percentage}% completat` : ''}
${context.mistakes.length > 0 ? `- Greșeli recente: ${JSON.stringify(context.mistakes)}` : ''}

${context.lesson?.content ? `Conținut lecție: ${context.lesson.content.substring(0, 500)}` : ''}

Setări Creator:
- Tone: ${toneDescriptions[tone]}
- Depth: ${depthDescriptions[depth]}
${allowedTopics.length > 0 ? `- Teme permise: ${allowedTopics.join(', ')} (răspunde DOAR despre aceste teme)` : ''}
${restrictedTopics.length > 0 ? `- Teme restricționate: ${restrictedTopics.join(', ')} (NU răspunde despre aceste teme)` : ''}

Răspunde ca un tutor ${toneDescriptions[tone]}. Fii:
- Context aware (folosește informațiile despre lecție și progres)
- Progress aware (adaptează răspunsurile la nivelul studentului)
- Mistake aware (ajută la corectarea greșelilor dacă există)
- Depth: ${depthDescriptions[depth]}

${allowedTopics.length > 0 ? `IMPORTANT: Răspunde DOAR despre temele permise: ${allowedTopics.join(', ')}.` : ''}
${restrictedTopics.length > 0 ? `IMPORTANT: NU răspunde despre temele restricționate: ${restrictedTopics.join(', ')}.` : ''}
${context.mistakes.length > 0 ? 'Studentul a făcut greșeli recente. Ajută-l să le înțeleagă și să le corecteze.' : ''}

Întrebare student: ${userMessage.content}

Răspunde concis, clar și util, respectând tone-ul și depth-ul configurate.`;
			} else {
				// General tutor prompt (no course context)
				contextPrompt = `Ești un AI Tutor general pentru o platformă de învățare online.

Rolul tău:
- Ajută utilizatorii cu întrebări generale despre învățare
- Ghidează utilizatorii în utilizarea platformei
- Răspunde la întrebări despre cursuri, progres, și funcționalități
- Oferă sugestii pentru îmbunătățirea progresului academic

Tone: ${toneDescriptions[tone]} (prietenos, suportiv, și util)

Întrebare utilizator: ${userMessage.content}

Răspunde concis, clar și util. Dacă întrebarea este despre un curs specific sau o funcționalitate specifică a platformei, oferă informații relevante sau ghidează utilizatorul către locul potrivit.`;
			}

			let assistantResponse = '';
			const assistantMessage = { role: 'assistant', content: '' };
			setMessages(prev => [...prev, assistantMessage]);

			await openaiService.streamCourseGeneration(
				contextPrompt,
				messages.map(m => ({ role: m.role, content: m.content })),
				null,
				(chunk) => {
					if (chunk) {
						assistantResponse += chunk;
						setMessages(prev => {
							const newMessages = [...prev];
							newMessages[newMessages.length - 1] = {
								...newMessages[newMessages.length - 1],
								content: assistantResponse,
							};
							return newMessages;
						});
					}
				},
				() => {}
			);
		} catch (error) {
			console.error('Error getting AI Tutor response:', error);
			setMessages(prev => [...prev, {
				role: 'assistant',
				content: 'Scuze, am întâmpinat o eroare. Te rugăm să încerci din nou.'
			}]);
		} finally {
			setIsTyping(false);
		}
	};

	// Quick action buttons
	const quickActions = course ? [
		{ label: '📚 Explică conceptul', prompt: 'Explică-mi conceptul principal din această lecție' },
		{ label: '💡 Exemple practice', prompt: 'Dă-mi exemple practice pentru conceptele din lecție' },
		{ label: '❓ Am o întrebare', prompt: 'Am o întrebare despre conținutul lecției' },
		{ label: '➡️ Următoarea lecție', prompt: 'Ce ar trebui să învăț în următoarea lecție?' }
	] : [
		{ label: '📚 Despre cursuri', prompt: 'Ce cursuri pot găsi pe platformă?' },
		{ label: '💡 Cum funcționează', prompt: 'Cum funcționează platforma?' },
		{ label: '❓ Am o întrebare', prompt: 'Am o întrebare generală' },
		{ label: '🎯 Progresul meu', prompt: 'Cum pot urmări progresul meu?' }
	];

	const handleQuickAction = (prompt) => {
		setInput(prompt);
		// Auto-send after a brief delay
		setTimeout(() => {
			const fakeEvent = { preventDefault: () => {}, target: { value: prompt } };
			setInput(prompt);
			handleSend(fakeEvent);
		}, 100);
	};

	return (
		<div className={`ai-tutor-container ${isMinimized ? 'minimized' : 'expanded'}`}>
			{/* Floating Button - When Minimized */}
			{isMinimized && (
				<button
					className="ai-tutor-floating-button"
					onClick={() => setIsMinimized(false)}
					title="Deschide AI Tutor"
					aria-label="Deschide AI Tutor"
				>
					<span className="ai-tutor-icon">AI</span>
					{isTyping && <span className="ai-tutor-typing-indicator-badge">⏳</span>}
				</button>
			)}

			{/* Expanded Chat - When Not Minimized */}
			{!isMinimized && (
				<>
					{/* Header */}
					<div className="ai-tutor-header">
						<div className="ai-tutor-header-left">
							<span className="ai-tutor-icon">AI</span>
							<span className="ai-tutor-title">Tutor</span>
							{isTyping && <span className="ai-tutor-typing-indicator">⏳</span>}
						</div>
						<button
							className="ai-tutor-toggle"
							onClick={() => setIsMinimized(true)}
							title="Minimizează"
							aria-label="Minimizează"
						>
							×
						</button>
					</div>

					{/* Chat Content */}
					<div className="ai-tutor-chat" ref={chatContainerRef}>
						{messages.map((message, idx) => (
							<div key={idx} className={`ai-tutor-message ai-tutor-message-${message.role}`}>
								<div className="ai-tutor-message-content">
									{message.content.split('\n').map((line, lineIdx) => (
										<React.Fragment key={lineIdx}>
											{line}
											{lineIdx < message.content.split('\n').length - 1 && <br />}
										</React.Fragment>
									))}
								</div>
							</div>
						))}
						{isTyping && (
							<div className="ai-tutor-message ai-tutor-message-assistant">
								<div className="ai-tutor-typing-dots">
									<span></span>
									<span></span>
									<span></span>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Quick Actions */}
					{messages.length <= 1 && (
						<div className="ai-tutor-quick-actions">
							{quickActions.map((action, idx) => (
								<button
									key={idx}
									className="ai-tutor-quick-action"
									onClick={() => handleQuickAction(action.prompt)}
								>
									{action.label}
								</button>
							))}
						</div>
					)}

					{/* Input */}
					<form className="ai-tutor-input-form" onSubmit={handleSend}>
						<input
							type="text"
							className="ai-tutor-input"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Întreabă AI Tutor..."
							disabled={isTyping}
						/>
						<button
							type="submit"
							className="ai-tutor-send-button"
							disabled={!input.trim() || isTyping}
						>
							➤
						</button>
					</form>
				</>
			)}
		</div>
	);
};

export default AITutor;
