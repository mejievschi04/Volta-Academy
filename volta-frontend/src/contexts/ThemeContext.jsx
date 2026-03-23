import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
};

/** Tema este întotdeauna light; tema dark a fost eliminată. */
export const ThemeProvider = ({ children }) => {
	useEffect(() => {
		document.documentElement.setAttribute('data-theme', 'light');
	}, []);

	return (
		<ThemeContext.Provider value={{ theme: 'light' }}>
			{children}
		</ThemeContext.Provider>
	);
};
