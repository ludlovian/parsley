import { suite, test } from 'node:test'
import assert from 'node:assert'

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
  ['trailing white space', '<a /> ', '<a />'],
  ['leading CDATA', '<![CDATA[x]]><a />', '<a />']
]

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

suite('Parsley', () => {
  suite('Round trip', () => {
    for (const [msg, xml, exp] of ROUND_TRIP_TESTS) {
      test(msg, () => {
        const p = Parsley.from(xml)
        const act = p.xml()
        assert.strictEqual(act, exp ?? xml)
      })
    }
  })

  test('Find tests', t => {
    for (const [msg, xml, fn, exp, all] of FIND_TESTS) {
      const p = Parsley.from(xml)
      let act
      if (fn === null) {
        act = all ? p.textAll : p.text
      } else {
        if (all) {
          act = p.findAll(fn).map(p => p.xml())
        } else {
          const found = p.find(fn)
          act = found ? found.xml() : found
        }
      }
      assert.deepStrictEqual(exp, act, msg)
    }
  })

  suite('get / getAll', () => {
    test('Find first matching child', () => {
      const xml = '<a><b num="1" /><b num="2" /></a>'
      const exp = '<b num="1" />'

      const act = Parsley.from(xml).get('b').xml()
      assert.equal(act, exp)
    })

    test('Find no matching child', () => {
      const xml = '<a><b num="1" /><b num="2" /></a>'

      const act = Parsley.from(xml).get('c')
      assert.equal(act, null)
    })

    test('Find all matching children', () => {
      const xml = '<a><b num="1" /><b num="2" /></a>'
      const exp = ['<b num="1" />', '<b num="2" />']

      const act = Parsley.from(xml).getAll('b').map(x => x.xml())
      assert.deepEqual(act, exp)
    })

    test('Find no matching children', () => {
      const xml = '<a><b num="1" /><b num="2" /></a>'
      const exp = []

      const act = Parsley.from(xml).getAll('c').map(x => x.xml())
      assert.deepEqual(act, exp)
    })

    test('Ignore nested children on get', () => {
      const xml = '<a><b><c num="1" /></b><c num="2" /></a>'
      const exp = '<c num="2" />'

      const act = Parsley.from(xml).get('c').xml()
      assert.equal(act, exp)
    })

    test('Ignore nested children on getAll', () => {
      const xml = '<a><b><c num="1" /></b><c num="2" /></a>'
      const exp = ['<c num="2" />']

      const act = Parsley.from(xml).getAll('c').map(x => x.xml())
      assert.deepEqual(act, exp)
    })
  })

  test('construction', () => {
    const h = Parsley.create
    const p = h('a', {})
    p.add('b')

    const child = h('c', { d: 'e' }, ['f'])
    assert.ok(child instanceof Parsley, 'child is a Parsley object')

    p.add(child)

    const exp = '<a>b<c d="e">f</c></a>'
    assert.strictEqual(p.xml(), exp, 'manually created correctly')
  })

  test('errors', () => {
    assert.throws(
      () => Parsley.from(''),
      /Not a valid string/,
      'Create from empty string'
    )

    assert.throws(
      () => Parsley.from({}),
      /Not a valid string/,
      'Create from non-string'
    )

    assert.throws(() => Parsley.from('<'), /Unexpected EOF/, 'Unfinished doc')

    const p = Parsley.create('a')
    assert.throws(
      () => p.add({}),
      /Can only add text or a Parsley/,
      'Adding an invalid child'
    )
  })

  test('clone', () => {
    const xml = '<a>b<c d="e"><f /></c></a>'
    const p1 = Parsley.from(xml)
    const p2 = p1.clone()
    assert.deepStrictEqual(p1.xml(), p2.xml(), 'XML cloned')
  })

  test('decoded text from CDATA', () => {
    const xml = '<a><![CDATA[<>]]></a>'
    const p = Parsley.from(xml)

    assert.strictEqual(p.text, '<>', 'Text is already decoded')
    const exp = '<a>&lt;&gt;</a>'

    assert.strictEqual(p.xml(), exp, 'Text is re-encoded')
  })

  test('encoded attrs', () => {
    const xml = '<a b="&gt;" />'
    const p = Parsley.from(xml)

    assert.strictEqual(p.attr.b, '>', 'attribute decoded correctly')

    assert.strictEqual(p.xml(), xml, 'attribute re-encoded correctly')
  })

  test('safe mode', () => {
    const safe = true
    assert.strictEqual(Parsley.from('<', { safe }), null)
    assert.strictEqual(Parsley.from({}, { safe }), null)
  })

  test('Find with blanks', () => {
    const xml = '<a />'
    const p = Parsley.from(xml)

    let f = p.find('b')
    assert.strictEqual(f, null)

    f = p.find('b', { blank: true })
    assert.ok(f instanceof Parsley)
  })

  test('Allow unclosed', () => {
    const allowUnclosed = true
    const xml1 = '<a>b<c d="e"><f /></a>'
    const xml2 = '<a>b<c d="e"><f /></c></a>'
    assert.throws(
      () => Parsley.from(xml1),
      /Mismatched close/,
      'Unclosed normally throws'
    )
    const p = Parsley.from(xml1, { allowUnclosed })
    assert.strictEqual(p.xml(), xml2, 'Inserts assumed close')
  })

  test('Unclosed tag', () => {
    const xml = '<a><b>c</b>'
    assert.throws(() => Parsley.from(xml), /Unclosed tag/)
  })

  test('Blank parsley', () => {
    const p = new Parsley()
    assert.strictEqual(p.xml(), '', 'Returns blank xml')
  })
})
