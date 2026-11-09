import React from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContextShared.js';
import AppLoader from './AppLoader';

const UserRoute = ({ children }) => {
	const { user, loading } = useAuth();

	if (loading) { return <AppLoader screen />; }

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	// Allow admins to view user pages (for preview purposes)
	// They can navigate back to admin via the sidebar button

	return children;
};

export default UserRoute;

