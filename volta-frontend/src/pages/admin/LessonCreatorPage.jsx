import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import RichTextEditor from '../../components/RichTextEditor';

// Template blocks for lessons
const lessonBlocks = [
	{
		id: 'introduction',
		name: 'Introducere',
		icon: '📖',
		template: `# Introducere

Bine ai venit la această lecție!

## Obiective
- Obiectivul 1
- Obiectivul 2
- Obiectivul 3

## Ce vei învăța
În această lecție vei învăța...`,
	},
	{
		id: 'theory',
		name: 'Teorie',
		icon: '📚',
		template: `# Teorie

## Concepte Cheie

### Conceptul 1
Descrierea conceptului...

### Conceptul 2
Descrierea conceptului...

## Explicații Detaliate
Text explicativ detaliat...`,
	},
	{
		id: 'example',
		name: 'Exemplu',
		icon: '💡',
		template: `# Exemplu Practic

## Exemplu: [Nume Exemplu]

\`\`\`
// Cod sau exemplu aici
\`\`\`

### Explicație
Explicația exemplului...`,
	},
	{
		id: 'exercise',
		name: 'Exercițiu',
		icon: '✏️',
		template: `# Exercițiu

## Sarcina
Descrierea sarcinii...

## Instrucțiuni
1. Pasul 1
2. Pasul 2
3. Pasul 3

## Soluție
Soluția exercițiului...`,
	},
	{
		id: 'summary',
		name: 'Rezumat',
		icon: '📝',
		template: `# Rezumat

## Puncte Cheie
- Punctul cheie 1
- Punctul cheie 2
- Punctul cheie 3

## Concluzie
Concluzia lecției...`,
	},
	{
		id: 'resources',
		name: 'Resurse',
		icon: '🔗',
		template: `# Resurse Suplimentare

## Link-uri Utile
- [Resursa 1](https://example.com)
- [Resursa 2](https://example.com)

## Documentație
Link către documentație...

## Lecturi Recomandate
- Lectura 1
- Lectura 2`,
	},
];

const LessonCreatorPage = () => {
	const { id } = useParams(); // lesson ID if editing
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const courseId = searchParams.get('course_id');
	const moduleId = searchParams.get('module_id');

	const [loading, setLoading] = useState(false);
	const [courses, setCourses] = useState([]);
	const [showBlockSelector, setShowBlockSelector] = useState(false);
	const [errors, setErrors] = useState({});
	const [touched, setTouched] = useState({});
	const [formData, setFormData] = useState({
		course_id: courseId || '',
		module_id: moduleId || '',
		title: '',
		content: '',
		order: 0,
	});

	useEffect(() => {
		// Require course_id to create/edit lessons
		if (!courseId && !id) {
			alert('Trebuie să selectezi un curs pentru a crea o lecție!');
			navigate('/admin/courses');
			return;
		}
		
		fetchCourses();
		// Only fetch lesson if id exists and is not "new"
		if (id && id !== 'new') {
			fetchLesson();
		} else {
			// Set course_id and module_id if provided via URL
			setFormData(prev => ({
				...prev,
				course_id: courseId || prev.course_id,
				module_id: moduleId || prev.module_id,
			}));
		}
	}, [id, courseId, moduleId]);

	const fetchCourses = async () => {
		try {
			const allCourses = await adminService.getCourses();
			const filteredCourses = allCourses;
			setCourses(filteredCourses);
			if (courseId && !formData.course_id) {
				setFormData(prev => ({ ...prev, course_id: courseId }));
			}
		} catch (err) {
			console.error('Error fetching courses:', err);
		}
	};

	const fetchLesson = async () => {
		try {
			setLoading(true);
			const lesson = await adminService.getLesson(id);
			setFormData({
				course_id: lesson.course_id || courseId || '',
				module_id: lesson.module_id || moduleId || '',
				title: lesson.title || '',
				content: lesson.content || '',
				order: lesson.order || 0,
			});
		} catch (err) {
			console.error('Error fetching lesson:', err);
			alert('Eroare la încărcarea lecției');
		} finally {
			setLoading(false);
		}
	};


	// Convert Markdown to HTML for Quill
	const markdownToHtml = (markdown) => {
		let html = markdown;
		// Headers
		html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
		// Bold
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		// Italic
		html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
		// Code blocks
		html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
		// Inline code
		html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
		// Links
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
		// Lists
		html = html.replace(/^\- (.+)$/gim, '<li>$1</li>');
		html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
		// Line breaks
		html = html.replace(/\n/g, '<br>');
		return html;
	};

	const insertBlock = (block) => {
		const currentContent = formData.content;
		const separator = currentContent ? '<br><br><hr><br><br>' : '';
		const blockHtml = markdownToHtml(block.template);
		setFormData({
			...formData,
			content: currentContent + separator + blockHtml,
		});
		setShowBlockSelector(false);
	};

	// Validate form
	const validate = () => {
		const newErrors = {};
		if (!formData.course_id) {
			newErrors.course_id = 'Trebuie să selectezi un curs';
		}
		if (!formData.title || formData.title.trim().length < 3) {
			newErrors.title = 'Titlul trebuie să aibă minim 3 caractere';
		}
		// Strip HTML tags for validation
		const textContent = formData.content ? formData.content.replace(/<[^>]*>/g, '').trim() : '';
		if (!formData.content || textContent.length < 20) {
			newErrors.content = 'Conținutul trebuie să aibă minim 20 caractere';
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Calculate form completion percentage
	const completionPercentage = () => {
		let completed = 0;
		const total = 3;
		if (formData.course_id) completed++;
		if (formData.title && formData.title.trim().length >= 3) completed++;
		const textContent = formData.content ? formData.content.replace(/<[^>]*>/g, '').trim() : '';
		if (textContent.length >= 20) completed++;
		return Math.round((completed / total) * 100);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		
		// Validate before submit
		if (!validate()) {
			alert('Te rugăm să completezi toate câmpurile obligatorii corect!');
			return;
		}
		
		try {
			setLoading(true);
			if (id && id !== 'new') {
				await adminService.updateLesson(id, formData);
				alert('Lecție actualizată cu succes!');
			} else {
				await adminService.createLesson(formData);
				alert('Lecție creată cu succes!');
			}
			
			// Always navigate back to course detail page
			if (formData.course_id) {
				navigate(`/admin/courses/${formData.course_id}`);
			} else {
				navigate('/admin/courses');
			} else {
				navigate('/admin/courses');
			}
		} catch (err) {
			console.error('Error saving lesson:', err);
			alert('Eroare la salvarea lecției: ' + (err.response?.data?.message || err.message || 'Eroare necunoscută'));
		} finally {
			setLoading(false);
		}
	};

	if (loading && id && id !== 'new') {
		return (
			<div className="admin-lesson-creator-page">
				<div className="admin-loading-state">
					<p>Se încarcă...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="admin-lesson-creator-page">
			<div className="admin-lesson-creator-container">
				<div className="admin-page-header">
					<div>
						<h1 className="admin-page-title">
							{id && id !== 'new' ? 'Editează Lecție' : 'Creează Lecție Nouă'}
						</h1>
						<p className="admin-page-subtitle">
							Completează informațiile pentru {id && id !== 'new' ? 'actualizarea' : 'crearea'} lecției
						</p>
					</div>
					<button 
						className="admin-btn admin-btn-secondary" 
						onClick={() => {
							if (categoryId) {
								navigate(`/admin/categories/${categoryId}`);
							} else if (formData.course_id) {
								navigate(`/admin/courses/${formData.course_id}`);
							} else {
								navigate('/admin/courses');
							}
						}}
					>
						← Înapoi
					</button>
				</div>

				<div className="admin-form">
					<div className="admin-form-body">
					<form onSubmit={handleSubmit} className="admin-lesson-form">
						{/* Progress Indicator */}
						<div className="admin-form-progress">
							<div className="admin-form-progress-header">
								<span className="admin-form-progress-label">Progres completare</span>
								<span className="admin-form-progress-value">{completionPercentage()}%</span>
							</div>
							<div className="admin-form-progress-bar">
								<div 
									className="admin-form-progress-fill"
									style={{ width: `${completionPercentage()}%` }}
								/>
							</div>
						</div>

						{/* Course Selection */}
						<div className="admin-form-group">
							<label className="admin-label admin-label-with-icon">
								<span>📚</span>
								<span>Curs</span>
								{formData.course_id && (
									<span className="admin-form-check">✓</span>
								)}
							</label>
							<select
								className={`admin-form-select ${errors.course_id ? 'error' : ''} ${formData.course_id ? 'has-value' : ''}`}
								value={formData.course_id}
								onChange={(e) => {
									setFormData({ ...formData, course_id: e.target.value });
									if (touched.course_id) validate();
								}}
								onBlur={() => {
									setTouched({ ...touched, course_id: true });
									validate();
								}}
								required
								disabled={!!courseId}
							>
								<option value="">Selectează curs...</option>
								{courses.map((course) => (
									<option key={course.id} value={course.id}>
										{course.title}
									</option>
								))}
							</select>
							{errors.course_id && touched.course_id && (
								<p className="admin-form-error">{errors.course_id}</p>
							)}
							{courses.length === 0 && (
								<div className="admin-form-info">
									💡 Nu există cursuri disponibile. Creează mai întâi un curs!
								</div>
							)}
						</div>

						{/* Title Field */}
						<div className="admin-form-group">
							<label className="admin-label admin-label-with-icon">
								<span>📝</span>
								<span>Titlu Lecție <span className="admin-form-required">*</span></span>
								{formData.title && formData.title.trim().length >= 3 && (
									<span className="admin-form-check">✓</span>
								)}
							</label>
							<input
								type="text"
								className={`admin-form-input ${errors.title ? 'error' : ''} ${formData.title && formData.title.trim().length >= 3 ? 'has-value' : ''}`}
								value={formData.title}
								onChange={(e) => {
									setFormData({ ...formData, title: e.target.value });
									if (touched.title) validate();
								}}
								onBlur={() => {
									setTouched({ ...touched, title: true });
									validate();
								}}
								placeholder="Ex: Introducere în React"
								required
							/>
							{errors.title && touched.title && (
								<p className="admin-form-error">{errors.title}</p>
							)}
							{formData.title && formData.title.trim().length > 0 && formData.title.trim().length < 3 && (
								<p className="admin-form-help-text">
									💡 Minim 3 caractere necesare ({formData.title.trim().length}/3)
								</p>
							)}
						</div>

						{/* Order Field */}
						<div className="admin-form-group">
							<label className="admin-label admin-label-with-icon">
								<span>🔢</span>
								<span>Ordine</span>
							</label>
							<input
								type="number"
								className="admin-form-input"
								value={formData.order}
								onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
								min="0"
								placeholder="Ordinea în care apare lecția în curs"
							/>
							<p className="admin-form-help-text">
								💡 Lecțiile vor fi afișate în ordinea crescătoare a acestui număr (0 = prima lecție)
							</p>
						</div>

						{/* Content Field */}
						<div className="admin-form-group">
							<div className="admin-form-group-header">
								<label className="admin-label admin-label-with-icon">
									<span>📄</span>
									<span>Conținut Lecție <span className="admin-form-required">*</span></span>
									{formData.content && formData.content.replace(/<[^>]*>/g, '').trim().length >= 20 && (
										<span className="admin-form-check">✓</span>
									)}
								</label>
								<button
									type="button"
									className="admin-btn admin-btn-sm admin-btn-primary"
									onClick={() => setShowBlockSelector(!showBlockSelector)}
								>
									<span>➕</span>
									<span>Adaugă Bloc</span>
								</button>
							</div>

							{showBlockSelector && (
								<div className="admin-block-selector">
									<h4 className="admin-block-selector-title">
										Selectează un bloc pentru a-l adăuga:
									</h4>
									<div className="admin-block-grid">
										{lessonBlocks.map((block) => (
											<button
												key={block.id}
												type="button"
												className="admin-block-card"
												onClick={() => insertBlock(block)}
											>
												<span className="admin-block-icon">{block.icon}</span>
												<span className="admin-block-name">{block.name}</span>
											</button>
										))}
									</div>
								</div>
							)}

							<div className={`admin-form-editor-wrapper ${errors.content ? 'has-error' : ''} ${formData.content && formData.content.replace(/<[^>]*>/g, '').trim().length >= 20 ? 'has-value' : ''}`}>
								<RichTextEditor
									value={formData.content}
									onChange={(value) => {
										setFormData({ ...formData, content: value });
										if (touched.content) validate();
									}}
									onBlur={() => {
										setTouched({ ...touched, content: true });
										validate();
									}}
									placeholder="Scrie conținutul lecției aici sau adaugă blocuri gata făcute folosind butonul de mai sus..."
								/>
							</div>
							{errors.content && touched.content && (
								<p className="admin-form-error">{errors.content}</p>
							)}
							{formData.content && (() => {
								const textContent = formData.content.replace(/<[^>]*>/g, '').trim();
								return (
									<p className={`admin-form-help-text ${textContent.length >= 20 ? 'success' : ''}`}>
										{textContent.length >= 20 ? (
											<>✓ {textContent.length} caractere</>
										) : (
											<>💡 Minim 20 caractere necesare ({textContent.length}/20)</>
										)}
									</p>
								);
							})()}
							<div className="admin-form-info">
								💡 Poți folosi formatare Markdown pentru text (bold, italic, liste, etc.) sau adaugă blocuri gata făcute folosind butonul de mai sus.
							</div>
						</div>

						<div className="admin-form-actions">
							<button
								type="button"
								className="admin-btn admin-btn-secondary"
								onClick={() => {
									if (categoryId) {
										navigate(`/admin/categories/${categoryId}`);
									} else if (formData.course_id) {
										navigate(`/admin/courses/${formData.course_id}`);
									} else {
										navigate('/admin/courses');
									}
								}}
								disabled={loading}
							>
								Anulează
							</button>
							<button
								type="submit"
								className={`admin-btn admin-btn-primary ${completionPercentage() < 100 ? 'disabled' : ''}`}
								disabled={loading || completionPercentage() < 100}
							>
								{loading ? (
									<>
										<span>⏳</span>
										<span>Se salvează...</span>
									</>
								) : completionPercentage() < 100 ? (
									<>
										<span>⚠️</span>
										<span>Completează toate câmpurile</span>
									</>
								) : (
									<>
										<span>💾</span>
										<span>{id && id !== 'new' ? 'Actualizează Lecție' : 'Creează Lecție'}</span>
									</>
								)}
							</button>
						</div>
					</form>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LessonCreatorPage;
