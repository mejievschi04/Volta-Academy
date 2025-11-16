import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quizService } from '../services/api';

const QuizPage = () => {
	const { courseId } = useParams();
	const [quiz, setQuiz] = useState(null);
	const [answers, setAnswers] = useState({});
	const [submitted, setSubmitted] = useState(false);
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchQuiz = async () => {
			try {
				setLoading(true);
				const data = await quizService.getQuiz(courseId);
				setQuiz(data);
			} catch (err) {
				console.error('Error fetching quiz:', err);
				setError('Quiz-ul nu a fost găsit');
			} finally {
				setLoading(false);
			}
		};
		fetchQuiz();
	}, [courseId]);

	const handleSubmit = async () => {
		try {
			const resultData = await quizService.submitQuiz(courseId, answers);
			setResult(resultData);
			setSubmitted(true);
		} catch (err) {
			console.error('Error submitting quiz:', err);
			setError('Eroare la trimiterea quiz-ului');
		}
	};

	if (loading) { return null; }

	if (error || !quiz) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error || 'Quiz-ul nu a fost găsit'}</p>
			</div>
		);
	}

	return (
		<div className="va-stack">
			<h1 className="va-page-title">{quiz.title}</h1>

			<div className="va-card">
				<div className="va-card-body va-stack">
					{quiz.questions.map((q, idx) => (
						<div key={q.id} className="va-quiz-question">
							<div className="va-quiz-q">
								<span className="va-quiz-num">Q{idx + 1}.</span> {q.text}
							</div>
							<div className="va-quiz-options">
								{q.options.map((opt, i) => (
									<label key={i} className="va-radio">
										<input
											type="radio"
											name={q.id}
											checked={answers[q.id] === i}
											onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
										/>
										<span>{opt}</span>
									</label>
								))}
							</div>
							{submitted && result && (
								<div className={answers[q.id] === q.answerIndex ? 'va-correct' : 'va-wrong'}>
									{answers[q.id] === q.answerIndex ? '✓ Corect' : '✗ Incorect'}
								</div>
							)}
						</div>
					))}
				</div>
			</div>

			<div className="va-actions">
				{!submitted ? (
					<button className="va-btn va-btn-primary" onClick={handleSubmit}>
						Trimite
					</button>
				) : (
					<div className="va-quiz-result">
						<span>Scor: {result?.score || 0} / {result?.total || quiz.questions.length}</span>
						{result && (
							<div>
								<p>Procentaj: {result.percentage}%</p>
								<p>{result.passed ? '✓ Promovat' : '✗ Nepromovat'}</p>
							</div>
						)}
						<button className="va-btn va-btn-secondary" onClick={() => { 
							setSubmitted(false); 
							setAnswers({}); 
							setResult(null);
						}}>
							Reia
						</button>
					</div>
				)}
				<Link to={`/courses/${courseId}/lessons`} className="va-btn va-btn-link">Înapoi la lecții</Link>
			</div>
		</div>
	);
};

export default QuizPage;


