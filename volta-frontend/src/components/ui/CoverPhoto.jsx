import { useCoverImage } from '../../hooks/useCoverImage';

/** Copertă din listă: miniatura (cu revenire la original), încărcată doar când ajunge în ecran. */
export default function CoverPhoto({ url, className, style }) {
	const { src, onError } = useCoverImage(url);
	if (!src) return null;
	return <img src={src} alt="" className={className} style={style} loading="lazy" decoding="async" onError={onError} />;
}
