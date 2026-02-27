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

	// Latest result per (user_id, test_id)
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

	// --- CURSURI: agregat per curs, la expand = studenți ---
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

	// --- TESTE: unic per test, agregat scor/rezultat; la expand = studenți ---
	const testSummaries = useMemo(() => {
		// Unique tests from test_results (by test_id), with latest result per user for stats
		const byTest = {};
		Object.entries(resultsByUserTest).forEach(([key, r]) => {
			const tid = r.test_id;
			if (!byTest[tid]) {
				byTest[tid] = { test_id: tid, test_title: r.test_title || `Test #${tid}`, results: [] };
			}
			byTest[tid].results.push(r);
		});
		return Object.values(byTest).map(({ test_id, test_title, results }) => {
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
		}).sort((a, b) => a.test_title.localeCompare(b.test_title));
	}, [resultsByUserTest]);

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
			<div className="admin-container">
				<div className="admin-statistics-loading">
					<div className="va-spinner va-spinner-lg" />
					<p>Se încarcă statisticile...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="admin-container">
				<div className="lms-empty-state">
					<p style={{ color: 'var(--color-error)' }}>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container admin-statistics-page">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Statistici</h1>
					<p className="admin-page-subtitle">
						Rezumat cursuri și teste; deschide un rând pentru detalii per student
					</p>
				</div>
			</div>

			<div className="admin-statistics-filters">
				<div className="admin-statistics-filter-group">
					<label htmlFor="stats-course" className="admin-statistics-filter-label">Curs</label>
					<select
						id="stats-course"
						className="admin-statistics-filter-select"
						value={courseFilter}
						onChange={(e) => setCourseFilter(e.target.value)}
					>
						<option value="">Toate cursurile</option>
						{courses.map((c) => (
							<option key={c.id} value={c.id}>{c.title}</option>
						))}
					</select>
				</div>
				<div className="admin-statistics-filter-group">
					<label htmlFor="stats-student" className="admin-statistics-filter-label">Student</label>
					<select
						id="stats-student"
						className="admin-statistics-filter-select"
						value={studentFilter}
						onChange={(e) => setStudentFilter(e.target.value)}
					>
						<option value="">Toți studenții</option>
						{students.map((s) => (
							<option key={s.id} value={s.id}>{s.name} ({s.email})</option>
						))}
					</select>
				</div>
			</div>

			{/* --- Secțiune CURSURI --- */}
			<section className="admin-statistics-section" aria-labelledby="stats-courses-title">
				<h2 id="stats-courses-title" className="admin-statistics-section-title">
					Cursuri
				</h2>
				<p className="admin-statistics-section-desc">
					Scor și rezultat general per curs; deschide rândul pentru lista de studenți
				</p>
				<div className="admin-statistics-table-wrap">
					<table className="admin-statistics-table admin-statistics-table-courses">
						<thead>
							<tr>
								<th className="admin-statistics-th-expand" aria-label="Deschide / închide" />
								<th>Curs</th>
								<th>Înscriși</th>
								<th>Progres mediu</th>
								<th>Rezultat general</th>
							</tr>
						</thead>
						<tbody>
							{courseSummaries.length === 0 ? (
								<tr>
									<td colSpan={5} className="admin-statistics-empty">
										Niciun curs cu înscrieri care să corespundă filtrelor.
									</td>
								</tr>
							) : (
								courseSummaries.map((row) => {
									const isOpen = expandedCourses.has(row.course_id);
									return (
										<React.Fragment key={row.course_id}>
											<tr
												className="admin-statistics-row-clickable"
												onClick={() => toggleCourse(row.course_id)}
												role="button"
												tabIndex={0}
												onKeyDown={(e) => e.key === 'Enter' && toggleCourse(row.course_id)}
												aria-expanded={isOpen}
											>
												<td className="admin-statistics-td-expand">
													<span className={`admin-statistics-chevron ${isOpen ? 'open' : ''}`} aria-hidden>
														▼
													</span>
												</td>
												<td className="admin-statistics-cell-title">{row.course_title}</td>
												<td>{row.enrolled_count}</td>
												<td>
													<div className="admin-statistics-progress">
														<div className="admin-statistics-progress-bar">
															<div
																className="admin-statistics-progress-fill"
																style={{ width: `${row.avg_progress}%` }}
															/>
														</div>
														<span className="admin-statistics-progress-text">{row.avg_progress}%</span>
													</div>
												</td>
												<td>
													<span className="admin-statistics-summary-badge">
														{row.completed_count} / {row.enrolled_count} finalizat
													</span>
												</td>
											</tr>
											{isOpen && (
												<tr className="admin-statistics-expanded-row">
													<td colSpan={5} className="admin-statistics-expanded-cell">
														<div className="admin-statistics-expanded-inner">
															<table className="admin-statistics-inner-table">
																<thead>
																	<tr>
																		<th>Student</th>
																		<th>Progres</th>
																		<th>Finalizat</th>
																	</tr>
																</thead>
																<tbody>
																	{row.enrollments.map((e) => {
																		const s = studentsById[e.user_id];
																		return (
																			<tr key={e.user_id}>
																				<td>
																					<div className="admin-statistics-cell-student">
																						<span className="admin-statistics-cell-name">{s?.name || `#${e.user_id}`}</span>
																						{s?.email && (
																							<span className="admin-statistics-cell-email">{s.email}</span>
																						)}
																					</div>
																				</td>
																				<td>
																					<div className="admin-statistics-progress">
																						<div className="admin-statistics-progress-bar">
																							<div
																								className="admin-statistics-progress-fill"
																								style={{ width: `${e.progress_percentage ?? 0}%` }}
																							/>
																						</div>
																						<span className="admin-statistics-progress-text">{e.progress_percentage ?? 0}%</span>
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

			{/* --- Secțiune TESTE --- */}
			<section className="admin-statistics-section" aria-labelledby="stats-tests-title">
				<h2 id="stats-tests-title" className="admin-statistics-section-title">
					Teste
				</h2>
				<p className="admin-statistics-section-desc">
					Scor și rezultat general per test; deschide rândul pentru lista de studenți
				</p>
				<div className="admin-statistics-table-wrap">
					<table className="admin-statistics-table admin-statistics-table-tests">
						<thead>
							<tr>
								<th className="admin-statistics-th-expand" aria-label="Deschide / închide" />
								<th>Test</th>
								<th>Participanți</th>
								<th>Scor mediu</th>
								<th>Rezultat general</th>
							</tr>
						</thead>
						<tbody>
							{testSummaries.length === 0 ? (
								<tr>
									<td colSpan={5} className="admin-statistics-empty">
										Niciun rezultat la teste care să corespundă filtrelor.
									</td>
								</tr>
							) : (
								testSummaries.map((row) => {
									const isOpen = expandedTests.has(row.test_id);
									return (
										<React.Fragment key={row.test_id}>
											<tr
												className="admin-statistics-row-clickable"
												onClick={() => toggleTest(row.test_id)}
												role="button"
												tabIndex={0}
												onKeyDown={(e) => e.key === 'Enter' && toggleTest(row.test_id)}
												aria-expanded={isOpen}
											>
												<td className="admin-statistics-td-expand">
													<span className={`admin-statistics-chevron ${isOpen ? 'open' : ''}`} aria-hidden>
														▼
													</span>
												</td>
												<td className="admin-statistics-cell-title">{row.test_title}</td>
												<td>{row.participants_count}</td>
												<td>
													{row.avg_percentage != null ? `${row.avg_percentage}%` : '—'}
												</td>
												<td>
													<span className="admin-statistics-summary-badge">
														{row.passed_count} / {row.participants_count} promovat
													</span>
												</td>
											</tr>
											{isOpen && (
												<tr className="admin-statistics-expanded-row">
													<td colSpan={5} className="admin-statistics-expanded-cell">
														<div className="admin-statistics-expanded-inner">
															<table className="admin-statistics-inner-table">
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
																		const questionsCorrect = r.total_questions != null && r.correct_answers_count != null
																			? `${r.correct_answers_count} / ${r.total_questions} întrebări corecte`
																			: '—';
																		const pct = r.percentage != null ? `${r.percentage}%` : (r.score != null && r.max_score != null ? `${r.score}/${r.max_score}` : '—');
																		return (
																			<tr key={`${r.user_id}-${r.test_id}`}>
																				<td>
																					<div className="admin-statistics-cell-student">
																						<span className="admin-statistics-cell-name">{s?.name || `#${r.user_id}`}</span>
																						{s?.email && (
																							<span className="admin-statistics-cell-email">{s.email}</span>
																						)}
																					</div>
																				</td>
																				<td>{questionsCorrect}</td>
																				<td>{pct}</td>
																				<td>
																					<span className={`admin-statistics-test-badge ${r.passed ? 'passed' : 'failed'}`}>
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
