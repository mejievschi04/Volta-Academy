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
