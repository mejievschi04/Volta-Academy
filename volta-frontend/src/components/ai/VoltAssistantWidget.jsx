import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lightning, X, PaperPlaneRight, DownloadSimple, Broom } from '@phosphor-icons/react';
import { openaiService } from '../../services/openaiService';
import { adminService } from '../../services/api';

import { useToast } from '../../contexts/ToastContextShared.js';
import {
	buildStructuredExcelRows,
	downloadStructuredExcel,
	statisticsExcelFilename,
} from '../../utils/statisticsExcelExport';
import { isVoltEnabled, notifyVoltComingSoon } from '../../utils/voltAvailability';
import './VoltAssistantWidget.css';

const WELCOME_MESSAGE = {
	role: 'assistant',
	content:
		'Salut! Sunt Volt. Te pot ajuta cu întrebări despre platformă, cursuri și statistici. Scrie ce vrei și pot genera și un export Excel direct de aici.',
};

const QUICK_PROMPTS = [
	'Care elevi sunt în risc și ce recomandări avem?',
	'Ce cursuri sau teste trebuie urmărite săptămâna asta?',
	'Câți elevi activi am în ultima lună?',
	'Top 10 studenți după scor la teste',
	'Rezultate teste promovate din ultima lună',
	'Sumar cursuri cu rata de finalizare',
];

const VoltAssistantWidget = () => {
	const { showToast } = useToast();
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState([WELCOME_MESSAGE]);
	const [input, setInput] = useState('');
	const [isBusy, setIsBusy] = useState(false);
	const messagesEndRef = useRef(null);
	const inputRef = useRef(null);

	useEffect(() => {
		if (open) {
			messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
		}
	}, [messages, open]);

	useEffect(() => {
		if (open) {
			const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
			return () => window.clearTimeout(timer);
		}
		return undefined;
	}, [open]);

	const appendMessage = useCallback((message) => {
		setMessages((prev) => [...prev, message]);
	}, []);

	const updateLastAssistant = useCallback((content) => {
		setMessages((prev) => {
			const next = [...prev];
			for (let i = next.length - 1; i >= 0; i -= 1) {
				if (next[i].role === 'assistant') {
					next[i] = { ...next[i], content };
					break;
				}
			}
			return next;
		});
	}, []);

	const handleAsk = useCallback(async () => {
		const prompt = input.trim();
		if (!prompt || isBusy) return;
		if (!isVoltEnabled()) {
			notifyVoltComingSoon(showToast);
			return;
		}

		const history = messages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.map((m) => ({ role: m.role, content: m.content }));

		appendMessage({ role: 'user', content: prompt });
		appendMessage({ role: 'assistant', content: '…' });
		setInput('');
		setIsBusy(true);

		try {
			let streamed = '';
			await openaiService.streamCourseGeneration(
				prompt,
				history,
				null,
				(chunk) => {
					if (!chunk) return;
					streamed += chunk;
					updateLastAssistant(streamed);
				},
				null,
				{ type: 'tutor', mode: 'admin_tutor' }
			);

			if (!streamed.trim()) {
				updateLastAssistant('Nu am putut genera un răspuns. Încearcă să reformulezi întrebarea.');
			}
		} catch (error) {
			console.error('Volt assistant error:', error);
			const message = error?.response?.data?.error || error?.message || 'A apărut o eroare.';
			updateLastAssistant(`Îmi pare rău, am întâmpinat o eroare: ${message}`);
		} finally {
			setIsBusy(false);
		}
	}, [appendMessage, input, isBusy, messages, showToast, updateLastAssistant]);

	const handleExport = useCallback(async () => {
		const prompt = input.trim();
		if (!prompt || isBusy) return;
		if (!isVoltEnabled()) {
			notifyVoltComingSoon(showToast);
			return;
		}

		appendMessage({ role: 'user', content: `📊 Export Excel: ${prompt}` });
		appendMessage({ role: 'assistant', content: '⚙️ Pregătesc exportul Excel...' });
		setInput('');
		setIsBusy(true);

		try {
			const exportData = await adminService.generateStatisticsExportWithVolt({ prompt });

			const rows = buildStructuredExcelRows({
				sheetLabel: exportData.title || 'Export Volt',
				periodFrom: exportData.filters_applied?.date_from || '',
				periodTo: exportData.filters_applied?.date_to || '',
				kpiEntries: exportData.kpis?.length ? exportData.kpis : null,
				extraMeta: [
					['Tip raport', exportData.dataset_label || exportData.dataset || '—'],
					['Cerere', prompt],
					['Rezumat Volt', exportData.summary || ''],
				],
				tableHeaders: exportData.headers || [],
				tableRows: exportData.rows || [],
			});

			downloadStructuredExcel(
				statisticsExcelFilename(exportData.filename_slug || exportData.dataset || 'volt-export'),
				exportData.title || 'Export Volt',
				rows
			);

			updateLastAssistant(
				`✅ Export descărcat: ${exportData.title || 'Export Volt'} (${exportData.row_count ?? 0} rânduri).`
			);
			showToast('Export Excel descărcat.', 'success');
		} catch (error) {
			console.error('Volt export error:', error);
			const message = error?.response?.data?.error || error?.message || 'Nu s-a putut genera exportul.';
			updateLastAssistant(`Nu am putut genera exportul Excel: ${message}`);
			showToast(message, 'error');
		} finally {
			setIsBusy(false);
		}
	}, [appendMessage, input, isBusy, showToast, updateLastAssistant]);

	const handleKeyDown = (event) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleAsk();
		}
	};

	const handleReset = () => {
		setMessages([WELCOME_MESSAGE]);
		setInput('');
	};

	const showQuickPrompts = messages.length <= 1;

	return createPortal(
		<div className="volt-widget-root">
			{open && (
				<div
					className="volt-widget-overlay"
					role="presentation"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isBusy) setOpen(false);
					}}
				>
				<div className="volt-widget-panel" role="dialog" aria-modal="true" aria-label="Asistentul Volt">
					<header className="volt-widget-header">
						<div className="volt-widget-header-title">
							<span className="volt-widget-header-icon" aria-hidden>
								<Lightning size={18} weight="fill" />
							</span>
							<div>
								<h2>Volt</h2>
								<p>Asistentul tău, peste tot</p>
							</div>
						</div>
						<div className="volt-widget-header-actions">
							<button
								type="button"
								className="volt-widget-icon-btn"
								onClick={handleReset}
								title="Conversație nouă"
								aria-label="Conversație nouă"
								disabled={isBusy}
							>
								<Broom size={18} weight="bold" />
							</button>
							<button
								type="button"
								className="volt-widget-icon-btn"
								onClick={() => setOpen(false)}
								title="Închide"
								aria-label="Închide"
							>
								<X size={18} weight="bold" />
							</button>
						</div>
					</header>

					<div className="volt-widget-messages">
						{messages.map((message, index) => (
							<div
								key={index}
								className={`volt-widget-message volt-widget-message-${message.role}`}
							>
								<div className="volt-widget-bubble">{message.content}</div>
							</div>
						))}
						{showQuickPrompts && (
							<div className="volt-widget-quick">
								<span className="volt-widget-quick-label">Sugestii rapide</span>
								{QUICK_PROMPTS.map((quick) => (
									<button
										key={quick}
										type="button"
										className="volt-widget-quick-chip"
										onClick={() => setInput(quick)}
										disabled={isBusy}
									>
										{quick}
									</button>
								))}
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					<div className="volt-widget-input-row">
						<textarea
							ref={inputRef}
							className="volt-widget-textarea"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Întreabă Volt sau cere un export..."
							rows={1}
							disabled={isBusy}
						/>
						<div className="volt-widget-input-actions">
							<button
								type="button"
								className="volt-widget-action volt-widget-action-export"
								onClick={handleExport}
								disabled={!input.trim() || isBusy}
								title="Generează export Excel din text"
							>
								<DownloadSimple size={16} weight="bold" />
								Excel
							</button>
							<button
								type="button"
								className="volt-widget-action volt-widget-action-send"
								onClick={handleAsk}
								disabled={!input.trim() || isBusy}
								title="Trimite"
								aria-label="Trimite"
							>
								<PaperPlaneRight size={16} weight="fill" />
							</button>
						</div>
					</div>
				</div>
				</div>
			)}

			<button
				type="button"
				className={`volt-widget-launcher ${open ? 'is-open' : ''}`}
				onClick={() => setOpen((prev) => !prev)}
				aria-label={open ? 'Închide Volt' : 'Deschide Volt'}
				title="Volt"
			>
				{open ? <X size={24} weight="bold" /> : <Lightning size={24} weight="fill" />}
			</button>
		</div>,
		document.body
	);
};

export default VoltAssistantWidget;
