import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import './CourseTestsManager.css';

const CourseTestsManager = ({ courseId, courseData, onUpdate }) => {
	const { showToast } = useToast();
	const [availableTests, setAvailableTests] = useState([]);
	const [linkedTests, setLinkedTests] = useState([]);
	const [loading, setLoading] = useState(false);
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [selectedTest, setSelectedTest] = useState(null);
	const [linkOptions, setLinkOptions] = useState({
		scope: 'course', // course, module, lesson
		scope_id: null,
		required: false,
		passing_score: 70,
		order: 0,
	});

	useEffect(() => {
		if (courseId) {
			fetchData();
		}
	}, [courseId]);

	const fetchData = async () => {
		setLoading(true);
		try {
			const [tests, course] = await Promise.all([
				adminService.getTests({ status: 'published' }),
				adminService.getCourse(courseId),
			]);
			
			setAvailableTests(Array.isArray(tests) ? tests : (tests?.data || []));
			setLinkedTests(course.tests || course.courseTests || []);
		} catch (err) {
			console.error('Error fetching data:', err);
			showToast('Eroare la încărcarea datelor', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleLinkTest = async () => {
		if (!selectedTest) {
			showToast('Selectează un test', 'error');
			return;
		}

		try {
			await adminService.linkTestToCourse(selectedTest.id, courseId, linkOptions);
			showToast('Test atașat cu succes', 'success');
			setShowLinkModal(false);
			setSelectedTest(null);
			fetchData();
		} catch (err) {
			console.error('Error linking test:', err);
			showToast(err.response?.data?.error || 'Eroare la atașarea testului', 'error');
		}
	};

	const handleUnlinkTest = async (testId, scope, scopeId) => {
		if (!confirm('Sigur dorești să deconectezi acest test?')) {
			return;
		}

		try {
			await adminService.unlinkTestFromCourse(testId, courseId, scope, scopeId);
			showToast('Test deconectat cu succes', 'success');
			fetchData();
		} catch (err) {
			console.error('Error unlinking test:', err);
			showToast(err.response?.data?.error || 'Eroare la deconectarea testului', 'error');
		}
	};

	const getScopeLabel = (scope, scopeId) => {
		if (scope === 'course') return 'Curs complet';
		if (scope === 'module') {
			const module = courseData?.modules?.find(m => m.id === scopeId);
			return module ? `Modul: ${module.title}` : `Modul ID: ${scopeId}`;
		}
		if (scope === 'lesson') {
			// Find lesson in modules
			for (const module of courseData?.modules || []) {
				const lesson = module.lessons?.find(l => l.id === scopeId);
				if (lesson) return `Lecție: ${lesson.title}`;
			}
			return `Lecție ID: ${scopeId}`;
		}
		return scope;
	};

	const getTestTypeBadge = (type) => {
		const types = {
			practice: { label: 'Practică', color: '#3B82F6' },
			graded: { label: 'Notat', color: '#8B5CF6' },
			final: { label: 'Final', color: '#EF4444' },
		};
		const badge = types[type] || types.graded;
		return (
			<span className="test-type-badge" style={{ backgroundColor: `${badge.color}20`, color: badge.color }}>
				{badge.label}
			</span>
		);
	};

	return (
		<div className="course-tests-manager">
			<div className="course-tests-header">
				<div>
					<h2>Teste & Evaluări</h2>
					<p>Gestionează testele atribuite acestui curs</p>
				</div>
				<button
					className="admin-btn admin-btn-primary"
					onClick={() => setShowLinkModal(true)}
				>
					➕ Atașează Test
				</button>
			</div>

			{/* Linked Tests */}
			<div className="course-tests-list">
				{linkedTests.length === 0 ? (
					<div className="course-tests-empty">
						<div className="course-tests-empty-icon">📝</div>
						<h3>Nu există teste atașate</h3>
						<p>Adaugă teste pentru a evalua progresul studenților</p>
						<button
							className="admin-btn admin-btn-primary"
							onClick={() => setShowLinkModal(true)}
						>
							➕ Atașează Primul Test
						</button>
					</div>
				) : (
					linkedTests.map((test, index) => {
						const pivot = test.pivot || test;
						return (
							<div key={`${test.id}-${pivot.scope}-${pivot.scope_id}`} className="course-test-card">
								<div className="course-test-card-header">
									<div className="course-test-card-info">
										<h3>{test.title}</h3>
										<div className="course-test-card-meta">
											{getTestTypeBadge(test.type)}
											<span className="test-scope-badge">
												📍 {getScopeLabel(pivot.scope, pivot.scope_id)}
											</span>
											{pivot.required && (
												<span className="test-required-badge">Obligatoriu</span>
											)}
										</div>
									</div>
									<div className="course-test-card-actions">
										<span className="test-passing-score">
											Scor minim: {pivot.passing_score}%
										</span>
										<button
											className="admin-btn admin-btn-danger admin-btn-sm"
											onClick={() => handleUnlinkTest(test.id, pivot.scope, pivot.scope_id)}
										>
											🗑️ Deconectează
										</button>
									</div>
								</div>
								{test.description && (
									<p className="course-test-card-description">{test.description}</p>
								)}
								<div className="course-test-card-stats">
									<span>⏱️ {test.time_limit_minutes || 'Fără limită'} min</span>
									<span>🔄 {test.max_attempts || 'Nelimitat'} încercări</span>
									<span>❓ {test.questions_count || 0} întrebări</span>
								</div>
							</div>
						);
					})
				)}
			</div>

			{/* Link Test Modal */}
			{showLinkModal && (
				<div className="course-tests-modal-overlay" onClick={() => setShowLinkModal(false)}>
					<div className="course-tests-modal" onClick={(e) => e.stopPropagation()}>
						<div className="course-tests-modal-header">
							<h3>Atașează Test la Curs</h3>
							<button
								className="course-tests-modal-close"
								onClick={() => setShowLinkModal(false)}
							>
								✕
							</button>
						</div>

						<div className="course-tests-modal-content">
							{/* Test Selection */}
							<div className="course-tests-form-group">
								<label>Selectează Test</label>
								<select
									className="admin-form-input"
									value={selectedTest?.id || ''}
									onChange={(e) => {
										const test = availableTests.find(t => t.id === parseInt(e.target.value));
										setSelectedTest(test);
									}}
								>
									<option value="">-- Selectează un test --</option>
									{availableTests.map(test => (
										<option key={test.id} value={test.id}>
											{test.title} ({test.type})
										</option>
									))}
								</select>
							</div>

							{/* Scope Selection */}
							<div className="course-tests-form-group">
								<label>Domeniu de aplicare</label>
								<select
									className="admin-form-input"
									value={linkOptions.scope}
									onChange={(e) => {
										setLinkOptions({
											...linkOptions,
											scope: e.target.value,
											scope_id: null,
										});
									}}
								>
									<option value="course">Curs complet</option>
									<option value="module">Modul specific</option>
									<option value="lesson">Lecție specifică</option>
								</select>
							</div>

							{/* Module/Lesson Selection */}
							{linkOptions.scope === 'module' && (
								<div className="course-tests-form-group">
									<label>Selectează Modul</label>
									<select
										className="admin-form-input"
										value={linkOptions.scope_id || ''}
										onChange={(e) => {
											setLinkOptions({
												...linkOptions,
												scope_id: parseInt(e.target.value),
											});
										}}
									>
										<option value="">-- Selectează modul --</option>
										{courseData?.modules?.map(module => (
											<option key={module.id} value={module.id}>
												{module.title}
											</option>
										))}
									</select>
								</div>
							)}

							{linkOptions.scope === 'lesson' && (
								<div className="course-tests-form-group">
									<label>Selectează Lecție</label>
									<select
										className="admin-form-input"
										value={linkOptions.scope_id || ''}
										onChange={(e) => {
											setLinkOptions({
												...linkOptions,
												scope_id: parseInt(e.target.value),
											});
										}}
									>
										<option value="">-- Selectează lecție --</option>
										{courseData?.modules?.flatMap(module =>
											module.lessons?.map(lesson => (
												<option key={lesson.id} value={lesson.id}>
													{module.title} - {lesson.title}
												</option>
											)) || []
										)}
									</select>
								</div>
							)}

							{/* Options */}
							<div className="course-tests-form-group">
								<label>
									<input
										type="checkbox"
										checked={linkOptions.required}
										onChange={(e) => {
											setLinkOptions({
												...linkOptions,
												required: e.target.checked,
											});
										}}
									/>
									Test obligatoriu
								</label>
							</div>

							<div className="course-tests-form-group">
								<label>Scor minim pentru trecere (%)</label>
								<input
									type="number"
									className="admin-form-input"
									min="0"
									max="100"
									value={linkOptions.passing_score}
									onChange={(e) => {
										setLinkOptions({
											...linkOptions,
											passing_score: parseInt(e.target.value) || 70,
										});
									}}
								/>
							</div>
						</div>

						<div className="course-tests-modal-footer">
							<button
								className="admin-btn admin-btn-secondary"
								onClick={() => setShowLinkModal(false)}
							>
								Anulează
							</button>
							<button
								className="admin-btn admin-btn-primary"
								onClick={handleLinkTest}
								disabled={!selectedTest}
							>
								Atașează Test
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CourseTestsManager;
