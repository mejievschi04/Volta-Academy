import React, { useEffect, useState } from 'react';
import logoShort from '../assets/Volta Logo 2@300x 1.png';
import './SplashScreen.css';

const SplashScreen = ({ onStart, durationMs = 1500 }) => {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		// Progress animation - completes in durationMs
		const step = 100 / Math.max(20, Math.floor(durationMs / 25));
		const progressInterval = setInterval(() => {
			setProgress(prev => {
				if (prev >= 100) {
					clearInterval(progressInterval);
					setTimeout(() => onStart?.(), 150);
					return 100;
				}
				return Math.min(100, prev + step);
			});
		}, 25);

		return () => {
			clearInterval(progressInterval);
		};
	}, [onStart]);

	return (
		<div className="splash-page" onClick={() => onStart?.()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onStart?.()} aria-label="Apasă pentru a continua">
			{/* Animated background circles */}
			<div className="splash-bg-circles">
				<div className="splash-circle circle-1"></div>
				<div className="splash-circle circle-2"></div>
				<div className="splash-circle circle-3"></div>
			</div>

			<div className="splash-content">
				{/* Logo with glow effect */}
				<div className="splash-logo-wrapper">
					<div className="splash-logo-glow"></div>
					<img 
						src={logoShort} 
						alt="Volta Academy" 
						className="splash-logo"
					/>
				</div>

				{/* Brand name */}
				<div className="splash-brand">
					<h1 className="splash-brand-name">VOLTA</h1>
					<div className="splash-brand-line"></div>
					<p className="splash-brand-academy">ACADEMY</p>
				</div>

				{/* Loading indicator */}
				<div className="splash-loader">
					<div className="splash-loader-track">
						<div 
							className="splash-loader-progress"
							style={{ width: `${progress}%` }}
						>
							<div className="splash-loader-glow"></div>
						</div>
					</div>
					<div className="splash-loader-percentage">{progress}%</div>
				</div>

				{/* Loading dots */}
				<div className="splash-dots">
					<div className="splash-dot"></div>
					<div className="splash-dot"></div>
					<div className="splash-dot"></div>
				</div>
			</div>

			{/* Footer */}
			<div className="splash-footer">
				<p className="splash-footer-text">Realizat de Mejievski</p>
				<p className="splash-skip-hint">Apasă pentru a continua</p>
			</div>
		</div>
	);
};

export default SplashScreen;
