import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { toImageUrl } from '../../utils/imageUrl';
import courseMapPlaceholder from '../../assets/course-map-placeholder.svg';
import './course-showcase-card.css';

/** Copertă implicită când lipsește URL-ul sau încărcarea eșuează. */
export const COURSE_SHOWCASE_FALLBACK_IMAGE = courseMapPlaceholder;

function resolveCardImageUrl(value) {
	if (value == null || value === '') return null;
	const s = typeof value === 'string' ? value.trim() : String(value).trim();
	if (!s) return null;
	if (s.startsWith('data:') || s.startsWith('blob:')) return s;
	if (s.startsWith('/assets/') || s.startsWith('./') || s.startsWith('../')) return s;
	return toImageUrl(s) ?? s;
}

function cssUrl(value) {
	return `url(${JSON.stringify(String(value))})`;
}

/**
 * Card tip „destination”: bandă copertă + panel text întunecat, accent din `themeHsl`.
 *
 * @typedef {Object} CourseShowcaseCardProps
 * @property {string} imageUrl
 * @property {string} title
 * @property {string} subtitle
 * @property {string} themeHsl
 * @property {() => void} onOpen
 * @property {string} [ctaLabel]
 * @property {string} [badge]
 * @property {React.ReactNode} [topLeftSlot]
 * @property {React.ReactNode} [topRightSlot]
 * @property {string} [className]
 * @property {'default' | 'compact'} [density]
 */

const CourseShowcaseCard = React.forwardRef(
	(
		{
			className,
			imageUrl,
			title,
			subtitle,
			themeHsl,
			onOpen,
			ctaLabel = 'Deschide',
			badge,
			topLeftSlot,
			topRightSlot,
			density = 'default',
			style,
			...rest
		},
		ref
	) => {
		const resolved = React.useMemo(() => resolveCardImageUrl(imageUrl), [imageUrl]);
		const [coverBroken, setCoverBroken] = React.useState(false);

		React.useEffect(() => {
			setCoverBroken(false);
		}, [resolved]);

		const showUrl = resolved && !coverBroken ? resolved : COURSE_SHOWCASE_FALLBACK_IMAGE;
		const aria = `Deschide: ${title}`;

		return (
			<div
				ref={ref}
				className={cn(
					'course-showcase-card',
					density === 'compact' && 'course-showcase-card--compact',
					className
				)}
				style={{ ...style, '--theme-color': themeHsl }}
				{...rest}
			>
				<div
					role="button"
					tabIndex={0}
					className="course-showcase-card__hit"
					onClick={onOpen}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onOpen();
						}
					}}
					aria-label={aria}
				>
					<div className="course-showcase-card__media">
						<div
							className="course-showcase-card__cover"
							style={{ backgroundImage: cssUrl(showUrl) }}
							aria-hidden
						/>
						{resolved ? (
							<img
								className="course-showcase-card__cover-probe"
								src={resolved}
								alt=""
								decoding="async"
								onError={() => setCoverBroken(true)}
							/>
						) : null}
						<div className="course-showcase-card__shade" aria-hidden />
						{topLeftSlot ? <div className="course-showcase-card__tl">{topLeftSlot}</div> : null}
						{topRightSlot ? <div className="course-showcase-card__tr">{topRightSlot}</div> : null}
					</div>
					<div className="course-showcase-card__inner">
						{badge ? <span className="course-showcase-card__badge">{badge}</span> : null}
						<h3 className="course-showcase-card__title">{title}</h3>
						<p className="course-showcase-card__subtitle">{subtitle}</p>
						<div className="course-showcase-card__cta">
							<span className="course-showcase-card__cta-label">{ctaLabel}</span>
							<span className="course-showcase-card__cta-icon-wrap" aria-hidden>
								<ArrowRight className="course-showcase-card__cta-icon" />
							</span>
						</div>
					</div>
				</div>
			</div>
		);
	}
);

CourseShowcaseCard.displayName = 'CourseShowcaseCard';

export { CourseShowcaseCard };
