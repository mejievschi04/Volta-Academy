import { test, expect } from '@playwright/test';
import { login, ADMIN_EMAIL } from './helpers.js';

test.beforeEach(async ({ page }) => {
	await login(page, ADMIN_EMAIL);
});

test('adminul ajunge pe panoul de control', async ({ page }) => {
	await expect(page).toHaveURL(/\/admin$/);
	await expect(page.getByRole('heading', { name: 'Panou de control' })).toBeVisible();
});

test('builder-ul afișează structura cursului și lecția deschisă', async ({ page }) => {
	await page.goto('/admin/courses/1/builder');
	await expect(page.getByText('Test final E2E').first()).toBeVisible();
	for (const lesson of ['Lecția 1', 'Lecția 2', 'Lecția 3']) {
		await expect(page.getByText(lesson, { exact: true }).first()).toBeVisible();
	}
	await expect(page.getByText('Conținutul lecției 1')).toBeVisible();
});

test('o adresă inexistentă din admin arată pagina 404', async ({ page }) => {
	await page.goto('/admin/pagina-care-nu-exista');
	await expect(page.getByRole('heading', { name: 'Pagina nu a fost găsită' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Înapoi la administrare' })).toBeVisible();
});

test('lista de utilizatori își arată numele și emailul pe câte un rând', async ({ page }) => {
	await page.goto('/admin/users');
	const row = page.locator('.admin-users-table tbody tr').filter({ hasText: 'student-desktop@e2e.test' });
	// rândurile de text ocupate de un element (pe telefon emailul se rupea literă cu literă)
	const textLines = (locator) => locator.evaluate((el) => {
		const range = document.createRange();
		range.selectNodeContents(el);
		return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
	});
	const name = row.locator('.admin-users-table-cell-name');
	await expect(name).toHaveText('Cursant E2E desktop');
	expect(await textLines(name)).toBe(1);
	const email = row.locator(':is(.admin-users-table-cell-email, .admin-users-table-cell-email-stacked):visible');
	await expect(email).toHaveText('student-desktop@e2e.test');
	expect(await textLines(email)).toBe(1);
	await expect(row.getByRole('button', { name: 'Editează utilizatorul: Cursant E2E desktop' })).toBeVisible();
});
