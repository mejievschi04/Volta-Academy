export const getSemanticTone = (value, context = 'status') => {
	const normalized = String(value || '').toLowerCase();
	if (context === 'type') {
		if (normalized === 'final' || normalized === 'critical') return 'danger';
		if (normalized === 'practice' || normalized === 'info') return 'neutral';
		if (normalized === 'graded') return 'warning';
		return 'neutral';
	}

	if (normalized === 'published' || normalized === 'active' || normalized === 'completed' || normalized === 'passed') return 'success';
	if (normalized === 'draft' || normalized === 'pending' || normalized === 'review') return 'warning';
	if (normalized === 'archived' || normalized === 'inactive' || normalized === 'disabled') return 'neutral';
	if (normalized === 'failed' || normalized === 'error' || normalized === 'rejected') return 'danger';
	return 'neutral';
};
