import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
	markNotificationRead,
	removeNotificationFromHistoric,
	getPrimiteFromApi,
	getIstoricList,
} from '../../utils/notificationInboxStorage';
import './NotificationsDrawer.css';

const CloseIcon = () => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
		<path d="M18 6L6 18M6 6l12 12" />
	</svg>
);

function StudentRowIcon({ type }) {
	if (type === 'pending_exam') {
		return (
			<div className="va-notif-drawer-row-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
				</svg>
			</div>
		);
	}
	return (
		<div className="va-notif-drawer-row-icon">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<path d="M12 2L2 7l10 5 10-5-10-5z" />
				<path d="M2 17l10 5 10-5" />
			</svg>
		</div>
	);
}

function AdminRowIcon() {
	return (
		<div className="va-notif-drawer-row-icon va-notif-drawer-row-icon--warn">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
				<path d="M12 9v4" />
				<path d="M12 17h.01" />
			</svg>
		</div>
	);
}

const NotificationsDrawer = ({ open, onClose, variant, apiItems, loading, onLocalStateChange }) => {
	const isStudent = variant === 'student';
	const navigate = useNavigate();
	const [tab, setTab] = useState('primite');
	const [tick, setTick] = useState(0);

	const bump = useCallback(() => {
		setTick((t) => t + 1);
		onLocalStateChange?.();
	}, [onLocalStateChange]);

	useEffect(() => {
		if (open) setTab('primite');
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	const primite = useMemo(() => getPrimiteFromApi(apiItems, variant), [apiItems, variant, tick]);
	const istoric = useMemo(() => getIstoricList(variant), [variant, tick]);

	const handleReadStudent = useCallback(
		(notif) => {
			markNotificationRead(variant, notif);
			bump();
			setTab('istoric');
			if (notif.link && String(notif.link).startsWith('/')) {
				onClose();
				navigate(notif.link);
			}
		},
		[variant, bump, onClose, navigate]
	);

	const handleReadAdmin = useCallback(
		(notif) => {
			markNotificationRead(variant, notif);
			bump();
			setTab('istoric');
			const href =
				typeof notif.action_url === 'string' && notif.action_url.startsWith('/')
					? notif.action_url
					: null;
			if (href) {
				onClose();
				navigate(href);
			}
		},
		[variant, bump, onClose, navigate]
	);

	const handleDeleteHistoric = useCallback(
		(id) => {
			removeNotificationFromHistoric(variant, id);
			bump();
		},
		[variant, bump]
	);

	if (!open) return null;

	const portalTarget = typeof document !== 'undefined' ? document.body : null;
	if (!portalTarget) return null;

	const title = 'Notificări';
	const subtitle = isStudent ? 'Primite și istoric' : 'Alerte și mesaje pentru echipă';

	const content = (
		<>
			<button type="button" className="va-notif-drawer-backdrop" aria-label="Închide" onClick={onClose} />
			<div
				className="va-notif-drawer-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="va-notif-drawer-title"
			>
				<header className="va-notif-drawer-header">
					<div>
						<h2 id="va-notif-drawer-title" className="va-notif-drawer-title">
							{title}
						</h2>
						<p className="va-notif-drawer-sub">{subtitle}</p>
					</div>
					<button type="button" className="va-notif-drawer-close" onClick={onClose} aria-label="Închide">
						<CloseIcon />
					</button>
				</header>

				<div className="va-notif-drawer-tabs" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'primite'}
						className={`va-notif-drawer-tab ${tab === 'primite' ? 'is-active' : ''}`}
						onClick={() => setTab('primite')}
					>
						Primite
						{primite.length > 0 && <span className="va-notif-drawer-tab-count">{primite.length}</span>}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'istoric'}
						className={`va-notif-drawer-tab ${tab === 'istoric' ? 'is-active' : ''}`}
						onClick={() => setTab('istoric')}
					>
						Istoric
						{istoric.length > 0 && <span className="va-notif-drawer-tab-count va-notif-drawer-tab-count--muted">{istoric.length}</span>}
					</button>
				</div>

				<div className="va-notif-drawer-body">
					{loading ? (
						<p className="va-notif-drawer-empty">Se încarcă…</p>
					) : tab === 'primite' ? (
						primite.length === 0 ? (
							<p className="va-notif-drawer-empty">
								{isStudent ? 'Nu ai notificări noi în primite.' : 'Nu există notificări noi în primite.'}
							</p>
						) : (
							<ul className="va-notif-drawer-list">
								{primite.map((notif) => {
									if (isStudent) {
										const inner = (
											<>
												<StudentRowIcon type={notif.type} />
												<div className="va-notif-drawer-row-text">
													<div className="va-notif-drawer-row-title">{notif.title}</div>
													{notif.message ? <div className="va-notif-drawer-row-meta">{notif.message}</div> : null}
												</div>
											</>
										);
										return (
											<li key={notif.id}>
												<button
													type="button"
													className="va-notif-drawer-row va-notif-drawer-row--action"
													onClick={() => handleReadStudent(notif)}
												>
													{inner}
												</button>
											</li>
										);
									}
									const inner = (
										<>
											<AdminRowIcon />
											<div className="va-notif-drawer-row-text">
												<div className="va-notif-drawer-row-title">{notif.title}</div>
												{notif.description ? (
													<div className="va-notif-drawer-row-meta">{notif.description}</div>
												) : null}
												{notif.created_at ? (
													<div className="va-notif-drawer-row-time">
														{new Date(notif.created_at).toLocaleString('ro-RO')}
													</div>
												) : null}
											</div>
										</>
									);
									return (
										<li key={notif.id}>
											<button
												type="button"
												className="va-notif-drawer-row va-notif-drawer-row--action"
												onClick={() => handleReadAdmin(notif)}
											>
												{inner}
											</button>
										</li>
									);
								})}
							</ul>
						)
					) : istoric.length === 0 ? (
						<p className="va-notif-drawer-empty">
							Istoricul este gol. După ce citești notificările din Primite, apar aici; le poți șterge manual din această listă.
						</p>
					) : (
						<ul className="va-notif-drawer-list">
							{istoric.map((entry) => (
								<li key={entry.id} className="va-notif-drawer-historic-item">
									<div className="va-notif-drawer-row va-notif-drawer-row--static">
										{isStudent ? <StudentRowIcon type={entry.type} /> : <AdminRowIcon />}
										<div className="va-notif-drawer-row-text">
											<div className="va-notif-drawer-row-title">{entry.title}</div>
											{entry.subtitle ? <div className="va-notif-drawer-row-meta">{entry.subtitle}</div> : null}
											<div className="va-notif-drawer-row-time">
												Citită: {entry.readAt ? new Date(entry.readAt).toLocaleString('ro-RO') : '—'}
											</div>
										</div>
									</div>
									<div className="va-notif-drawer-historic-actions">
										{entry.link ? (
											<Link to={entry.link} className="va-notif-drawer-link" onClick={onClose}>
												Deschide
											</Link>
										) : null}
										<button
											type="button"
											className="va-notif-drawer-delete"
											onClick={() => handleDeleteHistoric(entry.id)}
										>
											Șterge
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</>
	);

	return createPortal(content, portalTarget);
};

export default NotificationsDrawer;
