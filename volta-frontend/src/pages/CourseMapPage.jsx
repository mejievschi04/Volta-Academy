import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseMapsService } from '../services/api';
import { toImageUrl } from '../utils/imageUrl';
import './CourseMapPage.css';

/**
 * Pagina unei mape de cursuri (folder).
 * Design: header verde cu titlul mapei, grid de carduri curs (imagine, vizualizări, durată, titlu, progres, Începe).
 */
function formatDuration(minutes) {
	if (!minutes || minutes < 1) return '—';
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} h ${m} min` : `${h} h`;
}

const CourseMapPage = () => {
	const { mapId } = useParams();
	const navigate = useNavigate();
	const [map, setMap] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		let cancelled = false;
		const fetchMap = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await courseMapsService.getMap(mapId);
				if (!cancelled) setMap(data);
			} catch (err) {
				if (!cancelled) setError(err.response?.status === 404 ? 'Mapa nu a fost găsită.' : 'Nu s-a putut încărca mapa.');
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		fetchMap();
		return () => { cancelled = true; };
	}, [mapId]);

	if (loading) {
		return (
			<div className="course-map-page">
				<div className="course-map-page-loading">
					<div className="course-map-page-spinner" />
					<p>Se încarcă...</p>
				</div>
			</div>
		);
	}

	if (error || !map) {
		return (
			<div className="course-map-page">
				<div className="course-map-page-error">
					<p>{error || 'Eroare'}</p>
					<button type="button" className="course-map-page-btn" onClick={() => navigate('/courses')}>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M19 12H5M12 19l-7-7 7-7"/>
						</svg>
						Înapoi la Cursuri
					</button>
				</div>
			</div>
		);
	}

	const { name, description, courses } = map;

	return (
		<div className="course-map-page">
			<header className="course-map-page-header">
				<div className="course-map-page-header-inner">
					<button
						type="button"
						className="course-map-page-back"
						onClick={() => navigate('/courses')}
						aria-label="Înapoi la Cursuri"
						title="Înapoi la Cursuri"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M19 12H5M12 19l-7-7 7-7"/>
						</svg>
					</button>
					<h1 className="course-map-page-title">{name}</h1>
					{description && <p className="course-map-page-description">{description}</p>}
				</div>
			</header>

			<div className="course-map-page-content">
				{courses && courses.length > 0 ? (
					<div className="course-map-page-grid">
						{courses.map((course) => (
							<article
								key={course.id}
								className="course-map-course-card"
								onClick={() => navigate(`/courses/${course.id}`)}
							>
								<div className="course-map-course-card-image">
									{course.image_url ? (
										<img src={toImageUrl(course.image_url)} alt={course.title} loading="lazy" />
									) : (
										<div className="course-map-course-card-placeholder">
											<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
												<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
												<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
											</svg>
										</div>
									)}
								</div>
								<div className="course-map-course-card-meta">
									<span className="course-map-course-card-views" title="Vizualizări">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
											<circle cx="12" cy="12" r="3"/>
										</svg>
										{course.views_count ?? 0}
									</span>
									<span className="course-map-course-card-duration" title="Durată">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
											<circle cx="12" cy="12" r="10"/>
											<path d="M12 6v6l4 2"/>
										</svg>
										{formatDuration(course.estimated_duration_minutes)}
									</span>
								</div>
								<h3 className="course-map-course-card-title">{course.title}</h3>
								<div className="course-map-course-card-footer">
									<span className="course-map-course-card-progress">
										Finisate: {course.progress_percentage ?? 0}%
									</span>
									<button
										type="button"
										className="course-map-course-card-start"
										onClick={(e) => { e.stopPropagation(); navigate(`/courses/${course.id}`); }}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<polygon points="5 3 19 12 5 21 5 3"/>
										</svg>
										Începe
									</button>
								</div>
							</article>
						))}
					</div>
				) : (
					<div className="course-map-page-empty">
						<p>Nu există cursuri în această mapă.</p>
						<button type="button" className="course-map-page-btn" onClick={() => navigate('/courses')}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M19 12H5M12 19l-7-7 7-7"/>
							</svg>
							Înapoi la Cursuri
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

export default CourseMapPage;
