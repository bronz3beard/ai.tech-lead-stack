import pMap from 'p-map';

const numTraces = 100;
const traces = Array.from({ length: numTraces }).map((_, i) => ({ id: `trace-${i}` }));

let concurrentFetches = 0;
let maxConcurrentFetches = 0;

async function mockFetch(url) {
  concurrentFetches++;
  if (concurrentFetches > maxConcurrentFetches) {
    maxConcurrentFetches = concurrentFetches;
  }

  // Simulate network latency 50ms
  await new Promise(resolve => setTimeout(resolve, 50));

  // Simulate connection exhaustion by delaying significantly if concurrency is high
  if (concurrentFetches > 20) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  concurrentFetches--;

  return {
    ok: true,
    json: async () => ({ data: [] })
  };
}

// Override global fetch
global.fetch = mockFetch;

async function runBenchmark(mode) {
  console.log(`Running benchmark with mode: ${mode}`);
  const startTime = Date.now();

  if (mode === 'promise-all') {
    const tracesWithObservations = await Promise.all(
      traces.map(async (t) => {
        try {
          const obsUrl = `http://localhost/api/public/observations?traceId=${t.id}`;
          const obsResponse = await fetch(obsUrl, {
            headers: { Authorization: 'Bearer test' },
          });
          if (obsResponse.ok) {
            const obsData = await obsResponse.json();
            return { ...t, observations: obsData.data || [] };
          }
        } catch (e) {
          console.error(`Error`, e);
        }
        return { ...t, observations: [] };
      })
    );
  } else if (mode === 'p-map') {
    const tracesWithObservations = await pMap(
      traces,
      async (t) => {
        try {
          const obsUrl = `http://localhost/api/public/observations?traceId=${t.id}`;
          const obsResponse = await fetch(obsUrl, {
            headers: { Authorization: 'Bearer test' },
          });
          if (obsResponse.ok) {
            const obsData = await obsResponse.json();
            return { ...t, observations: obsData.data || [] };
          }
        } catch (e) {
          console.error(`Error`, e);
        }
        return { ...t, observations: [] };
      },
      { concurrency: 10 }
    );
  }

  const endTime = Date.now();
  console.log(`Elapsed time: ${endTime - startTime}ms`);
  console.log(`Max concurrent fetches: ${maxConcurrentFetches}`);
}

const mode = process.argv[2] || 'promise-all';
runBenchmark(mode).catch(console.error);
