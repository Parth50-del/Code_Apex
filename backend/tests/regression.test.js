import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const mod = await import('../src/server.js');
const { parseRepositoryUrl, validBranchName, analyzeErrorResponse, GitHubError } = mod;

describe('parseRepositoryUrl', () => {
  it('accepts a canonical public repository URL', () => {
    assert.deepEqual(parseRepositoryUrl('https://github.com/Parth50-del/Code_Apex'), {
      owner: 'Parth50-del',
      repo: 'Code_Apex',
    });
  });

  it('rejects the trailing-bracket URL from the bug report as invalid_url', () => {
    assert.equal(parseRepositoryUrl('https://github.com/Parag1337/quartz]'), null);
  });

  it('rejects trailing punctuation, extra segments, and non-GitHub hosts', () => {
    assert.equal(parseRepositoryUrl('https://github.com/owner/repo]'), null);
    assert.equal(parseRepositoryUrl('https://github.com/owner/repo.'), null);
    assert.equal(parseRepositoryUrl('https://github.com/owner/repo/tree/main'), null);
    assert.equal(parseRepositoryUrl('https://github.com/owner'), null);
    assert.equal(parseRepositoryUrl('https://gitlab.com/owner/repo'), null);
    assert.equal(parseRepositoryUrl('not a url'), null);
  });

  it('accepts a .git suffix and case-insensitive https host', () => {
    assert.deepEqual(parseRepositoryUrl('https://github.com/owner/repo.git'), { owner: 'owner', repo: 'repo' });
    assert.deepEqual(parseRepositoryUrl('HTTPS://GITHUB.COM/owner/repo'), { owner: 'owner', repo: 'repo' });
  });
});

describe('validBranchName', () => {
  it('treats omitted/null/empty branch as default-branch (never invalid)', () => {
    assert.equal(validBranchName(undefined), '');
    assert.equal(validBranchName(null), '');
    assert.equal(validBranchName(''), '');
    assert.equal(validBranchName('   '), '');
  });

  it('accepts normal branch names including slashes', () => {
    assert.equal(validBranchName('main'), 'main');
    assert.equal(validBranchName('feature/my-branch_1.2'), 'feature/my-branch_1.2');
  });

  it('rejects characters GitHub does not accept', () => {
    assert.equal(validBranchName('bad branch!!'), null);
    assert.equal(validBranchName('quartz]'), null);
    assert.equal(validBranchName('a..b'), null);
    assert.equal(validBranchName('/main'), null);
    assert.equal(validBranchName('a@{b'), null);
    assert.equal(validBranchName('a\\b'), null);
  });
});

describe('analyzeErrorResponse', () => {
  it('maps a surviving-metadata branch miss to invalid_branch (not not_found)', () => {
    const err = new GitHubError('nope', { status: 404, branch: 'ghost', branchNotFound: true });
    const mapped = analyzeErrorResponse(err, 'Branch "ghost"');
    assert.equal(mapped.status, 404);
    assert.equal(mapped.body.code, 'invalid_branch');
    assert.match(mapped.body.error, /ghost/);
  });

  it('keeps genuine repository misses as not_found', () => {
    const mapped = analyzeErrorResponse(new GitHubError('nope', { status: 404 }), 'Repository');
    assert.equal(mapped.body.code, 'not_found');
  });

  it('maps exhausted limits to rate_limit with retryAt preserved', () => {
    const retryAt = new Date(Date.now() + 60000).toISOString();
    const mapped = analyzeErrorResponse(
      new GitHubError('limited', { status: 403, rateLimited: true, retryAt }),
      'Repository',
    );
    assert.equal(mapped.status, 429);
    assert.equal(mapped.body.code, 'rate_limit');
    assert.equal(mapped.body.retryAt, retryAt);
  });

  it('maps 422 to empty_repository and timeouts to timeout', () => {
    assert.equal(analyzeErrorResponse(new GitHubError('x', { status: 422 }), 'Repository').body.code, 'empty_repository');
    assert.equal(analyzeErrorResponse(Object.assign(new Error('t'), { name: 'TimeoutError' }), 'Repository').body.code, 'timeout');
  });
});
