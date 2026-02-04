import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/** Loads admin CSS only when user is admin - reduces initial load for students */
export default function AdminStylesLoader() {
	const { user } = useAuth();
	const loadedRef = useRef(false);

	useEffect(() => {
		if (user?.role === 'admin' && !loadedRef.current) {
			loadedRef.current = true;
			import('../styles/admin-styles-bundle.js');
		}
	}, [user?.role]);

	return null;
}
