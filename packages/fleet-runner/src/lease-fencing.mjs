import { createHash } from 'node:crypto';

// A single-process experiment: the returned attempt object is the capability.
export function createLeaseFencing(job, { now, leaseMs }) {
  if (!job || typeof job.id !== 'string' || !job.id || job.kind !== 'BookcaseDiscovery' ||
      typeof now !== 'function' || !Number.isFinite(leaseMs) || leaseMs <= 0) {
    throw new TypeError('Expected a BookcaseDiscovery job, clock, and positive lease');
  }
  const jobId = job.id;
  let generation = 0;
  let current = null;
  let accepted = null;
  let lastTime = -Infinity;

  function time() {
    const value = now();
    if (!Number.isFinite(value) || value < lastTime) throw new RangeError('Clock must be finite and monotonic');
    lastTime = value;
    return value;
  }

  return Object.freeze({
    claim(workerId) {
      if (typeof workerId !== 'string' || !workerId) throw new TypeError('Expected a worker ID');
      const at = time();
      if (accepted || (current && at < current.expiresAt)) return null;
      if (!Number.isSafeInteger(generation + 1) || !Number.isFinite(at + leaseMs)) throw new RangeError('Lease overflow');
      const attempt = Object.freeze({ jobId, workerId, generation: ++generation, expiresAt: at + leaseMs });
      current = attempt;
      return attempt;
    },
    accept(attempt, bytes) {
      const at = time();
      if (accepted || attempt !== current || !current || at >= current.expiresAt) return false;
      if (!Buffer.isBuffer(bytes)) throw new TypeError('Expected artifact bytes as a Buffer');
      const copy = Buffer.from(bytes);
      accepted = { jobId, generation: current.generation, digest: createHash('sha256').update(copy).digest('hex'), bytes: copy };
      return true;
    },
    result() {
      return accepted && { ...accepted, bytes: Buffer.from(accepted.bytes) };
    },
  });
}
