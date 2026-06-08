/**
 * Verifies Harper's real-time transports for the Topics table:
 *   - MQTT over TCP (publish -> persisted in Topics table, readable via REST)
 *   - MQTT over WebSocket (ws://.../mqtt, subscribe receives a published retained message)
 *   - Server-Sent Events (SSE) on the REST resource (live update on record change)
 *
 * Harper bridges the Topics table and MQTT topics: publishing to topic `<id>` is
 * equivalent to writing the record with primary key `<id>`, and subscribing to a
 * topic streams that record's changes. The same mechanism backs SSE on the REST
 * resource (GET with `Accept: text/event-stream`).
 *
 * MQTT defaults (Harper defaultConfig.yaml): TCP port 1883, WebSocket enabled,
 * requireAuthentication: true. Each Harper instance binds a distinct loopback
 * address, so the fixed MQTT port does not collide across concurrent suites.
 */
import { suite, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import mqtt from 'mqtt';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, '..');

const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

const MQTT_TCP_PORT = 1883;

function basicAuth(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

/** Derive the loopback hostname Harper bound to from its httpURL. */
function hostFromURL(url: string): string {
  return new URL(url).hostname;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)),
  ]);
}

suite('Real-time transports', (ctx: ContextWithHarper) => {
  before(async () => {
    await setupHarperWithFixture(ctx, fixtureDir, { harperBinPath });
  });

  after(async () => {
    await teardownHarper(ctx);
  });

  test('MQTT (TCP): publish persists to the Topics table and is readable via REST', async () => {
    const { admin, httpURL } = ctx.harper;
    const host = hostFromURL(httpURL);
    const topic = 'led-sign/TESTTCP/message';
    const value = 'hello-over-mqtt';

    const client = mqtt.connect(`mqtt://${host}:${MQTT_TCP_PORT}`, {
      username: admin.username,
      password: admin.password,
      reconnectPeriod: 0,
    });

    // Harper maps an MQTT topic to a Topics record whose primary key is the topic path.
    // Publishing the record body as JSON populates the `value` column.
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        client.on('error', reject);
        client.on('connect', () => {
          client.publish(topic, JSON.stringify({ value }), { qos: 1, retain: true }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }),
      15000,
      'mqtt tcp publish',
    );
    client.end(true);

    // Poll the REST API until the MQTT-published value is persisted. Read the body as
    // text and tolerate either a JSON record ({ value }) or a bare value serialization.
    const auth = basicAuth(admin.username, admin.password);
    let persistedValue: string | undefined;
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`${httpURL}/Topics/${encodeURIComponent(topic)}`, {
        headers: { Authorization: auth },
      });
      if (res.status === 200) {
        const text = await res.text();
        try {
          const rec = JSON.parse(text) as { value?: string };
          persistedValue = typeof rec === 'object' && rec !== null ? rec.value : (rec as unknown as string);
        } catch {
          persistedValue = text;
        }
        if (persistedValue === value) break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    strictEqual(persistedValue, value, 'MQTT-published value should be persisted in Topics and served over REST');
  });

  test('MQTT (WebSocket): subscriber receives a retained message published over WS', async () => {
    const { admin, httpURL } = ctx.harper;
    const host = hostFromURL(httpURL);
    const wsPort = new URL(httpURL).port || '9926';
    const topic = 'led-sign/TESTWS/power';
    const value = 'on';

    // Seed the value via REST so the broker has a retained record to deliver on subscribe.
    const auth = basicAuth(admin.username, admin.password);
    const seed = await fetch(`${httpURL}/Topics/${encodeURIComponent(topic)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic, value }),
    });
    ok(seed.ok, `seed PUT failed: HTTP ${seed.status}`);

    const wsURL = `ws://${host}:${wsPort}/mqtt`;
    const client = mqtt.connect(wsURL, {
      username: admin.username,
      password: admin.password,
      protocolVersion: 5,
      reconnectPeriod: 0,
    });

    const received = await withTimeout(
      new Promise<string>((resolve, reject) => {
        client.on('error', reject);
        client.on('message', (_t, payload) => resolve(payload.toString()));
        client.on('connect', () => {
          client.subscribe(topic, { qos: 1 }, (err) => {
            if (err) reject(err);
          });
        });
      }),
      15000,
      'mqtt ws subscribe',
    );
    client.end(true);

    // Harper delivers the full Topics record (as JSON) as the MQTT message payload.
    const record = JSON.parse(received) as { value?: string };
    strictEqual(record.value, value, 'WebSocket MQTT subscriber should receive the retained topic value');
  });

  test('SSE: REST resource streams a live update when the record changes', async () => {
    const { admin, httpURL } = ctx.harper;
    const auth = basicAuth(admin.username, admin.password);
    const topic = 'led-sign/TESTSSE/brightness';

    // Create the record first so the SSE subscription has a resource to follow.
    const create = await fetch(`${httpURL}/Topics/${encodeURIComponent(topic)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic, value: '1' }),
    });
    ok(create.ok, `SSE seed PUT failed: HTTP ${create.status}`);

    const ac = new AbortController();
    const sseRes = await fetch(`${httpURL}/Topics/${encodeURIComponent(topic)}`, {
      headers: { Authorization: auth, Accept: 'text/event-stream' },
      signal: ac.signal,
    });
    strictEqual(sseRes.status, 200, 'SSE request should return 200');
    ok(
      sseRes.headers.get('content-type')?.includes('text/event-stream'),
      `expected text/event-stream, got ${sseRes.headers.get('content-type')}`,
    );

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();

    // Read the stream and look for the updated value pushed after we change the record.
    const readUpdate = (async () => {
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) return null;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('15')) return buffer;
      }
    })();

    // Give the subscription a moment to establish, then update the record.
    await new Promise((r) => setTimeout(r, 500));
    const update = await fetch(`${httpURL}/Topics/${encodeURIComponent(topic)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ topic, value: '15' }),
    });
    ok(update.ok, `SSE update PUT failed: HTTP ${update.status}`);

    const streamed = await withTimeout(readUpdate, 15000, 'sse update');
    ac.abort();
    ok(streamed && streamed.includes('15'), 'SSE stream should deliver the updated brightness value (15)');
  });
});
