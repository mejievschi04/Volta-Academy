import React, { useCallback, useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { studentActivityService } from '../services/api';
import { useRegisterPageRefresh } from '../contexts/PageRefreshContext';
import {
	getFriendlyLogLine,
	getGroupedLogLine,
	groupActivityLogs,
	activityGroupCount,
	getActionLabelRo,
	ACTION_LABELS_RO,
} from '../utils/activityLogLabels';

const SCOPE_OPTIONS = [
	{ id: 'progress', label: 'Progres (cursuri, lecții, teste)' },
	{ id: 'auth', label: 'Autentificare' },
	{ id: 'all', label: 'Tot' },
];

const ACTION_FILTER_OPTIONS = [
	'',
	'enrolled_course',
	'completed_lesson',
	'completed_course',
	'completed_exam',
	'telemetry.learner_attempt_submitted',
	'logged_in',
	'logged_out',
];

function getIcon(action) {
	if (action === 'completed_course') return '📗';
	if (action === 'completed_lesson') return '📖';
	if (action === 'enrolled_course') return '✨';
	if (action === 'logged_in') return '🔐';
	if (action === 'logged_out') return '🚪';
	if (action === 'completed_exam' || action === 'telemetry.learner_attempt_submitted') return '📝';
	return '•';
}

const StudentActivityPage = () => {
	const [entries, setEntries] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [expandedKey, setExpandedKey] = useState(null);
	const [scope, setScope] = useState('progress');
	const [actionFilter, setActionFilter] = useState('');
	const [pagination, setPagination] = useState({
		current_page: 1,
		last_page: 1,
		per_page: 20,
		total: 0,
	});

	const fetchActivity = useCallback(async ({ silent = false } = {}) => {
		try {
			if (!silent) {
				setLoading(true);
				setError(null);
			}
			const data = await studentActivityService.getActivity({
				page: pagination.current_page,
				per_page: pagination.per_page,
				scope: actionFilter ? undefined : scope,
				action: actionFilter || undefined,
			});
			setEntries(data.data || []);
			setPagination((prev) => ({
				...prev,
				current_page: data.pagination?.current_page ?? prev.current_page,
				last_page: data.pagination?.last_page ?? 1,
				per_page: data.pagination?.per_page ?? prev.per_page,
				total: data.pagination?.total ?? 0,
			}));
		} catch (err) {
			console.error('Error fetching student activity:', err);
			if (!silent) {
				setError('Nu s-a putut încărca activitatea.');
				setEntries([]);
			}
		} finally {
			if (!silent) setLoading(false);
		}
	}, [pagination.current_page, pagination.per_page, scope, actionFilter]);

	useEffect(() => {
		fetchActivity();
	}, [fetchActivity]);

	useRegisterPageRefresh(() => fetchActivity({ silent: true }));

	const groupedEntries = useMemo(
		() => groupActivityLogs(entries.map((entry) => ({ ...entry, user_id: 'me', user: { name: 'Tu' } }))),
		[entries],
	);

	const formatDate = (dateString) => {
		if (!dateString) return '';
		return new Intl.DateTimeFormat('ro-RO', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(dateString));
	};

	const formatTime = (dateString) => {
		if (!dateString) return '';
		return new Intl.DateTimeFormat('ro-RO', {
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(dateString));
	};

	const handleScopeChange = (value) => {
		setScope(value);
		setActionFilter('');
		setPagination((prev) => ({ ...prev, current_page: 1 }));
	};

	const handleActionChange = (value) => {
		setActionFilter(value);
		setPagination((prev) => ({ ...prev, current_page: 1 }));
	};

	const goToPage = (page) => {
		setPagination((prev) => ({ ...prev, current_page: page }));
	};

	return (
		<div className="va-profile-container va-student-activity-page">
			<div className="va-student-activity-header">
				<Link to="/profile" className="lms-btn-secondary lms-btn-sm">
					← Profil
				</Link>
				<div>
					<h1 className="va-student-activity-title">Activitatea mea</h1>
					<p className="va-student-activity-subtitle">
						Istoricul acțiunilor tale în platformă: înscrieri, lecții, teste și autentificări.
					</p>
				</div>
			</div>

			<div className="va-student-activity-filters">
				<div className="va-student-activity-filter">
					<label className="va-student-activity-filter-label">Ce vrei să vezi</label>
					<select
						className="va-student-activity-filter-input"
						value={scope}
						onChange={(e) => handleScopeChange(e.target.value)}
						disabled={Boolean(actionFilter)}
					>
						{SCOPE_OPTIONS.map((opt) => (
							<option key={opt.id} value={opt.id}>
								{opt.label}
							</option>
						))}
					</select>
				</div>
				<div className="va-student-activity-filter">
					<label className="va-student-activity-filter-label">Tip eveniment</label>
					<select
						className="va-student-activity-filter-input"
						value={actionFilter}
						onChange={(e) => handleActionChange(e.target.value)}
					>
						{ACTION_FILTER_OPTIONS.map((value) => (
							<option key={value || 'any'} value={value}>
								{value === '' ? 'Orice' : ACTION_LABELS_RO[value] || getActionLabelRo(value)}
							</option>
						))}
					</select>
				</div>
			</div>

			{error && (
				<div className="va-profile-error" style={{ marginBottom: 'var(--space-4)' }}>
					{error}
				</div>
			)}

			{loading && entries.length === 0 ? (
				<div className="lms-dashboard-loading">
					<div className="lms-spinner" />
					<p>Se încarcă activitatea…</p>
				</div>
			) : entries.length === 0 ? (
				<EmptyState
					icon={<ClockCounterClockwise size={30} weight="bold" />}
					title="Încă nu ai activitate"
					text="Înscrie-te la un curs sau finalizează o lecție și activitatea va apărea automat."
				>
					<Link to="/courses" className="lms-btn-primary">Explorează cursuri</Link>
				</EmptyState>
			) : (
				<ul className="va-student-activity-list">
					{groupedEntries.map((group) => {
						const entry = group.items[0];
						const count = activityGroupCount(group);
						const line = getGroupedLogLine(group);
						const label = getActionLabelRo(entry.action);
						const isOpen = expandedKey === group.key;

						return (
							<li key={group.key} className="va-student-activity-item">
								<span className="va-student-activity-icon" aria-hidden>
									{getIcon(entry.action)}
								</span>
								<div className="va-student-activity-body">
									<div className="va-student-activity-meta">
										<span className="va-student-activity-badge">{label}</span>
										<time className="va-student-activity-time" dateTime={entry.created_at}>
											{formatDate(entry.created_at)}
										</time>
										{count > 1 ? <span className="va-student-activity-badge">{count} înregistrări</span> : null}
									</div>
									<p className="va-student-activity-line">{line}</p>
									{count > 1 ? (
										<button
											type="button"
											className="va-student-activity-link"
											aria-expanded={isOpen}
											onClick={() => setExpandedKey(isOpen ? null : group.key)}
										>
											{isOpen ? 'Ascunde orele' : 'Vezi orele'}
										</button>
									) : entry.link ? (
										<Link to={entry.link} className="va-student-activity-link">
											Vezi detalii →
										</Link>
									) : null}
									{isOpen && count > 1 ? (
										<ul className="va-student-activity-times">
											{group.items.map((item) => (
												<li key={item.id}>
													<time dateTime={item.created_at}>{formatTime(item.created_at)}</time>
													<span>{getFriendlyLogLine({ ...item, user: { name: 'Tu' } })}</span>
												</li>
											))}
										</ul>
									) : null}
								</div>
							</li>
						);
					})}
				</ul>
			)}

			{pagination.last_page > 1 && (
				<div className="va-student-activity-pagination">
					<button
						type="button"
						className="lms-btn-secondary lms-btn-sm"
						disabled={pagination.current_page <= 1 || loading}
						onClick={() => goToPage(pagination.current_page - 1)}
					>
						Înapoi
					</button>
					<span className="va-student-activity-page-info">
						Pagina {pagination.current_page} din {pagination.last_page}
						{pagination.total > 0 && ` (${pagination.total} evenimente)`}
					</span>
					<button
						type="button"
						className="lms-btn-secondary lms-btn-sm"
						disabled={pagination.current_page >= pagination.last_page || loading}
						onClick={() => goToPage(pagination.current_page + 1)}
					>
						Înainte
					</button>
				</div>
			)}
		</div>
	);
};

export default StudentActivityPage;
