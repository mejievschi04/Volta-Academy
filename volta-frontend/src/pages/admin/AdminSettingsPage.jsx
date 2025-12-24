import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const AdminSettingsPage = () => {
	const { success, error: showError } = useToast();
	const [settings, setSettings] = useState({
		default_currency: 'RON',
		maintenance_mode: false,
		registration_enabled: true,
		email_notifications: true,
		backup_enabled: true,
		backup_frequency: 'daily',
	});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [activeTab, setActiveTab] = useState('general');

	const currencies = [
		{ code: 'MDL', name: 'Leu moldovenesc', symbol: 'MDL' },
		{ code: 'RON', name: 'Leu românesc', symbol: 'RON' },
		{ code: 'USD', name: 'Dolar american', symbol: '$' },
		{ code: 'EUR', name: 'Euro', symbol: '€' },
	];

	useEffect(() => {
		fetchSettings();
	}, []);

	const fetchSettings = async () => {
		try {
			setLoading(true);
			const data = await adminService.getSettings();
			const currency = data.default_currency?.value || localStorage.getItem('volta_currency') || 'RON';
			setSettings(prev => ({
				...prev,
				default_currency: currency,
				maintenance_mode: data.maintenance_mode?.value === '1' || data.maintenance_mode?.value === true || prev.maintenance_mode,
				registration_enabled: data.registration_enabled?.value !== '0' && data.registration_enabled?.value !== false || prev.registration_enabled,
				email_notifications: data.email_notifications?.value !== '0' && data.email_notifications?.value !== false || prev.email_notifications,
				backup_enabled: data.backup_enabled?.value !== '0' && data.backup_enabled?.value !== false || prev.backup_enabled,
				backup_frequency: data.backup_frequency?.value || prev.backup_frequency,
			}));
			// Also update localStorage
			localStorage.setItem('volta_currency', currency);
		} catch (err) {
			console.error('Error fetching settings:', err);
			// Fallback to localStorage
			const storedCurrency = localStorage.getItem('volta_currency') || 'RON';
			setSettings(prev => ({
				...prev,
				default_currency: storedCurrency,
			}));
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			await adminService.updateSettings(settings);
			// Update localStorage
			localStorage.setItem('volta_currency', settings.default_currency);
			// Dispatch custom event to notify other components
			window.dispatchEvent(new CustomEvent('currencyChanged', { detail: settings.default_currency }));
			success('Setările au fost salvate cu succes');
		} catch (err) {
			console.error('Error saving settings:', err);
			showError('Eroare la salvarea setărilor');
		} finally {
			setSaving(false);
		}
	};

	const handleCurrencyChange = (currencyCode) => {
		setSettings(prev => ({
			...prev,
			default_currency: currencyCode,
		}));
	};

	const handleInputChange = (key, value) => {
		setSettings(prev => ({
			...prev,
			[key]: value,
		}));
	};

	const handleToggle = (key) => {
		setSettings(prev => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const handleExportData = async () => {
		try {
			const data = await adminService.exportData();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `volta-backup-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			success('Datele au fost exportate cu succes');
		} catch (err) {
			console.error('Error exporting data:', err);
			showError('Eroare la exportarea datelor');
		}
	};

	const handleClearCache = async () => {
		if (!confirm('Sigur dorești să ștergi cache-ul? Această acțiune nu poate fi anulată.')) {
			return;
		}
		try {
			await adminService.clearCache();
			success('Cache-ul a fost șters cu succes');
		} catch (err) {
			console.error('Error clearing cache:', err);
			showError('Eroare la ștergerea cache-ului');
		}
	};

	const handleImportBackup = async (event) => {
		const file = event.target.files[0];
		if (!file) {
			return;
		}

		if (!file.name.endsWith('.json')) {
			showError('Fișierul trebuie să fie de tip JSON');
			return;
		}

		if (!confirm('ATENȚIE! Importarea backup-ului va suprascrie datele existente. Ești sigur că vrei să continui?')) {
			event.target.value = '';
			return;
		}

		try {
			setSaving(true);
			const result = await adminService.importBackup(file);
			success(`Backup-ul a fost importat cu succes! Data backup: ${result.imported_date || 'necunoscută'}`);
			event.target.value = '';
		} catch (err) {
			console.error('Error importing backup:', err);
			showError(err.response?.data?.message || 'Eroare la importarea backup-ului');
			event.target.value = '';
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="admin-settings-page">
				<div className="admin-settings-loading">
					<div className="admin-loading-spinner"></div>
					<p>Se încarcă setările...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">Setări</h1>
					<p className="va-muted admin-page-subtitle">
						Gestionează configurațiile aplicației
					</p>
				</div>
			</div>

			<div className="admin-settings-content">
				{/* Tabs */}
				<div className="admin-settings-tabs">
					<button
						className={`admin-settings-tab ${activeTab === 'general' ? 'active' : ''}`}
						onClick={() => setActiveTab('general')}
					>
						⚙️ General
					</button>
					<button
						className={`admin-settings-tab ${activeTab === 'currency' ? 'active' : ''}`}
						onClick={() => setActiveTab('currency')}
					>
						💱 Monetar
					</button>
					<button
						className={`admin-settings-tab ${activeTab === 'system' ? 'active' : ''}`}
						onClick={() => setActiveTab('system')}
					>
						🔧 Sistem
					</button>
					<button
						className={`admin-settings-tab ${activeTab === 'backup' ? 'active' : ''}`}
						onClick={() => setActiveTab('backup')}
					>
						💾 Backup
					</button>
				</div>

				{/* General Settings */}
				{activeTab === 'general' && (
					<div className="admin-settings-section">
						<div className="admin-settings-section-header">
							<h2 className="admin-settings-section-title">
								<span className="admin-settings-section-icon">⚙️</span>
								<span>Setări Generale</span>
							</h2>
							<p className="admin-settings-section-description">
								Configurează setările generale ale platformei
							</p>
						</div>

						<div className="admin-settings-form">
							<div className="admin-settings-toggle-group">
								<div className="admin-settings-toggle">
									<div className="admin-settings-toggle-info">
										<label className="admin-settings-toggle-label">
											Inregistrări Active
										</label>
										<p className="admin-settings-toggle-description">
											Permite utilizatorilor noi să se înregistreze pe platformă
										</p>
									</div>
									<button
										type="button"
										className={`admin-settings-toggle-switch ${settings.registration_enabled ? 'active' : ''}`}
										onClick={() => handleToggle('registration_enabled')}
									>
										<div className="admin-settings-toggle-slider" />
									</button>
								</div>

								<div className="admin-settings-toggle">
									<div className="admin-settings-toggle-info">
										<label className="admin-settings-toggle-label">
											Notificări Email
										</label>
										<p className="admin-settings-toggle-description">
											Trimite notificări email către utilizatori
										</p>
									</div>
									<button
										type="button"
										className={`admin-settings-toggle-switch ${settings.email_notifications ? 'active' : ''}`}
										onClick={() => handleToggle('email_notifications')}
									>
										<div className="admin-settings-toggle-slider" />
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Currency Settings */}
				{activeTab === 'currency' && (
					<div className="admin-settings-section">
						<div className="admin-settings-section-header">
							<h2 className="admin-settings-section-title">
								<span className="admin-settings-section-icon">💱</span>
								<span>Setări Monetare</span>
							</h2>
							<p className="admin-settings-section-description">
								Selectează valuta implicită pentru prețurile cursurilor
							</p>
						</div>

						<div className="admin-settings-form">
							<div className="admin-settings-form-group">
								<label className="admin-settings-label">
									Valută Implicită
								</label>
								<div className="admin-currency-selector">
									{currencies.map((currency) => (
										<button
											key={currency.code}
											type="button"
											className={`admin-currency-option ${
												settings.default_currency === currency.code ? 'active' : ''
											}`}
											onClick={() => handleCurrencyChange(currency.code)}
										>
											<div className="admin-currency-option-header">
												<span className="admin-currency-symbol">
													{currency.symbol}
												</span>
												<span className="admin-currency-code">
													{currency.code}
												</span>
											</div>
											<span className="admin-currency-name">
												{currency.name}
											</span>
										</button>
									))}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* System Settings */}
				{activeTab === 'system' && (
					<div className="admin-settings-section">
						<div className="admin-settings-section-header">
							<h2 className="admin-settings-section-title">
								<span className="admin-settings-section-icon">🔧</span>
								<span>Setări Sistem</span>
							</h2>
							<p className="admin-settings-section-description">
								Configurează setările de sistem și mentenanță
							</p>
						</div>

						<div className="admin-settings-form">
							<div className="admin-settings-toggle">
								<div className="admin-settings-toggle-info">
									<label className="admin-settings-toggle-label">
										Mod Mentenanță
									</label>
									<p className="admin-settings-toggle-description">
										Activează modul de mentenanță pentru a restricționa accesul utilizatorilor
									</p>
								</div>
								<button
									type="button"
									className={`admin-settings-toggle-switch ${settings.maintenance_mode ? 'active' : ''}`}
									onClick={() => handleToggle('maintenance_mode')}
								>
									<div className="admin-settings-toggle-slider" />
								</button>
							</div>

							<div className="admin-settings-actions-grid">
								<button
									className="admin-settings-action-btn"
									onClick={handleClearCache}
								>
									<span className="admin-settings-action-icon">🗑️</span>
									<div className="admin-settings-action-content">
										<div className="admin-settings-action-title">Șterge Cache</div>
										<div className="admin-settings-action-description">
											Elimină toate datele din cache
										</div>
									</div>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Backup Settings */}
				{activeTab === 'backup' && (
					<div className="admin-settings-section">
						<div className="admin-settings-section-header">
							<h2 className="admin-settings-section-title">
								<span className="admin-settings-section-icon">💾</span>
								<span>Backup & Export</span>
							</h2>
							<p className="admin-settings-section-description">
								Gestionează backup-urile și exportă datele platformei
							</p>
						</div>

						<div className="admin-settings-form">
							<div className="admin-settings-toggle">
								<div className="admin-settings-toggle-info">
									<label className="admin-settings-toggle-label">
										Backup Automat
									</label>
									<p className="admin-settings-toggle-description">
										Activează backup-uri automate pentru datele platformei
									</p>
								</div>
								<button
									type="button"
									className={`admin-settings-toggle-switch ${settings.backup_enabled ? 'active' : ''}`}
									onClick={() => handleToggle('backup_enabled')}
								>
									<div className="admin-settings-toggle-slider" />
								</button>
							</div>

							{settings.backup_enabled && (
								<div className="va-form-group">
									<label className="va-form-label">Frecvență Backup</label>
									<select
										className="va-form-input"
										value={settings.backup_frequency}
										onChange={(e) => handleInputChange('backup_frequency', e.target.value)}
									>
										<option value="daily">Zilnic</option>
										<option value="weekly">Săptămânal</option>
										<option value="monthly">Lunar</option>
									</select>
								</div>
							)}

							<div className="admin-settings-actions-grid">
								<button
									className="admin-settings-action-btn"
									onClick={handleExportData}
								>
									<span className="admin-settings-action-icon">📥</span>
									<div className="admin-settings-action-content">
										<div className="admin-settings-action-title">Exportă Date</div>
										<div className="admin-settings-action-description">
											Descarcă un backup JSON cu toate datele
										</div>
									</div>
								</button>
								
								<label className="admin-settings-action-btn" style={{ cursor: 'pointer' }}>
									<input
										type="file"
										accept=".json"
										onChange={handleImportBackup}
										disabled={saving}
										style={{ display: 'none' }}
									/>
									<span className="admin-settings-action-icon">📤</span>
									<div className="admin-settings-action-content">
										<div className="admin-settings-action-title">Importă Backup</div>
										<div className="admin-settings-action-description">
											Încarcă și restaurează date dintr-un backup JSON
										</div>
									</div>
								</label>
							</div>
						</div>
					</div>
				)}

				{/* Save Button */}
				<div className="admin-settings-actions">
					<button
						className="va-btn va-btn-primary"
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? (
							<>
								<span className="admin-loading-spinner-small"></span>
								<span>Se salvează...</span>
							</>
						) : (
							<>
								<span>💾</span>
								<span>Salvează Setările</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};

export default AdminSettingsPage;

