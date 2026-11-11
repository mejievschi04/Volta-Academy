import LessonPullRefresh from './LessonPullRefresh';
import { usePageRefreshControls } from '../../contexts/PageRefreshContext';

export default function UserPullRefresh() {
	const controls = usePageRefreshControls();
	if (!controls?.active) return null;
	return <LessonPullRefresh onRefresh={controls.refresh} />;
}
