import React, { useState, useEffect } from 'react';
import { adminService } from '../../../../services/api';

const CourseBuilderStep6 = ({ data, onUpdate, errors }) => {
	const [availableInstructors, setAvailableInstructors] = useState([]);

	useEffect(() => {
		fetchInstructors();
	}, []);

	const fetchInstructors = async () => {
		try {
			const insts = await adminService.getTeachers();
			setAvailableInstructors(Array.isArray(insts) ? insts : (insts?.data || []));
		} catch (err) {
			console.error('Error fetching instructors:', err);
		}
	};

	const handleToggleInstructor = (instructorId) => {
		const currentInstructors = data.instructors || [];
		const isSelected = currentInstructors.includes(instructorId);
		
		if (isSelected) {
			onUpdate({ instructors: currentInstructors.filter(id => id !== instructorId) });
		} else {
			onUpdate({ instructors: [...currentInstructors, instructorId] });
		}
	};

	return (
		<div className="admin-course-builder-step-content">
			<h2>Instructori & Permisiuni</h2>
			<p className="admin-course-builder-step-description">
				Gestionează instructorii și permisiunile pentru curs
			</p>

			<div className="admin-course-builder-form">
				{/* Additional Instructors */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Instructori Adiționali</h3>
					<p className="admin-form-hint">
						Adaugă instructorii care vor colabora la acest curs (opțional)
					</p>
					
					<div className="admin-instructors-list">
						{availableInstructors.map((instructor) => {
							const isSelected = (data.instructors || []).includes(instructor.id);
							const isMain = data.teacher_id === instructor.id;
							
							return (
								<div
									key={instructor.id}
									className={`admin-instructor-item ${isSelected ? 'selected' : ''} ${isMain ? 'main' : ''}`}
									onClick={() => !isMain && handleToggleInstructor(instructor.id)}
								>
									<input
										type="checkbox"
										checked={isSelected || isMain}
										disabled={isMain}
										onChange={() => {}}
										className="admin-checkbox-input"
									/>
									<div className="admin-instructor-info">
										<div className="admin-instructor-name">
											{instructor.name}
											{isMain && <span className="admin-instructor-badge">Principal</span>}
										</div>
										{instructor.email && (
											<div className="admin-instructor-email">{instructor.email}</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Permissions */}
				<div className="admin-form-section">
					<h3 className="admin-form-section-title">Permisiuni Studenți</h3>
					
					<div className="admin-permissions-list">
						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.permissions?.can_comment !== false}
								onChange={(e) => onUpdate({
									permissions: {
										...data.permissions,
										can_comment: e.target.checked
									}
								})}
								className="admin-checkbox-input"
							/>
							<span>Permite comentarii</span>
							<p className="admin-form-hint-inline">
								Studenții pot comenta și discuta despre curs
							</p>
						</label>

						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.permissions?.can_download === true}
								onChange={(e) => onUpdate({
									permissions: {
										...data.permissions,
										can_download: e.target.checked
									}
								})}
								className="admin-checkbox-input"
							/>
							<span>Permite descărcare materiale</span>
							<p className="admin-form-hint-inline">
								Studenții pot descărca PDF-uri și alte materiale
							</p>
						</label>

						<label className="admin-form-label admin-form-label-checkbox">
							<input
								type="checkbox"
								checked={data.permissions?.can_share !== false}
								onChange={(e) => onUpdate({
									permissions: {
										...data.permissions,
										can_share: e.target.checked
									}
								})}
								className="admin-checkbox-input"
							/>
							<span>Permite partajare</span>
							<p className="admin-form-hint-inline">
								Studenții pot partaja cursul pe rețelele sociale
							</p>
						</label>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CourseBuilderStep6;

