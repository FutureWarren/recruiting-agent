import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../unsubscribe/index.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Orbit website provides a navigable email-preferences page', () => {
  assert.match(home, /href="\/unsubscribe\/"[^>]*>Email preferences<\/a>/);
  assert.match(page, /<title>Email Preferences — Orbit<\/title>/);
  assert.match(page, /href="\/privacy\/"/);
});

test('Unsubscribe works without JavaScript and has a functional API target', () => {
  assert.match(page, /<form id="unsubscribe-form" action="https:\/\/orbit-marketing-preferences-production\.up\.railway\.app\/api\/marketing\/unsubscribe" method="POST">/);
  assert.match(page, /<input id="email" name="email" type="email"[^>]* required>/);
  assert.match(page, /await fetch\(form\.action/);
  assert.match(page, /if \(!response\.ok \|\| !body\.ok\)/);
  assert.match(page, /You're unsubscribed/);
  assert.match(page, /future@orbit-reaches\.com/);
});

test('No one-click unauthenticated GET unsubscribe and no leaking email in URLs', () => {
  assert.doesNotMatch(page, /new URLSearchParams\(window\.location\.search\)\.get\('email'\)/);
  assert.match(page, /name="robots" content="noindex,nofollow"/);
  assert.match(page, /name="referrer" content="no-referrer"/);
});
