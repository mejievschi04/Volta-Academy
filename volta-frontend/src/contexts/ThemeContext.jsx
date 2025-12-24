import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};

export const ThemeProvider = ({ children }) => {
	useEffect(() => {
		// Set fixed theme - no switching
		document.documentElement.setAttribute('data-theme', 'light');
	}, []);

	return (
		<ThemeContext.Provider value={{ theme: 'light' }}>
			{children}
		</ThemeContext.Provider>
	);
};
