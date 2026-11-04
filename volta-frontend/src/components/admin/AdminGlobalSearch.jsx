import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/api';

const MIN_CHARS = 2;
const LIMIT = 5;

const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

/**
 * Căutarea din bara de sus: utilizatori, cursuri și evenimente, din listele de admin existente
 * (aceeași căutare fără majuscule/diacritice ca în pagini). Enter deschide primul rezultat.
 */
const AdminGlobalSearch = ({ canSearchUsers = true, canSearchEvents = true }) => {
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);
	// rezultatele țin minte pentru ce text au venit: cât timp diferă de textul curent, căutarea e în curs
	const [result, setResult] = useState({ term: '', groups: [] });
	const [active, setActive] = useState(0);
	const boxRef = useRef(null);
	const requestRef = useRef(0);

	const term = query.trim();

	useEffect(() => {
		if (term.length < MIN_CHARS) return undefined;
		const requestId = ++requestRef.current;
		const timer = setTimeout(async () => {
			const [users, courses, events] = await Promise.allSettled([
				canSearchUsers ? adminService.getUsers({ search: term, per_page: LIMIT, page: 1 }) : Promise.resolve([]),
				adminService.getCourses({ search: term, status: 'all', per_page: LIMIT }),
				canSearchEvents ? adminService.getEvents({ search: term, per_page: LIMIT }) : Promise.resolve([]),
			]);
			if (requestId !== requestRef.current) return;
			const pick = (result) => (result.status === 'fulfilled' ? listOf(result.value).slice(0, LIMIT) : []);
			setResult({ term, groups: [
				{
					label: 'Utilizatori',
					items: pick(users).map((u) => ({ key: `u${u.id}`, title: u.name, meta: u.email, to: `/admin/users/${u.id}/profile` })),
				},
				{
					label: 'Cursuri',
					items: pick(courses).map((c) => ({ key: `c${c.id}`, title: c.title, meta: c.status === 'published' ? 'Publicat' : 'Ciornă', to: `/admin/courses/${c.id}` })),
				},
				{
					label: 'Evenimente',
					items: pick(events).map((e) => ({
						key: `e${e.id}`,
						title: e.title,
						meta: e.start_date ? new Date(e.start_date).toLocaleDateString('ro-RO') : '',
						to: `/admin/events?search=${encodeURIComponent(e.title || '')}`,
					})),
				},
			].filter((group) => group.items.length > 0) });
			setActive(0);
		}, 250);
		return () => clearTimeout(timer);
	}, [term, canSearchUsers, canSearchEvents]);

	useEffect(() => {
		const onClick = (event) => {
			if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
		};
		document.addEventListener('mousedown', onClick);
		return () => document.removeEventListener('mousedown', onClick);
	}, []);

	const loading = term.length >= MIN_CHARS && result.term !== term;
	const groups = loading ? [] : result.groups;
	const flat = groups.flatMap((group) => group.items);
	const indexOf = new Map(flat.map((item, i) => [item.key, i]));

	const go = (item) => {
		if (!item) return;
		setOpen(false);
		setQuery('');
		navigate(item.to);
	};

	const onKeyDown = (event) => {
		if (event.key === 'Escape') {
			setOpen(false);
			return;
		}
		if (!flat.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setActive((i) => (i + 1) % flat.length);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActive((i) => (i - 1 + flat.length) % flat.length);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			go(flat[active]);
		}
	};

	const showPanel = open && term.length >= MIN_CHARS;

	return (
		<div className="admin-topnav-search" ref={boxRef}>
			<input
				type="search"
				placeholder="Caută utilizatori, cursuri, evenimente..."
				value={query}
				onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
				onFocus={() => setOpen(true)}
				onKeyDown={onKeyDown}
				className="admin-topnav-search-input"
				aria-label="Caută utilizatori, cursuri, evenimente"
				role="combobox"
				aria-expanded={showPanel}
				aria-controls="admin-global-search-results"
				autoComplete="off"
			/>
			{showPanel ? (
				<div className="admin-global-search-panel" id="admin-global-search-results" role="listbox">
					{loading && flat.length === 0 ? <p className="admin-global-search-empty">Se caută…</p> : null}
					{!loading && flat.length === 0 ? <p className="admin-global-search-empty">Niciun rezultat pentru „{term}”.</p> : null}
					{groups.map((group) => (
						<div key={group.label} className="admin-global-search-group">
							<p className="admin-global-search-group-label">{group.label}</p>
							{group.items.map((item) => {
								const itemIndex = indexOf.get(item.key);
								return (
									<button
										type="button"
										key={item.key}
										role="option"
										aria-selected={itemIndex === active}
										className={`admin-global-search-item${itemIndex === active ? ' is-active' : ''}`}
										onMouseEnter={() => setActive(itemIndex)}
										onClick={() => go(item)}
									>
										<span className="admin-global-search-item-title">{item.title}</span>
										{item.meta ? <span className="admin-global-search-item-meta">{item.meta}</span> : null}
									</button>
								);
							})}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
};

export default AdminGlobalSearch;
