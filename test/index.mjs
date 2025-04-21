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

suite('Parsley', () => {
  suite('Round trip', () => {
    for (const [msg, xml, exp] of ROUND_TRIP_TESTS) {
      test(msg, () => {
        const p = Parsley.from(xml)
        const act = p.toXml()
        assert.strictEqual(act, exp ?? xml)
      })
    }
  })

  test('Manual construction', () => {
    const h = Parsley.create
    const p = h('a', {})
    p.add('b')

    const child = h('c', { d: 'e' }, ['f'])
    assert.ok(child.isElement, 'child is a Parsley object')

    p.add(child)

    const exp = '<a>b<c d="e">f</c></a>'
    assert.strictEqual(p.toXml(), exp, 'manually created correctly')
  })

  test('clone', () => {
    const xml = '<a>b<c d="e"><f /></c></a>'
    const p1 = Parsley.from(xml)
    const p2 = p1.clone()
    assert.deepStrictEqual(p1.toXml(), p2.toXml(), 'XML cloned')
  })

  test('trim', () => {
    const xml = `
      <a>
        <b>
          <![CDATA[ cde ]]>
        </b>
      </a>`

    const p1 = Parsley.from(xml)
    const p2 = p1.trim()
    const exp = '<a><b>cde</b></a>'
    const act = p2.toXml()
    assert.strictEqual(act, exp)
  })

  test('Walk', t => {
    const xml = '<a>foo<bar>baz</bar><baz /></a>'

    const p = Parsley.from(xml)
    const bar = p.children[1]
    const baz = p.children[2]
    const exp = [p, p.children[0], bar, bar.children[0], baz]

    const act = [...p.walk()]

    assert.deepStrictEqual(act, exp)

    const act2 = [...p]
    assert.deepStrictEqual(act2, exp)
  })

  test('.getText', t => {
    const xml = '<a>foo<bar>baz</bar><baz /></a>'

    const p1 = Parsley.from(xml)
    const exp = 'foobaz'
    const act = p1.getText()

    assert.deepStrictEqual(act, exp)

    const p2 = Parsley.from('<a><b /></a>')
    const exp2 = ''
    const act2 = p2.getText()

    assert.deepStrictEqual(act2, exp2)
  })

  suite('find', () => {
    test('find basic type', () => {
      const xml = '<a><b><c /></b></a>'
      const exp = '<b><c /></b>'
      const p = Parsley.from(xml)
      const act = p.find('b').toXml()

      assert.deepStrictEqual(act, exp)
    })

    test('find type and class', () => {
      const xml = '<a><b /><b class="foo bar">baz</b></a>'
      const exp = '<b class="foo bar">baz</b>'
      const p = Parsley.from(xml)
      const act = p.find('b.foo').toXml()

      assert.deepStrictEqual(act, exp)
    })

    test('find - type not found', () => {
      const xml = '<a><b><c /></b></a>'
      const exp = undefined
      const p = Parsley.from(xml)
      const act = p.find('z')?.toXml()

      assert.deepStrictEqual(act, exp)
    })

    test('find - type found but not class', () => {
      const xml = '<a><b class="foo"><c /></b></a>'
      const exp = undefined
      const p = Parsley.from(xml)
      const act = p.find('b.bar')?.toXml()

      assert.deepStrictEqual(act, exp)
    })

    test('findAll matching', () => {
      const xml = '<a><b><c /></b><b d="e" /></a>'
      const exp = ['<b><c /></b>', '<b d="e" />']
      const p = Parsley.from(xml)
      const act = p.findAll('b').map(p => p.toXml())

      assert.deepStrictEqual(act, exp)
    })

    test('findAll not matching', () => {
      const xml = '<a><b><c /></b><b d="e" /></a>'
      const exp = []
      const p = Parsley.from(xml)
      const act = p.findAll('z').map(p => p.toXml())

      assert.deepStrictEqual(act, exp)
    })
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

  test('decoded text from CDATA', () => {
    const xml = '<a><![CDATA[<>]]></a>'
    const p = Parsley.from(xml)

    assert.strictEqual(p.getText(), '<>', 'Text is already decoded')
    const exp = '<a>&lt;&gt;</a>'

    assert.strictEqual(p.toXml(), exp, 'Text is re-encoded')
  })

  test('encoded attrs', () => {
    const xml = '<a b="&gt;" />'
    const p = Parsley.from(xml)

    assert.strictEqual(p.attr.b, '>', 'attribute decoded correctly')

    assert.strictEqual(p.toXml(), xml, 'attribute re-encoded correctly')
  })

  test('safe mode', () => {
    const safe = true
    assert.strictEqual(Parsley.from('<', { safe }), null)
    assert.strictEqual(Parsley.from({}, { safe }), null)
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
    assert.strictEqual(p.toXml(), xml2, 'Inserts assumed close')
  })

  test('Unclosed tag', () => {
    const xml = '<a><b>c</b>'
    assert.throws(() => Parsley.from(xml), /Unclosed tag/)
  })

  test('Blank parsley', () => {
    const p = new Parsley()
    assert.strictEqual(p.toXml(), '', 'Returns blank xml')
    assert.deepStrictEqual([...p], [], 'No elements')
  })

  test('loose mode', () => {
    let xml

    // HTML void
    xml = '<a><br></a>'
    assert.doesNotThrow(() => Parsley.from(xml, { loose: true }))

    // Mismatched close
    xml = '<a><b></a>'
    assert.doesNotThrow(() => Parsley.from(xml, { loose: true }))

    // Missing close
    xml = '<a><b>'
    assert.doesNotThrow(() => Parsley.from(xml, { loose: true }))

    // Bad quotes in attr
    xml = '<a "b="c"></a>'
    assert.doesNotThrow(() => Parsley.from(xml, { loose: true }))

    // Bad formed CDATA
    xml = '<a><![CDATX'
    assert.doesNotThrow(() => Parsley.from(xml, { loose: true }))
  })

  suite('ParsleyText', () => {
    test('.text', () => {
      const p = Parsley.from('<a>foobar</a>')
      const el = p.children[0]
      assert.strictEqual(!el.isElement, true)
      assert.strictEqual(el.toString(), 'foobar')
      assert.strictEqual(el.text, 'foobar')
    })
  })
})
