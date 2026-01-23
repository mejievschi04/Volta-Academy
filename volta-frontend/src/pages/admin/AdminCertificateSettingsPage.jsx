import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';
import './AdminCertificateSettingsPage.css';
import '../../styles/admin-certificate-settings.css';

const AdminCertificateSettingsPage = () => {
	const { success, error: showError } = useToast();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [currentStep, setCurrentStep] = useState(0);
	const [errors, setErrors] = useState({});

	const [settings, setSettings] = useState({
		template: 'modern',
		primary_color: '#FFEE00',
		secondary_color: '#E6D600',
		accent_color: '#ffd700',
		background_color: '#ffffff',
		border_color: '#FFEE00',
		border_style: 'solid',
		border_width: '3px',
		font_family: 'Georgia, serif',
		logo_url: '',
		organization_name: 'Volta Academy',
		organization_subtitle: 'Platformă de învățare online',
		custom_text: '',
	});

	const templates = [
		{ 
			value: 'classic', 
			name: 'Clasic', 
			description: 'Design tradițional cu border auriu',
			icon: '📜',
			preset: {
				primary_color: '#ffd700',
				secondary_color: '#daa520',
				accent_color: '#ffd700',
				background_color: '#ffffff',
				border_color: '#ffd700',
				border_style: 'solid',
				border_width: '4px',
				font_family: 'Georgia, serif',
			}
		},
		{ 
			value: 'modern', 
			name: 'Modern', 
			description: 'Design minimalist și profesional',
			icon: '🎓',
			preset: {
				primary_color: '#FFEE00',
				secondary_color: '#E6D600',
				accent_color: '#ffd700',
				background_color: '#ffffff',
				border_color: '#FFEE00',
				border_style: 'solid',
				border_width: '3px',
				font_family: 'Arial, sans-serif',
			}
		},
		{ 
			value: 'premium', 
			name: 'Premium', 
			description: 'Design luxos cu gradient și efecte',
			icon: '🏆',
			preset: {
				primary_color: '#FFEE00',
				secondary_color: '#E6D600',
				accent_color: '#ffd700',
				background_color: '#ffffff',
				border_color: '#FFEE00',
				border_style: 'double',
				border_width: '5px',
				font_family: "'Times New Roman', serif",
			}
		},
	];

	const steps = [
		{ number: 1, title: 'Template', icon: '🎨', description: 'Alege template-ul de bază' },
		{ number: 2, title: 'Culori', icon: '🎨', description: 'Personalizează paleta de culori' },
		{ number: 3, title: 'Organizație', icon: '🏢', description: 'Logo și informații organizație' },
		{ number: 4, title: 'Tipografie', icon: '✍️', description: 'Font și text personalizat' },
		{ number: 5, title: 'Preview', icon: '👁️', description: 'Verifică rezultatul final' },
	];

	// Preview certificate data
	const previewCertificate = useMemo(() => ({
		user_name: 'Ion Mejievski',
		course_title: 'Introducere în Programare',
		completion_date: new Date().toISOString(),
		certificate_id: 'VOLTA-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
	}), []);

	useEffect(() => {
		fetchSettings();
	}, []);

	const fetchSettings = async () => {
		try {
			setLoading(true);
			const data = await adminService.getCertificateSettings();
			if (data) {
				setSettings(prev => ({ ...prev, ...data }));
			}
		} catch (err) {
			logger.error('Error fetching certificate settings:', err);
			showError('Nu s-au putut încărca setările certificate');
		} finally {
			setLoading(false);
		}
	};

	const handleTemplateSelect = (templateValue) => {
		const template = templates.find(t => t.value === templateValue);
		if (template && template.preset) {
			setSettings(prev => ({
				...prev,
				template: templateValue,
				...template.preset
			}));
		} else {
			setSettings(prev => ({ ...prev, template: templateValue }));
		}
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			setErrors({});

			// Validare
			if (!settings.organization_name || settings.organization_name.trim() === '') {
				setErrors({ organization_name: 'Numele organizației este obligatoriu' });
				setCurrentStep(2);
				return;
			}

			await adminService.updateCertificateSettings(settings);
			success('Setările certificate au fost salvate cu succes');
		} catch (err) {
			logger.error('Error saving certificate settings:', err);
			showError('Nu s-au putut salva setările certificate');
		} finally {
			setSaving(false);
		}
	};

	const handleLogoUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		if (file.size > 2 * 1024 * 1024) {
			showError('Fișierul este prea mare. Dimensiunea maximă este 2MB');
			return;
		}

		try {
			const formData = new FormData();
			formData.append('logo', file);
			const response = await adminService.uploadCertificateLogo(formData);
			setSettings(prev => ({ ...prev, logo_url: response.url }));
			success('Logo-ul a fost încărcat cu succes');
		} catch (err) {
			logger.error('Error uploading logo:', err);
			showError('Nu s-a putut încărca logo-ul');
		}
	};

	const handleNext = () => {
		if (currentStep < steps.length - 1) {
			setCurrentStep(currentStep + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		}
	};

	const updateSetting = (key, value) => {
		setSettings(prev => ({ ...prev, [key]: value }));
		setErrors(prev => ({ ...prev, [key]: null }));
	};

	if (loading) {
		return (
			<div className="admin-container">
				<div className="admin-loading-spinner"></div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Personalizare Certificate</h1>
					<p className="admin-page-subtitle">
						Configurează designul certificate pentru cursuri - proces simplu în {steps.length} pași
					</p>
				</div>
				<div className="admin-page-header-actions">
					<button
						onClick={handleSave}
						disabled={saving}
						className="admin-btn admin-btn-primary"
					>
						{saving ? 'Se salvează...' : '💾 Salvează Setări'}
					</button>
				</div>
			</div>

			<div className="certificate-wizard">
				{/* Steps Indicator */}
				<div className="certificate-wizard-steps">
					{steps.map((step, index) => (
						<div
							key={step.number}
							className={`certificate-wizard-step ${
								index === currentStep ? 'active' : 
								index < currentStep ? 'completed' : ''
							}`}
							onClick={() => {
								if (index <= currentStep) {
									setCurrentStep(index);
								}
							}}
						>
							<div className="certificate-wizard-step-icon">
								{index < currentStep ? '✓' : step.icon}
							</div>
							<div className="certificate-wizard-step-info">
								<div className="certificate-wizard-step-title">{step.title}</div>
								<div className="certificate-wizard-step-description">{step.description}</div>
							</div>
						</div>
					))}
				</div>

				{/* Main Content Area */}
				<div className={`certificate-wizard-content ${currentStep === 0 ? 'template-step-layout' : ''}`}>
					{/* Step 1: Template Selection - Special Layout */}
					{currentStep === 0 ? (
						<>
							<div className="certificate-template-selector-column">
								<h2 className="certificate-wizard-step-header">Alege Template-ul</h2>
								<p className="certificate-wizard-step-subheader">
									Selectează un template de bază. Poți personaliza culorile și stilurile în pașii următori.
								</p>
								<div className="admin-template-selector-column">
									{templates.map((template) => (
										<div
											key={template.value}
											className={`admin-template-option ${settings.template === template.value ? 'active' : ''}`}
											onClick={() => handleTemplateSelect(template.value)}
										>
											<div className="admin-template-preview">
												<div className={`admin-template-preview-${template.value}`}>
													<div className="admin-template-preview-icon">{template.icon}</div>
												</div>
											</div>
											<div className="admin-template-info">
												<div className="admin-template-name">{template.name}</div>
												<div className="admin-template-description">{template.description}</div>
											</div>
										</div>
									))}
								</div>
							</div>
							<div className="certificate-wizard-preview">
								<div className="certificate-wizard-preview-header">
									<h3>Preview Live</h3>
									<p>Vizualizează modificările în timp real</p>
								</div>
								<div className="certificate-wizard-preview-content">
									<CertificatePreviewContent
										certificate={previewCertificate}
										settings={settings}
									/>
								</div>
							</div>
						</>
					) : (
						<>
							<div className="certificate-wizard-form">
								{/* Step 2: Colors */}
								{currentStep === 1 && (
							<div className="certificate-wizard-step-content">
								<h2 className="certificate-wizard-step-header">Personalizează Culorile</h2>
								<p className="certificate-wizard-step-subheader">
									Configurează paleta de culori pentru certificat. Culorile se aplică automat în preview.
								</p>
								<div className="admin-color-grid">
									<div className="admin-form-group">
										<label className="admin-form-label">
											Culoare Principală
											<span className="admin-form-label-hint">Pentru titluri și elemente principale</span>
										</label>
										<div className="admin-color-input-group">
											<input
												type="color"
												value={settings.primary_color}
												onChange={(e) => updateSetting('primary_color', e.target.value)}
												className="admin-color-picker"
											/>
											<input
												type="text"
												value={settings.primary_color}
												onChange={(e) => updateSetting('primary_color', e.target.value)}
												className="admin-color-text"
											/>
										</div>
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">
											Culoare Secundară
											<span className="admin-form-label-hint">Pentru subtitluri și accenturi</span>
										</label>
										<div className="admin-color-input-group">
											<input
												type="color"
												value={settings.secondary_color}
												onChange={(e) => updateSetting('secondary_color', e.target.value)}
												className="admin-color-picker"
											/>
											<input
												type="text"
												value={settings.secondary_color}
												onChange={(e) => updateSetting('secondary_color', e.target.value)}
												className="admin-color-text"
											/>
										</div>
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">
											Culoare Accent
											<span className="admin-form-label-hint">Pentru elemente decorative</span>
										</label>
										<div className="admin-color-input-group">
											<input
												type="color"
												value={settings.accent_color}
												onChange={(e) => updateSetting('accent_color', e.target.value)}
												className="admin-color-picker"
											/>
											<input
												type="text"
												value={settings.accent_color}
												onChange={(e) => updateSetting('accent_color', e.target.value)}
												className="admin-color-text"
											/>
										</div>
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">
											Culoare Fundal
											<span className="admin-form-label-hint">Fundalul certificatului</span>
										</label>
										<div className="admin-color-input-group">
											<input
												type="color"
												value={settings.background_color}
												onChange={(e) => updateSetting('background_color', e.target.value)}
												className="admin-color-picker"
											/>
											<input
												type="text"
												value={settings.background_color}
												onChange={(e) => updateSetting('background_color', e.target.value)}
												className="admin-color-text"
											/>
										</div>
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">
											Culoare Border
											<span className="admin-form-label-hint">Culoarea marginii certificatului</span>
										</label>
										<div className="admin-color-input-group">
											<input
												type="color"
												value={settings.border_color}
												onChange={(e) => updateSetting('border_color', e.target.value)}
												className="admin-color-picker"
											/>
											<input
												type="text"
												value={settings.border_color}
												onChange={(e) => updateSetting('border_color', e.target.value)}
												className="admin-color-text"
											/>
										</div>
									</div>
								</div>
								<div className="admin-form-grid" style={{ marginTop: 'var(--space-6)' }}>
									<div className="admin-form-group">
										<label className="admin-form-label">Stil Border</label>
										<select
											value={settings.border_style}
											onChange={(e) => updateSetting('border_style', e.target.value)}
											className="admin-form-input"
										>
											<option value="solid">Solid</option>
											<option value="dashed">Dashed</option>
											<option value="double">Double</option>
											<option value="dotted">Dotted</option>
										</select>
									</div>
									<div className="admin-form-group">
										<label className="admin-form-label">Grosime Border</label>
										<input
											type="text"
											value={settings.border_width}
											onChange={(e) => updateSetting('border_width', e.target.value)}
											className="admin-form-input"
											placeholder="3px"
										/>
									</div>
								</div>
							</div>
						)}

						{/* Step 3: Organization */}
						{currentStep === 2 && (
							<div className="certificate-wizard-step-content">
								<h2 className="certificate-wizard-step-header">Informații Organizație</h2>
								<p className="certificate-wizard-step-subheader">
									Configurează logo-ul și informațiile organizației care vor apărea pe certificat.
								</p>
								<div className="admin-form-group">
									<label className="admin-form-label">
										Logo Organizație
										<span className="admin-form-label-hint">Recomandat: PNG transparent, max 2MB</span>
									</label>
									<div className="admin-logo-upload">
										{settings.logo_url ? (
											<div className="admin-logo-preview">
												<img src={settings.logo_url} alt="Logo" />
												<button
													type="button"
													onClick={() => updateSetting('logo_url', '')}
													className="admin-logo-remove"
													title="Elimină logo"
												>
													✕
												</button>
											</div>
										) : (
											<label className="admin-logo-upload-btn">
												<input
													type="file"
													accept="image/*"
													onChange={handleLogoUpload}
													style={{ display: 'none' }}
												/>
												<span>📤 Încarcă Logo</span>
											</label>
										)}
									</div>
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">
										Nume Organizație <span className="required">*</span>
									</label>
									<input
										type="text"
										value={settings.organization_name}
										onChange={(e) => updateSetting('organization_name', e.target.value)}
										className={`admin-form-input ${errors.organization_name ? 'error' : ''}`}
										placeholder="Volta Academy"
									/>
									{errors.organization_name && (
										<div className="admin-form-error">{errors.organization_name}</div>
									)}
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">Subtitlu Organizație</label>
									<input
										type="text"
										value={settings.organization_subtitle}
										onChange={(e) => updateSetting('organization_subtitle', e.target.value)}
										className="admin-form-input"
										placeholder="Platformă de învățare online"
									/>
								</div>
							</div>
						)}

						{/* Step 4: Typography */}
						{currentStep === 3 && (
							<div className="certificate-wizard-step-content">
								<h2 className="certificate-wizard-step-header">Tipografie și Text</h2>
								<p className="certificate-wizard-step-subheader">
									Alege fontul și adaugă text personalizat opțional pentru certificat.
								</p>
								<div className="admin-form-group">
									<label className="admin-form-label">Font Family</label>
									<select
										value={settings.font_family}
										onChange={(e) => updateSetting('font_family', e.target.value)}
										className="admin-form-input"
									>
										<option value="Georgia, serif">Georgia (Serif)</option>
										<option value="'Times New Roman', serif">Times New Roman</option>
										<option value="Arial, sans-serif">Arial (Sans-serif)</option>
										<option value="'Helvetica Neue', sans-serif">Helvetica Neue</option>
										<option value="'Courier New', monospace">Courier New (Monospace)</option>
									</select>
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">
										Text Personalizat
										<span className="admin-form-label-hint">Text opțional care va apărea pe certificat</span>
									</label>
									<textarea
										value={settings.custom_text}
										onChange={(e) => updateSetting('custom_text', e.target.value)}
										className="admin-form-input"
										rows="4"
										placeholder="Ex: Acest certificat atestă finalizarea cu succes a cursului..."
									/>
								</div>
							</div>
						)}

						{/* Step 5: Preview */}
						{currentStep === 4 && (
							<div className="certificate-wizard-step-content">
								<h2 className="certificate-wizard-step-header">Preview Final</h2>
								<p className="certificate-wizard-step-subheader">
									Verifică aspectul final al certificatului. Poți reveni la pașii anteriori pentru modificări.
								</p>
								<div className="certificate-preview-container">
									<CertificatePreviewContent
										certificate={previewCertificate}
										settings={settings}
									/>
								</div>
								</div>
							)}
							</div>

							{/* Live Preview Sidebar - for steps 2-4 */}
							{currentStep > 0 && currentStep < 4 && (
								<div className="certificate-wizard-preview">
									<div className="certificate-wizard-preview-header">
										<h3>Preview Live</h3>
										<p>Vizualizează modificările în timp real</p>
									</div>
									<div className="certificate-wizard-preview-content">
										<CertificatePreviewContent
											certificate={previewCertificate}
											settings={settings}
										/>
									</div>
								</div>
							)}
						</>
					)}
				</div>

				{/* Navigation Footer */}
				<div className="certificate-wizard-footer">
					<button
						onClick={handleBack}
						disabled={currentStep === 0}
						className="admin-btn admin-btn-secondary"
					>
						← Înapoi
					</button>
					<div className="certificate-wizard-progress">
						<span>Pas {currentStep + 1} din {steps.length}</span>
					</div>
					<button
						onClick={currentStep === steps.length - 1 ? handleSave : handleNext}
						disabled={saving}
						className="admin-btn admin-btn-primary"
					>
						{currentStep === steps.length - 1 ? (saving ? 'Se salvează...' : '💾 Salvează') : 'Următorul →'}
					</button>
				</div>
			</div>
		</div>
	);
};

// Certificate Preview Component
const CertificatePreviewContent = ({ certificate, settings }) => {
	const getCertificateStyles = () => {
		return {
			background: settings.background_color,
			borderColor: settings.border_color,
			borderStyle: settings.border_style,
			borderWidth: settings.border_width,
			fontFamily: settings.font_family,
		};
	};

	const TemplateComponent = {
		classic: ClassicCertificateTemplate,
		modern: ModernCertificateTemplate,
		premium: PremiumCertificateTemplate,
	}[settings.template] || ModernCertificateTemplate;

	return (
		<div className="certificate-preview-content" style={getCertificateStyles()}>
			<TemplateComponent certificate={certificate} settings={settings} />
		</div>
	);
};

// Template Components (same as before)
const ClassicCertificateTemplate = ({ certificate, settings }) => {
	return (
		<div style={{ padding: '60px', textAlign: 'center' }}>
			{settings.logo_url && (
				<img src={settings.logo_url} alt="Logo" style={{ height: '80px', marginBottom: '30px' }} />
			)}
			<h1 style={{ fontSize: '36px', marginBottom: '20px', color: settings.primary_color }}>
				CERTIFICAT DE FINALIZARE
			</h1>
			<p style={{ fontSize: '14px', color: '#666', marginBottom: '40px' }}>
				{settings.organization_name}
			</p>
			<p style={{ fontSize: '16px', marginBottom: '20px' }}>
				Acest certificat atestă faptul că
			</p>
			<div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', color: settings.primary_color }}>
				{certificate.user_name}
			</div>
			<p style={{ fontSize: '16px', marginBottom: '20px' }}>
				a finalizat cu succes cursul
			</p>
			<div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '40px', color: settings.secondary_color }}>
				{certificate.course_title}
			</div>
			{settings.custom_text && (
				<p style={{ fontSize: '14px', color: '#666', marginBottom: '30px', fontStyle: 'italic' }}>
					{settings.custom_text}
				</p>
			)}
			<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
				<div>
					<p style={{ fontSize: '12px', color: '#666' }}>Data: {new Date(certificate.completion_date).toLocaleDateString('ro-RO')}</p>
				</div>
				<div>
					<p style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>ID: {certificate.certificate_id}</p>
				</div>
			</div>
		</div>
	);
};

const ModernCertificateTemplate = ({ certificate, settings }) => {
	return (
		<div style={{ padding: '60px', textAlign: 'center', background: `linear-gradient(135deg, ${settings.background_color} 0%, ${settings.secondary_color}15 100%)` }}>
			{settings.logo_url && (
				<img src={settings.logo_url} alt="Logo" style={{ height: '60px', marginBottom: '20px' }} />
			)}
			<div style={{ fontSize: '48px', marginBottom: '20px' }}>🎓</div>
			<h1 style={{ fontSize: '28px', marginBottom: '10px', color: settings.primary_color, letterSpacing: '2px' }}>
				CERTIFICAT DE FINALIZARE
			</h1>
			<p style={{ fontSize: '12px', color: '#666', marginBottom: '40px' }}>
				{settings.organization_subtitle}
			</p>
			<p style={{ fontSize: '14px', marginBottom: '20px', color: '#475569' }}>
				Acest certificat atestă faptul că
			</p>
			<div style={{
				fontSize: '32px',
				fontWeight: 'bold',
				marginBottom: '20px',
				color: settings.primary_color,
				padding: '15px',
				background: `linear-gradient(135deg, ${settings.primary_color}15 0%, ${settings.secondary_color}10 100%)`,
				borderRadius: '8px',
				border: `2px solid ${settings.primary_color}30`
			}}>
				{certificate.user_name}
			</div>
			<p style={{ fontSize: '14px', marginBottom: '20px', color: '#475569' }}>
				a finalizat cu succes cursul
			</p>
			<div style={{
				fontSize: '22px',
				fontWeight: '600',
				marginBottom: '40px',
				color: settings.secondary_color,
				padding: '15px',
				borderLeft: `4px solid ${settings.primary_color}`
			}}>
				{certificate.course_title}
			</div>
			{settings.custom_text && (
				<p style={{ fontSize: '12px', color: '#64748b', marginBottom: '30px', fontStyle: 'italic' }}>
					{settings.custom_text}
				</p>
			)}
			<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
				<div>
					<p style={{ fontSize: '11px', color: '#64748b' }}>Data finalizării</p>
					<p style={{ fontSize: '13px', fontWeight: '600' }}>{new Date(certificate.completion_date).toLocaleDateString('ro-RO')}</p>
				</div>
				<div>
					<p style={{ fontSize: '11px', color: '#64748b' }}>ID Certificat</p>
					<p style={{ fontSize: '11px', fontFamily: 'monospace' }}>{certificate.certificate_id}</p>
				</div>
			</div>
		</div>
	);
};

const PremiumCertificateTemplate = ({ certificate, settings }) => {
	return (
		<div style={{
			padding: '60px',
			textAlign: 'center',
			background: `linear-gradient(135deg, ${settings.background_color} 0%, ${settings.primary_color}08 50%, ${settings.secondary_color}08 100%)`,
			position: 'relative'
		}}>
			<div style={{
				position: 'absolute',
				top: '20px',
				left: '20px',
				right: '20px',
				bottom: '20px',
				border: `2px ${settings.border_style} ${settings.border_color}`,
				borderRadius: '8px',
				opacity: 0.3
			}}></div>
			{settings.logo_url && (
				<img src={settings.logo_url} alt="Logo" style={{ height: '70px', marginBottom: '25px', position: 'relative', zIndex: 1 }} />
			)}
			<div style={{ fontSize: '56px', marginBottom: '25px', position: 'relative', zIndex: 1 }}>🏆</div>
			<h1 style={{
				fontSize: '32px',
				marginBottom: '15px',
				background: `linear-gradient(135deg, ${settings.primary_color} 0%, ${settings.secondary_color} 100%)`,
				WebkitBackgroundClip: 'text',
				WebkitTextFillColor: 'transparent',
				letterSpacing: '3px',
				position: 'relative',
				zIndex: 1
			}}>
				CERTIFICAT DE FINALIZARE
			</h1>
			<p style={{ fontSize: '13px', color: '#64748b', marginBottom: '50px', position: 'relative', zIndex: 1 }}>
				{settings.organization_name} • {settings.organization_subtitle}
			</p>
			<p style={{ fontSize: '15px', marginBottom: '25px', color: '#475569', position: 'relative', zIndex: 1 }}>
				Acest certificat atestă faptul că
			</p>
			<div style={{
				fontSize: '36px',
				fontWeight: 'bold',
				marginBottom: '25px',
				background: `linear-gradient(135deg, ${settings.primary_color} 0%, ${settings.secondary_color} 100%)`,
				WebkitBackgroundClip: 'text',
				WebkitTextFillColor: 'transparent',
				position: 'relative',
				zIndex: 1
			}}>
				{certificate.user_name}
			</div>
			<p style={{ fontSize: '15px', marginBottom: '25px', color: '#475569', position: 'relative', zIndex: 1 }}>
				a finalizat cu succes cursul
			</p>
			<div style={{
				fontSize: '26px',
				fontWeight: '600',
				marginBottom: '50px',
				color: settings.secondary_color,
				padding: '20px 30px',
				background: `linear-gradient(135deg, ${settings.primary_color}10 0%, ${settings.secondary_color}10 100%)`,
				borderRadius: '10px',
				borderLeft: `5px solid ${settings.accent_color}`,
				position: 'relative',
				zIndex: 1
			}}>
				{certificate.course_title}
			</div>
			{settings.custom_text && (
				<p style={{ fontSize: '13px', color: '#64748b', marginBottom: '40px', fontStyle: 'italic', position: 'relative', zIndex: 1 }}>
					{settings.custom_text}
				</p>
			)}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				marginTop: '50px',
				paddingTop: '30px',
				borderTop: `2px solid ${settings.border_color}30`,
				position: 'relative',
				zIndex: 1
			}}>
				<div>
					<p style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>Data finalizării</p>
					<p style={{ fontSize: '14px', fontWeight: '600' }}>{new Date(certificate.completion_date).toLocaleDateString('ro-RO')}</p>
				</div>
				<div>
					<p style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>ID Certificat</p>
					<p style={{ fontSize: '12px', fontFamily: 'monospace' }}>{certificate.certificate_id}</p>
				</div>
			</div>
		</div>
	);
};

export default AdminCertificateSettingsPage;
