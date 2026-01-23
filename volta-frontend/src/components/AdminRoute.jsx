import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
	const { user, loading } = useAuth();

	if (loading) { return null; }

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	// Strict protection: only admins can access admin pages
	// Students and other users are redirected to home
	if (user.role !== 'admin') {
		// Redirect students to their home page
		if (user.role === 'student' || !user.role || user.role === '') {
			return <Navigate to="/home" replace />;
		}
		// Redirect other users to home
		return <Navigate to="/home" replace />;
	}

	return children;
};

export default AdminRoute;

