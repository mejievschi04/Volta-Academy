import React, { useRef, useState } from 'react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContextShared.js';
import { toImageUrl } from '../../../utils/imageUrl';
import './ExamCoverField.css';

/**
 * Coperta examenului: apare pe cardul din „Teste lunare”. Se salvează imediat, ca la mape.
 */
export default function ExamCoverField({ examId, coverUrl, onChange, disabled = false }) {
	const { success: toastSuccess, error: toastError } = useToast();
	const inputRef = useRef(null);
	const [busy, setBusy] = useState(false);
	const src = coverUrl ? toImageUrl(coverUrl) || coverUrl : null;

	const handleFile = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file || !examId) return;
		setBusy(true);
		try {
			const data = await adminService.uploadExamCover(examId, file);
			onChange?.(data?.cover_image_url ?? null);
			toastSuccess('Coperta a fost salvată.');
		} catch (error) {
			toastError(error?.response?.data?.message || 'Nu s-a putut încărca coperta.');
		} finally {
			setBusy(false);
		}
	};

	const handleRemove = async () => {
		if (!examId) return;
		setBusy(true);
		try {
			await adminService.deleteExamCover(examId);
			onChange?.(null);
			toastSuccess('Coperta a fost ștearsă.');
		} catch (error) {
			toastError(error?.response?.data?.message || 'Nu s-a putut șterge coperta.');
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="va-ts__field va-ts__field--full exam-cover-field">
			<span className="exam-cover-field__label">Copertă</span>
			<div className="exam-cover-field__body">
				<div className={`exam-cover-field__preview${src ? '' : ' is-empty'}`}>
					{src ? <img src={src} alt="Coperta examenului" /> : <span>Fără copertă</span>}
				</div>
				<div className="exam-cover-field__actions">
					<input
						ref={inputRef}
						type="file"
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="exam-cover-field__input"
						onChange={handleFile}
						aria-label="Alege coperta examenului"
						disabled={disabled || busy || !examId}
					/>
					<button
						type="button"
						className="lms-btn-secondary lms-btn-sm"
						onClick={() => inputRef.current?.click()}
						disabled={disabled || busy || !examId}
					>
						{busy ? 'Se salvează…' : src ? 'Schimbă coperta' : 'Adaugă copertă'}
					</button>
					{src ? (
						<button
							type="button"
							className="lms-btn-secondary lms-btn-sm"
							onClick={handleRemove}
							disabled={disabled || busy}
						>
							Șterge
						</button>
					) : null}
				</div>
			</div>
			<p className="va-ts__hint">
				{examId
					? 'Apare pe cardul examenului din „Teste lunare”. JPG, PNG sau WebP, cel mult 4 MB.'
					: 'Salvează examenul ca să poți adăuga o copertă.'}
			</p>
		</div>
	);
}
