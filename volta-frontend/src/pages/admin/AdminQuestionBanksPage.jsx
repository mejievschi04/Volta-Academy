import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, coursesService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const AdminQuestionBanksPage = () => {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const [questionBanks, setQuestionBanks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [editingBank, setEditingBank] = useState(null);
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		category: '',
	});
	const [showAIModal, setShowAIModal] = useState(false);
	const [selectedBank, setSelectedBank] = useState(null);
	const [courses, setCourses] = useState([]);
	const [selectedCourse, setSelectedCourse] = useState('');
	const [aiGenerating, setAiGenerating] = useState(false);
	const [aiError, setAiError] = useState(null);
	const [aiOptions, setAiOptions] = useState({
		numberOfQuestions: 10,
		difficulty: 'medium',
		questionTypes: ['multiple_choice']
	});

	useEffect(() => {
		fetchQuestionBanks();
		fetchCourses();
	}, []);

	const fetchCourses = async () => {
		try {
			const data = await coursesService.getAll();
			setCourses(Array.isArray(data) ? data : []);
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const fetchQuestionBanks = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await adminService.getQuestionBanks();
			setQuestionBanks(Array.isArray(data) ? data : (data?.data || []));
		} catch (err) {
			console.error('Error fetching question banks:', err);
			setError('Nu s-au putut încărca băncile de întrebări');
			showToast('Eroare la încărcarea băncilor de întrebări', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingBank) {
				await adminService.updateQuestionBank(editingBank.id, formData);
				showToast('Bancă de întrebări actualizată cu succes', 'success');
			} else {
				await adminService.createQuestionBank(formData);
				showToast('Bancă de întrebări creată cu succes', 'success');
			}
			setShowModal(false);
			setEditingBank(null);
			setFormData({ title: '', description: '', category: '' });
			fetchQuestionBanks();
		} catch (err) {
			console.error('Error saving question bank:', err);
			showToast('Eroare la salvarea băncii de întrebări', 'error');
		}
	};

	const handleDelete = async (id) => {
		if (!confirm('Sigur dorești să ștergi această bancă de întrebări?')) {
			return;
		}

		try {
			await adminService.deleteQuestionBank(id);
			showToast('Bancă de întrebări ștearsă cu succes', 'success');
			fetchQuestionBanks();
		} catch (err) {
			console.error('Error deleting question bank:', err);
			showToast('Eroare la ștergerea băncii de întrebări', 'error');
		}
	};

	const handleOpenAIModal = (bank) => {
		setSelectedBank(bank);
		setSelectedCourse('');
		setAiOptions({
			numberOfQuestions: 10,
			difficulty: 'medium',
			questionTypes: ['multiple_choice']
		});
		setAiError(null);
		setShowAIModal(true);
	};

	const handleGenerateQuestions = async () => {
		if (!selectedCourse) {
			showToast('Te rugăm să selectezi un curs', 'error');
			return;
		}

		try {
			setAiGenerating(true);
			setAiError(null);
			const result = await adminService.generateQuestionsFromCourse(
				selectedBank.id,
				selectedCourse,
				aiOptions
			);
			showToast(`S-au generat ${result.questions_generated || 0} întrebări cu succes!`, 'success');
			setShowAIModal(false);
			setSelectedBank(null);
			setSelectedCourse('');
			fetchQuestionBanks();
		} catch (err) {
			console.error('Error generating questions:', err);
			const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Eroare la generarea întrebărilor cu AI';
			setAiError(message);
			showToast(message, 'error');
		} finally {
			setAiGenerating(false);
		}
	};



	if (loading) {
		return (
			<div className="admin-container">
				<div className="lms-dashboard-loading">
					<div className="lms-spinner"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div className="admin-page-header-content">
					<h1 className="admin-page-title">Bănci de Întrebări</h1>
					<p className="admin-page-subtitle">
						Gestionează băncile de întrebări reutilizabile pentru teste
					</p>
				</div>
				<button
					className="lms-btn-primary"
					onClick={() => navigate('/admin/question-banks/new/builder')}
				>
					+ Creează Bancă de Întrebări
				</button>
			</div>

			{error && (
				<div className="lms-error-message">
					{error}
				</div>
			)}

			{questionBanks.length > 0 ? (
				<div className="admin-question-banks-grid">
					{questionBanks.map((bank) => (
						<div key={bank.id} className="admin-question-bank-card">
							<div className="admin-question-bank-card-body">
								<h3 className="admin-question-bank-card-title">{bank.title}</h3>
								{bank.description && (
									<p className="admin-question-bank-card-description">
										{bank.description}
									</p>
								)}
								<div className="admin-question-bank-card-info">
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
										{bank.questions_count !== undefined && (
											<span>❓ {bank.questions_count} întrebări</span>
										)}
										{bank.category && (
											<span>📁 {bank.category}</span>
										)}
									</div>
								</div>
								<div className="admin-question-bank-card-actions">
									<button
										className="lms-btn-secondary lms-btn-sm"
										onClick={() => navigate(`/admin/question-banks/${bank.id}/builder`)}
									>
										✏️ Editează
									</button>
									<button
										className="lms-btn-primary lms-btn-sm"
										onClick={() => handleOpenAIModal(bank)}
									>
										🤖 Generează cu AI
									</button>
									<button
										className="lms-btn-secondary lms-btn-sm"
										onClick={() => navigate(`/admin/question-banks/${bank.id}/questions`)}
									>
										📝 Gestionează Întrebări
									</button>
									<button
										className="lms-btn-secondary lms-btn-sm va-btn-danger"
										onClick={() => handleDelete(bank.id)}
									>
										🗑️ Șterge
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="lms-empty-state">
					<div className="lms-empty-icon">📚</div>
					<h3 className="lms-empty-title">Nu există bănci de întrebări</h3>
					<p className="lms-empty-description">
						Băncile de întrebări permit reutilizarea întrebărilor în multiple teste
					</p>
					<button
						className="lms-btn-primary"
						onClick={() => navigate('/admin/question-banks/new/builder')}
					>
						+ Creează Prima Bancă de Întrebări
					</button>
				</div>
			)}

			{/* Create/Edit Modal */}
			{showModal && (
				<div
					className="admin-team-modal-overlay"
					onClick={() => setShowModal(false)}
				>
					<div
						className="admin-team-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="admin-team-modal-header">
							<h2 className="admin-team-modal-title">{editingBank ? 'Editează Bancă de Întrebări' : 'Creează Bancă de Întrebări Nouă'}</h2>
							<button
								type="button"
								className="admin-team-modal-close"
								onClick={() => setShowModal(false)}
							>
								×
							</button>
						</div>
						<div className="admin-team-modal-body">
							<form onSubmit={handleSubmit} className="admin-team-modal-form">
								<div className="admin-form-group">
									<label className="admin-form-label">Titlu</label>
									<input
										type="text"
										className="admin-form-input"
										value={formData.title}
										onChange={(e) => setFormData({ ...formData, title: e.target.value })}
										required
										placeholder="ex: Întrebări PHP Avansat"
									/>
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">Descriere</label>
									<textarea
										className="admin-form-input"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										rows={4}
										placeholder="Descrierea băncii de întrebări..."
									/>
								</div>
								<div className="admin-form-group">
									<label className="admin-form-label">Categorie (opțional)</label>
									<input
										type="text"
										className="admin-form-input"
										value={formData.category}
										onChange={(e) => setFormData({ ...formData, category: e.target.value })}
										placeholder="ex: PHP, JavaScript, etc."
									/>
								</div>
								<div className="admin-team-modal-footer">
									<button
										type="button"
										className="lms-btn-secondary"
										onClick={() => setShowModal(false)}
									>
										Anulează
									</button>
									<button type="submit" className="lms-btn-primary">
										Salvează
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* AI Generation Modal */}
			{showAIModal && (
				<div
					className="admin-team-modal-overlay"
					onClick={() => !aiGenerating && setShowAIModal(false)}
				>
					<div
						className="admin-team-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="admin-team-modal-header">
							<div>
								<h2 className="admin-team-modal-title">🤖 Generează Întrebări cu AI</h2>
								<p className="admin-page-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
									Selectează un curs și AI-ul va genera întrebări pentru test
								</p>
							</div>
							{!aiGenerating && (
								<button
									type="button"
									className="admin-team-modal-close"
									onClick={() => setShowAIModal(false)}
								>
									×
								</button>
							)}
						</div>
						<div className="admin-team-modal-body">
							<div className="admin-team-modal-form">
								<div className="admin-form-group">
									<label className="admin-form-label">Bancă de Întrebări</label>
									<input
										type="text"
										className="admin-form-input"
										value={selectedBank?.title || ''}
										disabled
										style={{ opacity: 0.7 }}
									/>
								</div>

								<div className="admin-form-group">
									<label className="admin-form-label">Selectează Curs *</label>
									<select
										className="admin-form-input"
										value={selectedCourse}
										onChange={(e) => setSelectedCourse(e.target.value)}
										disabled={aiGenerating}
										required
									>
										<option value="">-- Selectează un curs --</option>
										{courses.map((course) => (
											<option key={course.id} value={course.id}>
												{course.title}
											</option>
										))}
									</select>
									{selectedCourse && (
										<p className="admin-form-hint">
											AI-ul va analiza conținutul cursului și va genera întrebări relevante
										</p>
									)}
								</div>

								<div className="admin-form-group">
									<label className="admin-form-label">Număr de Întrebări</label>
									<input
										type="number"
										className="admin-form-input"
										value={aiOptions.numberOfQuestions}
										onChange={(e) => setAiOptions({
											...aiOptions,
											numberOfQuestions: parseInt(e.target.value) || 10
										})}
										min="1"
										max="50"
										disabled={aiGenerating}
									/>
								</div>

								<div className="admin-form-group">
									<label className="admin-form-label">Dificultate</label>
									<select
										className="admin-form-input"
										value={aiOptions.difficulty}
										onChange={(e) => setAiOptions({
											...aiOptions,
											difficulty: e.target.value
										})}
										disabled={aiGenerating}
									>
										<option value="easy">Ușor</option>
										<option value="medium">Mediu</option>
										<option value="hard">Dificil</option>
									</select>
								</div>

								{aiGenerating && (
									<div className="admin-ai-generating">
										<div className="lms-spinner" style={{ margin: '0 auto 1rem' }}></div>
										<p style={{ color: 'var(--color-primary)', fontWeight: 600, textAlign: 'center' }}>
											AI-ul generează întrebări din conținutul cursului...
										</p>
										<p className="admin-form-hint" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
											Aceasta poate dura câteva momente
										</p>
									</div>
								)}

								{aiError && (
									<div className="lms-error-message">
										<strong>Eroare AI:</strong>
										<p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>{aiError}</p>
									</div>
								)}

								<div className="admin-team-modal-footer">
									<button
										type="button"
										className="lms-btn-secondary"
										onClick={() => setShowAIModal(false)}
										disabled={aiGenerating}
									>
										Anulează
									</button>
									<button
										type="button"
										className="lms-btn-primary"
										onClick={handleGenerateQuestions}
										disabled={aiGenerating || !selectedCourse}
									>
										🤖 {aiGenerating ? 'Se generează...' : 'Generează Întrebări'}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminQuestionBanksPage;

