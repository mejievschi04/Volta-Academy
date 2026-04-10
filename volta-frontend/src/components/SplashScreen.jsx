import React, { useEffect, useState } from 'react';
import logoShort from '../assets/Volta Logo 2@300x 1.png';
import LiquidEther from './backgrounds/LiquidEther';
import './SplashScreen.css';

const TYPEWRITER_TEXT = 'VOLTA ACADEMY';
const SPLASH_LIQUID_COLORS = ['#7a7000', '#ffee00', '#ffee00'];

const SplashScreen = ({ onStart, appReady = true }) => {
	const [displayedText, setDisplayedText] = useState('');
	const [showButton, setShowButton] = useState(false);
	const [phase, setPhase] = useState('overlay'); // overlay -> bulb -> bulb-on -> logo -> typewriter

	// Faze: overlay dispare -> bec stins -> bec aprins #FFEE00 -> doar becul dispare, logo rămâne -> typewriter sub logo
	useEffect(() => {
		const t1 = setTimeout(() => setPhase('bulb'), 1200);      // overlay gata, bec stins
		const t2 = setTimeout(() => setPhase('bulb-on'), 2400);  // bec se aprinde (#FFEE00)
		const t3 = setTimeout(() => setPhase('logo'), 3800);      // bec dispare, logo apare și rămâne
		const t4 = setTimeout(() => setPhase('typewriter'), 4500); // typewriter sub logo
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
			clearTimeout(t4);
		};
	}, []);

	// Typewriter când phase = typewriter
	useEffect(() => {
		if (phase !== 'typewriter') return;
		let index = 0;
		const intervalMs = 220;
		const typeInterval = setInterval(() => {
			if (index <= TYPEWRITER_TEXT.length) {
				setDisplayedText(TYPEWRITER_TEXT.slice(0, index));
				index++;
			} else {
				clearInterval(typeInterval);
				setTimeout(() => setShowButton(true), 400);
			}
		}, intervalMs);
		return () => clearInterval(typeInterval);
	}, [phase]);

	// Butonul Începe apare doar după ce s-a încărcat totul (auth + prefetch)
	const canShowButtons = showButton && appReady;

	return (
		<div className={`splash-page splash-phase-${phase}`}>
			{/* Overlay negru - se estompează în 1.2s */}
			<div className="splash-light-overlay" aria-hidden="true" />

			<div className="splash-login-like-background" aria-hidden="true">
				<LiquidEther
					className="splash-login-liquid-ether"
					resolution={0.4}
					autoDemo={true}
					autoSpeed={0.45}
					autoIntensity={1.55}
					colors={SPLASH_LIQUID_COLORS}
				/>
				<div className="splash-login-gradient" />
				<div className="splash-login-pattern" />
				<div className="splash-logo-center-mask" />
			</div>

			<div className="splash-content">
				<div className="splash-center-area">
					{/* Bec - doar lampa dispare după ce se aprinde (#FFEE00) */}
					{(phase === 'bulb' || phase === 'bulb-on' || phase === 'logo') && (
						<div className={`splash-bulb-container ${phase}`}>
							<svg className="splash-bulb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M9 18h6"/>
								<path d="M10 22h4"/>
								<path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
								<path d="M12 2v2"/>
								<path d="M4.93 4.93l1.41 1.41"/>
								<path d="M2 12h2"/>
								<path d="M19.07 4.93l-1.41 1.41"/>
								<path d="M20 12h2"/>
							</svg>
						</div>
					)}

					{/* Logo - rămâne vizibil, nu dispare */}
					{(phase === 'logo' || phase === 'typewriter') && (
						<div className={`splash-logo-container ${phase}`}>
							<img src={logoShort} alt="Volta Academy" className="splash-logo-img" />
						</div>
					)}

					{/* Typewriter - dispare cursorul când apar butoanele sau "Se încarcă..." */}
					{phase === 'typewriter' && (
						<div className="splash-typewriter">
							<span className="splash-typewriter-text">{displayedText}</span>
							{!showButton && <span className="splash-typewriter-cursor">|</span>}
						</div>
					)}
				</div>
			</div>

			{showButton && (
				<>
					{canShowButtons ? (
						<button className="splash-start-btn" onClick={() => onStart?.()} aria-label="Începe">Începe</button>
					) : (
						<div className="splash-loading-dots" aria-live="polite">Se încarcă...</div>
					)}
				</>
			)}
			{canShowButtons && <p className="splash-powered-by">Powered by Mejievski</p>}
		</div>
	);
};

export default SplashScreen;
