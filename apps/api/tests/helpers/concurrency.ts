/**
 * Starts `n` calls at the same moment and waits for all of them to settle.
 *
 * Each call must go through the real API (or its own `db` query) so it gets its own connection
 * from the pool. Never run them inside one shared transaction: that serializes them and hides
 * the race condition under test.
 *
 * Example (Phase 5a): two customers buy the last item at the same time
 *   const results = await runConcurrently(2, (i) => client(cookies[i]).api.orders.$post(...))
 */
export function runConcurrently<T>(n: number, call: (index: number) => Promise<T>) {
  return Promise.allSettled(Array.from({ length: n }, (_, i) => call(i)))
}
