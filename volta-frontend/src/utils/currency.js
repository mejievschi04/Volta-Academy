/**
 * Currency utility functions
 */

// Get currency symbol
export const getCurrencySymbol = (currencyCode) => {
	const symbols = {
		MDL: 'MDL',
		RON: 'RON',
		USD: '$',
		EUR: '€',
	};
	return symbols[currencyCode] || currencyCode;
};

// Get currency name
export const getCurrencyName = (currencyCode) => {
	const names = {
		MDL: 'Leu moldovenesc',
		RON: 'Leu românesc',
		USD: 'Dolar american',
		EUR: 'Euro',
	};
	return names[currencyCode] || currencyCode;
};

// Format currency amount
export const formatCurrency = (amount, currencyCode = 'RON', locale = 'ro-RO') => {
	if (amount === null || amount === undefined) {
		return 'N/A';
	}

	const currencySymbol = getCurrencySymbol(currencyCode);
	
	// For MDL and RON, use custom formatting
	if (currencyCode === 'MDL' || currencyCode === 'RON') {
		return new Intl.NumberFormat(locale, {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		}).format(amount) + ' ' + currencySymbol;
	}

	// For USD and EUR, use standard currency formatting
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: currencyCode,
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount);
};

// Get default currency from settings or localStorage
export const getDefaultCurrency = () => {
	// Try to get from localStorage first (user preference)
	const stored = localStorage.getItem('volta_currency');
	if (stored && ['MDL', 'RON', 'USD', 'EUR'].includes(stored)) {
		return stored;
	}
	
	// Default to RON
	return 'RON';
};

// Set default currency
export const setDefaultCurrency = (currencyCode) => {
	if (['MDL', 'RON', 'USD', 'EUR'].includes(currencyCode)) {
		localStorage.setItem('volta_currency', currencyCode);
	}
};

