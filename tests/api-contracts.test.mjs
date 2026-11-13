import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// These checks exercise request/response contracts without modifying the live server.
const base = 'https://api.test/idea2ip';
const imageUtils = stripTypeScriptTypes(readFileSync(new URL('../src/utils/image.ts', import.meta.url), 'utf8'));
async function load(name) {
  const source = readFileSync(new URL(`../src/api/${name}.ts`, import.meta.url), 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify(base))
    .replace("import { isSupportedImage } from '../utils/image';", '');
  return import('data:text/javascript;base64,' + Buffer.from(imageUtils + '\n' + stripTypeScriptTypes(source)).toString('base64'));
}
const auth = await load('auth');
const users = await load('users');
const projects = await load('projects');
const materials = await load('materials');
const artwork = await load('artwork');
const interview = await load('interview');
const contributions = await load('contributions');
const reports = await load('reports');
const file = new File(['PNG'], 'test.png', { type: 'image/png' });
const attachment = { fileId: 21, fileName: 'test.png', imageUrl: '/api/materials/10/files/21' };
const detail = { materialId: 10, materialType: 'AI_ASSISTED', title: 'Material', description: null, usedAi: 'ChatGPT', productionDate: null, files: [attachment] };
const project = { projectId: 1, title: 'Project', createdAt: '2026-11-07T10:00:00', updatedAt: null, artworkType: null, thumbnailUrl: '/uploads/project-thumbnails/a.png' };
const art = { artworkId: 5, projectId: 1, title: 'Artwork', description: null, fileName: 'test.png', fileUrl: '/api/projects/1/artwork/image' };
const credentials = { loginId: 'test', password: ' password ' };
const cases = [
  ['report readiness', () => reports.getReportReadiness('1'), 'GET', '/api/projects/1/report/readiness', 200, {
    canGenerate: true, inputRevision: 13, checks: [{ code: 'FINAL_ARTWORK_IMAGE_REQUIRED', status: 'READY', message: 'Ready' }], blockingReasons: [], warnings: [],
  }],
  ['contribution review save', () => contributions.updateContributions('1', { expectedRevision: 1, changes: [{ stepId: -10, decision: 'CONFIRM' }], finalize: true }), 'PATCH', '/api/projects/1/contributions', 200, {
    reviewStatus: 'CONFIRMED', revision: 2, timeline: [{ stepId: -10, order: 1, kind: 'MATERIAL', title: 'Material', reviewStatus: 'CONFIRMED' }], unresolvedFields: [], latestGeneration: null,
  }],
  ['contribution step detail', () => contributions.getContributionStep('1', -10), 'GET', '/api/projects/1/contributions/steps/-10', 200, {
    stepId: -10, order: 1, kind: 'MATERIAL', title: 'Material', reviewStatus: 'UNREVIEWED',
    materialRefs: [{ materialId: 5, title: 'Reference', files: [{ fileId: 5, originalFileName: 'reference.png', fileUrl: '/api/materials/5/files/5' }] }],
    finalArtworkRef: null, aiUsage: { tools: ['Stable Diffusion'], purpose: 'Reference', outputUsage: null },
    humanCreatedElements: ['Created'], humanEdits: ['Edited'], sources: [{ sourceId: 'answer:10', kind: 'USER_STATEMENT', title: 'Answer', quote: 'Edited', locator: null, officialUrl: null, edition: null, effectiveFrom: null, effectiveTo: null, publisher: null, publishedOn: null, retrievedOn: null }],
  }],
  ['contribution list', () => contributions.getContributions('1'), 'GET', '/api/projects/1/contributions', 200, {
    reviewStatus: 'NOT_STARTED', revision: 0, timeline: [], unresolvedFields: [], latestGeneration: null,
  }],
  ['interview answer', () => interview.submitInterviewAnswer('1', { questionId: 1, content: 'Stable Diffusion', requestId: '20c01f39-fded-472f-88ab-b469be65c535' }), 'POST', '/api/projects/1/interview/answers', 200, {
    answerMessageId: 2, interview: { interviewId: 1, status: 'COMPLETED', fieldStates: [], currentQuestion: null, nextQuestionPending: false },
  }],
  ['interview messages', () => interview.getInterviewMessages('1'), 'GET', '/api/projects/1/interview/messages', 200, { messages: [] }],
  ['interview status', () => interview.getInterviewStatus('1'), 'GET', '/api/projects/1/interview', 200, {
    interviewId: null, status: 'NOT_STARTED', fieldStates: [], currentQuestion: null, nextQuestionPending: false,
  }],
  ['interview start', () => interview.startInterview('1'), 'POST', '/api/projects/1/interview', 201, {
    interviewId: 1, status: 'IN_PROGRESS', fieldStates: [], nextQuestionPending: false,
    currentQuestion: { messageId: 1, content: 'Question', targetField: 'AI_TOOL', reason: null, materialRefs: [] },
  }],
  ['interview readiness', () => interview.getInterviewReadiness('1'), 'GET', '/api/projects/1/interview/readiness', 200, {
    canStart: true,
    fieldStates: [{ field: 'AI_TOOL', status: 'NOT_APPLICABLE', summary: null }],
    materialChecks: [{ materialType: 'FINAL_ARTWORK', ready: true }, { materialType: 'AI_MATERIAL', ready: false }],
    blockingReasons: [], warnings: [{ materialType: 'AI_MATERIAL', message: 'Optional material missing' }],
  }],
  ['signup', () => auth.signup(credentials), 'POST', '/api/auth/signup', 201, { userId: 1, loginId: 'test' }, false],
  ['login', () => auth.login(credentials), 'POST', '/api/auth/login', 200, { accessToken: 'jwt' }, false],
  ['logout', () => auth.logout(), 'POST', '/api/auth/logout', 204, null],
  ['me', () => users.getCurrentUser(), 'GET', '/api/users/me', 200, { userId: 1, loginId: 'test' }],
  ['project create', () => projects.createProject({ title: 'Project', workType: 'character-design' }), 'POST', '/api/projects', 201, { projectId: 1, title: 'Project' }],
  ['project list', () => projects.getProjects(), 'GET', '/api/projects', 200, { projects: [project] }],
  ['project detail', () => projects.getProject('1'), 'GET', '/api/projects/1', 200, { ...project, description: null }],
  ['material create', () => materials.createMaterial('1', { materialType: 'AI_ASSISTED', title: 'Material', usedAi: 'ChatGPT' }), 'POST', '/api/projects/1/materials', 201, { materialId: 10, projectId: 1, title: 'Material', files: [] }],
  ['material list', () => materials.getMaterials('1'), 'GET', '/api/projects/1/materials', 200, { materials: [{ ...detail, materialOrder: 2, createdAt: project.createdAt }] }],
  ['material detail', () => materials.getMaterial('10'), 'GET', '/api/materials/10', 200, detail],
  ['material edit', () => materials.updateMaterial('10', { description: null }), 'PATCH', '/api/materials/10', 200, detail],
  ['material upload', () => materials.uploadMaterialFiles('10', [file]), 'POST', '/api/materials/10/files', 201, { materialId: 10, files: [attachment] }],
  ['material files edit', () => materials.updateMaterialFiles('10', [file], [20]), 'PATCH', '/api/materials/10/files', 200, { materialId: 10, files: [attachment] }],
  ['material image', () => materials.getMaterialImage('10', '21'), 'GET', '/api/materials/10/files/21', 200, 'image'],
  ['material delete', () => materials.deleteMaterial('10'), 'DELETE', '/api/materials/10', 204, null],
  ['artwork create', () => artwork.createArtwork('1', { title: 'Artwork' }), 'POST', '/api/projects/1/artwork', 201, art],
  ['artwork detail', () => artwork.getArtwork('1'), 'GET', '/api/projects/1/artwork', 200, art],
  ['artwork edit', () => artwork.updateArtwork('1', { description: null }), 'PATCH', '/api/projects/1/artwork', 200, art],
  ['artwork upload', () => artwork.uploadArtworkImage('1', file), 'PATCH', '/api/projects/1/artwork/image', 200, art],
  ['artwork image', () => artwork.getArtworkImage('1'), 'GET', '/api/projects/1/artwork/image', 200, 'image'],
  ['artwork delete', () => artwork.deleteArtwork('1'), 'DELETE', '/api/projects/1/artwork', 204, null],
];
for (const [name, run, method, path, status, data, authenticated = true] of cases) {
  test(name, async () => {
    globalThis.localStorage = { getItem: () => 'Bearer jwt' };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, base + path);
      assert.equal(options.method ?? 'GET', method);
      assert.equal(options.headers.Authorization, authenticated ? 'Bearer jwt' : undefined);
      if (options.body instanceof FormData) {
        assert.equal(options.headers['Content-Type'], undefined);
        const field = name === 'material files edit' ? 'newFiles' : name === 'material upload' ? 'files' : 'file';
        assert.equal(options.body.get(field).name, 'test.png');
        if (name === 'material files edit') assert.deepEqual(options.body.getAll('deleteFileIds'), ['20']);
      } else if (options.body) {
        assert.equal(options.headers['Content-Type'], 'application/json');
        const body = JSON.parse(options.body);
        if (name === 'login' || name === 'signup') assert.deepEqual(body, credentials);
        if (name.endsWith('edit')) assert.deepEqual(body, { description: null });
      }
      if (data === 'image') return new Response('PNG', { headers: { 'Content-Type': 'image/png' } });
      return status === 204 ? new Response(null, { status }) : Response.json({
        isSuccess: true,
        timestamp: '2026-11-12T03:23:00',
        code: 'TEST_SUCCESS',
        httpStatus: status,
        message: 'Success',
        data,
      }, { status });
    };
    const result = await run();
    if (data === 'image') assert.equal(await result.text(), 'PNG');
    if (name === 'project list') {
      assert.equal(result[0].thumbnailUrl, base + project.thumbnailUrl);
      assert.equal(result[0].updatedAt, project.createdAt);
      assert.equal(result[0].workType, null);
    }
    for (const errorStatus of [403, 500]) {
      globalThis.fetch = async () => Response.json({
        isSuccess: false,
        timestamp: '2026-11-12T03:23:00',
        code: 'TEST_ERROR',
        httpStatus: errorStatus,
        message: 'Error',
        data: null,
      }, { status: errorStatus });
      await assert.rejects(run());
    }
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(run());
  });
}

test('readiness blocked state and invalid contracts', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const blocked = { canStart: false, fieldStates: [], materialChecks: [], blockingReasons: [{ materialType: 'FINAL_ARTWORK', message: 'Image required' }], warnings: [] };
  globalThis.fetch = async () => Response.json({ data: blocked });
  assert.equal((await interview.getInterviewReadiness('1')).canStart, false);
  for (const status of [401, 404]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(interview.getInterviewReadiness('1'));
  }
  globalThis.fetch = async () => Response.json({ data: { ...blocked, canStart: 'true' } });
  await assert.rejects(interview.getInterviewReadiness('1'));
  await assert.rejects(interview.getInterviewReadiness('uuid'));
  globalThis.localStorage = { getItem: () => null };
  await assert.rejects(interview.getInterviewReadiness('1'));
});

test('deployed readiness uses type for material checks, warnings and blockers', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const data = {
    canStart: true,
    fieldStates: Object.keys(interview.INTERVIEW_FIELD_LABELS).map((field) => ({ field, status: field === 'AI_TOOL' ? 'NEEDS_REVIEW' : 'MISSING', summary: field === 'AI_TOOL' ? 'Registered AI tool: a' : null })),
    materialChecks: [{ type: 'FINAL_ARTWORK', ready: true }, { type: 'AI_MATERIAL', ready: true }, { type: 'MANUAL_EDIT_MATERIAL', ready: false }],
    blockingReasons: [], warnings: [{ type: 'MANUAL_EDIT_MATERIAL', message: 'Optional material can be supplemented.' }],
  };
  globalThis.fetch = async () => Response.json({ isSuccess: true, httpStatus: 200, data });
  const readiness = await interview.getInterviewReadiness('7');
  assert.equal(readiness.canStart, true);
  assert.equal(readiness.materialChecks[2].materialType, 'MANUAL_EDIT_MATERIAL');
  assert.equal(readiness.warnings[0].materialType, 'MANUAL_EDIT_MATERIAL');
  globalThis.fetch = async () => Response.json({ data: { ...data, canStart: false, blockingReasons: [{ type: 'FINAL_ARTWORK', message: 'Image required' }] } });
  assert.equal((await interview.getInterviewReadiness('7')).blockingReasons[0].materialType, 'FINAL_ARTWORK');
  globalThis.fetch = async () => Response.json({ data: { ...data, materialChecks: [{ type: 'FINAL_ARTWORK', ready: 'true' }] } });
  await assert.rejects(interview.getInterviewReadiness('7'));
});

test('deployed interview accepts string source IDs across start, status and answers', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const session = {
    interviewId: 7, status: 'IN_PROGRESS',
    fieldStates: Object.keys(interview.INTERVIEW_FIELD_LABELS).map((field) => ({ field, status: field === 'AI_TOOL' ? 'NEEDS_REVIEW' : 'MISSING', summary: field === 'AI_TOOL' ? 'AI tool: a' : null })),
    currentQuestion: { messageId: 65, content: 'Which AI tool?', targetField: 'AI_TOOL', reason: 'Check this field', materialRefs: [{ sourceId: 'material:15:file:13', materialId: 15, fileId: 13, title: 'Image test' }] },
    nextQuestionPending: false,
  };
  globalThis.fetch = async () => Response.json({ isSuccess: true, httpStatus: 200, data: session });
  assert.deepEqual(await interview.startInterview('7'), session);
  assert.deepEqual(await interview.getInterviewStatus('7'), session);
  globalThis.fetch = async () => Response.json({ data: { answerMessageId: 66, interview: session } });
  const answered = await interview.submitInterviewAnswer('7', { questionId: 65, content: 'Stable Diffusion', requestId: '20c01f39-fded-472f-88ab-b469be65c535' });
  assert.equal(answered.interview.currentQuestion.materialRefs[0].sourceId, 'material:15:file:13');
  for (const invalid of [{ sourceId: {} }, { sourceId: '' }, { materialId: 'bad' }, { fileId: -1 }]) {
    globalThis.fetch = async () => Response.json({ data: { ...session, currentQuestion: { ...session.currentQuestion, materialRefs: [{ ...session.currentQuestion.materialRefs[0], ...invalid }] } } });
    await assert.rejects(interview.getInterviewStatus('7'));
  }
});

test('interview existing/pending/completed, start errors and no request body', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  for (const status of ['IN_PROGRESS', 'COMPLETED']) {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.body, undefined);
      return Response.json({ data: { interviewId: 1, status, fieldStates: [], currentQuestion: null, nextQuestionPending: status === 'IN_PROGRESS' } });
    };
    assert.equal((await interview.startInterview('1')).status, status);
  }
  for (const status of [401, 404, 409, 503]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(interview.startInterview('1'));
  }
  globalThis.fetch = async () => Response.json({ data: { status: 'IN_PROGRESS' } });
  await assert.rejects(interview.startInterview('1'));
  await assert.rejects(interview.startInterview('uuid'));
});

test('interview GET restores questions/pending/completed and supports cancellation', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  for (const status of ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']) {
    const data = {
      interviewId: status === 'NOT_STARTED' ? null : 1, status, fieldStates: [],
      currentQuestion: status === 'IN_PROGRESS' ? { messageId: 7, content: 'Saved question', targetField: 'AI_TOOL', reason: null, materialRefs: [] } : null,
      nextQuestionPending: false,
    };
    globalThis.fetch = async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(options.body, undefined);
      assert.equal(options.cache, 'no-store');
      return Response.json({ data });
    };
    assert.deepEqual(await interview.getInterviewStatus('1'), data);
  }
  for (const status of [401, 404, 201]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(interview.getInterviewStatus('1'));
  }
  const controller = new AbortController();
  controller.abort();
  const error = new DOMException('Aborted', 'AbortError');
  globalThis.fetch = async (url, options) => { assert.equal(options.signal, controller.signal); throw error; };
  await assert.rejects(interview.getInterviewStatus('1', controller.signal), (cause) => cause === error);
});

test('interview message order, reply references and malformed responses', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const question = { messageId: 1, role: 'ASSISTANT', content: 'Question', sequenceNo: 1, targetField: 'AI_TOOL', replyToQuestionId: null, createdAt: '2026-11-12T03:23:00' };
  const answer = { ...question, messageId: 2, role: 'USER', content: 'Stable Diffusion', sequenceNo: 2, replyToQuestionId: 1 };
  globalThis.fetch = async () => Response.json({ data: { messages: [answer, question] } });
  const messages = await interview.getInterviewMessages('1');
  assert.deepEqual(messages, [question, answer]);
  assert.equal(messages[1].replyToQuestionId, 1);
  for (const items of [[question, question], [{ ...question, role: 'invalid' }], [{ ...question, createdAt: 'invalid' }]]) {
    globalThis.fetch = async () => Response.json({ data: { messages: items } });
    await assert.rejects(interview.getInterviewMessages('1'));
  }
  for (const status of [401, 404]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(interview.getInterviewMessages('1'));
  }
  await assert.rejects(interview.getInterviewMessages('uuid'));
  globalThis.localStorage = { getItem: () => null };
  await assert.rejects(interview.getInterviewMessages('1'));
});

test('answer retry identity, validation and next-question-pending response', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const input = { questionId: 1, content: 'Stable Diffusion', requestId: '20c01f39-fded-472f-88ab-b469be65c535' };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) return Response.json({}, { status: 503 });
    return Response.json({ data: { answerMessageId: 2, interview: { interviewId: 1, status: 'IN_PROGRESS', fieldStates: [], currentQuestion: null, nextQuestionPending: true } } });
  };
  await assert.rejects(interview.submitInterviewAnswer('1', input), (error) => error.status === 503);
  assert.equal((await interview.submitInterviewAnswer('1', input)).interview.nextQuestionPending, true);
  assert.deepEqual(requests[0], requests[1]);
  for (const invalid of [{ ...input, questionId: 0 }, { ...input, requestId: 'bad' }, { ...input, content: ' ' }, { ...input, content: 'x'.repeat(8001) }]) {
    await assert.rejects(interview.submitInterviewAnswer('1', invalid));
  }
  for (const status of [400, 401, 404, 409]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(interview.submitInterviewAnswer('1', input), (error) => error.status === status);
  }
});

test('contribution generation acceptance, same-ID retry and conflict codes', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const input = { requestId: '20c01f39-fded-472f-88ab-b469be65c535', expectedRevision: 2 };
  for (const status of [200, 202]) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, base + '/api/projects/1/contributions/generations');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer jwt');
      assert.deepEqual(JSON.parse(options.body), input);
      return Response.json({ data: { generationId: 3, requestId: input.requestId, status: 'QUEUED', failure: null } }, { status });
    };
    assert.equal((await contributions.generateContributions('1', input)).generationId, 3);
  }
  const retry = { ...input, retry: true };
  globalThis.fetch = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body), retry);
    return Response.json({ data: { generationId: 3, requestId: input.requestId, status: 'FAILED', failure: { code: 'AI_FAILURE', message: 'Failed', retryable: true } } });
  };
  assert.equal((await contributions.generateContributions('1', retry)).failure.retryable, true);
  for (const code of ['INTERVIEW_NOT_COMPLETED', 'STALE_REVIEW_REVISION', 'CONTRIBUTION_JOB_IN_PROGRESS', 'REQUEST_ID_CONFLICT', 'RETRY_REQUEST_NOT_FOUND']) {
    globalThis.fetch = async () => Response.json({ code }, { status: 409 });
    await assert.rejects(contributions.generateContributions('1', input), (error) => error.code === code);
  }
  await assert.rejects(contributions.generateContributions('1', { ...input, expectedRevision: -1 }));
  await assert.rejects(contributions.generateContributions('1', { ...input, requestId: 'bad' }));
});

test('contribution negative step IDs, ordering, revision and latest job', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const first = { stepId: -10, order: 1, kind: 'MATERIAL', title: 'Material', reviewStatus: 'UNREVIEWED' };
  const second = { stepId: 5, order: 2, kind: 'FINAL_ARTWORK', title: 'Artwork', reviewStatus: 'EXCLUDED' };
  const data = { reviewStatus: 'IN_REVIEW', revision: 2, timeline: [second, first], unresolvedFields: ['creative_intent'], latestGeneration: { generationId: 3, requestId: '20c01f39-fded-472f-88ab-b469be65c535', status: 'RUNNING', failure: null } };
  globalThis.fetch = async () => Response.json({ data });
  const review = await contributions.getContributions('1');
  assert.equal(review.timeline[0].stepId, -10);
  assert.equal(review.revision, 2);
  assert.equal(review.latestGeneration.status, 'RUNNING');
  for (const invalid of [{ ...data, revision: -1 }, { ...data, timeline: [first, first] }, { ...data, latestGeneration: { ...data.latestGeneration, status: 'FAILED' } }]) {
    globalThis.fetch = async () => Response.json({ data: invalid });
    await assert.rejects(contributions.getContributions('1'));
  }
  for (const status of [401,404]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(contributions.getContributions('1'));
  }
});

test('contribution detail nulls, ID mismatch and missing sources', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const data = { stepId: -10, order: 1, kind: 'FINAL_ARTWORK', title: 'Final', reviewStatus: 'CONFIRMED', materialRefs: [], finalArtworkRef: { artworkId: 5, title: 'Artwork', fileUrl: null }, aiUsage: null, humanCreatedElements: [], humanEdits: [], sources: [] };
  globalThis.fetch = async () => Response.json({ data });
  assert.equal((await contributions.getContributionStep('1', -10)).finalArtworkRef.fileUrl, null);
  for (const invalid of [{ ...data, stepId: 10 }, { ...data, sources: null }, { ...data, aiUsage: { tools: 'bad' } }]) {
    globalThis.fetch = async () => Response.json({ data: invalid });
    await assert.rejects(contributions.getContributionStep('1', -10));
  }
  for (const status of [401, 404]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(contributions.getContributionStep('1', -10));
  }
  await assert.rejects(contributions.getContributionStep('1', 1.5));
});

test('contribution partial edits, empty arrays, exclusion and revision conflicts', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const data = { reviewStatus: 'IN_REVIEW', revision: 3, timeline: [], unresolvedFields: [], latestGeneration: null };
  for (const input of [
    { expectedRevision: 2, changes: [{ stepId: -10, decision: 'EDIT', edits: { humanEdits: [], aiUsage: null } }] },
    { expectedRevision: 2, changes: [{ stepId: -10, decision: 'EXCLUDE' }] },
    { expectedRevision: 2, changes: [], finalize: true, noContributionReason: 'No contribution' },
  ]) {
    globalThis.fetch = async (url, options) => {
      assert.deepEqual(JSON.parse(options.body), input);
      return Response.json({ data });
    };
    assert.equal((await contributions.updateContributions('1', input)).revision, 3);
  }
  const change = { stepId: -10, decision: 'CONFIRM' };
  for (const changes of [[change, change], [{ stepId: -10, decision: 'EDIT' }], [{ stepId: -10, decision: 'EXCLUDE', edits: {} }], Array(501).fill(change)]) {
    await assert.rejects(contributions.updateContributions('1', { expectedRevision: 2, changes }));
  }
  for (const [status, code] of [[400,'INVALID_CONTRIBUTION_CHANGE'],[400,'CONTRIBUTION_DECISION_REQUIRED'],[400,'NO_CONTRIBUTION_REASON_REQUIRED'],[409,'STALE_REVIEW_REVISION'],[409,'INTERVIEW_NOT_COMPLETED'],[404,'CONTRIBUTION_STEP_NOT_FOUND']]) {
    globalThis.fetch = async () => Response.json({ code }, { status });
    await assert.rejects(contributions.updateContributions('1', { expectedRevision: 2, changes: [] }), (error) => error.code === code);
  }
});

test('report readiness blocking conditions, optional warnings and validation', async () => {
  globalThis.localStorage = { getItem: () => 'jwt' };
  const blocked = { code: 'INTERVIEW_NOT_COMPLETED', status: 'BLOCKED', message: 'Interview required' };
  const warning = { code: 'MATERIAL_EVIDENCE_INCOMPLETE', status: 'WARNING', message: 'Optional evidence' };
  for (const canGenerate of [true, false]) {
    const data = { canGenerate, inputRevision: 13, checks: [warning], blockingReasons: canGenerate ? [] : [blocked], warnings: [warning] };
    globalThis.fetch = async () => Response.json({ data });
    assert.deepEqual(await reports.getReportReadiness('1'), data);
  }
  for (const status of [401,404]) {
    globalThis.fetch = async () => Response.json({}, { status });
    await assert.rejects(reports.getReportReadiness('1'));
  }
  globalThis.fetch = async () => Response.json({ data: { canGenerate: true, inputRevision: -1, checks: [], blockingReasons: [], warnings: [] } });
  await assert.rejects(reports.getReportReadiness('1'));
  await assert.rejects(reports.getReportReadiness('uuid'));
});
