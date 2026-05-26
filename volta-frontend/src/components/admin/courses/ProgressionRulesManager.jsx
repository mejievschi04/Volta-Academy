import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import ConfirmModal from '../../../components/common/ConfirmModal';

const ProgressionRulesManager = ({ courseId, variant = 'default', structureOptions = null }) => {
	const isBuilder = variant === 'builder';
	const { showToast } = useToast();
	const [rules, setRules] = useState([]);
	const [loading, setLoading] = useState(true);
	const [showRuleForm, setShowRuleForm] = useState(false);
	const [editingRule, setEditingRule] = useState(null);
	const [ruleForm, setRuleForm] = useState({
		type: 'lesson_completion',
		target_type: 'lesson',
		target_id: null,
		condition_type: 'lesson',
		condition_id: null,
		condition_value: null,
		action: 'unlock',
		priority: 100,
		active: true,
	});
	const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState(null);
	const [deleteRuleLoading, setDeleteRuleLoading] = useState(false);

	useEffect(() => {
		if (courseId) {
			fetchRules();
		}
	}, [courseId]);

	const fetchRules = async () => {
		try {
			setLoading(true);
			const data = await adminService.getProgressionRules(courseId);
			setRules(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching progression rules:', err);
			showToast('Eroare la încărcarea regulilor', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleSaveRule = async () => {
		try {
			if (editingRule) {
				await adminService.updateProgressionRule(courseId, editingRule.id, ruleForm);
				showToast('Regulă actualizată cu succes', 'success');
			} else {
				await adminService.createProgressionRule(courseId, ruleForm);
				showToast('Regulă creată cu succes', 'success');
			}
			setShowRuleForm(false);
			setEditingRule(null);
			setRuleForm({
				type: 'lesson_completion',
				target_type: 'lesson',
				target_id: null,
				condition_type: 'lesson',
				condition_id: null,
				condition_value: null,
				action: 'unlock',
				priority: 100,
				active: true,
			});
			fetchRules();
		} catch (err) {
			console.error('Error saving rule:', err);
			showToast('Eroare la salvarea regulii', 'error');
		}
	};

	const handleDeleteRuleClick = (ruleId) => {
		setDeleteConfirmRuleId(ruleId);
	};

	const handleConfirmDeleteRule = async () => {
		if (!deleteConfirmRuleId) return;
		setDeleteRuleLoading(true);
		try {
			await adminService.deleteProgressionRule(courseId, deleteConfirmRuleId);
			setDeleteConfirmRuleId(null);
			showToast('Regulă ștearsă cu succes', 'success');
			fetchRules();
		} catch (err) {
			console.error('Error deleting rule:', err);
			showToast('Eroare la ștergerea regulii', 'error');
		} finally {
			setDeleteRuleLoading(false);
		}
	};

	const handleToggleRule = async (ruleId) => {
		try {
			await adminService.toggleProgressionRule(courseId, ruleId);
			showToast('Regulă actualizată', 'success');
			fetchRules();
		} catch (err) {
			console.error('Error toggling rule:', err);
			showToast('Eroare la actualizarea regulii', 'error');
		}
	};

	const getRuleTypeLabel = (type) => {
		const labels = {
			lesson_completion: 'Finalizare Lecție',
			test_passing: 'Trecere Test',
			minimum_score: 'Scor Minim',
			order_constraint: 'Constrângere Ordine',
			time_requirement: 'Cerință Timp',
			prerequisite: 'Prerequisit',
		};
		return labels[type] || type;
	};

	const getActionLabel = (action) => {
		const labels = {
			unlock: 'Deblochează',
			lock: 'Blochează',
			require: 'Obligă',
			optional: 'Opțional',
		};
		return labels[action] || action;
	};

	const resolveEntityLabel = (entityType, entityId) => {
		if (!entityId || !structureOptions) return null;
		const id = Number(entityId);
		if (entityType === 'lesson') {
			const lesson = (structureOptions.lessons || []).find((l) => Number(l.id) === id);
			return lesson ? `${lesson.title}${lesson.moduleTitle ? ` (${lesson.moduleTitle})` : ''}` : `Lecție #${id}`;
		}
		if (entityType === 'module') {
			const mod = (structureOptions.modules || []).find((m) => Number(m.id) === id);
			return mod ? mod.title : `Modul #${id}`;
		}
		if (entityType === 'test') {
			const test = (structureOptions.tests || []).find((t) => Number(t.id) === id);
			return test ? test.title : `Test #${id}`;
		}
		return null;
	};

	const renderEntityFields = () => {
		if (!structureOptions) return null;
		const lessons = structureOptions.lessons || [];
		const modules = structureOptions.modules || [];
		const tests = structureOptions.tests || [];

		return (
			<>
				<div className="admin-form-group">
					<label className="admin-form-label">Țintă (ce se deblochează)</label>
					<div className="admin-form-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
						<select
							className="admin-form-input"
							style={{ flex: '1 1 140px' }}
							value={ruleForm.target_type || ''}
							onChange={(e) =>
								setRuleForm({
									...ruleForm,
									target_type: e.target.value || null,
									target_id: null,
								})
							}
						>
							<option value="">— Tip —</option>
							<option value="lesson">Lecție</option>
							<option value="module">Modul</option>
							<option value="test">Test</option>
							<option value="course">Curs</option>
						</select>
						<select
							className="admin-form-input"
							style={{ flex: '2 1 200px' }}
							value={ruleForm.target_id ?? ''}
							onChange={(e) =>
								setRuleForm({
									...ruleForm,
									target_id: e.target.value ? Number(e.target.value) : null,
								})
							}
							disabled={!ruleForm.target_type}
						>
							<option value="">— Element —</option>
							{ruleForm.target_type === 'lesson' &&
								lessons.map((l) => (
									<option key={l.id} value={l.id}>
										{l.title}
									</option>
								))}
							{ruleForm.target_type === 'module' &&
								modules.map((m) => (
									<option key={m.id} value={m.id}>
										{m.title}
									</option>
								))}
							{ruleForm.target_type === 'test' &&
								tests.map((t) => (
									<option key={t.id} value={t.id}>
										{t.title}
									</option>
								))}
						</select>
					</div>
				</div>
				<div className="admin-form-group">
					<label className="admin-form-label">Condiție (ce trebuie îndeplinit)</label>
					<div className="admin-form-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
						<select
							className="admin-form-input"
							style={{ flex: '1 1 140px' }}
							value={ruleForm.condition_type || ''}
							onChange={(e) =>
								setRuleForm({
									...ruleForm,
									condition_type: e.target.value || null,
									condition_id: null,
								})
							}
						>
							<option value="">— Tip —</option>
							<option value="lesson">Lecție</option>
							<option value="module">Modul</option>
							<option value="test">Test</option>
							<option value="score">Scor</option>
							<option value="time">Timp</option>
						</select>
						{['lesson', 'module', 'test'].includes(ruleForm.condition_type) ? (
							<select
								className="admin-form-input"
								style={{ flex: '2 1 200px' }}
								value={ruleForm.condition_id ?? ''}
								onChange={(e) =>
									setRuleForm({
										...ruleForm,
										condition_id: e.target.value ? Number(e.target.value) : null,
									})
								}
							>
								<option value="">— Element —</option>
								{ruleForm.condition_type === 'lesson' &&
									lessons.map((l) => (
										<option key={l.id} value={l.id}>
											{l.title}
										</option>
									))}
								{ruleForm.condition_type === 'module' &&
									modules.map((m) => (
										<option key={m.id} value={m.id}>
											{m.title}
										</option>
									))}
								{ruleForm.condition_type === 'test' &&
									tests.map((t) => (
										<option key={t.id} value={t.id}>
											{t.title}
										</option>
									))}
							</select>
						) : (
							<input
								type="text"
								className="admin-form-input"
								style={{ flex: '2 1 200px' }}
								placeholder={ruleForm.condition_type === 'score' ? 'ex: 70' : 'Valoare'}
								value={ruleForm.condition_value ?? ''}
								onChange={(e) =>
									setRuleForm({ ...ruleForm, condition_value: e.target.value || null })
								}
								disabled={!ruleForm.condition_type}
							/>
						)}
					</div>
				</div>
			</>
		);
	};

	if (loading) {
		return (
			<div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
				<div className="va-loading-spinner"></div>
			</div>
		);
	}

	const sectionClass = isBuilder
		? 'admin-course-builder-workflow admin-course-builder-progression-panel'
		: 'admin-form-section';

	return (
		<div className={sectionClass}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
				<div>
					<h3 className={isBuilder ? 'admin-course-builder-workflow-title' : 'admin-form-section-title'}>
						Reguli de progres
					</h3>
					{isBuilder && (
						<p className="admin-course-builder-workflow-hint">
							Controlează ordinea și deblocarea lecțiilor și testelor pentru elevi. Modificările se aplică imediat după salvare.
						</p>
					)}
				</div>
				<button
					className="va-btn va-btn-sm va-btn-primary"
					onClick={() => {
						setEditingRule(null);
						setRuleForm({
							type: 'lesson_completion',
							target_type: 'lesson',
							target_id: null,
							condition_type: 'lesson',
							condition_id: null,
							condition_value: null,
							action: 'unlock',
							priority: 100,
							active: true,
						});
						setShowRuleForm(true);
					}}
				>
					+ Adaugă Regulă
				</button>
			</div>

			{rules.length > 0 ? (
				<div className="va-stack" style={{ gap: '1rem' }}>
					{rules.map((rule) => (
						<div
							key={rule.id}
							style={{
								padding: '1.5rem',
								background: rule.active ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)',
								border: `1px solid ${rule.active ? 'rgba(255, 238, 0, 0.3)' : 'rgba(255, 238, 0, 0.1)'}`,
								borderRadius: '8px',
								opacity: rule.active ? 1 : 0.6,
							}}
						>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
								<div style={{ flex: 1 }}>
									<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
										<span style={{
											padding: '0.25rem 0.75rem',
											background: 'rgba(255, 238, 0, 0.2)',
											borderRadius: '12px',
											fontSize: '0.875rem',
										}}>
											{getRuleTypeLabel(rule.type)}
										</span>
										<span style={{
											padding: '0.25rem 0.75rem',
											background: rule.active ? 'rgba(76, 175, 80, 0.2)' : 'rgba(158, 158, 158, 0.2)',
											borderRadius: '12px',
											fontSize: '0.875rem',
											color: rule.active ? '#4caf50' : '#9e9e9e',
										}}>
											{rule.active ? 'Activ' : 'Inactiv'}
										</span>
										<span style={{
											padding: '0.25rem 0.75rem',
											background: 'rgba(33, 150, 243, 0.2)',
											borderRadius: '12px',
											fontSize: '0.875rem',
										}}>
											Prioritate: {rule.priority}
										</span>
									</div>
									<div style={{ fontSize: '0.9rem', color: 'var(--va-muted)' }}>
										<strong>Acțiune:</strong> {getActionLabel(rule.action)}
										{rule.target_type && rule.target_id && (
											<>
												{' '}
												• <strong>Țintă:</strong>{' '}
												{resolveEntityLabel(rule.target_type, rule.target_id) ||
													`${rule.target_type} #${rule.target_id}`}
											</>
										)}
										{rule.condition_type && (
											<>
												{' '}
												• <strong>Condiție:</strong>{' '}
												{rule.condition_id
													? resolveEntityLabel(rule.condition_type, rule.condition_id) ||
														`${rule.condition_type} #${rule.condition_id}`
													: rule.condition_type}
											</>
										)}
										{rule.condition_value && (
											<> • <strong>Valoare:</strong> {rule.condition_value}</>
										)}
									</div>
								</div>
								<div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
									<button
										className="va-btn va-btn-sm"
										onClick={() => {
											setEditingRule(rule);
											setRuleForm(rule);
											setShowRuleForm(true);
										}}
									>
										✏️
									</button>
									<button
										className="va-btn va-btn-sm"
										onClick={() => handleToggleRule(rule.id)}
									>
										{rule.active ? '⏸️' : '▶️'}
									</button>
									<button
										className="va-btn va-btn-sm va-btn-danger"
										onClick={() => handleDeleteRuleClick(rule.id)}
									>
										🗑️
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="admin-info-box">
					<p>Nu există reguli de progres configurate.</p>
					<p className="admin-info-box-hint">
						Regulile de progres controlează cum utilizatorii progresează prin curs.
					</p>
				</div>
			)}

			{/* Rule Form Modal */}
			{showRuleForm && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: 'rgba(0, 0, 0, 0.3)',
						backdropFilter: 'blur(10px)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
					onClick={() => setShowRuleForm(false)}
				>
					<div
						className="va-card"
						style={{
							width: '90%',
							maxWidth: '600px',
							maxHeight: '90vh',
							overflow: 'auto',
							position: 'relative',
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="va-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<h2>{editingRule ? 'Editează Regulă' : 'Creează Regulă Nouă'}</h2>
							<button
								type="button"
								onClick={() => setShowRuleForm(false)}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#fff',
									fontSize: '1.5rem',
									cursor: 'pointer',
								}}
							>
								×
							</button>
						</div>
						<div className="va-card-body">
							<div className="admin-form-group">
								<label className="admin-form-label">Tip Regulă</label>
								<select
									className="admin-form-input"
									value={ruleForm.type}
									onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })}
								>
									<option value="lesson_completion">Finalizare Lecție</option>
									<option value="test_passing">Trecere Test</option>
									<option value="minimum_score">Scor Minim</option>
									<option value="order_constraint">Constrângere Ordine</option>
									<option value="time_requirement">Cerință Timp</option>
									<option value="prerequisite">Prerequisit</option>
								</select>
							</div>

							<div className="admin-form-group">
								<label className="admin-form-label">Acțiune</label>
								<select
									className="admin-form-input"
									value={ruleForm.action}
									onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}
								>
									<option value="unlock">Deblochează</option>
									<option value="lock">Blochează</option>
									<option value="require">Obligă</option>
									<option value="optional">Opțional</option>
								</select>
							</div>

							<div className="admin-form-group">
								<label className="admin-form-label">Prioritate</label>
								<input
									type="number"
									className="admin-form-input"
									value={ruleForm.priority}
									onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 100 })}
									min="0"
								/>
								<p className="admin-form-hint">Prioritate mai mică = evaluare mai devreme</p>
							</div>

							{renderEntityFields()}

							<div className="admin-form-group">
								<label className="admin-form-label admin-form-label-checkbox">
									<input
										type="checkbox"
										checked={ruleForm.active}
										onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })}
										className="admin-checkbox-input"
									/>
									<span>Activă</span>
								</label>
							</div>

							<div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
								<button
									type="button"
									className="va-btn"
									onClick={() => setShowRuleForm(false)}
								>
									Anulează
								</button>
								<button
									type="button"
									className="va-btn va-btn-primary"
									onClick={handleSaveRule}
								>
									Salvează
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			<ConfirmModal
				open={!!deleteConfirmRuleId}
				onClose={() => setDeleteConfirmRuleId(null)}
				onConfirm={handleConfirmDeleteRule}
				title="Șterge regulă"
				message="Sigur dorești să ștergi această regulă?"
				confirmLabel="Șterge"
				cancelLabel="Anulare"
				variant="danger"
				loading={deleteRuleLoading}
			/>
		</div>
	);
};

export default ProgressionRulesManager;

