import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onStart, durationMs = 3800 }) => {
	const [showButton, setShowButton] = useState(true);
	const [isVisible, setIsVisible] = useState(false);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		// Force light theme for splash screen
		document.documentElement.setAttribute('data-theme', 'light');
		
		// Trigger animation after mount
		setTimeout(() => setIsVisible(true), 50);
		
		// Progress animation
		const progressInterval = setInterval(() => {
			setProgress(prev => {
				if (prev >= 100) {
					clearInterval(progressInterval);
					return 100;
				}
				return prev + 2;
			});
		}, 50);
		
		return () => {
			clearInterval(progressInterval);
		};
	}, []);

	const handleStart = () => {
		onStart && onStart();
	};

	const formely = ['f','o','r','m','e','l','y'];

	// Generate floating particles
	const particles = Array.from({ length: 20 }, (_, i) => ({
		id: i,
		size: Math.random() * 4 + 2,
		duration: Math.random() * 20 + 15,
		delay: Math.random() * 5,
		x: Math.random() * 100,
	}));

	return (
		<div className="splash-screen">
			{/* Animated background */}
			<div className="splash-background">
				<div className="splash-gradient-orb splash-orb-1"></div>
				<div className="splash-gradient-orb splash-orb-2"></div>
				<div className="splash-gradient-orb splash-orb-3"></div>
			</div>

			{/* Floating particles */}
			<div className="splash-particles">
				{particles.map(particle => (
					<div
						key={particle.id}
						className="splash-particle"
						style={{
							left: `${particle.x}%`,
							width: `${particle.size}px`,
							height: `${particle.size}px`,
							animationDuration: `${particle.duration}s`,
							animationDelay: `${particle.delay}s`,
						}}
					/>
				))}
			</div>

			<div className={`splash-content ${isVisible ? 'visible' : ''}`}>
				<div className="splash-logo">
					<div className="splash-logo-icon">
						<div className="splash-icon-glow"></div>
						<div className="splash-icon-pulse"></div>
						<svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path 
								d="M26.5 8.5L12.5 22.5L5.5 15.5" 
								stroke="currentColor" 
								strokeWidth="3" 
								strokeLinecap="round" 
								strokeLinejoin="round"
								className="splash-checkmark"
							/>
						</svg>
					</div>
					<div className="splash-logo-text">
						{formely.map((ch, idx) => (
							<span
								key={idx}
								className="splash-letter"
							>
								<span className="splash-letter-inner">{ch}</span>
							</span>
						))}
					</div>
				</div>

				{/* Progress bar */}
				<div className="splash-progress-container">
					<div className="splash-progress-bar">
						<div 
							className="splash-progress-fill"
							style={{ width: `${progress}%` }}
						></div>
						<div className="splash-progress-glow"></div>
					</div>
				</div>

				<div className="splash-tagline">
					<span className="splash-tagline-text">Powered by Mejievski</span>
				</div>
				{showButton && (
					<button 
						className="splash-button"
						onClick={handleStart} 
						aria-label="Start"
					>
						<span className="splash-button-text">Start</span>
						<span className="splash-button-shine"></span>
					</button>
				)}
			</div>
		</div>
	);
};

export default SplashScreen;


