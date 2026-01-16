import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoShort from '../assets/Logo short.png';

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
			const data = await login(email, password);
			// Check user role after login to redirect appropriately
			if (data?.user?.role === 'admin') {
				navigate('/admin');
			} else {
				navigate('/home');
			}
		} catch (err) {
			setError(err.response?.data?.message || 'Eroare la autentificare');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="modern-auth-container">
			{/* Background decorative elements */}
			<div className="modern-auth-background">
				<div className="modern-auth-gradient"></div>
				<div className="modern-auth-pattern"></div>
			</div>

			{/* Main content */}
			<div className="modern-auth-content">
				<div className="modern-auth-card">
					{/* Logo and Header */}
					<div className="modern-auth-header">
						<div className="modern-auth-logo">
							<img src={logoShort} alt="Volta Academy" className="modern-auth-logo-img" />
						</div>
						<h1 className="modern-auth-title">Bine ai revenit</h1>
						<p className="modern-auth-subtitle">
							Autentifică-te pentru a continua călătoria ta de învățare
						</p>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="modern-auth-form">
						{error && (
							<div className="modern-auth-error">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<circle cx="12" cy="12" r="10"></circle>
									<line x1="12" y1="8" x2="12" y2="12"></line>
									<line x1="12" y1="16" x2="12.01" y2="16"></line>
								</svg>
								<span>{error}</span>
							</div>
						)}

						<div className="modern-form-group">
							<label htmlFor="email" className="modern-form-label">
								Email
							</label>
							<div className="modern-form-input-wrapper">
								<svg className="modern-form-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
									<polyline points="22,6 12,13 2,6"></polyline>
								</svg>
								<input
									type="email"
									id="email"
									className="modern-form-input"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									placeholder="email@example.com"
									autoComplete="email"
								/>
							</div>
						</div>

						<div className="modern-form-group">
							<label htmlFor="password" className="modern-form-label">
								Parolă
							</label>
							<div className="modern-form-input-wrapper">
								<svg className="modern-form-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
									<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
								</svg>
								<input
									type={showPassword ? 'text' : 'password'}
									id="password"
									className="modern-form-input"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									placeholder="••••••••"
									autoComplete="current-password"
									style={{ paddingRight: '48px' }}
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="modern-password-toggle"
									aria-label={showPassword ? 'Ascunde parola' : 'Arată parola'}
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
							className="modern-auth-submit"
							disabled={loading}
						>
							{loading ? (
								<>
									<svg className="modern-auth-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none">
										<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
										<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
									</svg>
									<span>Se autentifică...</span>
								</>
							) : (
								<>
									<span>Autentificare</span>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<line x1="5" y1="12" x2="19" y2="12"></line>
										<polyline points="12 5 19 12 12 19"></polyline>
									</svg>
								</>
							)}
						</button>
					</form>

					{/* Footer */}
					<div className="modern-auth-footer">
						<p className="modern-auth-footer-text">
							Nu ai cont?{' '}
							<Link to="/register" className="modern-auth-link">
								Înregistrează-te
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LoginPage;

