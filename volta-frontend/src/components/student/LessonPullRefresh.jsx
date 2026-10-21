import { useLessonPullRefresh } from '../../hooks/useLessonPullRefresh';
import { createPortal } from 'react-dom';
import './LessonPullRefresh.css';

export default function LessonPullRefresh({ onRefresh }) {
	const { pull, refreshing, ready } = useLessonPullRefresh(onRefresh);
	const visible = pull > 6 || refreshing;
	const label = refreshing
		? 'Se actualizează'
		: ready
			? 'Eliberează pentru actualizare'
			: 'Trage pentru actualizare';

	return createPortal((
		<div
			className={`lesson-pull-refresh${visible ? ' is-visible' : ''}${refreshing ? ' is-refreshing' : ''}`}
			style={{ '--lesson-pull': `${pull}px` }}
			aria-hidden={!visible}
		>
			<div className="lesson-pull-refresh-chip" role="status" aria-live="polite">
				<span className="lesson-pull-refresh-spinner" />
				<span>{label}</span>
			</div>
		</div>
	), document.body);
}
