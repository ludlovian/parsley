import { suite, test } from 'node:test'
import assert from 'node:assert/strict'

import Parser from '../src/parser.mjs'

suite('parser', () => {
  class Elem {
    add (x) {
      this.children.push(x)
      return this
    }
  }

  const newElem = (type, rawAttr = '', children = []) =>
    Object.assign(new Elem(), { type, rawAttr, children })
  const newRawText = rawText => ({ rawText })
  const newText = text => ({ text })
  const std = { newElem, newRawText, newText }

  test('basic parse', () => {
    const xml = '<a x="y">b</a>'
    const exp = newElem('a', 'x="y"').add(newRawText('b'))
    const p = new Parser(std)
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('parse with CDATA', () => {
    const xml = '<a x="y"><![CDATA[b]]></a>'
    const exp = newElem('a', 'x="y"').add(newText('b'))
    const p = new Parser(std)
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('ignore initial text', () => {
    const xml = ' <a />'
    const exp = newElem('a')
    const p = new Parser(std)
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('ignore initial CDATA', () => {
    const xml = '<![CDATA[b]]><a />'
    const exp = newElem('a')
    const p = new Parser(std)
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('parse nested', () => {
    const xml = '<a><b /></a>'
    const exp = newElem('a').add(newElem('b'))
    const p = new Parser(std)
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('allowUnclosed', () => {
    const xml = '<a><b></a>'
    const exp = newElem('a').add(newElem('b'))
    const p = new Parser({ ...std, allowUnclosed: true })
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('html void tags', () => {
    const xml = '<a><br></a>'
    const exp = newElem('a').add(newElem('br'))
    const p = new Parser({ ...std, html: true })
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('loose ignores bad closes', () => {
    const xml = '<a><b></c>'
    const exp = newElem('a').add(newElem('b'))
    const p = new Parser({ ...std, loose: true })
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })

  test('loose ignores extra elements', () => {
    const xml = '<a><b><'
    const exp = newElem('a').add(newElem('b'))
    const p = new Parser({ ...std, loose: true })
    const act = p.push(xml).end()

    assert.deepStrictEqual(act, exp)
  })
  suite('errors', () => {
    test('missing close', () => {
      const xml = '<a><b></a>'
      const p = new Parser(std)
      assert.throws(() => p.push(xml), /Mismatched close/)
    })

    test('mismatched close', () => {
      const xml = '<a></b>'
      const p = new Parser(std)
      assert.throws(() => p.push(xml), /Mismatched close/)
    })

    test('missing close at end', () => {
      const xml = '<a>'
      const p = new Parser(std)
      assert.throws(() => p.push(xml).end(), /Unclosed/)
    })

    test('extra text at end', () => {
      const xml = '<a/><'
      const p = new Parser(std)
      assert.throws(() => p.push(xml).end(), /Unexpected/)
    })
  })
})
