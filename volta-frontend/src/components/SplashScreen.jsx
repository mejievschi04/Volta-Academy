import React, { useEffect, useState } from 'react';
import '../styles/loading.css';

const SplashScreen = ({ onStart, durationMs = 3800 }) => {
	const [showButton, setShowButton] = useState(true);

	const handleStart = () => {
		onStart && onStart();
	};

	const academy = ['A','c','a','d','e','m','y'];

	return (
		<div className="va-splash-screen">
			<div className="va-splash-logo logo-electric">
				<span className="logo-v">V</span>
				<span className="va-space" />
				<span className="logo-word">
					{academy.map((ch, idx) => (
						<span
							key={idx}
							className="logo-letter"
							style={{ '--i': idx, '--revealDelay': `${0.15 * (idx + 1)}s` }}
						>
							{ch}
						</span>
					))}
				</span>
			</div>
			<div className="va-splash-powered">Powered by Mejievski</div>
			{showButton && (
				<button className="va-splash-start" onClick={handleStart} aria-label="Start">
					Start
				</button>
			)}
		</div>
	);
};

export default SplashScreen;


