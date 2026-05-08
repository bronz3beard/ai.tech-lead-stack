// simple mock benchmark
const iterations = 10;
const startNPlus1 = performance.now();
let results = [];
for(let i = 0; i < iterations; i++) {
  // simulate an async db call taking ~10ms
  const start = performance.now();
  while(performance.now() - start < 10) {}
  results.push(i);
}
const endNPlus1 = performance.now();

const startCreateMany = performance.now();
// simulate batch db call taking ~15ms total
const startBatch = performance.now();
while(performance.now() - startBatch < 15) {}
const endCreateMany = performance.now();

console.log(`N+1 Time: ${(endNPlus1 - startNPlus1).toFixed(2)}ms`);
console.log(`createMany Time: ${(endCreateMany - startCreateMany).toFixed(2)}ms`);
console.log(`Improvement: ${(((endNPlus1 - startNPlus1) - (endCreateMany - startCreateMany)) / (endNPlus1 - startNPlus1) * 100).toFixed(2)}%`);
