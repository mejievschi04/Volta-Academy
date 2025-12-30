import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

export const AuthContext = createContext(null);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within AuthProvider');
	}
	return context;
};

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		checkAuth();
	}, []);

	const checkAuth = async () => {
		try {
			const data = await authService.me();
			setUser(data?.user || null);
		} catch (error) {
			// Silently handle auth check failures (401 is expected when not logged in)
			setUser(null);
		} finally {
			setLoading(false);
		}
	};

	const login = async (email, password) => {
		const data = await authService.login(email, password);
		setUser(data.user);
		return data;
	};

	const changePassword = async (currentPassword, newPassword, newPasswordConfirmation) => {
		const data = await authService.changePassword(currentPassword, newPassword, newPasswordConfirmation);
		setUser(data.user);
		return data;
	};

	const register = async (name, email, password) => {
		const data = await authService.register(name, email, password);
		setUser(data.user);
		return data;
	};

	const logout = async () => {
		await authService.logout();
		setUser(null);
	};

	return (
		<AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, changePassword }}>
			{children}
		</AuthContext.Provider>
	);
};

