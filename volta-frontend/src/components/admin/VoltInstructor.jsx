import React, { useState, useRef, useEffect } from 'react';
import './VoltInstructor.css';

/**
 * Volt Instructor - Asistent Volt pentru instructori
 * Fiecare acțiune poate avea propriile întrebări (questions, pdfUploadQuestionIndex)
 */
const VoltInstructor = ({ actions = [], welcomeMessage, questions = [], pdfUploadQuestionIndex = -1 }) => {
	const [isMinimized, setIsMinimized] = useState(true);
	const [input, setInput] = useState('');
	const [pdfFile, setPdfFile] = useState(null);
	const [step, setStep] = useState('initial');
	const [activeActionIndex, setActiveActionIndex] = useState(null);
	const [answers, setAnswers] = useState([]);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const messagesEndRef = useRef(null);

	const defaultWelcome = 'Mă numesc Volt și sunt asistentul Volt în construcție. Abia aștept ca Ion să finalizeze elaborarea mea pentru a îmbunătăți procesul de învățare la Volta.';
	const message = welcomeMessage ?? defaultWelcome;

	const activeAction = activeActionIndex !== null ? actions[activeActionIndex] : null;
	const activeQuestions = activeAction?.questions ?? questions;
	const activePdfIndex = activeAction?.pdfUploadQuestionIndex ?? pdfUploadQuestionIndex;

	const allAnswered = activeQuestions.length > 0 && answers.length >= activeQuestions.length;
	const chatData = activeQuestions.length > 0
		? activeQuestions.map((q, i) => `${q}\n${answers[i] || ''}`).join('\n\n')
		: '';

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [answers, currentQuestionIndex, step]);

	const handleStartAction = (actionIdx) => {
		const action = actions[actionIdx];
		const actionQuestions = action?.questions ?? (action?.primary ? questions : []);
		if (actionQuestions.length > 0) {
			setActiveActionIndex(actionIdx);
			setStep('questions');
			setAnswers([]);
			setCurrentQuestionIndex(0);
			setPdfFile(null);
		} else {
			setIsMinimized(true);
			action?.onClick?.();
		}
	};

	const handleBackToInitial = () => {
		setStep('initial');
		setActiveActionIndex(null);
		setAnswers([]);
		setCurrentQuestionIndex(0);
		setPdfFile(null);
	};

	const isPdfQuestion = activePdfIndex >= 0 && currentQuestionIndex === activePdfIndex;

	const handleChatSubmit = (e) => {
		e.preventDefault();
		const text = input.trim();
		const hasPdf = isPdfQuestion && pdfFile;
		if (!text && !hasPdf) return;
		const answerText = hasPdf ? `PDF: ${pdfFile.name}` : text;
		const newAnswers = [...answers, answerText];
		setAnswers(newAnswers);
		setInput('');
		if (newAnswers.length >= activeQuestions.length) {
			setStep('ready');
		} else {
			setCurrentQuestionIndex((prev) => prev + 1);
		}
	};

	const handleFinalize = () => {
		setIsMinimized(true);
		const data = activeQuestions.length > 0 && allAnswered
			? { answers, chatData, pdfFile: activePdfIndex >= 0 ? pdfFile : null }
			: undefined;
		activeAction?.onClick?.(data);
		handleBackToInitial();
	};

	const boltIcon = (
		<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
			<path d="M18 2L10 14h6l-3 14 12-16h-6L18 2z" fill="currentColor"/>
		</svg>
	);

	const currentQuestion = activeQuestions[currentQuestionIndex];
	const showQuestions = step === 'questions' || step === 'ready';
	const showFinalizeButton = step === 'ready';

	return (
		<div className={`volt-instructor-container ${isMinimized ? 'minimized' : 'expanded'}`}>
			{isMinimized && (
				<button
					type="button"
					className="volt-instructor-floating-btn"
					onClick={() => setIsMinimized(false)}
					title="Deschide Volt"
					aria-label="Deschide Volt"
				>
					<span className="volt-instructor-fox-icon">{boltIcon}</span>
				</button>
			)}

			{!isMinimized && (
				<>
					<div className="volt-instructor-header">
						<div className="volt-instructor-header-left">
							<span className="volt-instructor-fox-icon">{boltIcon}</span>
							<span className="volt-instructor-title">VOLT</span>
						</div>
						<button
							type="button"
							className="volt-instructor-toggle"
							onClick={() => { setIsMinimized(true); handleBackToInitial(); }}
							title="Minimizează"
							aria-label="Minimizează"
						>
							×
						</button>
					</div>

					<div className="volt-instructor-chat">
						<div className="volt-instructor-message volt-instructor-message-assistant">
							<div className="volt-instructor-message-content">
								{message}
							</div>
						</div>
						{showQuestions && (
							<>
								{answers.map((answer, i) => (
									<React.Fragment key={i}>
										<div className="volt-instructor-message volt-instructor-message-assistant">
											<div className="volt-instructor-message-content volt-instructor-question">
												{activeQuestions[i]}
											</div>
										</div>
										<div className="volt-instructor-message volt-instructor-message-user">
											<div className="volt-instructor-message-content">
												{answer}
											</div>
										</div>
									</React.Fragment>
								))}
								{currentQuestion && !allAnswered && (
									<div className="volt-instructor-message volt-instructor-message-assistant">
										<div className="volt-instructor-message-content volt-instructor-question">
											{currentQuestion}
										</div>
									</div>
								)}
								{allAnswered && (
									<div className="volt-instructor-message volt-instructor-message-assistant">
										<div className="volt-instructor-message-content">
											Am notat tot. Apasă „Finalizează” 										</div>
									</div>
								)}
							</>
						)}
						<div ref={messagesEndRef} />
					</div>

					{showQuestions && !allAnswered && (
						<form className="volt-instructor-input-form" onSubmit={handleChatSubmit}>
							{isPdfQuestion && (
								<div className="volt-instructor-pdf-upload">
									<input
										type="file"
										accept=".pdf,application/pdf"
										onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
										className="volt-instructor-file-input"
										id="volt-pdf-upload"
									/>
									<label htmlFor="volt-pdf-upload" className="volt-instructor-file-label">
										{pdfFile ? `📄 ${pdfFile.name}` : '📎 Încarcă PDF'}
									</label>
								</div>
							)}
							<input
								type="text"
								className="volt-instructor-input"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder={isPdfQuestion ? "Sau scrie 'nu' pentru a skipa..." : 'Scrie răspunsul tău...'}
							/>
							<button type="submit" className="volt-instructor-send-btn" disabled={!input.trim() && !pdfFile}>
								➤
							</button>
						</form>
					)}

					<div className="volt-instructor-quick-actions">
						{showFinalizeButton ? (
							<button
								type="button"
								className="volt-instructor-quick-action volt-instructor-primary-action"
								onClick={handleFinalize}
							>
								Finalizează
							</button>
						) : step === 'initial' ? (
							actions.map((action, idx) => (
								<button
									key={idx}
									type="button"
									className={`volt-instructor-quick-action ${action.primary ? 'volt-instructor-primary-action' : ''}`}
									onClick={() => handleStartAction(idx)}
									disabled={action.disabled}
								>
									{action.label}
								</button>
							))
						) : null}
					</div>
				</>
			)}
		</div>
	);
};

export default VoltInstructor;
