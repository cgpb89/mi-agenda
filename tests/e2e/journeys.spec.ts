import { expect, test, type Page } from '@playwright/test';

/*
 * Critical journeys, in order, against a real build + test database:
 *  1 register → 2 configure → 3 public page → 4 book → 5 appears in dashboard →
 *  6 duplicate/limit → 7 change policy & enforce → 8 cancel/reschedule →
 *  9 record payment & revenue → 10 cross-tenant access denied.
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const slug = `e2e-barber-${run}`;
const owner = {
  name: 'Erin Owner',
  email: `erin-${run}@example.test`,
  password: 'correct horse battery staple',
};
const customerPhone = '(202) 555-0177';
let manageUrl = '';

async function signup(
  page: Page,
  o: { name: string; email: string; password: string },
  business: string,
  s: string,
) {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(o.name);
  await page.getByLabel('Email').fill(o.email);
  await page.getByLabel('Password').fill(o.password);
  await page.getByLabel('Business name').fill(business);
  await page.getByLabel('Booking page address').fill(s);
  await page.getByLabel('Time zone').selectOption('America/New_York');
  await page.getByRole('button', { name: 'Create your booking page' }).click();
  await page.waitForURL(`**/app/${s}/onboarding`);
}

async function bookViaPublicPage(page: Page, name: string, phone: string) {
  await page.goto(`/book/${slug}`);
  await page
    .getByRole('button', { name: /Classic Cut/ })
    .first()
    .click();
  await page.getByRole('button', { name: /No preference/ }).click();
  const slot = page.locator('button[aria-label$="M"]:not([disabled])').first();
  await slot.waitFor();
  await slot.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Full name').fill(name);
  await page.locator('input[type="tel"]').fill(phone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(2_200); // the details form enforces a minimum fill time
  await page.getByRole('button', { name: 'Confirm booking' }).click();
}

test('1–3 · register a business, configure it and publish the booking page', async ({ page }) => {
  await signup(page, owner, 'E2E Barber', slug);
  await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();

  await page.getByLabel('Service name').fill('Classic Cut');
  await page.getByLabel('Price (USD)').fill('38');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(/Classic Cut · 45 min · \$38/)).toBeVisible();

  await page.getByRole('button', { name: /Mon–Sat 9:00 AM – 7:00 PM/ }).click();
  await expect(page.getByText(/Currently: Mon–Sat/)).toBeVisible();

  await page.getByRole('button', { name: 'Publish booking page' }).click();
  await page.waitForURL(`**/app/${slug}/overview`);

  // Tighten the phone limit to 1 for the next steps.
  await page.goto(`/app/${slug}/settings`);
  await page.getByLabel(/Active appointments per phone number/).fill('1');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.getByText('Booking policy saved')).toBeVisible();

  await page.goto(`/book/${slug}`);
  await expect(page.getByRole('heading', { name: /E2E Barber/i }).first()).toBeVisible();
});

test('4–5 · a customer books online and it appears in the dashboard', async ({ page, browser }) => {
  const customer = await browser.newPage();
  await bookViaPublicPage(customer, 'Jordan Lee', customerPhone);
  await expect(customer.getByText("You're booked.")).toBeVisible();
  await expect(customer.getByText(/TMP-\d+-[A-Z]/)).toBeVisible();
  manageUrl = customer.url();
  expect(manageUrl).toContain(`/book/${slug}/manage/`);
  await customer.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`**/app/${slug}/overview`);
  await page.goto(`/app/${slug}/appointments`);
  await expect(page.getByRole('cell', { name: 'Jordan Lee' })).toBeVisible();
});

test('6–7 · the per-phone limit blocks a second booking until the owner raises it', async ({
  page,
  browser,
}) => {
  const customer = await browser.newPage();
  await bookViaPublicPage(customer, 'Jordan Again', customerPhone);
  await expect(customer.getByRole('alert')).toContainText(/already has an upcoming appointment/);
  await customer.close();

  await page.goto('/login');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto(`/app/${slug}/settings`);
  await page.getByLabel(/Active appointments per phone number/).fill('2');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.getByText('Booking policy saved')).toBeVisible();

  const again = await browser.newPage();
  await bookViaPublicPage(again, 'Jordan Again', '+1 202 555 0177');
  await expect(again.getByText("You're booked.")).toBeVisible();
  await again.close();
});

test('8 · the customer reschedules and cancels with their private link', async ({ page }) => {
  await page.goto(manageUrl);
  await expect(page.getByText('Your appointment')).toBeVisible();
  await page.getByRole('button', { name: 'Reschedule' }).click();
  const slot = page.locator('button[aria-label$="M"]:not([disabled])').nth(2);
  await slot.waitFor();
  await slot.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Confirm new time' }).click();
  await expect(page.getByText('Rescheduled.')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, cancel' }).click();
  await expect(page.getByText('Appointment cancelled')).toBeVisible();
});

test('9 · the owner records a collected payment and revenue reflects it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto(`/app/${slug}/appointments?status=CONFIRMED`);
  await page.getByRole('cell', { name: 'Jordan Again' }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByLabel('Amount').fill('20');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Payment recorded')).toBeVisible();
  await expect(page.getByText('$20 of $38')).toBeVisible();

  await page.goto(`/app/${slug}/overview?range=today`);
  await expect(page.getByText('Revenue collected')).toBeVisible();
  await expect(page.locator('text=$20').first()).toBeVisible();
  // Estimated revenue is not affected by a payment on a non-completed appointment.
  await expect(page.getByText('Price of completed appointments').first()).toBeVisible();
});

test('10 · another business cannot reach this dashboard', async ({ page }) => {
  const intruder = {
    name: 'Ivy Intruder',
    email: `ivy-${run}@example.test`,
    password: 'correct horse battery staple',
  };
  await signup(page, intruder, 'Other Shop', `e2e-other-${run}`);
  const res = await page.goto(`/app/${slug}/appointments`);
  expect(res?.status()).toBe(404);
  const api = await page.request.get(`/app/${slug}/customers`);
  expect(api.status()).toBe(404);
});
