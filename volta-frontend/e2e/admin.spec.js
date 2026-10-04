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

test('în tema închisă butoanele din antetul mapei au text lizibil', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('volta-ui-theme', 'dark'));
	await page.goto('/admin/maps/1');
	const header = page.locator('.course-map-page-header');
	for (const name of ['Înapoi', 'Editează']) {
		const label = header.getByText(name, { exact: true });
		await expect(label).toBeVisible();
		// contrast text / fundalul butonului (fundalul era alb, iar textul lua culoarea deschisă a temei)
		const ratio = await label.evaluate((el) => {
			const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
			const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
				.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
			const button = el.closest('button');
			const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(button).backgroundColor))];
			return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
		});
		expect(ratio, name).toBeGreaterThanOrEqual(4.5);
	}
});

test('butonul X închide fereastra și are aspectul comun', async ({ page }) => {
	await page.goto('/admin/teams');
	await page.getByRole('button', { name: 'Adaugă Echipă' }).first().click();
	const heading = page.getByRole('heading', { name: 'Adaugă Echipă Nouă' });
	await expect(heading).toBeVisible();
	const close = page.locator('.va-close-btn:visible');
	await expect(close).toHaveCount(1);
	await expect(close).toHaveAccessibleName('Închide');
	// iconița comună (nu caracterul „×”), într-un buton cu margine vizibilă
	await expect(close.locator('svg')).toHaveCount(1);
	await expect(close).toHaveText('');
	const borderWidth = await close.evaluate((el) => getComputedStyle(el).borderTopWidth);
	expect(borderWidth).toBe('1px');
	await close.click();
	await expect(heading).toHaveCount(0);
});

// contrast text / fundal efectiv (culorile cu transparență sunt compuse peste părinți)
async function contrastOf(locator) {
	return locator.evaluate((el) => {
		const parse = (c) => { const p = c.match(/[\d.]+/g).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
		const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
		const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
			.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
		const chain = [];
		for (let n = el; n; n = n.parentElement) chain.unshift(n);
		let bg = { r: 255, g: 255, b: 255, a: 1 };
		for (const n of chain) {
			const b = parse(getComputedStyle(n).backgroundColor);
			if (b.a > 0) bg = over(b, bg);
		}
		const fg = over(parse(getComputedStyle(el).color), bg);
		const [x, y] = [lum(fg), lum(bg)];
		return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
	});
}

test('în tema deschisă textul de accent din notificări se citește (nu e galben pe alb)', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('volta-ui-theme', 'light'));
	await page.goto('/admin');
	await page.getByRole('button', { name: 'Deschide notificările' }).click();
	const drawer = page.locator('.va-notif-drawer-panel');
	for (const target of [drawer.getByRole('tab', { name: /Primite/ }), drawer.getByRole('button', { name: 'Marchează toate ca citite' })]) {
		await expect(target).toBeVisible();
		expect(await contrastOf(target)).toBeGreaterThanOrEqual(4.5);
	}
});

test('pagina Ghiduri deschisă direct are meniul de admin stilizat', async ({ page }) => {
	await page.goto('/guides');
	await expect(page.getByRole('heading', { name: 'Ghiduri', exact: true })).toBeVisible();
	// fără stilurile de admin, meniul lateral apărea ca o listă de linkuri în fluxul paginii
	const nav = page.getByRole('link', { name: 'Panou' }).first();
	await expect(nav).toBeAttached();
	const position = await page.locator('aside.modern-sidebar').first().evaluate((el) => getComputedStyle(el).position);
	expect(['fixed', 'sticky']).toContain(position);
});

test('Biblioteca și Ghidurile au margine față de meniu, iar antetul e aliniat cu lista', async ({ page }) => {
	for (const [url, list] of [['/library', 'Materiale disponibile'], ['/guides', 'Ghiduri disponibile']]) {
		await page.goto(url);
		const header = page.locator('.library-page-header');
		const listTitle = page.getByRole('heading', { name: list });
		await expect(listTitle).toBeVisible();
		// stilurile de admin se încarcă după pagină: așteptăm meniul lateral stilizat înainte de măsurare
		await expect.poll(() => page.locator('aside.modern-sidebar').first().evaluate((el) => getComputedStyle(el).position)).toMatch(/fixed|sticky/);
		// pagina intră cu o animație: comparăm pozițiile după ce s-au stabilizat
		await expect.poll(async () => Math.round((await listTitle.boundingBox()).x - (await header.boundingBox()).x), { message: url }).toBe(0);
		// înainte conținutul era lipit de meniul lateral (spațierea era anulată în cadrul de admin)
		const mainLeft = await page.locator('.va-shell-main').first().evaluate((el) => el.getBoundingClientRect().left);
		expect((await header.boundingBox()).x - mainLeft, url).toBeGreaterThanOrEqual(16);
	}
});

test('adminul parcurge un test ca un cursant, fără să i se salveze încercarea', async ({ page }) => {
	await page.goto('/admin/content?tab=tests');
	await page.getByRole('button', { name: 'Încearcă testul' }).first().click();
	await expect(page).toHaveURL(/\/exams\/\d+\?preview=1/);
	await expect(page.getByRole('note')).toContainText('nu se salvează');

	await page.getByLabel('București').check();
	await page.getByRole('button', { name: 'Întrebarea următoare' }).click();
	await page.getByLabel('4', { exact: true }).check();
	const submit = page.getByRole('button', { name: /Trimite/ }).first();
	await submit.click();
	const confirm = page.getByRole('dialog').getByRole('button', { name: /Trimite/ });
	if (await confirm.isVisible().catch(() => false)) await confirm.click();
	await expect(page.getByText('Promovat').first()).toBeVisible();

	await page.getByRole('link', { name: /Înapoi la teste/ }).first().click();
	await expect(page).toHaveURL(/\/admin\/content\?tab=tests/);
});
