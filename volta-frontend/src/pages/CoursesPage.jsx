import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseMapsService, adminService, examService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { mapFolderCardImageUrl } from '../utils/imageUrl';
import { CourseShowcaseCard, COURSE_SHOWCASE_FALLBACK_IMAGE } from '../components/ui/course-showcase-card';
import { hexToHslSpace } from '../lib/hexToHsl';
import './CoursesPage.css';

const COURSE_MAP_ACCENT_COLORS = [
	'#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f43f5e', '#0ea5e9',
];

const CoursesPage = () => {
	const navigate = useNavigate();
	const { user, loading: authLoading } = useAuth();
	const isAdmin = user?.role === 'admin' || user?.role === 'instructor';

	const [courseMaps, setCourseMaps] = useState([]);
	const [standaloneExams, setStandaloneExams] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const fetchingRef = useRef(false);

	useEffect(() => {
		if (fetchingRef.current || authLoading) return;

		const fetchCourses = async () => {
			if (fetchingRef.current) return;
			fetchingRef.current = true;

			try {
				setLoading(true);
				setError(null);

				if (isAdmin) {
					const mapsData = await adminService.getCourseMaps({ per_page: 100, include_virtual: 1 });
					const list = mapsData?.data ?? (Array.isArray(mapsData) ? mapsData : []);
					setCourseMaps(Array.isArray(list) ? list : []);
				} else {
					const mapsData = await courseMapsService.getMaps();
					setCourseMaps(Array.isArray(mapsData) ? mapsData : []);
				}

				try {
					const examRows = await examService.listStandaloneExams();
					setStandaloneExams(Array.isArray(examRows) ? examRows : []);
				} catch (examErr) {
					console.error('Error fetching standalone exams:', examErr);
					setStandaloneExams([]);
				}
			} catch (err) {
				console.error('Error fetching courses:', err);
				setError('Nu s-au putut incarca mapele.');
			} finally {
				setLoading(false);
				fetchingRef.current = false;
			}
		};

		fetchCourses();
	}, [authLoading, isAdmin]);

	const filteredCourseMaps = useMemo(() => {
		let rows = Array.isArray(courseMaps) ? [...courseMaps] : [];
		if (!isAdmin) {
			rows = rows.filter((map) => !map?.is_virtual && String(map?.id) !== 'unassigned');
		}
		if (searchQuery.trim()) {
			const needle = searchQuery.trim().toLowerCase();
			rows = rows.filter((map) =>
				String(map?.name || '').toLowerCase().includes(needle) ||
				String(map?.description || '').toLowerCase().includes(needle)
			);
		}
		return rows;
	}, [courseMaps, searchQuery, isAdmin]);

	const filteredStandaloneExams = useMemo(() => {
		let rows = Array.isArray(standaloneExams) ? [...standaloneExams] : [];
		if (searchQuery.trim()) {
			const needle = searchQuery.trim().toLowerCase();
			rows = rows.filter((ex) =>
				String(ex?.title || '').toLowerCase().includes(needle) ||
				String(ex?.description || '').toLowerCase().includes(needle)
			);
		}
		return rows;
	}, [standaloneExams, searchQuery]);

	if (loading || authLoading) {
		return (
			<div className="courses-page-modern">
				<div className="courses-page-loading">
					<div className="courses-page-spinner" />
					<p>Se incarca cursurile...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="courses-page-modern">
				<div className="courses-page-error">
					<div className="courses-page-error-icon">!</div>
					<h2>Eroare</h2>
					<p>{error}</p>
					<button
						className="courses-page-btn courses-page-btn-primary"
						onClick={() => window.location.reload()}
					>
						Incearca din nou
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={`courses-page-modern ${!isAdmin ? 'courses-page-student' : ''}`}>
			<div className={!isAdmin ? 'courses-page-student-main' : undefined}>
				<div className="courses-page-hero">
					<div className="courses-page-hero-content">
						<div className="courses-page-hero-text">
							<h1 className="courses-page-hero-title">Mape cursuri</h1>
							{!isAdmin && (
								<p className="courses-page-student-blurb">
									<strong>Mapele</strong> sunt parcursurile cu lectii.{' '}
									<strong>Examenele independente</strong> (daca apar mai jos) nu sunt legate de un curs - le deschizi direct de aici.{' '}
									Testele dintr-un curs raman in pagina acelui curs.
								</p>
							)}
						</div>
						<div className="courses-page-search-wrapper courses-page-hero-search">
							<svg className="courses-page-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="11" cy="11" r="8" />
								<path d="m21 21-4.35-4.35" />
							</svg>
							<input
								type="text"
								className="courses-page-search-input"
								placeholder="Cauta mape sau examene..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
							{searchQuery && (
								<button
									type="button"
									className="courses-page-search-clear"
									onClick={() => setSearchQuery('')}
									aria-label="Goleste cautarea"
								>
									X
								</button>
							)}
						</div>
						{isAdmin && (
							<div className="courses-page-admin-hero-actions">
								<button
									className="courses-page-create-btn courses-page-create-btn-secondary"
									onClick={() => navigate('/admin/content?tab=course-maps')}
								>
									<span>Administrare mape</span>
								</button>
								<button
									className="courses-page-create-btn"
									onClick={() => navigate('/admin/courses/new')}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
										<path d="M12 5v14M5 12h14" />
									</svg>
									<span>Creeaza Curs Nou</span>
								</button>
							</div>
						)}
					</div>
				</div>

				<div className="courses-page-content">
					<div className="courses-page-maps-grid">
						{filteredCourseMaps.map((map, index) => {
							const accentColor = map.accent_color || COURSE_MAP_ACCENT_COLORS[index % COURSE_MAP_ACCENT_COLORS.length];
							const courseCount = map.courses_count ?? 0;
							const descriptionLine = map.description?.trim() ? String(map.description).trim() : null;
							const isVirtualMap = Boolean(map?.is_virtual) || String(map?.id || '') === 'unassigned';
							const imageUrl = mapFolderCardImageUrl(map) || COURSE_SHOWCASE_FALLBACK_IMAGE;
							const subtitleParts = [];
							if (descriptionLine) subtitleParts.push(descriptionLine);
							subtitleParts.push(`${courseCount} ${courseCount === 1 ? 'curs' : 'cursuri'}`);
							const subtitle = subtitleParts.join(' - ');

							return (
								<article key={map.id} className="course-map-card course-map-card--showcase-wrap">
									<CourseShowcaseCard
										className="courses-page-map-card-showcase"
										imageUrl={imageUrl}
										title={map.name || 'Mapa'}
										subtitle={subtitle}
										themeHsl={hexToHslSpace(accentColor)}
										onOpen={() => navigate(`/courses/map/${map.id}`)}
										ctaLabel="Deschide mapa"
										badge={isVirtualMap ? 'Mapa virtuala' : undefined}
									/>
								</article>
							);
						})}

						{filteredCourseMaps.length === 0 ? (
							<div className="courses-page-empty">
								<div className="courses-page-empty-icon">
									<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
										<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
										<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
									</svg>
								</div>
								<h3 className="courses-page-empty-title">
									{searchQuery ? 'Nu am gasit mape' : 'Nu exista mape disponibile'}
								</h3>
								<p className="courses-page-empty-text">
									{searchQuery
										? 'Incearca un alt termen de cautare.'
										: 'Cursurile sunt afisate in interiorul mapelor.'}
								</p>
								{searchQuery ? (
									<button
										className="courses-page-btn courses-page-btn-secondary"
										onClick={() => setSearchQuery('')}
									>
										Goleste cautarea
									</button>
								) : (
									isAdmin && (
										<button
											className="courses-page-btn courses-page-btn-primary"
											onClick={() => navigate('/admin/content?tab=course-maps')}
										>
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M12 5v14M5 12h14" />
											</svg>
											<span>Creeaza prima mapa</span>
										</button>
									)
								)}
							</div>
						) : null}
					</div>

					{!isAdmin && filteredStandaloneExams.length > 0 ? (
						<section className="courses-page-exams-section" aria-labelledby="courses-page-exams-heading">
							<div className="courses-page-exams-section-head">
								<h2 id="courses-page-exams-heading" className="courses-page-exams-heading">
									Examene independente
								</h2>
								<p className="courses-page-exams-intro">
									Fara legatura cu mapele de mai sus - acces direct la evaluare.
								</p>
							</div>
							<div className="courses-page-exams-grid">
								{filteredStandaloneExams.map((ex, index) => {
									const accentColor = COURSE_MAP_ACCENT_COLORS[(index + 3) % COURSE_MAP_ACCENT_COLORS.length];
									return (
										<article
											key={ex.id}
											className="course-standalone-exam-card"
											onClick={() => navigate(`/exams/${ex.id}`)}
											role="button"
											tabIndex={0}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													navigate(`/exams/${ex.id}`);
												}
											}}
										>
											<div className="course-standalone-exam-card-body">
												<div
													className="course-standalone-exam-card-icon-wrap"
													style={{ '--map-accent': accentColor }}
												>
													<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
														<polyline points="14 2 14 8 20 8" />
														<line x1="9" y1="15" x2="15" y2="15" />
													</svg>
												</div>
												<div className="course-standalone-exam-card-content">
													<h3 className="course-standalone-exam-card-title">{ex.title || 'Examen'}</h3>
													{ex.description ? (
														<p className="course-standalone-exam-card-summary">{ex.description}</p>
													) : (
														<p className="course-standalone-exam-card-summary muted">
															{ex.passing_score != null ? `Punctaj minim: ${ex.passing_score}%` : 'Examen'}
														</p>
													)}
													<div className="course-standalone-exam-card-footer">
														<span className="course-standalone-exam-card-cta">Incepe examenul</span>
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
															<path d="M5 12h14M12 5l7 7-7 7" />
														</svg>
													</div>
												</div>
											</div>
										</article>
									);
								})}
							</div>
						</section>
					) : null}
				</div>
			</div>
		</div>
	);
};

export default CoursesPage;
