import { test } from 'uvu'
import * as assert from 'uvu/assert'

import Parsley from '../src/index.mjs'

test('basic cosntruction', () => {
  const xml = '<foo><bar>quux</bar>baz<boz /></foo>'
  const p = Parsley.from(xml)

  assert.instance(p, Parsley, 'Created ok')
  assert.is(p.xml(), xml, 'captured all the input')
})

test('basic extract', () => {
  const xml = '<a><b x="1">quux</b><b x="2">foobar</b></a>'
  let p = Parsley.from(xml)

  p = p.find('b')

  assert.instance(p, Parsley, 'find is a Parsley')
  assert.is(p.attr.x, '1')
  assert.is(p.type, 'b')
  assert.is(p.text, 'quux')
  assert.equal(p.children, ['quux'])
})

test('multiple extract', () => {
  const xml = '<a><b x="1">quux</b><b x="2">foobar</b></a>'
  const p = Parsley.from(xml)

  const p1 = p.find('b')
  const p2 = p.findAll('b')

  assert.instance(p1, Parsley, 'find is a Parsley')
  assert.equal(p1.text, 'quux')

  assert.ok(Array.isArray(p2), 'findAll produces an array')
  assert.ok(p2.every(x => x instanceof Parsley))

  assert.equal(
    p2.map(p => p.text),
    ['quux', 'foobar']
  )

  assert.equal(p.textAll, ['quux', 'foobar'])
})

test('functional condition', () => {
  const xml = '<a><b x="1">quux</b><b x="2">foobar</b></a>'
  const p = Parsley.from(xml)

  const p1 = p.find(p => p.attr.x === '2')
  assert.is(p1.text, 'foobar')
})

test('empty results', () => {
  const xml = '<foo><bar></bar></foo>'

  const p = Parsley.from(xml)
  assert.is(p.find('baz'), null)
  assert.equal(p.findAll('baz'), [])
})

test('encoded text', () => {
  const xml = '<a>a&lt;b</a>'
  const p = Parsley.from(xml)
  assert.equal(p.text, 'a<b')
})

test('encoded attributes', () => {
  const xml = '<a b="c&lt;d">e</a>'
  const p = Parsley.from(xml)
  assert.equal(p.attr.b, 'c<d')
  assert.equal(p.xml(), xml)
})

test('boolean attributes', () => {
  const xml = '<a b />'
  const p = Parsley.from(xml)
  assert.equal(p.attr.b, true)
  assert.equal(p.xml(), xml)
})

test.run()
