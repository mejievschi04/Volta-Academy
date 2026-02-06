import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/** Loads admin CSS only when user is admin - reduces initial load for students.
 *  When loadOnAdminPagesOnly=true, loads only on /admin/* paths (not when admin views student preview). */
export default function AdminStylesLoader({ loadOnAdminPagesOnly = false }) {
	const { user } = useAuth();
	const location = useLocation();
	const loadedRef = useRef(false);

	useEffect(() => {
		const isAdminPage = location.pathname.startsWith('/admin');
		const shouldLoad = user?.role === 'admin' &&
			(!loadOnAdminPagesOnly || isAdminPage) &&
			!loadedRef.current;
		if (shouldLoad) {
			loadedRef.current = true;
			import('../styles/admin-styles-bundle.js');
		}
	}, [user?.role, loadOnAdminPagesOnly, location.pathname]);

	return null;
}
