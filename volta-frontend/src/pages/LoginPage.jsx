import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const { login } = useAuth();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		try {
			await login(email, password);
			navigate('/home');
		} catch (err) {
			setError(err.response?.data?.message || 'Eroare la autentificare');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="va-auth-container" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
			<div
				className="va-auth-card va-neon-border"
				style={{
					width: 'min(92vw, 440px)',
					borderRadius: 22,
					border: '1px solid transparent',
					backgroundImage:
						'linear-gradient(rgba(0,0,0,0.86), rgba(0,0,0,0.86)),' +
						'linear-gradient(135deg, rgba(255,238,0,0.28), rgba(255,204,0,0.18))',
					backgroundOrigin: 'border-box',
					backgroundClip: 'padding-box, border-box',
					backdropFilter: 'blur(16px)',
					boxShadow: '0 30px 60px rgba(8,10,24,0.55), inset 0 0 22px rgba(255,255,255,0.02)'
				}}
			>
				<div className="va-auth-header" style={{ textAlign: 'center', paddingTop: 22 }}>
					<h1 className="va-auth-title" style={{ margin: 0, fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg, #fff, #dfe3ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Autentificare</h1>
					<p className="va-auth-subtitle" style={{ marginTop: 8, color: 'var(--va-muted)' }}>Bine ai revenit la V Academy</p>
				</div>

				<form onSubmit={handleSubmit} className="va-auth-form" style={{ padding: 22, display: 'grid', gap: 14 }}>
					{error && (
						<div className="va-auth-error" style={{ background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,0,0,0.25)', color: '#ffb3b3', padding: '10px 12px', borderRadius: 12 }}>
							{error}
						</div>
					)}

					<div className="va-form-group">
						<label htmlFor="email" className="va-form-label" style={{ display: 'block', marginBottom: 6, color: 'var(--va-muted)', fontSize: 13, fontWeight: 600 }}>Email</label>
						<input
							type="email"
							id="email"
							className="va-form-input"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							placeholder="email@example.com"
							style={{
								width: '100%',
								padding: '12px 14px',
								borderRadius: 12,
								background: 'rgba(255,255,255,0.03)',
								border: '1px solid rgba(255,238,0,0.14)',
								color: '#fff',
								boxShadow: 'inset 0 0 0 rgba(0,0,0,0), 0 0 0 rgba(0,0,0,0)'
							}}
						/>
					</div>

					<div className="va-form-group">
						<label htmlFor="password" className="va-form-label" style={{ display: 'block', marginBottom: 6, color: 'var(--va-muted)', fontSize: 13, fontWeight: 600 }}>Parolă</label>
						<div style={{ position: 'relative' }}>
							<input
								type={showPassword ? 'text' : 'password'}
								id="password"
								className="va-form-input"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								placeholder="••••••••"
								style={{
									width: '100%',
									padding: '12px 42px 12px 14px',
									borderRadius: 12,
									background: 'rgba(255,255,255,0.03)',
									border: '1px solid rgba(255,238,0,0.14)',
									color: '#fff',
									boxShadow: 'inset 0 0 0 rgba(0,0,0,0), 0 0 0 rgba(0,0,0,0)'
								}}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								style={{
									position: 'absolute',
									right: '12px',
									top: '50%',
									transform: 'translateY(-50%)',
									background: 'transparent',
									border: 'none',
									cursor: 'pointer',
									padding: '4px',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									color: 'var(--va-muted)',
								}}
								onMouseEnter={(e) => e.currentTarget.style.color = 'var(--va-primary)'}
								onMouseLeave={(e) => e.currentTarget.style.color = 'var(--va-muted)'}
							>
								{showPassword ? (
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
										<line x1="1" y1="1" x2="23" y2="23"></line>
									</svg>
								) : (
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
										<circle cx="12" cy="12" r="3"></circle>
									</svg>
								)}
							</button>
						</div>
					</div>

					<button
						type="submit"
						className="va-btn va-btn-primary va-btn-block"
						disabled={loading}
						style={{ width: '100%', borderRadius: 12, padding: '12px 16px', fontWeight: 800, letterSpacing: '0.06em', color: '#000000' }}
					>
						{loading ? 'Se autentifică...' : 'Autentificare'}
					</button>
				</form>

				<div className="va-auth-footer" style={{ padding: '0 22px 22px', textAlign: 'center', color: 'var(--va-muted)' }}>
					<p>
						Nu ai cont? <Link to="/register" className="va-auth-link">Înregistrează-te</Link>
					</p>
				</div>

				
			</div>
		</div>
	);
};

export default LoginPage;

