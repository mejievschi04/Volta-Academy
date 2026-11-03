import { useEffect, useRef } from 'react';

/**
 * Oprește ieșirea din pagină cât timp `enabled` e adevărat.
 * - închidere / reîncărcare tab: dialogul nativ al browserului;
 * - click pe un link intern care duce în afara paginii (`stayPrefix`): `onAttempt(href)` în loc de navigare.
 * Aplicația folosește BrowserRouter, unde `useBlocker` din React Router nu funcționează.
 */
const useLeaveGuard = ({ enabled, stayPrefix, onAttempt }) => {
	const onAttemptRef = useRef(onAttempt);
	useEffect(() => {
		onAttemptRef.current = onAttempt;
	}, [onAttempt]);

	useEffect(() => {
		if (!enabled) return undefined;

		const handleBeforeUnload = (event) => {
			event.preventDefault();
			event.returnValue = '';
			return '';
		};

		const handleClick = (event) => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
			if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

			let url;
			try {
				url = new URL(anchor.href, window.location.href);
			} catch {
				return;
			}
			if (url.origin !== window.location.origin) return;
			if (stayPrefix && url.pathname.startsWith(stayPrefix)) return;

			event.preventDefault();
			event.stopPropagation();
			onAttemptRef.current?.(`${url.pathname}${url.search}${url.hash}`);
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		// capture: înaintea handler-ului de navigare al <Link>/<NavLink>
		document.addEventListener('click', handleClick, true);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			document.removeEventListener('click', handleClick, true);
		};
	}, [enabled, stayPrefix]);
};

export default useLeaveGuard;
