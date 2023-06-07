import { test } from 'uvu'
import * as assert from 'uvu/assert'

import parser from '../src/parser.mjs'

test.before.each(ctx => {
  ctx.h = (t, a, c) => ({ t, a, c })
})

test('simple text', ctx => {
  const xml = '<a>b</a>'
  const exp = { t: 'a', a: {}, c: ['b'] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('nested elements', ctx => {
  const xml = '<a><b></b></a>'
  const exp = { t: 'a', a: {}, c: [{ t: 'b', a: {}, c: [] }] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('elements with space padded open', ctx => {
  const xml = '<a ></a>'
  const exp = { t: 'a', a: {}, c: [] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('element with attribute', ctx => {
  const xml = '<a b="c"></a>'
  const exp = { t: 'a', a: { b: 'c' }, c: [] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('element with multiple attributes', ctx => {
  const xml = '<a b="c" d=\'e\'></a>'
  const exp = { t: 'a', a: { b: 'c', d: 'e' }, c: [] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('self close element', ctx => {
  const xml = '<a><b />c</a>'
  const exp = { t: 'a', a: {}, c: [{ t: 'b', a: {}, c: [] }, 'c'] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('attribute with no value and self close', ctx => {
  const xml = '<a b />'
  const exp = { t: 'a', a: { b: true }, c: [] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('attribute with no value', ctx => {
  const xml = '<a b></a>'
  const exp = { t: 'a', a: { b: true }, c: [] }
  const act = parser.call(ctx.h, xml)
  assert.equal(act, exp)
})

test('Error - bad /', ctx => {
  const xml = '<a>b<c/a>'
  assert.throws(parser.bind(ctx.h, xml), 'Invalid character')
})

test('Error - unmatched close', ctx => {
  const xml = '<a></b>'
  assert.throws(parser.bind(ctx.h, xml), 'Unmatching close')
})

test('Error - unclosed document', ctx => {
  const xml = '<a><b></b>'
  assert.throws(parser.bind(ctx.h, xml), 'Unclosed document')
})

test('Error - unclosed tag', ctx => {
  const xml = '<a><b'
  assert.throws(parser.bind(ctx.h, xml), 'Unclosed tag')
})

test.run()
