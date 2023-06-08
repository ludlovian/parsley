import { test } from 'uvu'
import * as assert from 'uvu/assert'

import Parsley from '../src/index.mjs'
;[
  ['basic construction', '<a>b</a>'],
  ['complex construction', '<foo><bar>quux</bar>baz<boz /></foo>'],
  ['attributes', '<a b="c"><d /></a>'],
  ['single quoted attributes', "<a b='c'>d</a>", '<a b="c">d</a>'],
  ['encoded text', '<a>a&lt;b</a>'],
  ['encoded attributes', '<a b="c&lt;d">e</a>'],
  ['boolean attributes', '<a b />'],
  ['leading white space', ' <a />', '<a />'],
  ['trailing white space', '<a /> ', '<a />']
].forEach(([msg, xml, exp]) =>
  test(msg, () => {
    exp = exp || xml
    const p = Parsley.from(xml)
    assert.equal(p.xml(), exp)
  })
)

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

test('trim whitespace', () => {
  const xml = '<a> <b> <c>d</c> </b> </a>'
  const exp = '<a><b><c>d</c></b></a>'
  const act = Parsley.from(xml)
    .trimWS()
    .xml()
  assert.equal(act, exp)
})

test.run()
