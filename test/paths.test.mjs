import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownImageUrl } from '../src/paths.js';

test('resolves images beside their source MD using the authenticated native file route', () => {
  const url = new URL(markdownImageUrl('dsh-app://app/', 'D:/Notes/讲义.md', 'images/图%20片.png?version=1'));
  assert.equal(url.pathname, '/api/file');
  assert.equal(url.searchParams.get('path'), 'D:/Notes/images/图 片.png');
  assert.equal(markdownImageUrl('dsh-app://app/', '', 'relative.png'), undefined);
  assert.equal(markdownImageUrl('dsh-app://app/', 'D:/Notes/a.md', 'javascript:alert(1)'), undefined);
  assert.equal(markdownImageUrl('dsh-app://app/', 'D:/Notes/a.md', '//server/share.png'), undefined);
});
