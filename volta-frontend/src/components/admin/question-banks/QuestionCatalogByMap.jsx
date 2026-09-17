import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, FolderOpen, ListChecks, Map as MapIcon, Search } from 'lucide-react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContextShared.js';
import Drawer from './Drawer';
import QuestionRow from './QuestionRow';

function stripHtml(value = '') {
	return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesQuery(haystack, query) {
	if (!query) return true;
	return String(haystack || '').toLowerCase().includes(query);
}

const CatalogGroupCard = ({ title, description, stats, onOpen, icon }) => (
	<button type="button" className="qb-folder-card" onClick={onOpen}>
		<div className="qb-folder-icon" aria-hidden>
			{icon}
		</div>
		<div className="qb-folder-body">
			<strong className="qb-folder-title">{title}</strong>
			{description ? <p className="qb-folder-description">{description}</p> : null}
		</div>
		<div className="qb-folder-stats">
			{stats.map((stat) => (
				<span key={stat}>{stat}</span>
			))}
		</div>
		<span className="qb-folder-open" aria-hidden>
			<ArrowRight size={18} />
		</span>
	</button>
);

export default function QuestionCatalogByMap() {
	const { error } = useToast();
	const [level, setLevel] = useState('maps');
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(false);
	const [maps, setMaps] = useState([]);
	const [tests, setTests] = useState([]);
	const [questions, setQuestions] = useState([]);
	const [selectedMap, setSelectedMap] = useState(null);
	const [selectedTest, setSelectedTest] = useState(null);
	const [drawerQuestion, setDrawerQuestion] = useState(null);

	const query = search.trim().toLowerCase();

	const loadMaps = useCallback(async () => {
		setLoading(true);
		try {
			setMaps(await adminService.getQuestionCatalogMaps());
		} catch {
			error('Nu am putut încărca mapele din catalog.');
			setMaps([]);
		} finally {
			setLoading(false);
		}
	}, [error]);

	useEffect(() => {
		loadMaps();
	}, [loadMaps]);

	const openMap = async (map) => {
		setSelectedMap(map);
		setSelectedTest(null);
		setQuestions([]);
		setSearch('');
		setLevel('tests');
		setLoading(true);
		try {
			const res = await adminService.getQuestionCatalogMapTests(map.id);
			setTests(Array.isArray(res?.data) ? res.data : []);
			if (res?.map?.name) {
				setSelectedMap((prev) => ({ ...prev, name: res.map.name }));
			}
		} catch {
			error('Nu am putut încărca testele din mapă.');
			setTests([]);
		} finally {
			setLoading(false);
		}
	};

	const openTest = async (test) => {
		setSelectedTest(test);
		setSearch('');
		setLevel('questions');
		setLoading(true);
		try {
			const rows = await adminService.getQuestions(test.id);
			setQuestions(Array.isArray(rows) ? rows : []);
		} catch {
			error('Nu am putut încărca întrebările testului.');
			setQuestions([]);
		} finally {
			setLoading(false);
		}
	};

	const filteredMaps = useMemo(
		() => maps.filter((map) => matchesQuery(`${map.name} ${map.description || ''}`, query)),
		[maps, query]
	);
	const filteredTests = useMemo(
		() => tests.filter((test) => matchesQuery(`${test.title} ${test.courses_label || ''} ${test.description || ''}`, query)),
		[tests, query]
	);
	const filteredQuestions = useMemo(
		() => questions.filter((question) => matchesQuery(stripHtml(question?.content || ''), query)),
		[questions, query]
	);

	const searchPlaceholder =
		level === 'maps' ? 'Caută mapă' : level === 'tests' ? 'Caută test' : 'Caută întrebare';

	return (
		<>
			<div className="qb-catalog-topbar">
				<div className="qb-search-field">
					<Search size={18} aria-hidden />
					<label className="qb-sr-only" htmlFor="qb-map-catalog-search">
						{searchPlaceholder}
					</label>
					<input
						id="qb-map-catalog-search"
						className="admin-form-input qb-search-input"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={searchPlaceholder}
					/>
				</div>
			</div>

			<div className="qb-catalog-nav">
				{level !== 'maps' ? (
					<button
						type="button"
						className="qb-catalog-back btn-sm"
						onClick={() => {
							if (level === 'questions') {
								setLevel('tests');
								setSelectedTest(null);
								setQuestions([]);
							} else {
								setLevel('maps');
								setSelectedMap(null);
								setTests([]);
							}
							setSearch('');
						}}
					>
						<ArrowLeft size={14} aria-hidden />
						Înapoi
					</button>
				) : null}
				<nav className="qb-catalog-crumbs" aria-label="Navigare catalog">
					<button
						type="button"
						className={`qb-crumb ${level === 'maps' ? 'is-active' : ''}`}
						onClick={() => {
							setLevel('maps');
							setSelectedMap(null);
							setSelectedTest(null);
							setSearch('');
						}}
					>
						Mape
					</button>
					{selectedMap ? (
						<>
							<span aria-hidden>/</span>
							<button
								type="button"
								className={`qb-crumb ${level === 'tests' ? 'is-active' : ''}`}
								onClick={() => {
									setLevel('tests');
									setSelectedTest(null);
									setSearch('');
								}}
							>
								{selectedMap.name}
							</button>
						</>
					) : null}
					{selectedTest ? (
						<>
							<span aria-hidden>/</span>
							<span className={`qb-crumb ${level === 'questions' ? 'is-active' : ''}`}>{selectedTest.title}</span>
						</>
					) : null}
				</nav>
			</div>

			{loading ? (
				<div className="qb-catalog-loading qb-catalog-loading--inline">
					<span className="qb-spinner" aria-hidden />
					Se încarcă...
				</div>
			) : level === 'maps' ? (
				filteredMaps.length ? (
					<section className="qb-folder-list" aria-label="Mape">
						{filteredMaps.map((map) => (
							<CatalogGroupCard
								key={map.id}
								title={map.name}
								description={map.description}
								icon={<MapIcon size={22} />}
								stats={[
									`${map.courses_count || 0} cursuri`,
									`${map.tests_count || 0} teste`,
									`${map.questions_count || 0} întrebări`,
								]}
								onOpen={() => openMap(map)}
							/>
						))}
					</section>
				) : (
					<div className="qb-empty qb-empty--soft">
						<FolderOpen size={30} aria-hidden />
						<p className="qb-empty-title">Nicio mapă găsită</p>
						<p className="qb-empty-hint">Creează mape și atașează cursuri ca să apară testele aici.</p>
					</div>
				)
			) : level === 'tests' ? (
				filteredTests.length ? (
					<section className="qb-folder-list" aria-label="Teste din mapă">
						{filteredTests.map((test) => (
							<CatalogGroupCard
								key={test.id}
								title={test.title}
								description={test.courses_label || 'Fără curs atașat'}
								icon={<ClipboardList size={22} />}
								stats={[`${test.questions_count || 0} întrebări`]}
								onOpen={() => openTest(test)}
							/>
						))}
					</section>
				) : (
					<div className="qb-empty qb-empty--soft">
						<ClipboardList size={30} aria-hidden />
						<p className="qb-empty-title">Niciun test în această mapă</p>
						<p className="qb-empty-hint">Atașează teste la cursurile din mapă ca să le vezi aici.</p>
					</div>
				)
			) : filteredQuestions.length ? (
				<div className="qb-questions-list qb-questions-list--readonly" role="list" aria-label="Întrebări test">
					{filteredQuestions.map((question) => (
						<QuestionRow
							key={question.id}
							question={question}
							selected={false}
							readOnly
							onToggleSelect={() => {}}
							onToggleStar={() => {}}
							onOpenDrawer={setDrawerQuestion}
						/>
					))}
				</div>
			) : (
				<div className="qb-empty qb-empty--soft">
					<ListChecks size={30} aria-hidden />
					<p className="qb-empty-title">Nicio întrebare în acest test</p>
					<p className="qb-empty-hint">Adaugă întrebări din editorul de teste.</p>
				</div>
			)}

			<Drawer open={Boolean(drawerQuestion)} question={drawerQuestion} onClose={() => setDrawerQuestion(null)} />
		</>
	);
}
