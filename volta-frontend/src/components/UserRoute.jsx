import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const UserRoute = ({ children }) => {
	const { user, loading } = useAuth();

	if (loading) { return null; }

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	// Redirect admins to admin dashboard
	if (user.role === 'admin') {
		return <Navigate to="/admin" replace />;
	}

	return children;
};

export default UserRoute;

