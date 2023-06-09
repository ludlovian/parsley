import { test } from 'uvu'
import * as assert from 'uvu/assert'

import Parsley from '../src/index.mjs'

const ROUND_TRIP_TESTS = [
  ['basic construction', '<a>b</a>'],
  ['complex construction', '<foo><bar>quux</bar>baz<boz /></foo>'],
  ['attributes', '<a b="c"><d /></a>'],
  ['multiple attributes', '<a b="c" d="e">f</a>'],
  ['single quoted attributes', "<a b='c'>d</a>", '<a b="c">d</a>'],
  ['encoded text', '<a>a&lt;b</a>'],
  ['encoded attributes', '<a b="c&lt;d">e</a>'],
  ['leading white space', ' <a />', '<a />'],
  ['trailing white space', '<a /> ', '<a />']
]

ROUND_TRIP_TESTS.forEach(testRoundTrip)

const FIND_TESTS = [
  ['basic extract', '<a><b>c</b></a>', 'b', '<b>c</b>'],
  [
    'multi extract',
    '<a><b>c</b>e<f /><b /></a>',
    'b',
    ['<b>c</b>', '<b />'],
    true
  ],
  ['basic text', '<a>b</a>', null, 'b'],
  ['multiple text', '<a>b<c>d</c></a>', null, ['b', 'd'], true],
  [
    'extract by function',
    '<a><b x="1" /><c x="2" /></a>',
    p => p.attr.x === '2',
    '<c x="2" />'
  ],
  ['find root', '<a><b>c</b></a>', 'a', '<a><b>c</b></a>'],
  ['findAll with root matching', '<a />', 'a', ['<a />'], true],
  ['empty find', '<a>b<c /></a>', 'd', null],
  ['empty findAll', '<a>b<c /></a>', 'd', [], true],
  ['empty text', '<a><b /></a>', null, null],
  ['empty textAll', '<a><b /></a>', null, [], true]
]

FIND_TESTS.forEach(testFind)

function testRoundTrip ([msg, xml, exp]) {
  exp = exp || xml
  test(msg, () => {
    const p = Parsley.from(xml)
    assert.equal(p.xml(), exp)
  })
}

function testFind ([msg, xml, fn, exp, all]) {
  test(msg, () => {
    const p = Parsley.from(xml)
    let actual
    if (fn === null) {
      actual = all ? p.textAll : p.text
    } else {
      if (all) {
        actual = p.findAll(fn).map(p => p.xml())
      } else {
        const found = p.find(fn)
        actual = found ? found.xml() : found
      }
    }
    assert.equal(actual, exp)
  })
}

test('construction', () => {
  const h = Parsley.create
  const p = h('a', {})
  p.add('b')

  const child = h('c', { d: 'e' }, ['f'])
  assert.instance(child, Parsley)

  p.add(child)

  const exp = '<a>b<c d="e">f</c></a>'
  assert.equal(p.xml(), exp)
})

test('errors', () => {
  assert.throws(() => Parsley.from(''), 'Not a valid string')
  assert.throws(() => Parsley.from({}), 'Not a valid string')
  assert.throws(() => Parsley.from('<'))

  const p = Parsley.create('a')
  assert.throws(() => p.add({}), 'Can only add text or a Parsley')
})

test('safe mode', () => {
  const safe = true
  assert.equal(Parsley.from('<', { safe }), null)
  assert.equal(Parsley.from({}, { safe }), null)
})

test('clone', () => {
  const xml1 = '<a>b<c d="e"><f /></c></a>'
  const xml2 = '<a>b<c d="z"><f /></c></a>'
  const p1 = Parsley.from(xml1)
  const p2 = p1.clone()
  p2.children[1].attr.d = 'z'
  assert.equal(p1.xml(), xml1)
  assert.equal(p2.xml(), xml2)
})

test('From multiple text with no element', () => {
  const xml = 'a<![CDATA[b]]>c'
  assert.equal(Parsley.from(xml), null)
})

test('Find with blanks', () => {
  const xml = '<a />'
  const p = Parsley.from(xml)

  let f = p.find('b')
  assert.equal(f, null)

  f = p.find('b', { blank: true })
  assert.instance(f, Parsley)
})

test.run()
