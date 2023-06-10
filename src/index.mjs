import parser from './parser.mjs'

const { fromEntries, entries, assign } = Object

export default class Parsley {
  type = ''
  attr = {}
  children = []

  xml () {
    const { encode } = Parsley

    const attr = entries(this.attr).map(([k, v]) =>
      typeof v === 'string' ? ` ${k}="${encode(v)}"` : ' ' + k
    )
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

  find (fn) {
    return this._find(fn, true)
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

  trimWS () {
    const isWS = p => typeof p === 'string' && p.trim() === ''
    this.children = this.children.filter(p => !isWS(p))
    for (const child of this.children) {
      if (child instanceof Parsley) child.trimWS()
    }
    return this
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

  static from (xml) {
    if (!xml || typeof xml !== 'string') {
      throw new Error('Not a valid string')
    }
    const p = parser(Parsley._createAndDecode)
    let elem = p.parse(xml)
    if (Array.isArray(elem)) {
      elem = elem.find(e => e instanceof Parsley)
    }
    return elem
  }

  static create (type, attr = {}, children = []) {
    return assign(new Parsley(), { type, attr, children })
  }

  static _createAndDecode (type, attr, children) {
    const { decode } = Parsley
    return Parsley.create(
      type,
      fromEntries(entries(attr).map(([k, v]) => [k, decode(v)])),
      children.map(decode)
    )
  }

  static encodeEntities = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }

  static decodeEntities = fromEntries(
    entries(Parsley.encodeEntities).map(([a, b]) => [b, a])
  )

  static encode (s) {
    if (typeof s !== 'string' || !s) return s
    return s.replace(/[<>&'"]/g, c => Parsley.encodeEntities[c])
  }

  static decode (s) {
    if (typeof s !== 'string' || !s) return s
    return s.replace(
      /&(?:lt|gt|amp|apos|quot);/g,
      c => Parsley.decodeEntities[c]
    )
  }
}
global.Parsley = Parsley
