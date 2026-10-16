// Regenerate the compatibility fixture using the original TypeScript engine.
// Run from the repository root with Node 22. No database or services are used.
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    target: 'ES2022',
    module: 'CommonJS',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    esModuleInterop: true,
  },
})
const { computeAttribution } = require('../../final-data-cleaning-service/src/lib/attribution-engine.ts')

const base = params => ({
  $event_id: 'event-1',
  $session_id: 'session-1',
  $service_time: '2026-10-15 12:00:00.123',
  $is_attribution_event: true,
  $target_page_id: 'target-page',
  $ex_attribution_params: params,
  custom_unchanged: { text: '中文', array: [false, null, 3] },
})
const cases = []
const add = (name, input) => cases.push({ name, input, expected: computeAttribution(input) })

add('empty batch', [])
add('string and object extensions', [
  base('{"$campaign_id":"camp-json","$item_count":5}'),
  { ...base({ $campaign_id: 'camp-object' }), $event_id: 'event-2', $session_id: 'session-2' },
])
add('invalid, null, and non-object extensions', [
  undefined, null, false, true, 0, 1, '', '{invalid', 'null', 'false', '0', '"text"',
  '[]', '[{"x":1}]', [], [1], '{}', {},
].map((params, index) => ({ ...base(params), $event_id: `event-${index}` })))
add('JavaScript flag and target truthiness', [
  [false, 'target'], [0, 'target'], ['', 'target'], [null, 'target'], [undefined, 'target'],
  [true, ''], [true, 0], [true, null], [true, false], [true, undefined],
  ['false', 'target'], ['0', 'target'], [1, 1], [[], {}], [{}, []],
].map(([flag, target], index) => ({
  ...base({ x: index }),
  $event_id: `event-${index}`,
  $is_attribution_event: flag,
  $target_page_id: target,
})))
add('String values, recursive Array.join, and numeric thresholds', [base({
  nil: null,
  yes: true,
  no: false,
  text: '中文\ntext',
  object: { nested: 1 },
  empty_array: [],
  array: [1, null, [null, 'x', ['deep', false]], { foo: 1 }],
  decimal: 1.25,
  zero: 0,
  negative_zero: -0,
  small_fixed: 1e-6,
  small_exponential: 1e-7,
  large_fixed: 1e20,
  large_exponential: 1e21,
})])
add('JSON numbers use Node Number rounding but original text survives', [base(
  '{"huge":18446744073709551615,"unsafe":9007199254740993,"infinite":1e400,"negative_infinite":-1e400,"negative_zero":-0}',
)])
add('exact underscore conversion and Object.entries ordering', [base(JSON.stringify({
  last_key: 'first normal key',
  10: 'ten',
  2: 'two',
  '01': 'leading zero',
  4294967294: 'last index',
  4294967295: 'not an index',
  0: 'zero',
  '00': 'double zero',
  $product_id: 'product',
  __a: 'double underscore',
  _a_b: 'adjacent pairs',
  _X: 'uppercase unchanged',
  '_ä': 'non-ascii unchanged',
  $_: 'suffix unchanged',
  snake__case: 'double underscore middle',
  a_0_b: 'underscore number',
}))])
add('same target does not accumulate attributes across events or sessions', [
  { ...base({ $nav_position: 'top' }), $event_id: 'event-a', $session_id: 'session-a' },
  { ...base({ $nav_position: 'bottom' }), $event_id: 'event-b', $session_id: 'session-a' },
  { ...base({ $campaign_id: 'other' }), $event_id: 'event-c', $session_id: 'session-b' },
])

writeFileSync(join(__dirname, 'fixtures/node-attribution-golden.json'), `${JSON.stringify(cases, null, 2)}\n`)
console.log(`Generated ${cases.length} fixture cases from the original Node attribution engine`)
