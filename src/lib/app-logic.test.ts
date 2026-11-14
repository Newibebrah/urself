import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUsagePercent, formatIDR, validateEmail, validatePrompt } from './utils';
import { deleteProjectFromList, duplicateProjectInList, filterProjects, MOCK_PROJECTS } from '../features/projects/mock';

test('formatIDR formats Indonesian Rupiah with dot separators', () => {
  assert.equal(formatIDR(75000), 'Rp 75.000');
  assert.equal(formatIDR(177000), 'Rp 177.000');
  assert.equal(formatIDR(255000), 'Rp 255.000');
});

test('validateEmail accepts valid addresses and rejects invalid ones', () => {
  assert.equal(validateEmail('demo@urself.online').ok, true);
  assert.equal(validateEmail('not-an-email').ok, false);
  assert.equal(validateEmail('   ').ok, false);
});

test('validatePrompt enforces minimum length after trimming', () => {
  assert.equal(validatePrompt('   hi  ').ok, false);
  assert.equal(validatePrompt('Landing page for a specialty coffee shop').ok, true);
});

test('calculateUsagePercent clamps quota percentage between 0 and 100', () => {
  assert.equal(calculateUsagePercent(3, 5), 60);
  assert.equal(calculateUsagePercent(4, 10), 40);
  assert.equal(calculateUsagePercent(15, 10), 100);
  assert.equal(calculateUsagePercent(1, 0), 0);
});

test('project list helpers filter, duplicate, and delete deterministically', () => {
  const readyOnly = filterProjects(MOCK_PROJECTS, '', 'ready');
  assert.equal(readyOnly.length, 2);

  const searchKopi = filterProjects(MOCK_PROJECTS, 'kopi', 'all');
  assert.equal(searchKopi.length, 1);
  assert.equal(searchKopi[0].id, 'mock-1');

  const duplicated = duplicateProjectInList(MOCK_PROJECTS, 'mock-1');
  assert.equal(duplicated.length, MOCK_PROJECTS.length + 1);
  assert.equal(duplicated[0].name, 'Kopi Senja — Landing Page (Copy)');
  assert.equal(duplicated[0].status, 'draft');

  const deleted = deleteProjectFromList(MOCK_PROJECTS, 'mock-1');
  assert.equal(deleted.length, MOCK_PROJECTS.length - 1);
});
