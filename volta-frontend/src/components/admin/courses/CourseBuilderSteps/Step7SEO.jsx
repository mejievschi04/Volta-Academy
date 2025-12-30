import React, { useState } from 'react';

const CourseBuilderStep7 = ({ data, onUpdate, errors }) => {
	const [keywordInput, setKeywordInput] = useState('');
	const [tagInput, setTagInput] = useState('');

	const handleAddKeyword = () => {
		if (keywordInput.trim()) {
			const keywords = data.meta_keywords || [];
			if (!keywords.includes(keywordInput.trim())) {
				onUpdate({ meta_keywords: [...keywords, keywordInput.trim()] });
				setKeywordInput('');
			}
		}
	};

	const handleRemoveKeyword = (keyword) => {
		const keywords = data.meta_keywords || [];
		onUpdate({ meta_keywords: keywords.filter(k => k !== keyword) });
	};

	const handleAddTag = () => {
		if (tagInput.trim()) {
			const tags = data.marketing_tags || [];
			if (!tags.includes(tagInput.trim())) {
				onUpdate({ marketing_tags: [...tags, tagInput.trim()] });
				setTagInput('');
			}
		}
	};

	const handleRemoveTag = (tag) => {
		const tags = data.marketing_tags || [];
		onUpdate({ marketing_tags: tags.filter(t => t !== tag) });
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>SEO & Marketing</h2>
			<p className="admin-course-builder-step-description">
				Optimizează cursul pentru motoarele de căutare și marketing
			</p>

			<div className="admin-course-builder-form">
				{/* SEO Settings */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Optimizare SEO</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label">Meta Title</label>
						<input
							type="text"
							className="admin-form-input"
							value={data.meta_title || ''}
							onChange={(e) => onUpdate({ meta_title: e.target.value })}
							placeholder="Titlu optimizat pentru SEO (max 60 caractere)"
							maxLength={60}
						/>
						<p className="admin-form-hint">
							{(data.meta_title || '').length}/60 caractere
							{!data.meta_title && ' (Lăsat gol, se va folosi titlul cursului)'}
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Meta Description</label>
						<textarea
							className="admin-form-textarea"
							value={data.meta_description || ''}
							onChange={(e) => onUpdate({ meta_description: e.target.value })}
							placeholder="Descriere optimizată pentru SEO (max 160 caractere)"
							rows={3}
							maxLength={160}
						/>
						<p className="admin-form-hint">
							{(data.meta_description || '').length}/160 caractere
							{!data.meta_description && ' (Lăsat gol, se va folosi descrierea scurtă)'}
						</p>
					</div>

					<div className="admin-form-group">
						<label className="admin-form-label">Cuvinte Cheie SEO</label>
						<div className="admin-tags-input-group">
							<input
								type="text"
								className="admin-form-input"
								value={keywordInput}
								onChange={(e) => setKeywordInput(e.target.value)}
								onKeyPress={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										handleAddKeyword();
									}
								}}
								placeholder="Adaugă cuvânt cheie și apasă Enter"
							/>
							<button
								type="button"
								className="admin-btn admin-btn-sm"
								onClick={handleAddKeyword}
							>
								+
							</button>
						</div>
						<div className="admin-tags-list">
							{(data.meta_keywords || []).map((keyword, index) => (
								<span key={index} className="admin-tag">
									{keyword}
									<button
										type="button"
										className="admin-tag-remove"
										onClick={() => handleRemoveKeyword(keyword)}
									>
										×
									</button>
								</span>
							))}
						</div>
						<p className="admin-form-hint">
							Cuvinte cheie relevante pentru căutare (ex: "react", "javascript", "web development")
						</p>
					</div>
				</div>

				{/* Marketing Tags */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Tag-uri Marketing</h3>
					
					<div className="admin-form-group">
						<label className="admin-form-label">Tag-uri</label>
						<div className="admin-tags-input-group">
							<input
								type="text"
								className="admin-form-input"
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyPress={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										handleAddTag();
									}
								}}
								placeholder="Adaugă tag și apasă Enter"
							/>
							<button
								type="button"
								className="admin-btn admin-btn-sm"
								onClick={handleAddTag}
							>
								+
							</button>
						</div>
						<div className="admin-tags-list">
							{(data.marketing_tags || []).map((tag, index) => (
								<span key={index} className="admin-tag admin-tag-marketing">
									{tag}
									<button
										type="button"
										className="admin-tag-remove"
										onClick={() => handleRemoveTag(tag)}
									>
										×
									</button>
								</span>
							))}
						</div>
						<p className="admin-form-hint">
							Tag-uri pentru categorizare și filtrare (ex: "popular", "nou", "recomandat")
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseBuilderStep7;

