import parse from './parser.mjs'

const { entries, assign } = Object

export default class Parsley {
  type = ''
  attr = {}
  children = []

  xml () {
    const { encode } = parse
    const attr = entries(this.attr)
      .map(([k, v]) => ` ${k}="${encode(v)}"`)
      .join('')

    const children = this.children
      .map(child =>
        child instanceof Parsley ? child.xml() : encode(child.toString())
      )
      .join('')

    const type = this.type

    if (!children) return `<${type}${attr} />`
    return `<${type}${attr}>${children}</${type}>`
  }

  get text () {
    return this._find(p => typeof p === 'string', true, true)
  }

  get textAll () {
    return this._find(p => typeof p === 'string', false, true)
  }

  find (fn, { blank = false } = {}) {
    const p = this._find(fn, true)
    return p != null ? p : blank ? new Parsley() : null
  }

  findAll (fn) {
    return this._find(fn, false)
  }

  _find (fn, firstOnly, internal) {
    if (!internal) {
      if (typeof fn === 'string') {
        const type = fn
        fn = p => p instanceof Parsley && p.type === type
      } else {
        const _fn = fn
        fn = p => p instanceof Parsley && _fn(p)
      }
    }

    if (firstOnly) return walk(this).next().value || null
    return [...walk(this)]

    function * walk (p) {
      if (fn(p)) {
        yield p
        return
      }

      for (const child of p.children) {
        if (fn(child)) {
          yield child
        } else if (child instanceof Parsley) {
          yield * walk(child)
        }
      }
    }
  }

  add (child) {
    const isValid = typeof child === 'string' || child instanceof Parsley
    if (!isValid) throw new Error('Can only add text or a Parsley')
    this.children.push(child)
    return this
  }

  clone () {
    return Parsley.create(
      this.type,
      { ...this.attr },
      this.children.map(child =>
        child instanceof Parsley ? child.clone() : child
      )
    )
  }

  static from (xml, { safe = false } = {}) {
    if (!xml || typeof xml !== 'string') {
      if (safe) return null
      throw new Error('Not a valid string')
    }

    try {
      const elem = parse(Parsley.create, xml)
      return Array.isArray(elem)
        ? elem.find(e => e instanceof Parsley) || null
        : elem
    } catch (err) {
      if (safe) return null
      throw err
    }
  }

  static create (type, attr = {}, children = []) {
    return assign(new Parsley(), { type, attr, children })
  }
}
