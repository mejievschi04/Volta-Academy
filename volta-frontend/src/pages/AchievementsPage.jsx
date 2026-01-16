import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { achievementsService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utils/logger';

const AchievementsPage = () => {
	const { user } = useAuth();
	const { error: showError, success: showSuccess } = useToast();
	const [achievements, setAchievements] = useState(null);
	const [certificates, setCertificates] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const [achievementsData, certificatesData] = await Promise.all([
					achievementsService.getAchievements(),
					achievementsService.getCertificates(),
				]);
				setAchievements(achievementsData);
				setCertificates(certificatesData);
			} catch (err) {
				logger.error('Error fetching achievements:', err);
				const errorMessage = 'Nu s-au putut încărca realizările';
				setError(errorMessage);
				showError(errorMessage);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	const handleDownloadCertificate = async (courseId) => {
		try {
			await achievementsService.downloadCertificate(courseId);
			showSuccess('Certificatul a fost descărcat cu succes');
		} catch (err) {
			logger.error('Error downloading certificate:', err);
			const errorMessage = err.response?.data?.message || 'Eroare la descărcarea certificatului';
			showError(errorMessage);
		}
	};

	if (loading) {
		return (
			<div className="student-achievements-page">
				<div className="student-achievements-loading">
					<div className="student-loading-spinner"></div>
					<p>Se încarcă realizările...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="student-achievements-page">
				<div className="student-achievements-error">
					<p>{error}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="student-achievements-page">
			<div className="student-achievements-header">
				<h1 className="student-achievements-title">Istoric Realizări</h1>
				<p className="student-achievements-subtitle">
					Urmărește-ți progresul și realizările în călătoria ta de învățare
				</p>
			</div>

			{/* Statistics */}
			{achievements && (
				<div className="student-achievements-stats">
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon">🎓</div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{achievements.completed_courses || 0}</div>
							<div className="student-achievements-stat-label">Cursuri finalizate</div>
						</div>
					</div>
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon">📚</div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{achievements.completed_lessons || 0}</div>
							<div className="student-achievements-stat-label">Lecții finalizate</div>
						</div>
					</div>
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon">🏆</div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{achievements.badges_count || 0}</div>
							<div className="student-achievements-stat-label">Badge-uri obținute</div>
						</div>
					</div>
					<div className="student-achievements-stat-card">
						<div className="student-achievements-stat-icon">⏱️</div>
						<div className="student-achievements-stat-content">
							<div className="student-achievements-stat-value">{achievements.learning_hours || 0}h</div>
							<div className="student-achievements-stat-label">Ore de învățare</div>
						</div>
					</div>
				</div>
			)}

			{/* Certificates */}
			<div className="student-achievements-section">
				<h2 className="student-achievements-section-title">
					<span className="student-achievements-section-icon">🎓</span>
					<span>Certificări</span>
				</h2>
				{certificates.length > 0 ? (
					<div className="student-certificates-grid">
						{certificates.map((cert) => (
							<div key={cert.course_id} className="student-certificate-card">
								{cert.course_thumbnail && (
									<img 
										src={cert.course_thumbnail} 
										alt={cert.course_title}
										className="student-certificate-thumbnail"
									/>
								)}
								<div className="student-certificate-content">
									<h3 className="student-certificate-title">{cert.course_title}</h3>
									{cert.category_name && (
										<p className="student-certificate-category">{cert.category_name}</p>
									)}
									<div className="student-certificate-meta">
										<span className="student-certificate-date">
											Finalizat: {new Date(cert.completion_date).toLocaleDateString('ro-RO')}
										</span>
										<span className="student-certificate-id">ID: {cert.certificate_id}</span>
									</div>
									<button
										className="student-certificate-download-btn"
										onClick={() => handleDownloadCertificate(cert.course_id)}
									>
										<span>📥</span>
										<span>Descarcă certificat</span>
									</button>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="student-achievements-empty">
						<p>Nu ai finalizat încă niciun curs pentru a obține certificări.</p>
						<Link to="/courses" className="student-achievements-empty-link">
							Explorează cursuri →
						</Link>
					</div>
				)}
			</div>

			{/* Badges */}
			{achievements && achievements.badges && achievements.badges.length > 0 && (
				<div className="student-achievements-section">
					<h2 className="student-achievements-section-title">
						<span className="student-achievements-section-icon">🏆</span>
						<span>Badge-uri</span>
					</h2>
					<div className="student-badges-grid">
						{achievements.badges.map((badge, index) => (
							<div key={index} className="student-badge-card">
								<div className="student-badge-icon">{badge.icon || '🏆'}</div>
								<div className="student-badge-title">{badge.title}</div>
								<div className="student-badge-description">{badge.description}</div>
								<div className="student-badge-date">
									Obținut: {new Date(badge.earned_at).toLocaleDateString('ro-RO')}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Milestones */}
			{achievements && achievements.milestones && achievements.milestones.length > 0 && (
				<div className="student-achievements-section">
					<h2 className="student-achievements-section-title">
						<span className="student-achievements-section-icon">🎯</span>
						<span>Milestone-uri</span>
					</h2>
					<div className="student-milestones-timeline">
						{achievements.milestones.map((milestone, index) => (
							<div key={index} className="student-milestone-item">
								<div className="student-milestone-icon">{milestone.icon}</div>
								<div className="student-milestone-content">
									<div className="student-milestone-title">{milestone.title}</div>
									<div className="student-milestone-description">{milestone.description}</div>
									<div className="student-milestone-date">
										{new Date(milestone.achieved_at).toLocaleDateString('ro-RO')}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default AchievementsPage;

