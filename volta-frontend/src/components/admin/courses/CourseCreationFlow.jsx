import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CourseCreationFlow.css';

/**
 * Course Creation Flow - Full-screen Wizard
 * Conform defacut.md: PASUL 1 - Entry Point
 * Full-screen wizard, nu modal mic
 */
const CourseCreationFlow = ({ onStart }) => {
	const navigate = useNavigate();
	const [isStarting, setIsStarting] = useState(false);

	const handleStart = () => {
		setIsStarting(true);
		if (onStart) {
			onStart();
		} else {
			navigate('/admin/courses/new');
		}
	};

	return (
		<div className="course-creation-flow-entry">
			<div className="course-creation-flow-container">
				{/* Header */}
				<div className="course-creation-flow-header">
					<button
						className="course-creation-flow-close"
						onClick={() => navigate('/admin/courses')}
						aria-label="Close"
					>
						×
					</button>
				</div>

				{/* Main Content - Centered */}
				<div className="course-creation-flow-content">
					<div className="course-creation-flow-intro">
						<h1 className="course-creation-flow-title">
							Creează un curs nou
						</h1>
						<p className="course-creation-flow-subtitle">
							Lasă AI-ul să te ajute să structurezi și să optimizezi cursul tău
						</p>
					</div>

					{/* Progress Indicator */}
					<div className="course-creation-flow-progress">
						<div className="course-creation-flow-progress-bar">
							<div className="course-creation-flow-progress-fill" />
						</div>
						<span className="course-creation-flow-progress-text">Pasul 1 din 8</span>
					</div>

					{/* Features Preview */}
					<div className="course-creation-flow-features">
						<div className="course-creation-flow-feature">
							<span className="course-creation-flow-feature-icon">🤖</span>
							<div>
								<h3>Structură Alimentată de AI</h3>
								<p>Generează automat structura cursului, modulele și lecțiile</p>
							</div>
						</div>
						<div className="course-creation-flow-feature">
							<span className="course-creation-flow-feature-icon">✨</span>
							<div>
								<h3>Validare Inteligentă</h3>
								<p>AI verifică calitatea, lacunele și engagement-ul înainte de publicare</p>
							</div>
						</div>
						<div className="course-creation-flow-feature">
							<span className="course-creation-flow-feature-icon">📱</span>
							<div>
								<h3>Optimizat pentru Mobile</h3>
								<p>Lecții optimizate pentru experiența de învățare pe mobil</p>
							</div>
						</div>
					</div>

					{/* CTA */}
					<div className="course-creation-flow-actions">
						<button
							className="admin-btn admin-btn-primary"
							onClick={handleStart}
							disabled={isStarting}
						>
							{isStarting ? 'Se încarcă...' : 'Începe Crearea Cursului'}
						</button>
						<button
							className="admin-btn admin-btn-secondary"
							onClick={() => navigate('/admin/courses')}
						>
							Anulează
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseCreationFlow;
