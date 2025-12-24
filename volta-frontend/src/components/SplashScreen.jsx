import React, { useEffect, useState } from 'react';

const SplashScreen = ({ onStart, durationMs = 3800 }) => {
	const [showButton, setShowButton] = useState(true);

	const handleStart = () => {
		onStart && onStart();
	};

	const academy = ['A','c','a','d','e','m','y'];

	return (
		<div style={{
			position: 'fixed',
			inset: 0,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			background: 'var(--bg-primary)',
			zIndex: 10000,
		}}>
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: 'var(--space-2)',
				marginBottom: 'var(--space-8)',
			}}>
				<span style={{
					fontSize: 'var(--font-size-5xl)',
					fontWeight: 'var(--font-weight-extrabold)',
					background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
					WebkitBackgroundClip: 'text',
					WebkitTextFillColor: 'transparent',
					backgroundClip: 'text',
				}}>
					V
				</span>
				<div style={{
					display: 'flex',
					gap: 'var(--space-1)',
				}}>
					{academy.map((ch, idx) => (
						<span
							key={idx}
							style={{
								fontSize: 'var(--font-size-5xl)',
								fontWeight: 'var(--font-weight-extrabold)',
								color: 'var(--text-primary)',
								animation: `fadeIn ${0.15 * (idx + 1)}s ease-out`,
							}}
						>
							{ch}
						</span>
					))}
				</div>
			</div>
			<div style={{
				fontSize: 'var(--font-size-sm)',
				color: 'var(--text-tertiary)',
				marginBottom: 'var(--space-8)',
			}}>
				Powered by Mejievski
			</div>
			{showButton && (
				<button 
					className="btn btn-primary btn-lg"
					onClick={handleStart} 
					aria-label="Start"
				>
					Start
				</button>
			)}
		</div>
	);
};

export default SplashScreen;


