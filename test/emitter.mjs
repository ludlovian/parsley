import { suite, test } from 'node:test'
import assert from 'node:assert/strict'

import Emitter from '../src/emitter.mjs'

suite('emitter', () => {
  test('.on and .emit', t => {
    const fn = t.mock.fn()
    const e = new Emitter()
    e.on('foo', fn)
    e.emit('foo', 'bar')
    e.emit('bar', 'baz')
    assert.strictEqual(fn.mock.callCount(), 1)
    assert.deepStrictEqual(fn.mock.calls[0].arguments, ['bar'])
  })

  test('.onAll', t => {
    const fn = t.mock.fn()
    const e = new Emitter()
    e.onAll(['foo', 'bar'], fn)
    e.emit('foo', 17)
    e.emit('bar', 23)
    e.emit('baz', 28)

    assert.strictEqual(fn.mock.callCount(), 2)
    assert.deepStrictEqual(fn.mock.calls[0].arguments, ['foo', 17])
    assert.deepStrictEqual(fn.mock.calls[1].arguments, ['bar', 23])
  })
})
