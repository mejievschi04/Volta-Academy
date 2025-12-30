import React, { useState, useRef, useEffect } from 'react';
import { openaiService } from '../../../services/openaiService';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import './AIChat.css';

const AICourseChat = ({ onCourseGenerated, onClose }) => {
	const { showToast } = useToast();
	const [messages, setMessages] = useState([
		{
			role: 'assistant',
			content: 'Bună! Sunt asistentul tău AI pentru crearea cursurilor. Spune-mi ce fel de curs vrei să creezi. De exemplu: "Creează un curs despre React pentru începători" sau "Vreau un curs de Laravel avansat".',
		},
	]);
	const [input, setInput] = useState('');
	const [isGenerating, setIsGenerating] = useState(false);
	const [generatedCourse, setGeneratedCourse] = useState(null);
	const [currentCourseId, setCurrentCourseId] = useState(null); // Track current course ID
	const messagesEndRef = useRef(null);
	const chatContainerRef = useRef(null);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	const handleSend = async (e) => {
		e.preventDefault();
		if (!input.trim() || isGenerating) return;

		const userMessage = { role: 'user', content: input.trim() };
		setMessages(prev => [...prev, userMessage]);
		setInput('');
		setIsGenerating(true);

		try {
			let assistantResponse = '';
			const assistantMessage = { role: 'assistant', content: '' };
			setMessages(prev => [...prev, assistantMessage]);

			console.log('Starting course generation stream...');

			let courseId = null;

			// Stream the response (include current course ID if exists)
			await openaiService.streamCourseGeneration(
				userMessage.content,
				messages.map(m => ({ role: m.role, content: m.content })),
				currentCourseId, // Pass course ID for updates
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
				(data) => {
					// Handle special data like course_id
					if (data.course_id) {
						courseId = data.course_id;
						setCurrentCourseId(courseId); // Save course ID for future requests
						console.log('Course created/updated with ID:', courseId);
					}
				}
			);

			console.log('Stream completed. Total length:', assistantResponse.length);

			// If course was created or updated, show success message but don't redirect
			if (courseId) {
				setCurrentCourseId(courseId); // Save course ID for future requests
				setMessages(prev => [...prev, {
					role: 'assistant',
					content: `✅ Cursul a fost ${currentCourseId ? 'actualizat' : 'creat'} cu succes în background!\n\nID curs: ${courseId}\n\nPoți continua conversația sau să îmi spui dacă vrei să modific ceva.`
				}]);
				
				// Don't redirect - user stays in chat
				// Optionally reload courses list if callback is provided
				if (onCourseGenerated) {
					onCourseGenerated({ id: courseId, created: !currentCourseId });
				}
			} else {
				// Check if the response contains course data (fallback)
				try {
					const courseData = parseCourseFromResponse(assistantResponse);
					if (courseData) {
						setGeneratedCourse(courseData);
					}
				} catch (e) {
					console.error('Error parsing course data:', e);
				}
			}
		} catch (error) {
			console.error('Error generating course:', error);
			showToast('Eroare la generarea cursului. Te rugăm să încerci din nou.', 'error');
			setMessages(prev => {
				const newMessages = [...prev];
				newMessages[newMessages.length - 1] = {
					...newMessages[newMessages.length - 1],
					content: 'Îmi pare rău, am întâmpinat o eroare. Te rugăm să încerci din nou sau să reformulezi cererea.',
				};
				return newMessages;
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const parseCourseFromResponse = (response) => {
		// Try to extract JSON from the response
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			try {
				return JSON.parse(jsonMatch[0]);
			} catch (e) {
				// If JSON parsing fails, try to extract structured data
			}
		}

		// Fallback: extract course information from text
		const titleMatch = response.match(/Titlu[:\s]+(.+?)(?:\n|$)/i) || 
			response.match(/Title[:\s]+(.+?)(?:\n|$)/i);
		const descMatch = response.match(/Descriere[:\s]+(.+?)(?:\n|$)/i) ||
			response.match(/Description[:\s]+(.+?)(?:\n|$)/i);

		if (titleMatch || descMatch) {
			return {
				title: titleMatch ? titleMatch[1].trim() : 'Curs generat prin AI',
				description: descMatch ? descMatch[1].trim() : response.substring(0, 200),
				short_description: descMatch ? descMatch[1].trim().substring(0, 150) : response.substring(0, 150),
			};
		}

		return null;
	};

	const handleCreateCourse = async () => {
		if (!generatedCourse) return;

		try {
			const formData = new FormData();
			formData.append('title', generatedCourse.title || 'Curs generat prin AI');
			formData.append('description', generatedCourse.description || '');
			formData.append('short_description', generatedCourse.short_description || generatedCourse.description?.substring(0, 150) || '');
			formData.append('status', 'draft');

			const result = await adminService.createCourse(formData);
			showToast('Curs creat cu succes!', 'success');
			
			if (onCourseGenerated) {
				onCourseGenerated(result.course);
			}
			
			if (onClose) {
				onClose();
			}
		} catch (error) {
			console.error('Error creating course:', error);
			showToast('Eroare la crearea cursului. Te rugăm să încerci din nou.', 'error');
		}
	};

	return (
		<div className="ai-chat-container">
			<div className="ai-chat-header">
				<h2>🤖 Creator Curs AI</h2>
				{onClose && (
					<button className="ai-chat-close" onClick={onClose}>
						×
					</button>
				)}
			</div>

			<div className="ai-chat-messages" ref={chatContainerRef}>
				{messages.map((message, index) => (
					<div
						key={index}
						className={`ai-chat-message ${message.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-assistant'}`}
					>
						<div className="ai-chat-message-content">
							{message.content}
						</div>
					</div>
				))}
				{isGenerating && (
					<div className="ai-chat-message ai-chat-message-assistant">
						<div className="ai-chat-message-content">
							<span className="ai-chat-typing-indicator">●</span>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{generatedCourse && (
				<div className="ai-chat-preview">
					<h3>📋 Preview Curs Generat</h3>
					<div className="ai-chat-preview-content">
						<p><strong>Titlu:</strong> {generatedCourse.title}</p>
						{generatedCourse.description && (
							<p><strong>Descriere:</strong> {generatedCourse.description}</p>
						)}
					</div>
					<button className="ai-chat-btn ai-chat-btn-primary" onClick={handleCreateCourse}>
						✓ Creează Curs
					</button>
				</div>
			)}

			<form className="ai-chat-input-form" onSubmit={handleSend}>
				<input
					type="text"
					className="ai-chat-input"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Scrie aici ce fel de curs vrei să creezi..."
					disabled={isGenerating}
				/>
				<button
					type="submit"
					className="ai-chat-btn ai-chat-btn-send"
					disabled={!input.trim() || isGenerating}
				>
					{isGenerating ? '⏳' : '➤'}
				</button>
			</form>
		</div>
	);
};

export default AICourseChat;

