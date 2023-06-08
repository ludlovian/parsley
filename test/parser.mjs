import { test } from 'uvu'
import * as assert from 'uvu/assert'

import parser from '../src/parser.mjs'

test.before.each(ctx => {
  const p = parser((type, attr, children) => [type, attr, children])
  ctx.parse = p.parse
})
;[
  ['simple text', '<a>b</a>', ['a', {}, ['b']]],
  ['nested elements', '<a><b></b></a>', ['a', {}, [['b', {}, []]]]],
  ['elements with space padded open', '<a ></a>', ['a', {}, []]],
  ['element with attribute', '<a b="c"></a>', ['a', { b: 'c' }, []]],
  [
    'element with multiple attributes',
    '<a b="c" d=\'e\'></a>',
    ['a', { b: 'c', d: 'e' }, []]
  ],
  ['self close element', '<a><b />c</a>', ['a', {}, [['b', {}, []], 'c']]],
  ['attribute with no value and self close', '<a b />', ['a', { b: true }, []]],
  ['attribute with no value', '<a b></a>', ['a', { b: true }, []]],
  ['processing instruction', '<?foo ?><a>b</a>', ['a', {}, ['b']]],
  ['leading text', ' <a>b</a>', [' ', ['a', {}, ['b']]]],
  ['trailing text', '<a>b</a> ', [['a', {}, ['b']], ' ']],
  [
    'multiple root elements',
    '<a /><b />',
    [
      ['a', {}, []],
      ['b', {}, []]
    ]
  ]
].forEach(([msg, xml, exp]) =>
  test(msg, ({ parse }) => {
    const act = parse(xml)
    assert.equal(act, exp)
  })
)
;[
  ['Unclosed tag at EOF', '<a>b</a'],
  ['Unclosed document at EOF', '<a><b>c</b>'],
  ['Unmatched close', '<a><b></a>'],
  ['Unquoted attribute value', '<a b=c />']
].forEach(([msg, xml]) =>
  test('Error: ' + msg, ({ parse }) => {
    assert.throws(() => parse(xml), msg)
  })
)

test.run()
