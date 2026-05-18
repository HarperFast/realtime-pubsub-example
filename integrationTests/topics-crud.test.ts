/**
 * Verifies CRUD operations on the Topics REST API.
 * Topics uses `topic` (a path string like "device/sensor/temp") as primary key.
 */
import { suite, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, '..');

function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

suite('Topics CRUD', (ctx: ContextWithHarper) => {
  before(async () => {
    await setupHarperWithFixture(ctx, fixtureDir);
  });

  after(async () => {
    await teardownHarper(ctx);
  });

  test('PUT /Topics/:topic creates a topic entry', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    const res = await fetch(`${httpURL}/Topics/test-sensor-create`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic: 'test-sensor-create', value: 'on' }),
    });

    ok(res.ok, `expected successful create, got HTTP ${res.status}`);
  });

  test('GET /Topics/:topic returns the topic', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/Topics/test-sensor-read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic: 'test-sensor-read', value: '42' }),
    });

    const getRes = await fetch(`${httpURL}/Topics/test-sensor-read`, {
      headers: { Authorization: auth },
    });

    strictEqual(getRes.status, 200);
    const body = await getRes.json() as { topic: string; value: string };
    strictEqual(body.value, '42');
  });

  test('PUT /Topics/:topic updates the value', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/Topics/test-sensor-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic: 'test-sensor-update', value: 'initial' }),
    });

    await fetch(`${httpURL}/Topics/test-sensor-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic: 'test-sensor-update', value: 'updated' }),
    });

    const getRes = await fetch(`${httpURL}/Topics/test-sensor-update`, {
      headers: { Authorization: auth },
    });
    const body = await getRes.json() as { value: string };
    strictEqual(body.value, 'updated');
  });

  test('DELETE /Topics/:topic removes the topic', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/Topics/test-sensor-delete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic: 'test-sensor-delete', value: 'to-delete' }),
    });

    const deleteRes = await fetch(`${httpURL}/Topics/test-sensor-delete`, {
      method: 'DELETE',
      headers: { Authorization: auth },
    });
    ok(deleteRes.ok, `expected successful delete, got HTTP ${deleteRes.status}`);

    const getRes = await fetch(`${httpURL}/Topics/test-sensor-delete`, {
      headers: { Authorization: auth },
    });
    strictEqual(getRes.status, 404);
  });

  test('GET /Topics returns an array of topics', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);

    await fetch(`${httpURL}/Topics/test-sensor-list`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic: 'test-sensor-list', value: 'listed' }),
    });

    const res = await fetch(`${httpURL}/Topics/`, {
      headers: { Authorization: auth },
    });

    strictEqual(res.status, 200);
    const body = await res.json();
    ok(Array.isArray(body), 'GET /Topics should return an array');
    ok((body as unknown[]).length >= 1, 'should have at least one topic');
  });
});
