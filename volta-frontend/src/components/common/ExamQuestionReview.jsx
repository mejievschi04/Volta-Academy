import React, { useMemo } from 'react';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import RichTextHtml from '../RichTextHtml';
import {
	getCorrectChoiceIndices,
	isMultiSelectChoiceQuestion,
	normalizeAnswerIndex,
	normalizeMultiChoiceIndices,
} from '../../utils/examChoiceQuestions';
import { toImageUrl } from '../../utils/imageUrl';
import './ExamQuestionReview.css';

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function renderValueList(values, itemLookup) {
	if (!Array.isArray(values) || values.length === 0) return 'Fără răspuns';
	const labels = values
		.map((id) => itemLookup?.get(String(id))?.text || String(id))
		.filter(Boolean);
	return labels.length ? labels.join(' → ') : 'Fără răspuns';
}

export default function ExamQuestionReview({ question, index, result, submittedOnly = false, staffView = false }) {
	const type = question.type || question.question_type || 'multiple_choice';
	const userAnswer = question.user_answer ?? result?.answers?.[question.id] ?? result?.answers?.[String(question.id)];
	const multi = isMultiSelectChoiceQuestion({ type });
	const userAnswerIndices = Array.isArray(question.user_answer_indices)
		? normalizeMultiChoiceIndices(question.user_answer_indices)
		: multi
			? normalizeMultiChoiceIndices(userAnswer)
			: (() => {
				const idx = normalizeAnswerIndex(question.user_answer_index ?? userAnswer);
				return idx !== null ? [idx] : [];
			})();
	const correctIndices = Array.isArray(question.correct_answer_indices)
		? normalizeMultiChoiceIndices(question.correct_answer_indices)
		: getCorrectChoiceIndices(question);
	const options = asArray(question.answers).length
		? asArray(question.answers)
		: asArray(question.options).map((text, answerIndex) => ({
			id: answerIndex,
			text,
			answer_text: text,
			is_correct: correctIndices.includes(answerIndex),
			is_selected: userAnswerIndices.includes(answerIndex),
		}));
	const hasOptions = options.length > 0 && !['matching', 'image_matching', 'ordering'].includes(type);
	const correctness = typeof question.is_correct === 'boolean' ? question.is_correct : null;
	const hasAutoStatus = typeof correctness === 'boolean';
	const unanswered = staffView && question.has_answer === false;
	const statusClass = hasAutoStatus && !unanswered ? (correctness ? 'correct' : 'incorrect') : 'submitted';
	const status = unanswered ? 'Fără răspuns'
		: hasAutoStatus ? (correctness ? '✓ Corect' : '✗ Incorect')
		: 'Răspuns trimis';
	const answerLabel = staffView ? 'Răspuns trimis' : 'Răspunsul tău';
	const matching = question.matching;
	const imageMatching = question.imageMatching;
	const ordering = question.ordering;
	const rightLookup = useMemo(
		() => new Map(asArray(matching?.rightItems).map((item) => [String(item.id), item])),
		[matching]
	);
	const orderLookup = useMemo(
		() => new Map(asArray(ordering?.items).map((item) => [String(item.id), item])),
		[ordering]
	);
	const imageLookup = useMemo(() => new Map(asArray(imageMatching?.rightItems).map((item) => [String(item.id), item])), [imageMatching]);

	return (
		<article className={`student-exam-feedback-item exam-result-question ${statusClass}`}>
			<div className="student-exam-feedback-item-header">
				<span className="student-exam-feedback-item-number">{index + 1}</span>
				<span className="student-exam-feedback-item-status">{status}</span>
				{staffView && (
					<span className="exam-result-question-points">
						{question.points_earned ?? '—'} / {question.points ?? 1} p
					</span>
				)}
			</div>

			<RichTextHtml
				html={question.text || question.question_text || question.content}
				className="exam-result-question-text"
				fallback={<div className="exam-result-question-text">Întrebare fără conținut</div>}
			/>

			{hasOptions && (
				<div className="exam-result-answers">
					{options.map((answer, answerIndex) => {
						const fromApiAnswers = asArray(question.answers).length > 0;
						const selected = fromApiAnswers
							? Boolean(answer.is_selected)
							: userAnswerIndices.includes(answerIndex);
						if (submittedOnly && !selected) {
							return null;
						}
						const correct = fromApiAnswers
							? Boolean(answer.is_correct)
							: (!submittedOnly && correctIndices.includes(answerIndex));
						const answerText = answer.answer_text || answer.text || answer.content || `Varianta ${answerIndex + 1}`;
						const tone = correct ? 'correct' : selected ? 'user-incorrect' : 'default';
						return (
							<div
								key={answer.id ?? answerIndex}
								className={`exam-result-answer ${tone}`}
							>
								{(correct || selected) && (
									<span className="exam-result-answer-marker" aria-hidden>
										{correct ? <CheckCircle size={18} weight="bold" /> : <XCircle size={18} weight="bold" />}
									</span>
								)}
								<span className="exam-result-answer-text">{answerText}</span>
								{selected && <span className="exam-result-answer-label user">{answerLabel}</span>}
								{!submittedOnly && correct && <span className="exam-result-answer-label">Corect</span>}
							</div>
						);
					})}
				</div>
			)}

			{type === 'matching' && matching && (
				<div className="exam-result-structured">
					{asArray(matching.leftItems).map((left, pairIndex) => {
						const userChoice = Array.isArray(userAnswer) ? userAnswer[pairIndex] : null;
						const correctChoice = matching.correctMap?.[pairIndex];
						return (
							<div key={left.id ?? pairIndex} className="exam-result-structured-row">
								<strong>{left.text}</strong>
								<span>{answerLabel}: {rightLookup.get(String(userChoice))?.text || 'Fără răspuns'}</span>
								{!submittedOnly && !correctness && (
									<span>Corect: {rightLookup.get(String(correctChoice))?.text || 'Indisponibil'}</span>
								)}
							</div>
						);
					})}
				</div>
			)}

			{type === 'image_matching' && imageMatching && (
				<div className="exam-result-structured">
					{asArray(imageMatching.leftItems).map((left, pairIndex) => {
						const userChoice = Array.isArray(userAnswer) ? userAnswer[pairIndex] : null;
						const correctChoice = imageMatching.correctMap?.[pairIndex];
						const selected = imageLookup.get(String(userChoice));
						const correct = imageLookup.get(String(correctChoice));
						return (
							<div key={left.id ?? pairIndex} className="exam-result-structured-row">
								<strong>{left.text}</strong>
								<span>{staffView ? 'Imagine trimisă' : 'Imaginea ta'}: {selected?.image_url ? (
									<img className="exam-result-answer-image" src={toImageUrl(selected.image_url) || selected.image_url} alt={selected.alt || ''} />
								) : selected ? 'Indisponibilă' : 'Fără răspuns'}</span>
								{!submittedOnly && !correctness && (
									<span>Imagine corectă: {correct?.image_url ? (
										<img className="exam-result-answer-image" src={toImageUrl(correct.image_url) || correct.image_url} alt={correct.alt || ''} />
									) : 'Indisponibil'}</span>
								)}
							</div>
						);
					})}
				</div>
			)}

			{type === 'ordering' && ordering && (
				<div className="exam-result-structured">
					<div className="exam-result-structured-row">
						<strong>{staffView ? 'Ordinea trimisă' : 'Ordinea ta'}</strong>
						<span>{renderValueList(userAnswer, orderLookup)}</span>
					</div>
					{!submittedOnly && !correctness && (
						<div className="exam-result-structured-row">
							<strong>Ordinea corectă</strong>
							<span>{renderValueList(ordering.correctOrder, orderLookup)}</span>
						</div>
					)}
				</div>
			)}

			{!unanswered && !hasOptions && type !== 'matching' && type !== 'image_matching' && type !== 'ordering' && (
				<div className="exam-result-open-text-answer">
					{typeof userAnswer === 'string' && userAnswer.trim()
						? userAnswer
						: staffView && ['number', 'boolean'].includes(typeof userAnswer)
							? String(userAnswer)
							: 'Fără răspuns afișabil pentru acest tip de întrebare.'}
				</div>
			)}

			{staffView && question.review_feedback && (
				<div className="exam-result-open-text-answer">{question.review_feedback}</div>
			)}
		</article>
	);
}
