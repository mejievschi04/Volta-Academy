import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const CertificatePreview = ({ certificate, onClose, onDownload }) => {
	const { user } = useAuth();

	if (!certificate) return null;

	const completionDate = certificate.completion_date 
		? new Date(certificate.completion_date).toLocaleDateString('ro-RO', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
		: new Date().toLocaleDateString('ro-RO');

	// Settings can be attached on the certificate object (e.g. from admin settings).
	// Keep safe defaults so the preview never crashes if settings are missing.
	const certSettings = certificate?.settings || {
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
	};

	const getCertificateStyles = () => {
		const template = certSettings.template || 'modern';
		
		if (template === 'classic') {
			return {
				background: certSettings.background_color || '#ffffff',
				borderColor: certSettings.accent_color || '#ffd700',
				borderStyle: 'solid',
				borderWidth: '3px',
				fontFamily: certSettings.font_family || 'Georgia, serif',
			};
		} else if (template === 'premium') {
			return {
				background: `linear-gradient(135deg, ${certSettings.background_color || '#ffffff'} 0%, ${certSettings.primary_color || '#FFEE00'}08 50%, ${certSettings.secondary_color || '#E6D600'}08 100%)`,
				borderColor: certSettings.border_color || '#FFEE00',
				borderStyle: certSettings.border_style || 'solid',
				borderWidth: certSettings.border_width || '3px',
				fontFamily: certSettings.font_family || 'Georgia, serif',
			};
		} else {
			// modern
			return {
				background: certSettings.background_color || '#ffffff',
				borderColor: certSettings.border_color || '#FFEE00',
				borderStyle: certSettings.border_style || 'solid',
				borderWidth: certSettings.border_width || '3px',
				fontFamily: certSettings.font_family || 'Georgia, serif',
			};
		}
	};

	return (
		<div className="certificate-preview-overlay" onClick={onClose}>
			<div className="certificate-preview-modal" onClick={(e) => e.stopPropagation()}>
				<div className="certificate-preview-header">
					<h2 className="certificate-preview-title">Preview Certificat</h2>
					<button className="certificate-preview-close" onClick={onClose}>
						✕
					</button>
				</div>
				<div className="certificate-preview-body">
					<div className="certificate-preview-content" style={getCertificateStyles()}>
						{/* Certificate Design based on template */}
						{certSettings.template === 'classic' && (
							<ClassicCertificateTemplate certificate={certificate} settings={certSettings} />
						)}
						{certSettings.template === 'modern' && (
							<ModernCertificateTemplate certificate={certificate} settings={certSettings} />
						)}
						{certSettings.template === 'premium' && (
							<PremiumCertificateTemplate certificate={certificate} settings={certSettings} />
						)}
						{!certSettings.template && (
							<ModernCertificateTemplate certificate={certificate} settings={certSettings} />
						)}
					</div>
				</div>
				<div className="certificate-preview-actions">
					<button
						onClick={onClose}
						style={{
							padding: 'var(--space-3) var(--space-6)',
							background: 'var(--bg-secondary)',
							color: 'var(--text-primary)',
							border: '1px solid var(--border-primary)',
							borderRadius: 'var(--radius-md)',
							cursor: 'pointer',
							fontSize: 'var(--font-size-sm)',
							fontWeight: 'var(--font-weight-medium)',
							transition: 'all var(--transition-base)'
						}}
					>
						Închide
					</button>
					<button
						onClick={onDownload}
						style={{
							padding: 'var(--space-3) var(--space-6)',
							background: 'linear-gradient(135deg, var(--color-primary) 0%, rgba(255, 238, 0, 0.8) 100%)',
							color: 'white',
							border: 'none',
							borderRadius: 'var(--radius-md)',
							cursor: 'pointer',
							fontSize: 'var(--font-size-sm)',
							fontWeight: 'var(--font-weight-semibold)',
							transition: 'all var(--transition-base)',
							boxShadow: '0 2px 8px rgba(255, 238, 0, 0.3)'
						}}
					>
						📥 Descarcă PDF
					</button>
				</div>
			</div>
		</div>
	);
};

// Template Components
const ClassicCertificateTemplate = ({ certificate, settings }) => {
	const completionDate = certificate.completion_date 
		? new Date(certificate.completion_date).toLocaleDateString('ro-RO', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
		: new Date().toLocaleDateString('ro-RO');

	return (
		<div style={{ padding: '60px', textAlign: 'center' }}>
			{settings.logo_url && (
				<img src={settings.logo_url} alt="Logo" style={{ height: '80px', marginBottom: '30px' }} />
			)}
			<h1 style={{ fontSize: '36px', marginBottom: '20px', color: settings.primary_color || '#667eea' }}>
				CERTIFICAT DE FINALIZARE
			</h1>
			<p style={{ fontSize: '14px', color: '#666', marginBottom: '40px' }}>
				{settings.organization_name || 'Volta Academy'}
			</p>
			<p style={{ fontSize: '16px', marginBottom: '20px' }}>
				Acest certificat atestă faptul că
			</p>
			<div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', color: settings.primary_color || '#667eea' }}>
				{certificate.user_name}
			</div>
			<p style={{ fontSize: '16px', marginBottom: '20px' }}>
				a finalizat cu succes cursul
			</p>
			<div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '40px', color: settings.secondary_color || '#764ba2' }}>
				{certificate.course_title}
			</div>
			{settings.custom_text && (
				<p style={{ fontSize: '14px', color: '#666', marginBottom: '30px', fontStyle: 'italic' }}>
					{settings.custom_text}
				</p>
			)}
			<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
				<div>
					<p style={{ fontSize: '12px', color: '#666' }}>Data: {completionDate}</p>
				</div>
				<div>
					<p style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>ID: {certificate.certificate_id}</p>
				</div>
			</div>
		</div>
	);
};

const ModernCertificateTemplate = ({ certificate, settings }) => {
	const completionDate = certificate.completion_date 
		? new Date(certificate.completion_date).toLocaleDateString('ro-RO', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
		: new Date().toLocaleDateString('ro-RO');

	return (
		<div style={{ padding: '60px', textAlign: 'center', background: `linear-gradient(135deg, ${settings.background_color || '#ffffff'} 0%, ${settings.secondary_color || '#E6D600'}15 100%)` }}>
			{settings.logo_url && (
				<img src={settings.logo_url} alt="Logo" style={{ height: '60px', marginBottom: '20px' }} />
			)}
			<div style={{ fontSize: '48px', marginBottom: '20px' }}>🎓</div>
			<h1 style={{ fontSize: '28px', marginBottom: '10px', color: settings.primary_color || '#FFEE00', letterSpacing: '2px' }}>
				CERTIFICAT DE FINALIZARE
			</h1>
			<p style={{ fontSize: '12px', color: '#666', marginBottom: '40px' }}>
				{settings.organization_subtitle || 'Platformă de învățare online'}
			</p>
			<p style={{ fontSize: '14px', marginBottom: '20px', color: '#475569' }}>
				Acest certificat atestă faptul că
			</p>
			<div style={{
				fontSize: '32px',
				fontWeight: 'bold',
				marginBottom: '20px',
				color: settings.primary_color || '#FFEE00',
				padding: '15px',
				background: `linear-gradient(135deg, ${settings.primary_color || '#FFEE00'}15 0%, ${settings.secondary_color || '#E6D600'}10 100%)`,
				borderRadius: '8px',
				border: `2px solid ${settings.primary_color || '#FFEE00'}30`
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
				color: settings.secondary_color || '#E6D600',
				padding: '15px',
				borderLeft: `4px solid ${settings.primary_color || '#FFEE00'}`
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
					<p style={{ fontSize: '13px', fontWeight: '600' }}>{completionDate}</p>
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
	const completionDate = certificate.completion_date 
		? new Date(certificate.completion_date).toLocaleDateString('ro-RO', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
		: new Date().toLocaleDateString('ro-RO');

	return (
		<div style={{
			padding: '60px',
			textAlign: 'center',
			background: `linear-gradient(135deg, ${settings.background_color || '#ffffff'} 0%, ${settings.primary_color || '#FFEE00'}08 50%, ${settings.secondary_color || '#E6D600'}08 100%)`,
			position: 'relative'
		}}>
			<div style={{
				position: 'absolute',
				top: '20px',
				left: '20px',
				right: '20px',
				bottom: '20px',
				border: `2px ${settings.border_style || 'solid'} ${settings.border_color || '#FFEE00'}`,
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
				background: `linear-gradient(135deg, ${settings.primary_color || '#FFEE00'} 0%, ${settings.secondary_color || '#E6D600'} 100%)`,
				WebkitBackgroundClip: 'text',
				WebkitTextFillColor: 'transparent',
				letterSpacing: '3px',
				position: 'relative',
				zIndex: 1
			}}>
				CERTIFICAT DE FINALIZARE
			</h1>
			<p style={{ fontSize: '13px', color: '#64748b', marginBottom: '50px', position: 'relative', zIndex: 1 }}>
				{settings.organization_name || 'Volta Academy'} • {settings.organization_subtitle || 'Platformă de învățare online'}
			</p>
			<p style={{ fontSize: '15px', marginBottom: '25px', color: '#475569', position: 'relative', zIndex: 1 }}>
				Acest certificat atestă faptul că
			</p>
			<div style={{
				fontSize: '36px',
				fontWeight: 'bold',
				marginBottom: '25px',
				background: `linear-gradient(135deg, ${settings.primary_color || '#FFEE00'} 0%, ${settings.secondary_color || '#E6D600'} 100%)`,
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
				color: settings.secondary_color || '#E6D600',
				padding: '20px 30px',
				background: `linear-gradient(135deg, ${settings.primary_color || '#FFEE00'}10 0%, ${settings.secondary_color || '#E6D600'}10 100%)`,
				borderRadius: '10px',
				borderLeft: `5px solid ${settings.accent_color || '#ffd700'}`,
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
				borderTop: `2px solid ${settings.border_color || '#FFEE00'}30`,
				position: 'relative',
				zIndex: 1
			}}>
				<div>
					<p style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>Data finalizării</p>
					<p style={{ fontSize: '14px', fontWeight: '600' }}>{completionDate}</p>
				</div>
				<div>
					<p style={{ fontSize: '12px', color: '#64748b', marginBottom: '5px' }}>ID Certificat</p>
					<p style={{ fontSize: '12px', fontFamily: 'monospace' }}>{certificate.certificate_id}</p>
				</div>
			</div>
		</div>
	);
};

export default CertificatePreview;
