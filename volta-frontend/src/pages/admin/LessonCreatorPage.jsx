import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/api';
import '../../styles/admin.css';

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
	const categoryId = searchParams.get('category_id');

	const [loading, setLoading] = useState(false);
	const [courses, setCourses] = useState([]);
	const [showBlockSelector, setShowBlockSelector] = useState(false);
	const [formData, setFormData] = useState({
		course_id: courseId || '',
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
		if (id) {
			fetchLesson();
		} else if (courseId) {
			// Set course_id if provided via URL
			setFormData(prev => ({ ...prev, course_id: courseId }));
		}
	}, [id, courseId]);

	const fetchCourses = async () => {
		try {
			const allCourses = await adminService.getCourses();
			const filteredCourses = categoryId
				? allCourses.filter(c => c.category_id == categoryId)
				: allCourses;
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
				course_id: lesson.course_id,
				title: lesson.title,
				content: lesson.content,
				order: lesson.order || 0,
			});
		} catch (err) {
			console.error('Error fetching lesson:', err);
			alert('Eroare la încărcarea lecției');
		} finally {
			setLoading(false);
		}
	};

	const insertBlock = (block) => {
		const currentContent = formData.content;
		const separator = currentContent ? '\n\n---\n\n' : '';
		setFormData({
			...formData,
			content: currentContent + separator + block.template,
		});
		setShowBlockSelector(false);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		
		// Validate that course_id is required
		if (!formData.course_id) {
			alert('Trebuie să selectezi un curs!');
			return;
		}
		
		try {
			setLoading(true);
			if (id) {
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
			}
		} catch (err) {
			console.error('Error saving lesson:', err);
			alert('Eroare la salvarea lecției');
		} finally {
			setLoading(false);
		}
	};

	if (loading && id) {
		return (
			<div className="admin-container">
				<p>Se încarcă...</p>
			</div>
		);
	}

	return (
		<div className="admin-container">
			<div className="admin-page-header">
				<div>
					<h1 className="va-page-title admin-page-title">
						{id ? 'Editează Lecție' : 'Creează Lecție Nouă'}
					</h1>
					<p className="va-muted admin-page-subtitle">
						Completează informațiile pentru {id ? 'actualizarea' : 'crearea'} lecției
					</p>
				</div>
				<button className="va-btn" onClick={() => {
					if (categoryId) {
						navigate(`/admin/categories/${categoryId}`);
					} else {
						navigate('/admin/courses');
					}
				}}>
					Înapoi
				</button>
			</div>

			<div className="va-card">
				<div className="va-card-body">
					<form onSubmit={handleSubmit} className="va-stack">
						<div className="va-form-group">
							<label className="va-form-label">Curs *</label>
							<select
								className="va-form-input"
								value={formData.course_id}
								onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
								required
								disabled={!!courseId}
							>
								<option value="">Selectează curs</option>
								{courses.map((course) => (
									<option key={course.id} value={course.id}>
										{course.title}
									</option>
								))}
							</select>
							{courses.length === 0 && (
								<small style={{ color: 'var(--va-danger)', display: 'block', marginTop: '0.5rem' }}>
									Nu există cursuri disponibile. Creează mai întâi un curs!
								</small>
							)}
						</div>

						<div className="va-form-group">
							<label className="va-form-label">Titlu Lecție *</label>
							<input
								type="text"
								className="va-form-input"
								value={formData.title}
								onChange={(e) => setFormData({ ...formData, title: e.target.value })}
								placeholder="Ex: Introducere în React"
								required
							/>
						</div>

						<div className="va-form-group">
							<label className="va-form-label">Ordine</label>
							<input
								type="number"
								className="va-form-input"
								value={formData.order}
								onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
								min="0"
								placeholder="Ordinea în care apare lecția în curs"
							/>
							<small className="va-muted" style={{ marginTop: '0.25rem', display: 'block' }}>
								Lecțiile vor fi afișate în ordinea crescătoare a acestui număr
							</small>
						</div>

						<div className="va-form-group">
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
								<label className="va-form-label">Conținut Lecție *</label>
								<button
									type="button"
									className="va-btn va-btn-sm va-btn-primary"
									onClick={() => setShowBlockSelector(!showBlockSelector)}
								>
									+ Adaugă Bloc
								</button>
							</div>

							{showBlockSelector && (
								<div style={{
									marginBottom: '1rem',
									padding: '1rem',
									background: 'var(--va-surface-2)',
									borderRadius: '8px',
									border: '1px solid var(--va-border)',
								}}>
									<h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem' }}>
										Selectează un bloc pentru a-l adăuga:
									</h4>
									<div style={{
										display: 'grid',
										gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
										gap: '0.75rem',
									}}>
										{lessonBlocks.map((block) => (
											<button
												key={block.id}
												type="button"
												className="va-btn"
												onClick={() => insertBlock(block)}
												style={{
													display: 'flex',
													flexDirection: 'column',
													alignItems: 'center',
													gap: '0.5rem',
													padding: '1rem',
													textAlign: 'center',
												}}
											>
												<span style={{ fontSize: '2rem' }}>{block.icon}</span>
												<span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{block.name}</span>
											</button>
										))}
									</div>
								</div>
							)}

							<textarea
								className="va-form-input"
								value={formData.content}
								onChange={(e) => setFormData({ ...formData, content: e.target.value })}
								placeholder="Scrie conținutul lecției aici sau adaugă blocuri gata făcute..."
								required
								rows={20}
								style={{
									fontFamily: 'monospace',
									fontSize: '0.95rem',
									lineHeight: '1.6',
									resize: 'vertical',
									minHeight: '400px',
								}}
							/>
							<small className="va-muted" style={{ marginTop: '0.25rem', display: 'block' }}>
								Poți folosi formatare Markdown pentru text (bold, italic, liste, etc.) sau adaugă blocuri gata făcute folosind butonul de mai sus.
							</small>
						</div>

						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
							<button
								type="button"
								className="va-btn"
								onClick={() => {
									if (categoryId) {
										navigate(`/admin/categories/${categoryId}`);
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
								className="va-btn va-btn-primary"
								disabled={loading}
							>
								{loading ? 'Se salvează...' : id ? 'Actualizează Lecție' : 'Creează Lecție'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

export default LessonCreatorPage;
