import React, { useEffect, useState } from 'react';
import logoShort from '../assets/Logo short.png';
import './SplashScreen.css';

const SplashScreen = ({ onStart, durationMs = 2000 }) => {
	const [isVisible, setIsVisible] = useState(false);
	const [progress, setProgress] = useState(0);
	const [displayText, setDisplayText] = useState('');
	const fullText = 'Formely';

	useEffect(() => {
		// Trigger animation after mount
		setTimeout(() => setIsVisible(true), 50);

		// Typewriter effect for "Volta"
		let currentIndex = 0;
		const typewriterInterval = setInterval(() => {
			if (currentIndex < fullText.length) {
				setDisplayText(fullText.slice(0, currentIndex + 1));
				currentIndex++;
			} else {
				clearInterval(typewriterInterval);
			}
		}, 300); // 300ms delay between letters

		// Progress animation
		const progressInterval = setInterval(() => {
			setProgress(prev => {
				if (prev >= 100) {
					clearInterval(progressInterval);
					return 100;
				}
				return prev + 3;
			});
		}, 40);

		return () => {
			clearInterval(typewriterInterval);
			clearInterval(progressInterval);
		};
	}, []);

	const handleStart = () => {
		onStart && onStart();
	};

	// Generate flame particles
	const flameParticles = Array.from({ length: 8 }, (_, i) => ({
		id: i,
		angle: (i * 360) / 8,
		delay: i * 0.2,
		duration: 3 + Math.random() * 1,
	}));

	return (
		<div className="splash-screen">
			<div className={`splash-content ${isVisible ? 'visible' : ''}`}>
				<div className="splash-logo">
					{/* Flame particles */}
					{flameParticles.map(particle => {
						const angle = (particle.angle * Math.PI) / 180;
						const distance = 80;
						const x = Math.cos(angle) * distance;
						const y = Math.sin(angle) * distance;
						return (
							<div
								key={particle.id}
								className="splash-flame-particle"
								style={{
									left: `calc(50% + ${x}px)`,
									top: `calc(50% + ${y}px)`,
									animationDelay: `${particle.delay}s`,
									animationDuration: `${particle.duration}s`,
									'--flame-x': `${x * 0.5}px`,
								}}
							/>
						);
					})}
					<img 
						src={logoShort} 
						alt="Volta Academy" 
						className="splash-logo-img"
					/>
				</div>

				{/* Formely text under logo */}
				<div className="splash-formely">
					<p className="splash-formely-text">{displayText}</p>
				</div>

				{/* Progress bar */}
				<div className="splash-progress-container">
					<div className="splash-progress-bar">
						<div 
							className="splash-progress-fill"
							style={{ width: `${progress}%` }}
						></div>
					</div>
				</div>

				{progress >= 100 && (
					<button 
						className="splash-button"
						onClick={handleStart} 
						aria-label="Start"
					>
						Start
					</button>
				)}

				{/* Footer text - powered by Mejievski */}
				<div className="splash-footer">
					<p className="splash-footer-text">powered by Mejievski</p>
				</div>
			</div>
		</div>
	);
};

export default SplashScreen;


