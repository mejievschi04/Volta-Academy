import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '../../services/api';
import './AdminStatisticsPage.css';

const formatDate = (iso) =>
	iso
		? new Date(iso).toLocaleDateString('ro-RO', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
		  })
		: '—';

const KPI_CARD = ({ icon, label, value, sublabel, variant }) => (
	<div className={`stats-kpi-card ${variant ? `stats-kpi-card--${variant}` : ''}`}>
		<div className="stats-kpi-card__icon" aria-hidden="true">
			{icon}
		</div>
		<div className="stats-kpi-card__body">
			<span className="stats-kpi-card__label">{label}</span>
			<span className="stats-kpi-card__value">{value}</span>
			{sublabel != null && sublabel !== '' && (
				<span className="stats-kpi-card__sublabel">{sublabel}</span>
			)}
		</div>
	</div>
);

const AdminStatisticsPage = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [courseFilter, setCourseFilter] = useState('');
	const [studentFilter, setStudentFilter] = useState('');
	const [expandedCourses, setExpandedCourses] = useState(new Set());
	const [expandedTests, setExpandedTests] = useState(new Set());

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				setError(null);
				const params = {};
				if (courseFilter) params.course_id = courseFilter;
				if (studentFilter) params.user_id = studentFilter;
				const res = await adminService.getStatisticsCourseTestDetail(params);
				setData(res);
			} catch (err) {
				console.error('Error fetching statistics:', err);
				setError('Nu s-au putut încărca datele de statistici.');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [courseFilter, studentFilter]);

	const courses = data?.courses ?? [];
	const students = data?.students ?? [];
	const enrollments = data?.enrollments ?? [];
	const testResults = data?.test_results ?? [];

	const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
	const coursesById = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);

	const resultsByUserTest = useMemo(() => {
		const map = {};
		[...testResults]
			.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
			.forEach((r) => {
				const key = `${r.user_id}_${r.test_id}`;
				if (!map[key]) map[key] = r;
			});
		return map;
	}, [testResults]);

	const courseSummaries = useMemo(() => {
		const byCourse = {};
		enrollments.forEach((e) => {
			if (!byCourse[e.course_id]) {
				byCourse[e.course_id] = { course_id: e.course_id, enrollments: [] };
			}
			byCourse[e.course_id].enrollments.push(e);
		});
		return Object.values(byCourse)
			.map(({ course_id, enrollments: list }) => {
				const course = coursesById[course_id];
				const n = list.length;
				const avgProgress = n ? list.reduce((s, e) => s + (e.progress_percentage ?? 0), 0) / n : 0;
				const completedCount = list.filter((e) => e.completed_at).length;
				return {
					course_id,
					course_title: course?.title || `Curs #${course_id}`,
					enrolled_count: n,
					avg_progress: Math.round(avgProgress),
					completed_count: completedCount,
					enrollments: list,
				};
			})
			.sort((a, b) => a.course_title.localeCompare(b.course_title));
	}, [enrollments, coursesById]);

	const testSummaries = useMemo(() => {
		const byTest = {};
		Object.entries(resultsByUserTest).forEach(([key, r]) => {
			const tid = r.test_id;
			if (!byTest[tid]) {
				byTest[tid] = { test_id: tid, test_title: r.test_title || `Test #${tid}`, results: [] };
			}
			byTest[tid].results.push(r);
		});
		return Object.values(byTest)
			.map(({ test_id, test_title, results }) => {
				const n = results.length;
				const withPct = results.filter((r) => r.percentage != null);
				const avgPct = withPct.length
					? withPct.reduce((s, r) => s + r.percentage, 0) / withPct.length
					: null;
				const passedCount = results.filter((r) => r.passed).length;
				return {
					test_id,
					test_title,
					participants_count: n,
					avg_percentage: avgPct != null ? Math.round(avgPct * 10) / 10 : null,
					passed_count: passedCount,
					results,
				};
			})
			.sort((a, b) => a.test_title.localeCompare(b.test_title));
	}, [resultsByUserTest]);

	// KPIs derivate din date
	const kpis = useMemo(() => {
		const totalEnrollments = enrollments.length;
		const completedEnrollments = enrollments.filter((e) => e.completed_at).length;
		const completionRate =
			totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
		const totalAttempts = testResults.length;
		const passedAttempts = testResults.filter((r) => r.passed).length;
		const passRate =
			totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
		return {
			totalLearners: students.length,
			totalEnrollments,
			completionRate,
			activeCourses: courseSummaries.length,
			testAttempts: totalAttempts,
			passRate,
		};
	}, [students.length, enrollments, testResults, courseSummaries.length]);

	const toggleCourse = (id) => {
		setExpandedCourses((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleTest = (id) => {
		setExpandedTests((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	if (loading) {
		return (
			<div className="admin-container admin-statistics-page">
				<div className="stats-loading">
					<div className="va-spinner va-spinner-lg" />
					<p>Se încarcă statisticile...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="admin-container admin-statistics-page">
				<div className="stats-error">
					<p>{error}</p>
				</div>
			</div>
		);
	}

	const iconUsers = (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
	const iconEnroll = (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
			<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
			<path d="M12 6v6l4 2" />
		</svg>
	);
	const iconComplete = (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
			<polyline points="22 4 12 14.01 9 11.01" />
		</svg>
	);
	const iconCourses = (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
			<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
		</svg>
	);
	const iconTest = (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="16" y1="13" x2="8" y2="13" />
			<line x1="16" y1="17" x2="8" y2="17" />
			<polyline points="10 9 9 9 8 9" />
		</svg>
	);
	const iconPass = (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
			<path d="m9 12 2 2 4-4" />
		</svg>
	);

	return (
		<div className="admin-container admin-statistics-page">
			<header className="stats-header">
				<div className="stats-header__content">
					<h1 className="stats-header__title">Statistici platformă</h1>
					<p className="stats-header__subtitle">
						Metrici de învățare, finalizare cursuri și rezultate teste. Filtrează după curs sau student pentru detalii.
					</p>
				</div>
			</header>

			{/* KPI Cards */}
			<section className="stats-kpis" aria-label="Indicatori cheie">
				<KPI_CARD
					icon={iconUsers}
					label="Studenți înscriși"
					value={kpis.totalLearners.toLocaleString()}
					sublabel="în platformă"
				/>
				<KPI_CARD
					icon={iconEnroll}
					label="Înscrieri la cursuri"
					value={kpis.totalEnrollments.toLocaleString()}
					sublabel="total înscrieri"
				/>
				<KPI_CARD
					icon={iconComplete}
					label="Rata finalizare cursuri"
					value={`${kpis.completionRate}%`}
					sublabel="completate"
					variant="highlight"
				/>
				<KPI_CARD
					icon={iconCourses}
					label="Cursuri cu activitate"
					value={kpis.activeCourses}
					sublabel="cu cel puțin o înscriere"
				/>
				<KPI_CARD
					icon={iconTest}
					label="Încercări teste"
					value={kpis.testAttempts.toLocaleString()}
					sublabel="rezultate trimise"
				/>
				<KPI_CARD
					icon={iconPass}
					label="Rata promovare teste"
					value={`${kpis.passRate}%`}
					sublabel="promovați"
					variant="success"
				/>
			</section>

			{/* Filters */}
			<div className="stats-filters">
				<div className="stats-filters__group">
					<label htmlFor="stats-course" className="stats-filters__label">
						Curs
					</label>
					<select
						id="stats-course"
						className="stats-filters__select"
						value={courseFilter}
						onChange={(e) => setCourseFilter(e.target.value)}
					>
						<option value="">Toate cursurile</option>
						{courses.map((c) => (
							<option key={c.id} value={c.id}>
								{c.title}
							</option>
						))}
					</select>
				</div>
				<div className="stats-filters__group">
					<label htmlFor="stats-student" className="stats-filters__label">
						Student
					</label>
					<select
						id="stats-student"
						className="stats-filters__select"
						value={studentFilter}
						onChange={(e) => setStudentFilter(e.target.value)}
					>
						<option value="">Toți studenții</option>
						{students.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name} ({s.email})
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Cursuri */}
			<section className="stats-section" aria-labelledby="stats-courses-title">
				<div className="stats-section__head">
					<h2 id="stats-courses-title" className="stats-section__title">
						Progres pe cursuri
					</h2>
					<p className="stats-section__desc">
						Progres mediu și număr de finalizări per curs. Deschide un rând pentru lista de studenți.
					</p>
				</div>
				<div className="stats-table-wrap">
					<table className="stats-table stats-table--courses">
						<thead>
							<tr>
								<th className="stats-table__th-expand" aria-label="Expandare" />
								<th>Curs</th>
								<th>Înscriși</th>
								<th>Progres mediu</th>
								<th>Finalizări</th>
							</tr>
						</thead>
						<tbody>
							{courseSummaries.length === 0 ? (
								<tr>
									<td colSpan={5} className="stats-table__empty">
										Niciun curs cu înscrieri care să corespundă filtrelor.
									</td>
								</tr>
							) : (
								courseSummaries.map((row) => {
									const isOpen = expandedCourses.has(row.course_id);
									return (
										<React.Fragment key={row.course_id}>
											<tr
												className="stats-table__row-click"
												onClick={() => toggleCourse(row.course_id)}
												role="button"
												tabIndex={0}
												onKeyDown={(e) => e.key === 'Enter' && toggleCourse(row.course_id)}
												aria-expanded={isOpen}
											>
												<td className="stats-table__td-expand">
													<span className={`stats-table__chevron ${isOpen ? 'is-open' : ''}`} aria-hidden>
														▼
													</span>
												</td>
												<td className="stats-table__cell-title">{row.course_title}</td>
												<td>{row.enrolled_count}</td>
												<td>
													<div className="stats-progress">
														<div className="stats-progress__bar">
															<div
																className="stats-progress__fill"
																style={{ width: `${row.avg_progress}%` }}
															/>
														</div>
														<span className="stats-progress__text">{row.avg_progress}%</span>
													</div>
												</td>
												<td>
													<span className="stats-badge">
														{row.completed_count} / {row.enrolled_count} finalizat
													</span>
												</td>
											</tr>
											{isOpen && (
												<tr className="stats-table__expanded">
													<td colSpan={5} className="stats-table__expanded-cell">
														<div className="stats-table__expanded-inner">
															<table className="stats-inner-table">
																<thead>
																	<tr>
																		<th>Student</th>
																		<th>Progres</th>
																		<th>Finalizat la</th>
																	</tr>
																</thead>
																<tbody>
																	{row.enrollments.map((e) => {
																		const s = studentsById[e.user_id];
																		return (
																			<tr key={e.user_id}>
																				<td>
																					<div className="stats-cell-student">
																						<span className="stats-cell-student__name">{s?.name || `#${e.user_id}`}</span>
																						{s?.email && (
																							<span className="stats-cell-student__email">{s.email}</span>
																						)}
																					</div>
																				</td>
																				<td>
																					<div className="stats-progress">
																						<div className="stats-progress__bar">
																							<div
																								className="stats-progress__fill"
																								style={{ width: `${e.progress_percentage ?? 0}%` }}
																							/>
																						</div>
																						<span className="stats-progress__text">{e.progress_percentage ?? 0}%</span>
																					</div>
																				</td>
																				<td>{formatDate(e.completed_at)}</td>
																			</tr>
																		);
																	})}
																</tbody>
															</table>
														</div>
													</td>
												</tr>
											)}
										</React.Fragment>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</section>

			{/* Teste */}
			<section className="stats-section" aria-labelledby="stats-tests-title">
				<div className="stats-section__head">
					<h2 id="stats-tests-title" className="stats-section__title">
						Rezultate teste
					</h2>
					<p className="stats-section__desc">
						Scor mediu și rata de promovare per test. Deschide un rând pentru detalii per student.
					</p>
				</div>
				<div className="stats-table-wrap">
					<table className="stats-table stats-table--tests">
						<thead>
							<tr>
								<th className="stats-table__th-expand" aria-label="Expandare" />
								<th>Test</th>
								<th>Participanți</th>
								<th>Scor mediu</th>
								<th>Promovați</th>
							</tr>
						</thead>
						<tbody>
							{testSummaries.length === 0 ? (
								<tr>
									<td colSpan={5} className="stats-table__empty">
										Niciun rezultat la teste care să corespundă filtrelor.
									</td>
								</tr>
							) : (
								testSummaries.map((row) => {
									const isOpen = expandedTests.has(row.test_id);
									return (
										<React.Fragment key={row.test_id}>
											<tr
												className="stats-table__row-click"
												onClick={() => toggleTest(row.test_id)}
												role="button"
												tabIndex={0}
												onKeyDown={(e) => e.key === 'Enter' && toggleTest(row.test_id)}
												aria-expanded={isOpen}
											>
												<td className="stats-table__td-expand">
													<span className={`stats-table__chevron ${isOpen ? 'is-open' : ''}`} aria-hidden>
														▼
													</span>
												</td>
												<td className="stats-table__cell-title">{row.test_title}</td>
												<td>{row.participants_count}</td>
												<td>{row.avg_percentage != null ? `${row.avg_percentage}%` : '—'}</td>
												<td>
													<span className="stats-badge">
														{row.passed_count} / {row.participants_count} promovat
													</span>
												</td>
											</tr>
											{isOpen && (
												<tr className="stats-table__expanded">
													<td colSpan={5} className="stats-table__expanded-cell">
														<div className="stats-table__expanded-inner">
															<table className="stats-inner-table">
																<thead>
																	<tr>
																		<th>Student</th>
																		<th>Întrebări corecte</th>
																		<th>Scor</th>
																		<th>Rezultat</th>
																		<th>Data</th>
																	</tr>
																</thead>
																<tbody>
																	{row.results.map((r) => {
																		const s = studentsById[r.user_id];
																		const questionsCorrect =
																			r.total_questions != null && r.correct_answers_count != null
																				? `${r.correct_answers_count} / ${r.total_questions}`
																				: '—';
																		const pct =
																			r.percentage != null
																				? `${r.percentage}%`
																				: r.score != null && r.max_score != null
																					? `${r.score}/${r.max_score}`
																					: '—';
																		return (
																			<tr key={`${r.user_id}-${r.test_id}`}>
																				<td>
																					<div className="stats-cell-student">
																						<span className="stats-cell-student__name">{s?.name || `#${r.user_id}`}</span>
																						{s?.email && (
																							<span className="stats-cell-student__email">{s.email}</span>
																						)}
																					</div>
																				</td>
																				<td>{questionsCorrect}</td>
																				<td>{pct}</td>
																				<td>
																					<span className={`stats-badge stats-badge--${r.passed ? 'passed' : 'failed'}`}>
																						{r.passed ? 'Promovat' : 'Nepromovat'}
																					</span>
																				</td>
																				<td>{formatDate(r.completed_at)}</td>
																			</tr>
																		);
																	})}
																</tbody>
															</table>
														</div>
													</td>
												</tr>
											)}
										</React.Fragment>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
};

export default AdminStatisticsPage;
