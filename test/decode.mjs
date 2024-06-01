import { suite, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  isWhitespace,
  decodeEntities,
  decodeAttributes,
  encodeEntities
} from '../src/decode.mjs'

const eq = (...args) => assert.strictEqual(...args)
const deep = (...args) => assert.deepStrictEqual(...args)

suite('isWhitespace', () => {
  test('valid whitespaces', t => {
    eq(isWhitespace(' '), true, 'space')
    eq(isWhitespace('\t'), true, 'tab')
    eq(isWhitespace('\r'), true, 'carriage return')
    eq(isWhitespace('\n'), true, 'newline')
  })

  test('non whitespace', t => {
    eq(isWhitespace('a'), false, 'non whitespace')
  })

  test('empty char', t => {
    eq(isWhitespace(''), false, 'empty string isnt whitespace')
  })
})

const entityTests = [
  ['abc', 'abc', 'No entities'],
  ['', '', 'Empty string'],
  ['a&amp;b', 'a&b', 'amp inside string'],
  ['a&gt;b', 'a>b', '> inside string'],
  ['a&lt;b', 'a<b', '< inside string'],
  ['a&apos;b', "a'b", 'apos inside string'],
  ['a&quot;b', 'a"b', 'quot inside string'],
  ['&amp;b', '&b', 'amp at start of string'],
  ['a&amp;', 'a&', 'amp at end of string'],
  ['&amp;&amp;', '&&', 'two entities aside']
]

suite('decode & encode Entities', () => {
  test('decoding', t => {
    for (const [str, exp, msg] of entityTests) {
      const act = decodeEntities(str)
      eq(act, exp, msg)
    }
  })

  test('encoding', t => {
    for (const [exp, str, msg] of entityTests) {
      const act = encodeEntities(str)
      eq(act, exp, msg)
    }
  })

  test('decode unrecognised entities', t => {
    eq(decodeEntities('a&ampb'), 'a&ampb', 'unknown entity')
    eq(decodeEntities('a&'), 'a&', 'single amper')
  })
})

suite('decodeAttributes', () => {
  test('basic decoding', t => {
    deep(
      decodeAttributes('a="b" c="d" e="f"'),
      { a: 'b', c: 'd', e: 'f' },
      'basic quoted attributes'
    )

    deep(
      decodeAttributes("a='b' c='d' e='f'"),
      { a: 'b', c: 'd', e: 'f' },
      'single quoted attributes'
    )

    deep(
      decodeAttributes('a=b c=d e=f'),
      { a: 'b', c: 'd', e: 'f' },
      'unquoted attributes'
    )
  })

  test('attributes with spaces in values', t => {
    deep(
      decodeAttributes('a="b c" d="e f"'),
      { a: 'b c', d: 'e f' },
      'double quoted attributes'
    )

    deep(
      decodeAttributes("a='b c' d='e f'"),
      { a: 'b c', d: 'e f' },
      'single quoted attributes'
    )
  })

  test('Empty attributes', t => {
    deep(decodeAttributes(''), {}, 'Empty string')

    deep(decodeAttributes('  '), {}, 'Whitespace string')
  })

  test('Implied boolean values (loosey goosey)', t => {
    deep(
      decodeAttributes('a="b" c'),
      { a: 'b', c: true },
      'Value-less attributes are true'
    )
  })
})
