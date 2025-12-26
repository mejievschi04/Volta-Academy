import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage = () => {
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const { register } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		// Force light theme for register page
		document.documentElement.setAttribute('data-theme', 'light');
	}, []);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		try {
			await register(name, email, password);
			navigate('/home');
		} catch (err) {
			setError(err.response?.data?.message || 'Eroare la înregistrare');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="va-auth-container">
			<div className="va-auth-card">
				<div className="va-auth-header">
					<h1 className="va-auth-title">Înregistrare</h1>
					<p className="va-auth-subtitle">Creează-ți contul pentru a începe</p>
				</div>

				<form onSubmit={handleSubmit} className="va-auth-form">
					{error && (
						<div className="va-auth-error">
							{error}
						</div>
					)}

					<div className="va-form-group">
						<label htmlFor="name" className="va-form-label">Nume complet</label>
						<input
							type="text"
							id="name"
							className="va-form-input"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							placeholder="Ion Mejievski"
						/>
					</div>

					<div className="va-form-group">
						<label htmlFor="email" className="va-form-label">Email</label>
						<input
							type="email"
							id="email"
							className="va-form-input"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							placeholder="email@example.com"
						/>
					</div>

					<div className="va-form-group">
						<label htmlFor="password" className="va-form-label">Parolă</label>
						<div className="va-password-input-wrapper">
							<input
								type={showPassword ? 'text' : 'password'}
								id="password"
								className="va-form-input"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={6}
								placeholder="••••••••"
								style={{ paddingRight: '42px' }}
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="va-password-toggle"
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
						<small className="va-form-hint">Minim 6 caractere</small>
					</div>

					<button
						type="submit"
						className="va-btn va-btn-primary va-btn-block"
						disabled={loading}
					>
						{loading ? 'Se creează contul...' : 'Înregistrare'}
					</button>
				</form>

				<div className="va-auth-footer">
					<p>
						Ai deja cont? <Link to="/login" className="va-auth-link">Autentifică-te</Link>
					</p>
				</div>
			</div>
		</div>
	);
};

export default RegisterPage;

