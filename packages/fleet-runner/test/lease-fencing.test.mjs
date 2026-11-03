import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaseFencing } from '../src/lease-fencing.mjs';

const fixture = { id: 'bookcase-discovery-replay', kind: 'BookcaseDiscovery' };

function setup() {
  let now = 100;
  const runner = createLeaseFencing(fixture, { now: () => now, leaseMs: 10 });
  return { runner, setTime: value => { now = value; } };
}

test('a reclaimed attempt fences late completion and preserves accepted bytes', () => {
  const { runner, setTime } = setup();
  const a = runner.claim('worker-a');
  assert.equal(runner.claim('worker-b'), null);
  setTime(110);
  const b = runner.claim('worker-b');
  assert.notEqual(a.generation, b.generation);
  const replacement = Buffer.from('replacement');
  assert.equal(runner.accept(b, replacement), true);
  replacement.fill(0);
  const before = runner.result();
  assert.equal(before.bytes.toString(), 'replacement');
  assert.equal(before.digest, '95713e9cbdd1dfcb2d4080c2537f418d43ca0da25f0d7d6631f4f7c97b89dc47');
  assert.equal(runner.accept(a, Buffer.from('stale')), false);
  assert.equal(runner.accept(a, Buffer.from('replacement')), false);
  assert.deepEqual(runner.result(), before);
  before.bytes.fill(0);
  assert.equal(runner.result().bytes.toString(), 'replacement');
});

test('expiry rejects completion before reclaim, even with the same worker ID', () => {
  const { runner, setTime } = setup();
  const a = runner.claim('worker');
  setTime(110);
  assert.equal(runner.accept(a, Buffer.from('expired')), false);
  assert.equal(runner.result(), null);
  const b = runner.claim('worker');
  assert.notEqual(a.generation, b.generation);
  assert.equal(runner.accept(a, Buffer.from('old')), false);
  assert.equal(runner.accept({ ...b }, Buffer.from('forged')), false);
  assert.equal(runner.accept(b, Buffer.from('fresh')), true);
  assert.equal(runner.result().bytes.toString(), 'fresh');
});
