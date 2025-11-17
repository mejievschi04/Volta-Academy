import React, { useState, useEffect } from 'react';
import { rewardsService, profileService } from '../services/api';

const RewardsPage = () => {
	const [rewards, setRewards] = useState([]);
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true);
				const [rewardsData, profileData] = await Promise.all([
					rewardsService.getAll(),
					profileService.getProfile(),
				]);
				setRewards(rewardsData);
				setProfile(profileData);
			} catch (err) {
				console.error('Error fetching rewards:', err);
				setError('Nu s-au putut încărca recompensele');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	const getRewardIcon = (id) => {
		const icons = {
			'streak-3': '🔥',
			'promo-champ': '🏆',
			'security-guardian': '🛡️',
			'sales-closer': '💼',
			'product-master': '⭐',
		};
		return icons[id] || '✨';
	};

	const getRewardGradient = (index) => {
		const gradients = [
			'linear-gradient(135deg, #ffee00 0%, #ffd700 100%)',
			'linear-gradient(135deg, #ffd700 0%, #ffcc00 100%)',
			'linear-gradient(135deg, #ffee00 0%, #ffaa00 100%)',
			'linear-gradient(135deg, #ffcc00 0%, #ffd700 100%)',
			'linear-gradient(135deg, #ffd700 0%, #ffee00 100%)',
		];
		return gradients[index % gradients.length];
	};

	if (loading) { return null; }

	if (error) {
		return (
			<div className="va-stack">
				<p style={{ color: 'red' }}>{error}</p>
			</div>
		);
	}

	return (
		<div className="va-stack">
			<div className="va-rewards-header">
				<h1 className="va-page-title">Recompense & Certificate</h1>
				<p className="va-muted">
					Colecția ta de realizări și certificate de competență. Fiecare recompensă reprezintă un pas important în
					progresul tău.
				</p>
			</div>

			<div className="va-certificates-grid">
				{rewards.map((reward, index) => (
					<div
						key={reward.id}
						className="va-certificate"
						style={{
							'--cert-gradient': getRewardGradient(index),
						}}
					>
						<div className="va-certificate-border">
							<div className="va-certificate-corner va-certificate-corner-tl"></div>
							<div className="va-certificate-corner va-certificate-corner-tr"></div>
							<div className="va-certificate-corner va-certificate-corner-bl"></div>
							<div className="va-certificate-corner va-certificate-corner-br"></div>
						</div>

						<div className="va-certificate-content">
							<div className="va-certificate-icon">{getRewardIcon(reward.id)}</div>
							<div className="va-certificate-header">
								<p className="va-certificate-label">Certificat de Competență</p>
								<h2 className="va-certificate-title">{reward.title}</h2>
							</div>
							<div className="va-certificate-body">
								<p className="va-certificate-description">{reward.description}</p>
								{reward.points_required && (
									<p className="va-certificate-points">Puncte necesare: {reward.points_required}</p>
								)}
							</div>
							<div className="va-certificate-footer">
								<div className="va-certificate-seal">
									<div className="va-certificate-seal-inner">
										<span>VA</span>
									</div>
								</div>
								<div className="va-certificate-signature">
									<p className="va-certificate-name">{profile?.user?.name || 'Student'}</p>
									<p className="va-certificate-date">VoltaAcademy</p>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default RewardsPage;


