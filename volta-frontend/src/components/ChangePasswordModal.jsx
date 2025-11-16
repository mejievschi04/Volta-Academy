import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/modern-enhancements.css';

const ChangePasswordModal = () => {
	useEffect(() => {
		console.log('ChangePasswordModal mounted');
		return () => {
			console.log('ChangePasswordModal unmounted');
		};
	}, []);
	const { changePassword } = useAuth();
	const [formData, setFormData] = useState({
		currentPassword: '',
		newPassword: '',
		newPasswordConfirmation: '',
	});
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');

		if (formData.newPassword !== formData.newPasswordConfirmation) {
			setError('Parolele nu se potrivesc');
			return;
		}

		if (formData.newPassword.length < 8) {
			setError('Parola trebuie să aibă cel puțin 8 caractere');
			return;
		}

		// Validate password complexity
		const hasLowerCase = /[a-z]/.test(formData.newPassword);
		const hasUpperCase = /[A-Z]/.test(formData.newPassword);
		const hasNumber = /[0-9]/.test(formData.newPassword);

		if (!hasLowerCase || !hasUpperCase || !hasNumber) {
			setError('Parola trebuie să conțină cel puțin o literă mare, o literă mică și o cifră');
			return;
		}

		try {
			setLoading(true);
			await changePassword(formData.currentPassword, formData.newPassword, formData.newPasswordConfirmation);
			// Modal will close automatically when user.must_change_password becomes false
		} catch (err) {
			setError(err.response?.data?.message || 'Eroare la schimbarea parolei');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div 
			className="modal-backdrop" 
			style={{ 
				zIndex: 10000, 
				pointerEvents: 'all',
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center'
			}}
			onClick={(e) => {
				// Prevent closing modal by clicking backdrop - password change is mandatory
				e.stopPropagation();
			}}
		>
			<div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h2 className="modal-title">Schimbă parola</h2>
				</div>
				<div className="va-card-body">
					<p style={{ marginBottom: '1.5rem', color: 'var(--va-muted)' }}>
						Pentru securitate, trebuie să îți setezi o parolă nouă înainte de a continua.
					</p>

					{error && (
						<div style={{ 
							padding: '0.75rem', 
							background: 'rgba(220, 38, 38, 0.2)', 
							color: '#ff7d9b', 
							borderRadius: '8px', 
							marginBottom: '1rem',
							border: '1px solid rgba(220, 38, 38, 0.3)'
						}}>
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="va-stack" style={{ gap: '1rem' }}>
						<div className="form-input-modern">
							<label htmlFor="currentPassword" className="va-form-label">Parola curentă</label>
							<input
								type="password"
								id="currentPassword"
								className="va-form-input"
								value={formData.currentPassword}
								onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
								required
								placeholder="volta2025"
								autoFocus
							/>
							<p style={{ fontSize: '0.75rem', color: 'var(--va-muted)', marginTop: '0.25rem' }}>
								Parola implicită este: <strong>volta2025</strong>
							</p>
						</div>

						<div className="form-input-modern">
							<label htmlFor="newPassword" className="va-form-label">Parola nouă</label>
							<input
								type="password"
								id="newPassword"
								className="va-form-input"
								value={formData.newPassword}
								onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
								required
								minLength={6}
								placeholder="Minim 6 caractere"
							/>
						</div>

						<div className="form-input-modern">
							<label htmlFor="newPasswordConfirmation" className="va-form-label">Confirmă parola nouă</label>
							<input
								type="password"
								id="newPasswordConfirmation"
								className="va-form-input"
								value={formData.newPasswordConfirmation}
								onChange={(e) => setFormData({ ...formData, newPasswordConfirmation: e.target.value })}
								required
								minLength={6}
								placeholder="Repetă parola"
							/>
						</div>

						<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
							<button 
								type="submit" 
								className="va-btn va-btn-primary va-btn-enhanced"
								disabled={loading}
							>
								{loading ? 'Se salvează...' : 'Schimbă parola'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

export default ChangePasswordModal;

