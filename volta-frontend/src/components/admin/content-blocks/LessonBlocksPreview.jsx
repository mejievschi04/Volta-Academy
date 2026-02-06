import React from 'react';
import { toImageUrl } from '../../../utils/imageUrl';

const normalizeYouTubeEmbed = (url) => {
	if (!url) return null;
	try {
		if (url.includes('youtube.com/embed/')) return url;
		const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
		const id = match?.[1];
		return id ? `https://www.youtube.com/embed/${id}` : null;
	} catch {
		return null;
	}
};

const normalizeVimeoEmbed = (url) => {
	if (!url) return null;
	try {
		if (url.includes('player.vimeo.com/video/')) return url;
		const match = url.match(/vimeo\.com\/(\d+)/);
		const id = match?.[1];
		return id ? `https://player.vimeo.com/video/${id}` : null;
	} catch {
		return null;
	}
};

const BlockCard = ({ title, children, showLabel = true }) => {
	return (
		<div className={showLabel ? 'admin-card' : 'lesson-block-card'} style={{ marginBottom: showLabel ? 'var(--space-3)' : 'var(--space-6)' }}>
			<div className={showLabel ? 'admin-card-body' : 'lesson-block-card-body'}>
				{showLabel && (
					<div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
						{title}
					</div>
				)}
				{children}
			</div>
		</div>
	);
};

const LessonBlocksPreview = ({ blocks, variant = 'admin' }) => {
	const showLabels = variant === 'admin';
	if (!Array.isArray(blocks) || blocks.length === 0) {
		return (
			<div className="lms-empty-state">
				<div className="lms-empty-icon">👁️</div>
				<div className="lms-empty-title">Nu există conținut</div>
				<div className="lms-empty-description">Adaugă content blocks pentru a vedea preview.</div>
			</div>
		);
	}

	return (
		<div>
			{blocks.map((b, idx) => {
				const label = `${idx + 1}. ${b.type || 'block'}`;

				if (b.type === 'text') {
					const html = (b.source || '').replace(
						/<img([^>]*)\ssrc=["']([^"']+)["']/gi,
						(_, attrs, src) => {
							const url = toImageUrl(src) || src;
							return `<a href="${url}" target="_blank" rel="noreferrer" class="lesson-img-link">Deschide imagine</a>`;
						}
					);
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							<div
								className="lesson-preview-content"
								dangerouslySetInnerHTML={{ __html: html }}
							/>
						</BlockCard>
					);
				}

				if (b.type === 'video') {
					const yt = normalizeYouTubeEmbed(b.source || '');
					const vimeo = normalizeVimeoEmbed(b.source || '');
					const embed = yt || vimeo;
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							{embed ? (
								<div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
									<iframe
										src={embed}
										title={`video-${b.id || idx}`}
										style={{ width: '100%', aspectRatio: '16 / 9', border: 'none', display: 'block' }}
										loading="lazy"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
									/>
								</div>
							) : (
								<a href={b.source || '#'} target="_blank" rel="noreferrer" className="lms-btn-secondary">
									Deschide video
								</a>
							)}
						</BlockCard>
					);
				}

				if (b.type === 'embed') {
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							<div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
								<iframe
									src={b.source || ''}
									title={`embed-${b.id || idx}`}
									style={{ width: '100%', height: 420, border: 'none', display: 'block', background: 'var(--bg-primary)' }}
									loading="lazy"
								/>
							</div>
						</BlockCard>
					);
				}

				if (b.type === 'image') {
					const imgUrl = toImageUrl(b.source);
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							{imgUrl ? (
								<a href={imgUrl} target="_blank" rel="noreferrer" className="lms-btn-secondary">
									Deschide imagine
								</a>
							) : (
								<div style={{ color: 'var(--text-tertiary)' }}>Fără imagine</div>
							)}
						</BlockCard>
					);
				}

				if (b.type === 'gallery') {
					const imgs = Array.isArray(b.metadata?.images) ? b.metadata.images : [];
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							{imgs.length > 0 ? (
								<div
									style={{
										display: 'grid',
										gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
										gap: 'var(--space-3)',
									}}
								>
									{imgs.map((img, i) => {
										const imgUrl = toImageUrl(img.url) || img.url;
										return imgUrl ? (
											<a
												key={img.id || i}
												href={imgUrl}
												target="_blank"
												rel="noreferrer"
												className="lms-btn-secondary"
												style={{ display: 'inline-block', marginRight: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
											>
												{img.alt || `Imagine ${i + 1}`}
											</a>
										) : null;
									})}
								</div>
							) : (
								<div style={{ color: 'var(--text-tertiary)' }}>Galerie goală</div>
							)}
						</BlockCard>
					);
				}

				if (b.type === 'audio') {
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							<audio controls style={{ width: '100%' }}>
								<source src={b.source || ''} />
							</audio>
							{b.source ? (
								<div style={{ marginTop: 'var(--space-2)' }}>
									<a href={b.source} target="_blank" rel="noreferrer">
										{b.source}
									</a>
								</div>
							) : null}
						</BlockCard>
					);
				}

				if (b.type === 'file' || b.type === 'link') {
					return (
						<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
							<a href={b.source || '#'} target="_blank" rel="noreferrer" className="lms-btn-secondary">
								{b.type === 'file' ? 'Deschide fișier' : 'Deschide link'}
							</a>
							{b.source ? (
								<div style={{ marginTop: 'var(--space-2)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
									{b.source}
								</div>
							) : null}
						</BlockCard>
					);
				}

				return (
					<BlockCard key={b.id || idx} title={label} showLabel={showLabels}>
						<pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
							{b.source || '—'}
						</pre>
					</BlockCard>
				);
			})}
		</div>
	);
};

export default LessonBlocksPreview;

