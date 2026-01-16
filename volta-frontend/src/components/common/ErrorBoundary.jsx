import React from 'react';
import { logger } from '../../utils/logger';

/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 */
class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { 
			hasError: false, 
			error: null,
			errorInfo: null 
		};
	}

	static getDerivedStateFromError(error) {
		// Update state so the next render will show the fallback UI
		return { hasError: true };
	}

	componentDidCatch(error, errorInfo) {
		// Log error to error reporting service
		logger.error('Error Boundary caught an error:', {
			error,
			errorInfo,
			componentStack: errorInfo.componentStack,
		});

		this.setState({
			error,
			errorInfo,
		});

		// In production, you might want to send this to an error reporting service
		// Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
	}

	handleReset = () => {
		this.setState({ 
			hasError: false, 
			error: null,
			errorInfo: null 
		});
	};

	render() {
		if (this.state.hasError) {
			// Custom fallback UI
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.handleReset);
			}

			// Default fallback UI
			return (
				<div style={{
					padding: '2rem',
					textAlign: 'center',
					background: 'var(--bg-primary, #fff)',
					borderRadius: 'var(--radius-lg, 8px)',
					margin: '2rem auto',
					maxWidth: '600px',
					boxShadow: 'var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1))',
				}}>
					<div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
					<h2 style={{ 
						color: 'var(--text-primary, #333)',
						marginBottom: '1rem' 
					}}>
						Ceva nu a mers bine
					</h2>
					<p style={{ 
						color: 'var(--text-secondary, #666)',
						marginBottom: '1.5rem' 
					}}>
						A apărut o eroare neașteptată. Te rugăm să reîncarci pagina sau să contactezi suportul dacă problema persistă.
					</p>
					{this.props.showDetails && this.state.error && (
						<details style={{
							marginTop: '1rem',
							padding: '1rem',
							background: 'var(--bg-elevated, #f5f5f5)',
							borderRadius: 'var(--radius-md, 4px)',
							textAlign: 'left',
							fontSize: '0.875rem',
							color: 'var(--text-tertiary, #999)',
						}}>
							<summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
								Detalii tehnice
							</summary>
							<pre style={{ 
								overflow: 'auto',
								whiteSpace: 'pre-wrap',
								wordBreak: 'break-word',
							}}>
								{this.state.error.toString()}
								{this.state.errorInfo?.componentStack}
							</pre>
						</details>
					)}
					<div style={{ marginTop: '1.5rem' }}>
						<button
							onClick={this.handleReset}
							style={{
								padding: '0.75rem 1.5rem',
								background: 'var(--accent-primary, #007bff)',
								color: 'white',
								border: 'none',
								borderRadius: 'var(--radius-md, 4px)',
								cursor: 'pointer',
								fontSize: '1rem',
								marginRight: '1rem',
							}}
						>
							Încearcă din nou
						</button>
						<button
							onClick={() => window.location.reload()}
							style={{
								padding: '0.75rem 1.5rem',
								background: 'var(--bg-secondary, #f0f0f0)',
								color: 'var(--text-primary, #333)',
								border: '1px solid var(--border-primary, #ddd)',
								borderRadius: 'var(--radius-md, 4px)',
								cursor: 'pointer',
								fontSize: '1rem',
							}}
						>
							Reîncarcă pagina
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
