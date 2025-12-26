import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(() => {
		// Get theme from localStorage or default to 'light'
		const savedTheme = localStorage.getItem('volta-theme');
		return savedTheme === 'dark' ? 'dark' : 'light';
	});

	useEffect(() => {
		// Apply theme to document
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('volta-theme', theme);
	}, [theme]);

	const toggleTheme = () => {
		setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
	};

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};
