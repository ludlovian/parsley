import { suite, test } from 'node:test'
import assert from 'node:assert/strict'

import Tokenizer from '../src/tokenizer.mjs'
import { UnexpectedInput } from '../src/errors.mjs'

const eq = (...args) => assert.strictEqual(...args)
const deep = (...args) => assert.deepStrictEqual(...args)

const test1 = [
  ['<?x>', 'pi', 'regular PI'],
  ['<?>', 'pi', 'empty PI'],
  ['<![CDATA[x]]>', 'cdata', 'regular CDATA'],
  ['<![CDATA[]]>', 'cdata', 'empty CDATA'],
  ['<!--x-->', 'comment', 'regualr comment'],
  ['<!---->', 'comment', 'empty comment'],
  ['<!x>', 'dtd', 'regular dtd'],
  ['<!>', 'dtd', 'empty dtd'],
  ['<x>', 'tagOpen', 'regular tagOpen'],
  ['</x>', 'tagClose', 'regular tagClose'],
  ['<x/>', 'tagOpen', 'self closing tag'],
  ['a<x>', 'text,tagOpen', 'text followed by tag open'],
  ['<script>x</script>', 'script', 'basic script'],
  ['<script></script>', 'script', 'empty script']
]

suite('Tokenizer', () => {
  suite('Token types all at once', () => {
    for (const [xml, tokenList, msg] of test1) {
      test(msg, () => {
        const arr = []
        const t = new Tokenizer()
        t.onAll(tokenType => arr.push(tokenType))
        t.push(xml)
        assert.deepStrictEqual(arr, tokenList.split(','), 'tokens match')
        assert.ok(t.atEOD, 'tokenizer at EOD')
        assert.strictEqual(t.pos, xml.length, 'pos updated')
      })
    }
  })

  suite('basic token types a char at a time', () => {
    for (const [xml, tokenList, msg] of test1) {
      test(msg, () => {
        const arr = []
        const t = new Tokenizer()
        t.onAll(tokenType => arr.push(tokenType))
        for (const c of xml) {
          t.push(c)
        }
        assert.deepStrictEqual(arr, tokenList.split(','), 'tokens match')
        assert.ok(t.atEOD, 'tokenizer at EOD')
      })
    }
  })

  test('Text', t => {
    const fn = t.mock.fn()
    const xml = 'a<x>b<y>'
    const exp = [{ content: 'a' }, { content: 'b' }]

    const tok = new Tokenizer()
    tok.on('text', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('Processing instruction', t => {
    const fn = t.mock.fn()
    const xml = 'a<?pi-text?>b'
    const exp = [{ content: 'pi-text?' }]

    const tok = new Tokenizer()
    tok.on('pi', fn)
    tok.push(xml)

    eq(fn.mock.calls.length, 1, 'one PI emitted')
    deep(fn.mock.calls[0].arguments, exp, 'right content')
  })

  test('CData', t => {
    const fn = t.mock.fn()
    const xml = 'a<![CDATA[x]]>'
    const exp = [{ content: 'x' }]

    const tok = new Tokenizer()
    tok.on('cdata', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('comment', t => {
    const fn = t.mock.fn()
    const xml = 'a<!--x-->'
    const exp = [{ content: 'x' }]

    const tok = new Tokenizer()
    tok.on('comment', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('DTD - simple', t => {
    const fn = t.mock.fn()
    const xml = 'a<!x>'
    const exp = [{ content: 'x' }]

    const tok = new Tokenizer()
    tok.on('dtd', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('DTD - nested', t => {
    const fn = t.mock.fn()
    const xml = 'a<!x[<y>]>'
    const exp = [{ content: 'x[<y>]' }]

    const tok = new Tokenizer()
    tok.on('dtd', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('tagClose', t => {
    const fn = t.mock.fn()
    const xml = 'a</x>'
    const exp = [{ type: 'x' }]

    const tok = new Tokenizer()
    tok.on('tagClose', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('tagOpen - basic', t => {
    const fn = t.mock.fn()
    const xml = '<a>'
    const exp = [{ type: 'a' }]

    const tok = new Tokenizer()
    tok.on('tagOpen', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('tagOpen - with attrs', t => {
    const fn = t.mock.fn()
    const xml = '<a b="c" d="e">'
    const exp = [{ type: 'a', attr: 'b="c" d="e"' }]

    const tok = new Tokenizer()
    tok.on('tagOpen', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('tagOpen - with ">" in attr', t => {
    const fn = t.mock.fn()
    const xml = '<a b=">" d="e">'
    const exp = [{ type: 'a', attr: 'b=">" d="e"' }]

    const tok = new Tokenizer()
    tok.on('tagOpen', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('tagOpen - self Close and attrs', t => {
    const fn = t.mock.fn()
    const xml = '<a b="c" d="e"/>'
    const exp = [{ type: 'a', attr: 'b="c" d="e"', selfClose: true }]

    const tok = new Tokenizer()
    tok.on('tagOpen', fn)
    tok.push(xml)

    const act = fn.mock.calls.map(x => x.arguments[0])
    deep(act, exp, 'Right calls made')
  })

  test('Invalid tags', t => {
    const xmlList = ['<!-X', '<![X', '<![CDATX']
    for (const xml of xmlList) {
      const tok = new Tokenizer()
      tok.push(xml.slice(0, -1))
      assert.throws(
        () => tok.push(xml.at(-1)),
        UnexpectedInput,
        `Bad xml: ${xml}`
      )
    }
  })

  test('simple tag open', t => {
    const fn = t.mock.fn()
    const xml = '<a "b="c">'
    let tok = new Tokenizer({ simpleTagOpen: true })
    tok.on('tagOpen', fn)
    tok.push(xml)

    assert.strictEqual(fn.mock.callCount(), 1)
    assert.deepStrictEqual(fn.mock.calls[0].arguments[0], {
      type: 'a',
      attr: '"b="c"'
    })
    assert.strictEqual(tok.atEOD, true)

    tok = new Tokenizer()
    tok.push(xml)
    assert.ok(!tok.atEOD)
  })
})
