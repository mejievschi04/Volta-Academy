import React, { useState } from 'react';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useAuth } from '../../contexts/AuthContextShared.js';

const LessonNotes = (props) => {
	const { user } = useAuth();
	return <LessonNotesEditor key={`${user?.id || 'anon'}_${props.lessonId}`} {...props} />;
};

const LessonNotesEditor = ({ lessonId, initialNotes = '' }) => {
	const { user } = useAuth();
	const storageKey = user?.id && lessonId ? `lesson_notes_${user.id}_${lessonId}` : null;
	const [notes, setNotes] = useState(
		() => (storageKey ? (localStorage.getItem(storageKey) ?? initialNotes) : initialNotes)
	);
	const { saveStatus } = useAutoSave(
		notes,
		async (data) => {
			if (!storageKey) return;
			localStorage.setItem(storageKey, data);
		},
		1000
	);

	return (
		<div className="student-lesson-notes">
			<div className="student-lesson-notes-header">
				<h3 className="student-lesson-notes-title">
					<span className="student-lesson-notes-icon">📝</span>
					<span>Note personale</span>
				</h3>
				{saveStatus === 'saving' && (
					<span className="student-lesson-notes-saving">Salvare...</span>
				)}
				{saveStatus === 'saved' && (
					<span className="student-lesson-notes-saved">✓ Salvat</span>
				)}
			</div>
			<textarea
				className="student-lesson-notes-textarea"
				value={notes}
				onChange={(e) => setNotes(e.target.value)}
				placeholder="Adaugă note, întrebări sau observații despre această lecție..."
				rows={6}
			/>
		</div>
	);
};

export default LessonNotes;
