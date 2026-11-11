import React, { useCallback, useEffect, useState } from 'react';
import EmptyState from '../components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';
import { ClipboardText } from '@phosphor-icons/react';
import { examService } from '../services/api';
import { CourseShowcaseCard } from '../components/ui/course-showcase-card';
import { COURSE_SHOWCASE_FALLBACK_IMAGE } from '../components/ui/course-showcase-cardShared.js';
import { formatPercent } from '../utils/formatPercent';
import { useRegisterPageRefresh } from '../contexts/PageRefreshContext';
import TestsSectionTabs from '../components/student/TestsSectionTabs';
import './MonthlyTestsPage.css';

const MonthlyTestsPage = () => {
	const navigate = useNavigate();
	const [exams, setExams] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const reloadExams = useCallback(async ({ silent = false } = {}) => {
		try {
			if (!silent) {
				setLoading(true);
				setError(null);
			}
			const data = await examService.listStandaloneExams();
			setExams(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching monthly tests:', err);
			if (!silent) setError('Nu s-au putut încărca testele lunare');
		} finally {
			if (!silent) setLoading(false);
		}
	}, []);

	useEffect(() => {
		reloadExams();
	}, [reloadExams]);

	useRegisterPageRefresh(() => reloadExams({ silent: true }));

	if (loading) {
		return (
			<div className="monthly-tests-page">
				<div className="monthly-tests-loading">
					<div className="va-spinner" />
					<p>Se încarcă testele lunare...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="monthly-tests-page">
			<TestsSectionTabs />
			<header className="monthly-tests-header">
				<h1 className="monthly-tests-title">Teste lunare</h1>
				<p className="monthly-tests-subtitle">Testele pe care le poți susține acum.</p>
			</header>

			{error ? (
				<p className="monthly-tests-error" role="alert">{error}</p>
			) : exams.length === 0 ? (
				<EmptyState icon={<ClipboardText size={30} weight="bold" />} title="Nu ai teste lunare momentan" text="Când un test îți este atribuit, apare aici." />
			) : (
				<div className="monthly-tests-grid">
					{exams.map((exam) => {
						const minutes = Number(exam.time_limit_minutes) > 0 ? `${exam.time_limit_minutes} min` : null;
						const passing = exam.passing_score != null ? `Promovare ${formatPercent(exam.passing_score)}` : null;
						// încercările rămase ale cursantului (include pe cele acordate în plus); altfel limita examenului
						const left = exam.remaining_attempts ?? (Number(exam.max_attempts) > 0 ? Number(exam.max_attempts) : null);
						const attempts = left == null
							? null
							: left === 0
								? 'Nicio încercare rămasă'
								: `${left} ${Number(left) === 1 ? 'încercare rămasă' : 'încercări rămase'}`;
						// încercările întâi: ele contează cel mai mult
						const details = [attempts, minutes, passing].filter(Boolean).join(' · ');
						return (
							<article key={exam.id} className="monthly-tests-item">
								<CourseShowcaseCard
									imageUrl={exam.cover_image_url || COURSE_SHOWCASE_FALLBACK_IMAGE}
									title={exam.title || 'Test lunar'}
									subtitle={details || exam.description ? (
										<>
											{exam.description ? <span className="monthly-tests-description">{exam.description}</span> : null}
											{details ? <span className="monthly-tests-details">{details}</span> : null}
										</>
									) : null}
									onOpen={() => navigate(`/exams/${exam.id}`)}
									ctaLabel="Deschide testul"
								/>
							</article>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default MonthlyTestsPage;
