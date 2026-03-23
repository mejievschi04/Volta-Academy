import React, { useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import './CourseCongratulationsModal.css';

/**
 * Mesaj de felicitare la finalizarea cursului; la închidere → callback (ex. navigare la listă cursuri).
 */
function CourseCongratulationsModal({ open, onClose, courseTitle, closeButtonLabel = 'Închide' }) {
	const closeBtnRef = useRef(null);

	useEffect(() => {
		if (!open) return;
		const id = requestAnimationFrame(() => closeBtnRef.current?.focus());
		return () => cancelAnimationFrame(id);
	}, [open]);

	if (!open) return null;

	return (
		<Modal
			isOpen={open}
			onClose={onClose}
			ariaLabelledby="course-congrats-title"
			ariaDescribedby="course-congrats-desc"
			className="course-congrats-overlay"
		>
			<div className="course-congrats">
				<div className="course-congrats-icon" aria-hidden="true">
					<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
				</div>
				<h2 id="course-congrats-title" className="course-congrats-title">
					Felicitări!
				</h2>
				<p id="course-congrats-desc" className="course-congrats-message">
					{courseTitle
						? `Ai finalizat cursul „${courseTitle}”.`
						: 'Ai finalizat cursul.'}
				</p>
				<button
					ref={closeBtnRef}
					type="button"
					className="lms-btn-primary course-congrats-btn"
					onClick={onClose}
				>
					{closeButtonLabel}
				</button>
			</div>
		</Modal>
	);
}

export default CourseCongratulationsModal;
