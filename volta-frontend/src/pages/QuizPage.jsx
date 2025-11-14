import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCourseById } from '../data/mockData';

const QuizPage = () => {
	const { courseId } = useParams();
	const course = getCourseById(courseId);
	const quiz = course?.quiz;
	const [answers, setAnswers] = useState({});
	const [submitted, setSubmitted] = useState(false);

	const score = useMemo(() => {
		if (!submitted || !quiz) return 0;
		return quiz.questions.reduce((acc, q) => {
			return acc + (answers[q.id] === q.answerIndex ? 1 : 0);
		}, 0);
	}, [submitted, answers, quiz]);

	if (!course || !quiz) return <p>Quiz-ul nu a fost găsit.</p>;

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
							{submitted && (
								<div className={answers[q.id] === q.answerIndex ? 'va-correct' : 'va-wrong'}>
									{answers[q.id] === q.answerIndex ? 'Corect' : 'Incorect'}
								</div>
							)}
						</div>
					))}
				</div>
			</div>

			<div className="va-actions">
				{!submitted ? (
					<button className="va-btn va-btn-primary" onClick={() => setSubmitted(true)}>
						Trimite
					</button>
				) : (
					<div className="va-quiz-result">
						<span>Scor: {score} / {quiz.questions.length}</span>
						<button className="va-btn va-btn-secondary" onClick={() => { setSubmitted(false); setAnswers({}); }}>
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


