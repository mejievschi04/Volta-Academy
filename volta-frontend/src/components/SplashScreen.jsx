import React, { useEffect, useState, lazy, Suspense } from 'react';
import './SplashScreen.css';

const LiquidEther = lazy(() => import('./backgrounds/LiquidEther'));

const SPLASH_LIQUID_COLORS = ['#7a7000', '#ffee00', '#ffee00'];
const MOBILE_SPLASH_QUERY = '(max-width: 768px)';
// Cât rămâne animația pe ecran, ca să nu clipească dacă aplicația e gata instant.
const MIN_VISIBLE_MS = 1200;

const getIsMobileSplash = () =>
	typeof window !== 'undefined' && window.matchMedia(MOBILE_SPLASH_QUERY).matches;

const SplashScreen = ({ onStart, appReady = true }) => {
	const [isMobile, setIsMobile] = useState(getIsMobileSplash);
	const [minTimeElapsed, setMinTimeElapsed] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia(MOBILE_SPLASH_QUERY);
		const onChange = () => setIsMobile(mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
		return () => clearTimeout(timer);
	}, []);

	// Butonul Începe apare doar după ce s-a încărcat totul (auth + prefetch)
	const ready = appReady && minTimeElapsed;

	return (
		<div className={`splash-page${ready ? ' is-ready' : ''}`}>
			{!isMobile && (
				<div className="splash-login-like-background" aria-hidden="true">
					<Suspense fallback={null}>
						<LiquidEther
							className="splash-login-liquid-ether"
							resolution={0.4}
							autoDemo={true}
							autoSpeed={0.45}
							autoIntensity={1.55}
							colors={SPLASH_LIQUID_COLORS}
						/>
					</Suspense>
					<div className="splash-login-gradient" />
					<div className="splash-login-pattern" />
					<div className="splash-logo-center-mask" />
				</div>
			)}

			<div className="splash-content">
				<div className="splash-mark-glow" aria-hidden="true">
					<div className="splash-mark">
						<span className="splash-mark-charge" />
					</div>
				</div>

				<p className="splash-wordmark">Volta Academy</p>

				<div className="splash-action">
					{ready ? (
						<button type="button" className="splash-start-btn" onClick={() => onStart?.()}>Începe</button>
					) : (
						<div className="splash-progress" role="status" aria-label="Se încarcă">
							<span className="splash-progress-bar" />
						</div>
					)}
				</div>
			</div>

			<p className="splash-powered-by">Powered by Mejievski</p>
		</div>
	);
};

export default SplashScreen;
