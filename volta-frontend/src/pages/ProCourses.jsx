import React, { useMemo, useState } from 'react';
import CourseCard from '../components/ui/CourseCard';

const demoCourses = new Array(12).fill(0).map((_, i) => ({
	id: i + 1,
	title: `Course ${i + 1} — Learn Something Awesome`,
	instructor: ['Jane Doe', 'John Smith', 'Alex Roe'][i % 3],
	image: `https://picsum.photos/seed/course${i+1}/600/400`,
	category: ['Dezvoltare', 'Design', 'Afaceri'][i % 3],
	progress: Math.round(Math.random() * 100),
	popularity: (Math.random() * 2 + 3).toFixed(1),
	trend: [10, 20, 40, Math.round(Math.random() * 100)]
}));

const unique = (arr) => Array.from(new Set(arr));

const ProCourses = () => {
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('Toate');
	const [sort, setSort] = useState('popular');

	const categories = useMemo(() => ['Toate', ...unique(demoCourses.map(c => c.category))], []);

	const filtered = useMemo(() => {
		let out = demoCourses.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));
		if (category !== 'Toate') out = out.filter(c => c.category === category);
		if (sort === 'popular') out.sort((a, b) => b.popularity - a.popularity);
		if (sort === 'progress') out.sort((a, b) => b.progress - a.progress);
		if (sort === 'newest') out = out.slice().reverse();
		return out;
	}, [query, category, sort]);

	return (
		<div className="pro-page pro-courses-page">
			<aside className="pro-sidebar" aria-label="Navigare principală">
				<div className="pro-brand">Volta Pro</div>
				<nav className="pro-nav">
					<a href="/home" className="pro-nav-item">Acasă</a>
					<a href="/pro-courses" className="pro-nav-item active">Cursuri</a>
					<a href="/events" className="pro-nav-item">Evenimente</a>
					<a href="/profile" className="pro-nav-item">Profil</a>
				</nav>
			</aside>

			<main className="pro-main">
				<header className="pro-hero small">
					<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
						<h1 className="pro-title">Cursuri</h1>
						<p className="pro-subtitle">Explorează cursurile și continuă să înveți</p>
					</div>

					<div className="pro-filters">
						<input className="pro-input" placeholder="Caută cursuri..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Caută cursuri" />
						<select className="pro-select" value={category} onChange={e => setCategory(e.target.value)} aria-label="Filtrează după categorie">
							{categories.map(c => <option key={c} value={c}>{c}</option>)}
						</select>
						<select className="pro-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sortează cursuri">
							<option value="popular">Cele mai populare</option>
							<option value="progress">Progres</option>
							<option value="newest">Cele mai noi</option>
						</select>
					</div>
				</header>

				<section className="pro-section">
					{filtered.length === 0 ? (
						<div className="pro-empty">Niciun curs nu corespunde căutării.</div>
					) : (
						<div className="pro-course-grid">
							{filtered.map(c => (
								<CourseCard key={c.id} course={c} onStart={(course) => console.log('Start', course)} />
							))}
						</div>
					)}
				</section>
			</main>
		</div>
	);
};

export default ProCourses;
