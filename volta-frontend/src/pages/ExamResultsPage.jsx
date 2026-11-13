import '../styles/exam-results-modern.css';
import EmptyState from '../components/ui/EmptyState';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TestsSectionTabs from '../components/student/TestsSectionTabs';
import { useRegisterPageRefresh } from '../contexts/PageRefreshContext';
import {
	CalendarBlank,
	CaretDown,
	CheckCircle,
	Eye,
	Folder,
	HourglassMedium,
	MagnifyingGlass,
	WarningCircle,
	XCircle,
} from '@phosphor-icons/react';
import { examResultsService } from '../services/api';
import { handleApiError } from '../utils/errorHandler';
import {
	getCorrectChoiceIndices,
	isMultiSelectChoiceQuestion,
	normalizeMultiChoiceIndices,
} from '../utils/examChoiceQuestions';
import RichTextHtml from '../components/RichTextHtml';
import { formatPercent } from '../utils/formatPercent';
import { toImageUrl } from '../utils/imageUrl';

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAnswerIndex(value) {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? null : parsed;
}

function getResultTitle(result) {
	return result?.exam?.title || result?.test?.title || 'Test';
}

function getCourseTitle(result) {
	return result?.exam?.course?.title || result?.test?.course?.title || 'Fără curs';
}

function getCourseKey(result) {
	const course = result?.exam?.course || result?.test?.course;
	return course?.id != null ? `course:${course.id}` : `title:${getCourseTitle(result)}`;
}

function groupByCourse(list) {
	const groups = new Map();
	list.forEach((result) => {
		const key = getCourseKey(result);
		if (!groups.has(key)) groups.set(key, { key, title: getCourseTitle(result), results: [] });
		groups.get(key).results.push(result);
	});
	return [...groups.values()];
}

/** Testele lunare = examenele independente (fără curs), ca în pagina „Teste lunare”. */
function isMonthlyTest(result) {
	return result?.type === 'exam' && !(result?.exam?.course?.id ?? result?.exam?.course_id);
}

const MONTH_LABEL = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });

function groupByMonth(list) {
	const groups = new Map();
	list.forEach((result) => {
		const date = result?.completed_at ? new Date(result.completed_at) : null;
		const valid = date && !Number.isNaN(date.getTime());
		const key = valid ? `month:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'month:unknown';
		const label = valid ? MONTH_LABEL.format(date) : 'Fără dată';
		if (!groups.has(key)) {
			groups.set(key, { key, title: label.charAt(0).toUpperCase() + label.slice(1), results: [], icon: 'month' });
		}
		groups.get(key).results.push(result);
	});
	return [...groups.values()];
}

function isPendingReview(result) {
	return Boolean((result?.needs_manual_review || result?.status === 'pending_review') && !result?.reviewed_at);
}

function getResultState(result) {
	if (isPendingReview(result)) {
		return { key: 'pending', label: 'În curs de corectare' };
	}
	if (result?.passed) {
		return { key: 'passed', label: 'Promovat' };
	}
	return { key: 'failed', label: 'Nepromovat' };
}

function testIdentity(result) {
	if (result?.test_id) return `test:${result.test_id}`;
	if (result?.exam_id) return `exam:${result.exam_id}`;
	return `${result?.type || 'exam'}:${result?.id}`;
}

function latestResultPerTest(list) {
	const byTest = new Map();
	list.forEach((row) => {
		const key = testIdentity(row);
		const current = byTest.get(key);
		if (!current) {
			byTest.set(key, row);
			return;
		}
		const currentTime = new Date(current.completed_at || 0).getTime();
		const nextTime = new Date(row.completed_at || 0).getTime();
		const currentAttempt = Number(current.attempt_number) || 0;
		const nextAttempt = Number(row.attempt_number) || 0;
		if (nextTime > currentTime || (nextTime === currentTime && nextAttempt > currentAttempt)) {
			byTest.set(key, row);
		}
	});
	return [...byTest.values()];
}

function renderValueList(values, itemLookup) {
	if (!Array.isArray(values) || values.length === 0) return 'Fără răspuns';
	const labels = values
		.map((id) => itemLookup?.get(String(id))?.text || String(id))
		.filter(Boolean);
	return labels.length ? labels.join(' → ') : 'Fără răspuns';
}

function QuestionReview({ question, index, result, submittedOnly = false }) {
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
	const statusClass = hasAutoStatus ? (correctness ? 'correct' : 'incorrect') : 'submitted';
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
				<span className="student-exam-feedback-item-status">
					{hasAutoStatus ? (correctness ? '✓ Corect' : '✗ Incorect') : 'Răspuns trimis'}
				</span>
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
								{selected && <span className="exam-result-answer-label user">Răspunsul tău</span>}
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
								<span>Răspunsul tău: {rightLookup.get(String(userChoice))?.text || 'Fără răspuns'}</span>
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
						return <div key={left.id ?? pairIndex} className="exam-result-structured-row"><strong>{left.text}</strong><span>Imaginea ta: {selected ? <img src={toImageUrl(selected.image_url) || selected.image_url} alt={selected.alt || ''} style={{ display: 'block', maxWidth: 180, maxHeight: 120, objectFit: 'cover', borderRadius: 6 }} /> : 'Fără răspuns'}</span>{!submittedOnly && !correctness && <span>Imagine corectă: {correct ? <img src={toImageUrl(correct.image_url) || correct.image_url} alt={correct.alt || ''} style={{ display: 'block', maxWidth: 180, maxHeight: 120, objectFit: 'cover', borderRadius: 6 }} /> : 'Indisponibil'}</span>}</div>;
					})}
				</div>
			)}

			{type === 'ordering' && ordering && (
				<div className="exam-result-structured">
					<div className="exam-result-structured-row">
						<strong>Ordinea ta</strong>
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

			{!hasOptions && type !== 'matching' && type !== 'image_matching' && type !== 'ordering' && (
				<div className="exam-result-open-text-answer">
					{typeof userAnswer === 'string' && userAnswer.trim()
						? userAnswer
						: 'Fără răspuns afișabil pentru acest tip de întrebare.'}
				</div>
			)}

		</article>
	);
}

/** Card compact: titlu, stare, procent și scor pe un rând; întrebările se deschid la cerere. */
function ResultCard({ result }) {
	const [showAnswers, setShowAnswers] = useState(false);
	const state = getResultState(result);
	const percent = formatPercent(toNumber(result.percentage));
	const questions = asArray(result?.exam?.questions);
	const submittedOnly = Boolean(result?.show_only_submitted_answers);
	const answersId = `exam-result-answers-${result.type || 'exam'}-${result.id}`;
	const StateIcon = state.key === 'passed' ? CheckCircle : state.key === 'pending' ? HourglassMedium : XCircle;

	return (
		<article className={`exam-results-test-card is-${state.key}`}>
			<div className="exam-results-test-row">
				<StateIcon size={22} weight="fill" aria-hidden className="exam-results-test-icon" />
				<div className="exam-results-test-main">
					<h3 className="exam-results-test-title">{getResultTitle(result)}</h3>
					<p className="exam-results-test-meta">
						<span className="exam-results-test-state">{state.label}</span>
						<span>Scor {toNumber(result.score)} / {toNumber(result.total_points ?? result.max_score)}</span>
					</p>
				</div>
				{state.key !== 'pending' && <span className="exam-results-test-percent">{percent}</span>}
			</div>
			{questions.length > 0 ? (
				<>
					<button
						type="button"
						className="exam-results-test-toggle"
						aria-expanded={showAnswers}
						aria-controls={answersId}
						onClick={() => setShowAnswers((open) => !open)}
					>
						{showAnswers ? 'Ascunde răspunsurile' : `Vezi răspunsurile (${questions.length})`}
						<CaretDown size={14} weight="bold" aria-hidden className="exam-results-test-toggle-caret" />
					</button>
					{showAnswers && (
						<div id={answersId} className="student-exam-final-feedback exam-results-test-answers">
							{questions.map((question, index) => (
								<QuestionReview
									key={question.id ?? index}
									question={question}
									index={index}
									result={result}
									submittedOnly={submittedOnly}
								/>
							))}
						</div>
					)}
				</>
			) : (
				<p className="exam-results-test-missing">Detaliile întrebărilor nu sunt disponibile.</p>
			)}
		</article>
	);
}

const STATUS_FILTERS = [
	{ id: 'all', label: 'Toate' },
	{ id: 'passed', label: 'Promovate' },
	{ id: 'failed', label: 'Nepromovate' },
];

const SORT_FILTERS = [
	{ id: 'recent', label: 'Recente' },
	{ id: 'oldest', label: 'Vechi' },
];

const ExamResultsPage = () => {
	const [results, setResults] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [query, setQuery] = useState('');
	const [filterStatus, setFilterStatus] = useState('all');
	const [sortBy, setSortBy] = useState('recent');
	const [openCourses, setOpenCourses] = useState(() => new Set());
	const [activeSection, setActiveSection] = useState(null);

	const toggleCourse = (key) => setOpenCourses((prev) => {
		const next = new Set(prev);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});

	const loadResults = async ({ silent = false } = {}) => {
		try {
			if (!silent) {
				setLoading(true);
				setError(null);
			}
			const data = await examResultsService.getAll({ view: 'cards' });
			const list = latestResultPerTest(Array.isArray(data) ? data : []);
			const detailed = await Promise.all(list.map(async (row) => {
				if (Array.isArray(row?.exam?.questions)) {
					return row;
				}
				try {
					const details = await examResultsService.getById(row.id, row.type);
					return { ...row, ...details };
				} catch (detailError) {
					handleApiError(detailError, 'fetchResultDetails');
					return row;
				}
			}));
			setResults(detailed);
		} catch (err) {
			handleApiError(err, 'fetchExamResults');
			if (!silent) setError('Nu s-au putut încărca rezultatele testelor.');
		} finally {
			if (!silent) setLoading(false);
		}
	};

	useEffect(() => {
		loadResults();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useRegisterPageRefresh(() => loadResults({ silent: true }));

	const filteredResults = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return [...results]
			.filter((result) => {
				const state = getResultState(result).key;
				if (filterStatus !== 'all' && state !== filterStatus) return false;
				if (!needle) return true;
				return `${getResultTitle(result)} ${getCourseTitle(result)}`.toLowerCase().includes(needle);
			})
			.sort((a, b) => {
				const dateA = new Date(a.completed_at || 0).getTime();
				const dateB = new Date(b.completed_at || 0).getTime();
				return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
			});
	}, [results, query, filterStatus, sortBy]);

	const resultSections = useMemo(() => {
		const monthly = filteredResults.filter(isMonthlyTest);
		const courseTests = filteredResults.filter((result) => !isMonthlyTest(result));
		return [
			{ id: 'courses', title: 'Teste din cursuri', count: courseTests.length, groups: groupByCourse(courseTests) },
			{ id: 'monthly', title: 'Teste lunare', count: monthly.length, groups: groupByMonth(monthly) },
		];
	}, [filteredResults]);
	// Implicit: prima secțiune cu rezultate (cursurile, apoi testele lunare)
	const currentSectionId = activeSection
		?? resultSections.find((section) => section.count > 0)?.id
		?? 'courses';
	const currentSection = resultSections.find((section) => section.id === currentSectionId);
	const searching = query.trim() !== '';

	if (loading) {
		return (
			<div className="exam-results-page">
				<div className="exam-results-loading">
					<div className="lms-spinner" />
					<p>Se încarcă rezultatele...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="exam-results-page">
			<section className="exam-results-page-header exam-results-page-header--simple">
				<h1 className="exam-results-page-title">Rezultate teste</h1>
			</section>

			{error && (
				<div className="exam-results-error">
					<WarningCircle size={18} weight="bold" aria-hidden />
					<span>{error}</span>
				</div>
			)}

			<TestsSectionTabs />

			<div className="exam-results-controls">
				<div className="exam-results-button-row" role="group" aria-label="Filtru teste">
					{STATUS_FILTERS.map((filter) => (
						<button
							key={filter.id}
							type="button"
							className={`exam-results-filter-btn ${filterStatus === filter.id ? 'is-active' : ''}`}
							aria-pressed={filterStatus === filter.id}
							onClick={() => setFilterStatus(filter.id)}
						>
							{filter.label}
						</button>
					))}
				</div>
				<div className="exam-results-button-row" role="group" aria-label="Ordine teste">
					{SORT_FILTERS.map((filter) => (
						<button
							key={filter.id}
							type="button"
							className={`exam-results-filter-btn ${sortBy === filter.id ? 'is-active' : ''}`}
							aria-pressed={sortBy === filter.id}
							onClick={() => setSortBy(filter.id)}
						>
							{filter.label}
						</button>
					))}
				</div>
				<div className="exam-results-search">
					<MagnifyingGlass size={18} weight="bold" aria-hidden />
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Caută după test sau curs"
						aria-label="Caută teste"
					/>
				</div>
			</div>

			{results.length > 0 && (
				<div className="exam-results-section-tabs" role="tablist" aria-label="Tip teste">
					{resultSections.map((section) => (
						<button
							key={section.id}
							type="button"
							role="tab"
							id={`exam-results-tab-${section.id}`}
							aria-selected={section.id === currentSectionId}
							aria-controls="exam-results-section-panel"
							className={`exam-results-section-tab${section.id === currentSectionId ? ' is-active' : ''}`}
							onClick={() => setActiveSection(section.id)}
						>
							{section.title}
							<span className="exam-results-section-tab-count">{section.count}</span>
						</button>
					))}
				</div>
			)}

			{currentSection && currentSection.count > 0 ? (
				<div
					id="exam-results-section-panel"
					role="tabpanel"
					aria-labelledby={`exam-results-tab-${currentSection.id}`}
					className="exam-results-stack"
				>
					{currentSection.groups.map((group) => {
						// La căutare mapele se deschid singure, ca rezultatele găsite să fie vizibile.
						const isOpen = searching || openCourses.has(group.key);
						const passedCount = group.results.filter((result) => getResultState(result).key === 'passed').length;
						const panelId = `exam-results-course-${group.key.replace(/[^a-z0-9-]/gi, '-')}`;
						return (
							<section key={group.key} className={`exam-results-course${isOpen ? ' is-open' : ''}`}>
								<button
									type="button"
									className="exam-results-course-toggle"
									aria-expanded={isOpen}
									aria-controls={panelId}
									onClick={() => toggleCourse(group.key)}
									disabled={searching}
								>
									{group.icon === 'month' ? (
										<CalendarBlank size={22} weight="duotone" aria-hidden className="exam-results-course-icon" />
									) : (
										<Folder size={22} weight="duotone" aria-hidden className="exam-results-course-icon" />
									)}
									<span className="exam-results-course-name">{group.title}</span>
									<span className="exam-results-course-count">
										{group.results.length === 1 ? '1 test' : `${group.results.length} teste`} · {passedCount} promovate
									</span>
									<CaretDown size={18} weight="bold" aria-hidden className="exam-results-course-caret" />
								</button>
								{isOpen && (
									<div id={panelId} className="exam-results-course-body">
										{group.results.map((result) => (
											<ResultCard key={`${result.type || 'exam'}:${result.id}`} result={result} />
										))}
									</div>
								)}
							</section>
						);
					})}
				</div>
			) : (
				<EmptyState
					icon={<Eye size={30} weight="bold" />}
					title={results.length === 0
						? 'Nu ai rezultate încă'
						: filteredResults.length === 0
							? 'Niciun test pentru filtrele alese'
							: `Niciun rezultat la ${currentSection?.title.toLowerCase() ?? 'această secțiune'}`}
					text={results.length === 0
						? 'Finalizează un test pentru a vedea scorul aici.'
						: filteredResults.length === 0
							? 'Schimbă filtrul sau căutarea.'
							: 'Rezultatele tale sunt în cealaltă secțiune.'}
				>
					{results.length === 0 ? <Link to="/courses" className="lms-btn-primary">Mergi la cursuri</Link> : null}
				</EmptyState>
			)}
		</div>
	);
};

export default ExamResultsPage;
