import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = () => {
	const { theme, toggleTheme } = useTheme();

	return (
		<button 
			className="theme-toggle"
			onClick={toggleTheme}
			aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
			title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
			style={{
				position: 'relative',
				width: '56px',
				height: '32px',
				background: 'var(--bg-tertiary)',
				border: '1px solid var(--border-primary)',
				borderRadius: 'var(--radius-full)',
				cursor: 'pointer',
				transition: 'all var(--transition-base)',
				padding: 0,
			}}
		>
			<div 
				className="theme-toggle-slider"
				style={{
					position: 'absolute',
					top: '2px',
					left: '2px',
					width: '26px',
					height: '26px',
					background: 'var(--btn-primary-bg)',
					borderRadius: 'var(--radius-full)',
					transition: 'transform var(--transition-base)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 'var(--font-size-sm)',
					transform: theme === 'light' ? 'translateX(24px)' : 'translateX(0)',
					color: 'var(--btn-primary-text)',
				}}
			>
				{theme === 'dark' ? (
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<circle cx="12" cy="12" r="5"/>
						<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
					</svg>
				) : (
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				)}
			</div>
		</button>
	);
};

export default ThemeToggle;
