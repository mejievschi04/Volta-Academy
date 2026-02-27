import React, { useEffect, useState } from 'react';
import { adminService } from '../../../../services/api';

/**
 * Pas 2: Întrebări – sursă: Direct (în test) sau Din banca de întrebări.
 * După creare, utilizatorul va adăuga întrebări în editor (direct) sau va avea testul legat de bancă.
 */
const Step2Questions = ({ data, onUpdate }) => {
	const [banks, setBanks] = useState([]);
	const source = data.question_source || 'direct';
	const questionSetId = data.question_set_id || null;
	const selection = data.question_selection || { mode: 'random', count: 20 };

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const list = await adminService.getQuestionBanks();
				if (!cancelled) setBanks(Array.isArray(list) ? list : []);
			} catch (e) {
				if (!cancelled) setBanks([]);
			}
		})();
		return () => { cancelled = true; };
	}, []);

	return (
		<div className="test-wizard-step-questions">
			<h3 className="admin-settings-section-title">Sursă întrebări</h3>
			<p className="course-creation-wizard-step-desc">
				Alege cum vor fi furnizate întrebările: direct în test sau dintr-o bancă de întrebări.
			</p>

			<div className="admin-settings-form-group">
				<label className="admin-settings-label">Sursă</label>
				<select
					className="admin-settings-select"
					value={source}
					onChange={(e) => onUpdate({
						question_source: e.target.value,
						question_set_id: e.target.value === 'bank' ? (data.question_set_id || null) : null,
						question_selection: e.target.value === 'bank' ? selection : null,
					})}
				>
					<option value="direct">Direct (în test) – adaugi întrebări manual în editor</option>
					<option value="bank">Din banca de întrebări</option>
				</select>
			</div>

			{source === 'bank' && (
				<>
					<div className="admin-settings-form-group">
						<label className="admin-settings-label">Banca de întrebări</label>
						<select
							className="admin-settings-select"
							value={questionSetId || ''}
							onChange={(e) => onUpdate({
								question_set_id: e.target.value ? Number(e.target.value) : null,
							})}
						>
							<option value="">Alege o bancă…</option>
							{banks.map((b) => (
								<option key={b.id} value={b.id}>{b.title}</option>
							))}
						</select>
					</div>
					<div className="admin-settings-form-row">
						<div className="admin-settings-form-group">
							<label className="admin-settings-label">Mod selecție</label>
							<select
								className="admin-settings-select"
								value={selection.mode || 'random'}
								onChange={(e) => onUpdate({
									question_selection: { ...selection, mode: e.target.value },
								})}
							>
								<option value="random">Aleatoriu</option>
								<option value="ordered">După ordine</option>
							</select>
						</div>
						<div className="admin-settings-form-group">
							<label className="admin-settings-label">Număr întrebări</label>
							<input
								className="admin-settings-input"
								type="number"
								min={0}
								value={selection.count ?? 20}
								onChange={(e) => onUpdate({
									question_selection: { ...selection, count: e.target.value === '' ? 0 : Number(e.target.value) },
								})}
							/>
							<span className="admin-settings-hint">0 = toate din bancă</span>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

export default Step2Questions;
