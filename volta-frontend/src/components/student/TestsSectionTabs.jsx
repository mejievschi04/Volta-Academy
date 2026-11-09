import React from 'react';
import { NavLink } from 'react-router-dom';
import './TestsSectionTabs.css';

/** Pe telefon, tabul „Teste” are două secțiuni: testele de susținut și rezultatele. */
export default function TestsSectionTabs() {
	const linkClass = ({ isActive }) => `tests-section-tab${isActive ? ' is-active' : ''}`;
	return (
		<nav className="tests-section-tabs" aria-label="Secțiuni teste">
			<NavLink to="/monthly-tests" className={linkClass}>Teste lunare</NavLink>
			<NavLink to="/exam-results" className={linkClass}>Rezultate</NavLink>
		</nav>
	);
}
