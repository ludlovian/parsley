import { test } from 'uvu'
import * as assert from 'uvu/assert'

import DataString from '../src/datastring.mjs'

const CHARS = 'abcdefghijklmnopqrstuvwxyz'

test('construction', () => {
  const d = new DataString(CHARS)
  assert.is(d.data, CHARS, 'data has been stored')
  assert.is(d.len, CHARS.length, 'length has been stored')
  assert.is(d.pos, 0, 'starts at the begining')
})

test('basic read and lookahead', () => {
  const d = new DataString(CHARS)

  assert.is(d.read(), 'a', 'reads one character')
  assert.is(d.read(2), 'bc', 'reads multiple characters')

  assert.is(d.next(), 'd', 'look ahead one character')
  assert.is(d.next(2), 'de', 'look ahead multiple characters')
})

test('readWhile', () => {
  const d = new DataString(CHARS)
  assert.is(d.readWhile('dcba'), 'abcd', 'Reads while chars match')
  assert.is(d.next(), 'e', 'consumes read characters')

  assert.is(d.readWhile('dcba'), '', 'Returns if no chars match')
  assert.is(d.next(), 'e', 'stays at same place')

  assert.throws(
    () => d.readWhile(CHARS),
    /Unexpected EOF/,
    'Throws if it runs out of data'
  )
})

test('readUntilOneOf', () => {
  const d = new DataString(CHARS)
  assert.is(d.readUntilOneOf('mpe'), 'abcd', 'reads until it finds a match')
  assert.is(d.next(), 'e', 'consumes read characters, but not match')

  d.readUntilOneOf('x')
  assert.is(
    d.readUntilOneOf('a', { allowEOF: true }),
    'xyz',
    'reads to EOD if no match'
  )

  assert.throws(
    () => d.readUntilOneOf('a'),
    /Unexpected EOF/,
    'Throws if no match found'
  )
})

test('readUntilExact', () => {
  const d = new DataString(CHARS)
  assert.is(d.readUntilExact('efg'), 'abcd', 'reads until it finds a match')
  assert.is(d.next(), 'h', 'consumes read characters, and the match')

  assert.throws(
    () => d.readUntilExact('foobar'),
    /Unexpected EOF/,
    'Throws if no match found'
  )
})

test('EOF testing', () => {
  const d = new DataString(CHARS)
  assert.is(d.read(CHARS.length), CHARS, 'read the whole string')
  assert.is(d.atEOF, true)

  assert.throws(() => d.read(), /Unexpected EOF/, 'try to read past end')
})

test('Custom error', () => {
  const prev = DataString.UnexpectedEOF
  class E extends Error {
    constructor () {
      super('My Error')
    }
  }
  DataString.UnexpectedEOF = E
  const d = new DataString(CHARS)
  assert.throws(
    () => d.read(100),
    e => e instanceof E,
    'Throws with custom error'
  )
  DataString.UnexpectedEOF = prev
})

test.run()
