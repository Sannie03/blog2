// Per-process cache. Bound both entry count and total serialized size.
function createPublicCache({ ttl = 30000, maxEntries = 100, maxBytes = 8 * 1024 * 1024, now = Date.now } = {}) {
  const entries = new Map();
  const pending = new Map();
  let bytes = 0;
  let generation = 0;
  return {
    clear() { generation++; entries.clear(); pending.clear(); bytes = 0; },
    async get(key, loader) {
      const cached = entries.get(key);
      if (cached && cached.expires > now()) return cached.value;
      if (cached) { entries.delete(key); bytes -= cached.bytes; }
      if (pending.has(key)) return pending.get(key);
      const started = generation;
      const loading = Promise.resolve().then(loader);
      if (pending.size < maxEntries) pending.set(key, loading);
      let value;
      try { value = await loading; }
      finally { if (pending.get(key) === loading) pending.delete(key); }
      const size = Buffer.byteLength(JSON.stringify(value));
      if (started !== generation || size > maxBytes) return value;
      // A concurrent request may already have populated this key.
      const previous = entries.get(key);
      if (previous) { entries.delete(key); bytes -= previous.bytes; }
      while (entries.size >= maxEntries || bytes + size > maxBytes) {
        const oldest = entries.keys().next().value;
        bytes -= entries.get(oldest).bytes;
        entries.delete(oldest);
      }
      entries.set(key, { value, bytes: size, expires: now() + ttl });
      bytes += size;
      return value;
    },
  };
}

module.exports = { createPublicCache };
