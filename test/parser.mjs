import { test } from 'uvu'
import * as assert from 'uvu/assert'

import parse from '../src/parser.mjs'

function createElem (type, attr, children) {
  return [
    type,
    Object.keys(attr).length ? attr : null,
    children.length ? children : null
  ].filter(Boolean)
}

const VALID_TESTS = [
  ['simple text', '<a>b</a>', ['a', ['b']]],
  ['nested elements', '<a><b></b></a>', ['a', [['b']]]],
  ['elements with space padded open', '<a ></a>', ['a']],
  ['element with attribute', '<a b="c"></a>', ['a', { b: 'c' }]],
  ['element with single quote attribute', "<a b='c'></a>", ['a', { b: 'c' }]],
  [
    'element with multiple attributes',
    '<a b="c" d=\'e\'></a>',
    ['a', { b: 'c', d: 'e' }]
  ],
  ['self close element', '<a><b />c</a>', ['a', [['b'], 'c']]],
  ['processing instruction', '<?foo ?><a>b</a>', ['a', ['b']]],
  ['leading text', ' <a>b</a>', [' ', ['a', ['b']]]],
  ['trailing text', '<a>b</a> ', [['a', ['b']], ' ']],
  ['multiple root elements', '<a /><b />', [['a'], ['b']]],
  ['comment', '<a>b<!-- comment --></a>', ['a', ['b']]],
  ['Minimal comment', '<a><!----></a>', ['a']],
  ['Maximal spacing', '<a b = "c" >d</a >', ['a', { b: 'c' }, ['d']]],
  ['Minimal spacing', '<a b="c"d="e"/>', ['a', { b: 'c', d: 'e' }]],
  ['basic CDATA', '<a><![CDATA[b]]></a>', ['a', ['b']]],
  ['CDATA does not decode', '<a><![CDATA[&lt;]]></a>', ['a', ['&lt;']]],
  ['attributes decode', '<a b="&lt;" />', ['a', { b: '<' }]],
  ['text decodes', '<a>&lt;</a>', ['a', ['<']]],
  ['empty doc', '', null]
]

VALID_TESTS.forEach(([name, xml, exp]) =>
  test(name, () => {
    const act = parse(createElem, xml)
    assert.equal(act, exp)
  })
)

const ERRORS_TESTS = [
  ['Close where we expect open', '<a /></b>', /Invalid document/],
  ['Open tag with no content', '<a><', /Unexpected EOF/],
  ['Self close slash not at end of tag', '<a / b', /Invalid tag/],
  ['Close does not match current open', '<a>b</c>', /Mismatched close/],
  ['Malformed close tag', '<a>b</a quick>', /Invalid tag/],
  ['Attribute with no equals', '<a b/>', /Unexpected EOF/],
  ['Attribute with no equals #2', '<a b c/>', /Invalid tag/],
  ['Attribute value not in quotes', '<a b=/c/ />', /Invalid tag/],
  ['Unclosed tag', '<a><b />', /Unexpected EOF/],
  ['Unclosed PI', '<?xml ', /Unexpected EOF/],
  ['Unclosed Comment', '<!-- comment ', /Unexpected EOF/],
  ['Unclosed open tag #1', '<a>< ', /Unexpected EOF/],
  ['Unclosed open tag #2', '<a><b ', /Unexpected EOF/],
  ['Unclosed open tag #3', '<a><b c ', /Unexpected EOF/],
  ['Unclosed open tag #4', '<a><b c="d" ', /Unexpected EOF/],
  ['Unclosed open tag #5', '<a><b c="d" / ', /Unexpected EOF/],
  ['Unclosed close tag #1', '<a></', /Unexpected EOF/],
  ['Unclosed close tag #2', '<a></a ', /Unexpected EOF/]
]

ERRORS_TESTS.forEach(([name, xml, rgx]) => {
  test(name, () => {
    assert.throws(() => parse(createElem, xml), rgx)
  })
})

test('decode & encode', () => {
  const plain = '<>&\'"'
  const enc = parse.encode(plain)
  assert.equal(enc, '&lt;&gt;&amp;&apos;&quot;')
  assert.equal(parse.decode(enc), plain)

  assert.equal(parse.encode(null), null)
  assert.equal(parse.decode(null), null)
})

test.run()
