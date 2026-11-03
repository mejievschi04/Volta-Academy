import React, { useRef, useState } from 'react';
import { ImageSquare, UploadSimple } from '@phosphor-icons/react';
import { adminService } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContextShared.js';
import { toImageUrl } from '../../../utils/imageUrl';
import './QuestionImageUpload.css';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

function uploadErrorMessage(error) {
	const data = error?.response?.data;
	const fileError = Array.isArray(data?.errors?.file) ? data.errors.file[0] : null;
	return fileError || data?.message || 'Imaginea nu a putut fi încărcată. Încearcă din nou.';
}

/**
 * Imaginea unei perechi din „potrivire imagini”: se încarcă fișierul pe server
 * (WebP comprimat) și în întrebare rămâne adresa lui din storage.
 */
export default function QuestionImageUpload({ value, onChange, label, disabled = false }) {
	const inputRef = useRef(null);
	const [uploading, setUploading] = useState(false);
	const { error: showError } = useToast();
	const src = value ? (toImageUrl(value) || value) : null;

	const handleFile = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			showError('Alege un fișier imagine (JPG, PNG, WebP sau GIF).');
			return;
		}
		if (file.size > MAX_BYTES) {
			showError('Imaginea depășește 10 MB.');
			return;
		}
		setUploading(true);
		try {
			const result = await adminService.uploadContentImage(file);
			if (!result?.url) throw new Error('missing url');
			onChange(result.url);
		} catch (error) {
			showError(uploadErrorMessage(error));
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="va-qimg">
			<div className="va-qimg__preview" aria-hidden={src ? undefined : 'true'}>
				{src ? <img src={src} alt={`Imaginea pentru ${label}`} /> : <ImageSquare size={22} aria-hidden="true" />}
			</div>
			{disabled ? null : (
				<>
					<button
						type="button"
						className="lms-btn-secondary lms-btn-sm va-qimg__btn"
						onClick={() => inputRef.current?.click()}
						disabled={uploading}
						aria-label={`${value ? 'Schimbă' : 'Încarcă'} imaginea pentru ${label}`}
					>
						<UploadSimple size={16} weight="bold" aria-hidden="true" />
						{uploading ? 'Se încarcă…' : value ? 'Schimbă' : 'Încarcă imagine'}
					</button>
					<input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFile} hidden />
				</>
			)}
		</div>
	);
}
