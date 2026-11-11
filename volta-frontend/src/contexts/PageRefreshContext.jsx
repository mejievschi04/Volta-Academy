import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const PageRefreshContext = createContext(null);

export function PageRefreshProvider({ children }) {
	const handlerRef = useRef(null);
	const [active, setActive] = useState(false);

	const register = useCallback((handler) => {
		handlerRef.current = handler;
		setActive(true);
		return () => {
			if (handlerRef.current === handler) {
				handlerRef.current = null;
				setActive(false);
			}
		};
	}, []);

	const refresh = useCallback(() => handlerRef.current?.(), []);
	const value = useMemo(() => ({ register, refresh, active }), [register, refresh, active]);

	return <PageRefreshContext.Provider value={value}>{children}</PageRefreshContext.Provider>;
}

/** Pagina curentă își înregistrează reîncărcarea. Tragerea în jos o apelează. */
export function useRegisterPageRefresh(handler) {
	const ctx = useContext(PageRefreshContext);
	const handlerRef = useRef(handler);
	handlerRef.current = handler;

	useEffect(() => {
		if (!ctx) return undefined;
		return ctx.register(() => handlerRef.current?.());
	}, [ctx]);
}

export function usePageRefreshControls() {
	return useContext(PageRefreshContext);
}
