import React from 'react';

/** Pictogramă prindere drag — linii orizontale (fără puncte circulare). */
export function DragGripIcon({ size = 20, className, ...rest }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			className={className}
			aria-hidden
			{...rest}
		>
			<rect x="5" y="5.5" width="14" height="2.5" rx="1" />
			<rect x="5" y="10.75" width="14" height="2.5" rx="1" />
			<rect x="5" y="16" width="14" height="2.5" rx="1" />
		</svg>
	);
}
