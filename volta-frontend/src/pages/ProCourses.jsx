import React, { useMemo, useState } from 'react';
import CourseCard from '../components/ui/CourseCard';

const demoCourses = new Array(12).fill(0).map((_, i) => ({
	id: i + 1,
	title: `Course ${i + 1} — Learn Something Awesome`,
	instructor: ['Jane Doe', 'John Smith', 'Alex Roe'][i % 3],
	image: `https://picsum.photos/seed/course${i+1}/600/400`,
	category: ['Development', 'Design', 'Business'][i % 3],
	progress: Math.round(Math.random() * 100),
	popularity: (Math.random() * 2 + 3).toFixed(1),
	trend: [10, 20, 40, Math.round(Math.random() * 100)]
}));

const unique = (arr) => Array.from(new Set(arr));

const ProCourses = () => {
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState('All');
	const [sort, setSort] = useState('popular');

	const categories = useMemo(() => ['All', ...unique(demoCourses.map(c => c.category))], []);

	const filtered = useMemo(() => {
		let out = demoCourses.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));
		if (category !== 'All') out = out.filter(c => c.category === category);
		if (sort === 'popular') out.sort((a, b) => b.popularity - a.popularity);
		if (sort === 'progress') out.sort((a, b) => b.progress - a.progress);
		if (sort === 'newest') out = out.slice().reverse();
		return out;
	}, [query, category, sort]);

	return (
		<div className="pro-page pro-courses-page">
			<aside className="pro-sidebar" aria-label="Main navigation">
				<div className="pro-brand">Volta Pro</div>
				<nav className="pro-nav">
					<a href="/home" className="pro-nav-item">Home</a>
					<a href="/pro-courses" className="pro-nav-item active">Courses</a>
					<a href="/events" className="pro-nav-item">Events</a>
					<a href="/profile" className="pro-nav-item">Profile</a>
				</nav>
			</aside>

			<main className="pro-main">
				<header className="pro-hero small">
					<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
						<h1 className="pro-title">Courses</h1>
						<p className="pro-subtitle">Explore courses and continue learning</p>
					</div>

					<div className="pro-filters">
						<input className="pro-input" placeholder="Search courses..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search courses" />
						<select className="pro-select" value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">
							{categories.map(c => <option key={c} value={c}>{c}</option>)}
						</select>
						<select className="pro-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort courses">
							<option value="popular">Most Popular</option>
							<option value="progress">Progress</option>
							<option value="newest">Newest</option>
						</select>
					</div>
				</header>

				<section className="pro-section">
					{filtered.length === 0 ? (
						<div className="pro-empty">No courses match your search.</div>
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
