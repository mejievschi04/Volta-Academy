import React from 'react';

/**
 * Loader-ul de brand: chevronul Volta care se „încarcă” de jos în sus.
 * Stilurile (.va-loader*) stau în index.html, ca să existe și înainte de pornirea React;
 * același markup e folosit acolo pentru primul ecran.
 *
 * screen = acoperă tot ecranul și apare imediat (pornire, verificare sesiune);
 * fără screen = apare în zona paginii, cu o mică întârziere ca să nu clipească la încărcări rapide.
 */
const AppLoader = ({ screen = false, label = 'Se încarcă' }) => (
	<div className={`va-loader${screen ? ' va-loader--screen' : ''}`} role="status" aria-live="polite">
		<div className="va-loader__tile" aria-hidden="true">
			<div className="va-loader__mark">
				<span className="va-loader__charge" />
			</div>
		</div>
		<p className="va-loader__label">{label}</p>
	</div>
);

export default AppLoader;
