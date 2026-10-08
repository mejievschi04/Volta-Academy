/** Roluri cu acces la zona /admin (shell + API staff). */
export const STAFF_ADMIN_ROLES = ['admin', 'analyst', 'instructor'];

export function isStaffAdminRole(role) {
	return STAFF_ADMIN_ROLES.includes(role ?? '');
}

/** Roluri care parcurg cursuri și teste fără să li se salveze progresul sau rezultatele (ca User::isLearningActivityExempt). */
export function isLearningExemptRole(role) {
	return STAFF_ADMIN_ROLES.includes(role ?? '');
}
