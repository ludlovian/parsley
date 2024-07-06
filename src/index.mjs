import { decodeEntities, decodeAttributes, encodeEntities } from './decode.mjs'
import Parser from './parser.mjs'
import {
  UnexpectedInput,
  MismatchedClose,
  UnclosedTag,
  UnexpectedEOF
} from './errors.mjs'

const { entries, fromEntries } = Object

export default class Parsley {
  // internal members
  #type = ''
  #rawAttr = ''
  #attr = undefined
  #children = []

  // -----------------------------------------------------
  //
  // Creation
  //

  static #create (type, rawAttr = '', children = []) {
    const p = new Parsley()
    p.#type = type
    p.#rawAttr = rawAttr
    children.forEach(c => p.add(c))
    return p
  }

  static create (type, attr = {}, children = []) {
    const p = new Parsley()
    p.#type = type
    p.#attr = attr
    children.forEach(c => p.add(c))
    return p
  }

  // -----------------------------------------------------
  //
  // Getters
  //

  get type () {
    return this.#type
  }

  get attr () {
    if (this.#attr) return this.#attr
    const kvList = entries(decodeAttributes(this.#rawAttr)).map(
      ([key, value]) => [key, decodeEntities(value)]
    )
    this.#attr = fromEntries(kvList)
    return this.#attr
  }

  get children () {
    return this.#children.map(x => (x instanceof ParsleyText ? x.text : x))
  }

  get isText () {
    if (!this.#children.length) return false
    for (const child of this.#children) {
      if (child instanceof Parsley) return false
    }
    return true
  }

  // -----------------------------------------------------
  //
  // Reconstruct & adjust
  //

  xml () {
    if (!this.#type) return ''

    const attr = entries(this.attr)
      .map(([k, v]) => ` ${k}="${encodeEntities(v)}"`)
      .join('')

    const children = this.children
      .map(child =>
        child instanceof Parsley
          ? child.xml()
          : encodeEntities(child.toString())
      )
      .join('')

    const type = this.type

    if (!children) return `<${type}${attr} />`
    return `<${type}${attr}>${children}</${type}>`
  }

  clone () {
    const p = new Parsley()
    p.#type = this.#type
    p.#rawAttr = this.#rawAttr
    p.#attr = this.#attr
    p.#children = this.#children.map(child => child.clone())
    return p
  }

  trim () {
    const p = this.clone()
    p.#children = p.#children
      .map(child => child.trim())
      .filter(child => !(child instanceof ParsleyText && child.isEmpty))
    return p
  }

  // -----------------------------------------------------
  //
  // Find
  //

  #find (fn, findAll, parsleyOnly) {
    if (!findAll) return walk(this).next().value ?? null
    return [...walk(this)]

    function * walk (parsley) {
      if (fn(parsley)) yield parsley

      for (const child of parsley.#children) {
        if (child instanceof Parsley) {
          yield * walk(child)
        } else {
          if (!parsleyOnly && fn(child)) yield child.text
        }
      }
    }
  }

  get text () {
    return this.#find(p => p instanceof ParsleyText, false, false)
  }

  get textAll () {
    return this.#find(p => p instanceof ParsleyText, true, false)
  }

  find (fn, { blank = false } = {}) {
    const p = this.#find(makeFn(fn), false, true)
    return p != null ? p : blank ? new Parsley() : null
  }

  findAll (fn) {
    return this.#find(makeFn(fn), true, true)
  }

  get_ (fn) {
    fn = makeFn(fn)
    const pred = c => c instanceof Parsley && fn(c)
    return this.#children.find(pred) ?? null
  }

  getAll (fn) {
    fn = makeFn(fn)
    const pred = c => c instanceof Parsley && fn(c)
    return this.#children.filter(pred)
  }

  // -----------------------------------------------------
  //
  // Construction
  //

  add (child) {
    if (typeof child === 'string') {
      child = ParsleyText.decoded(child)
    }
    if (child instanceof ParsleyText || child instanceof Parsley) {
      this.#children.push(child)
    } else {
      throw new Error('Can only add text or a Parsley')
    }
    return this
  }

  // -----------------------------------------------------
  //
  // Parsing
  //

  static from (xml, opts = {}) {
    if (opts.loose) {
      opts.html = true
      opts.allowUnclosed = true
      opts.simpleTagOpen = true
    }

    if (!xml || typeof xml !== 'string') {
      if (opts.safe) return null
      throw new Error('Not a valid string')
    }

    const parser = new Parser({
      ...opts,
      newElem: Parsley.#create,
      newRawText: t => new ParsleyText(t),
      newText: ParsleyText.decoded
    })
    try {
      return parser.push(xml).end()
    } catch (err) {
      if (opts.safe) return null
      if (opts.loose) return parser.end()
      throw err
    }
  }
}
Parsley.prototype.get = Parsley.prototype.get_

class ParsleyText {
  #rawText = undefined
  #text = undefined

  constructor (rawText) {
    this.#rawText = rawText
  }

  static decoded (text) {
    const pt = new ParsleyText()
    pt.#text = text
    return pt
  }

  get text () {
    if (this.#text !== undefined) return this.#text
    this.#text = decodeEntities(this.#rawText)
    return this.#text
  }

  get isEmpty () {
    return !(this.#rawText || this.#text)
  }

  clone () {
    return this.#text !== undefined
      ? ParsleyText.decoded(this.#text)
      : new ParsleyText(this.#rawText)
  }

  trim () {
    return this.#text !== undefined
      ? ParsleyText.decoded(this.#text.trim())
      : new ParsleyText(this.#rawText.trim())
  }
}

function makeFn (fn) {
  if (typeof fn === 'function') return fn
  const type = fn + ''
  return p => p.type === type
}

Object.assign(Parsley, {
  UnexpectedInput,
  MismatchedClose,
  UnclosedTag,
  UnexpectedEOF,
  encode: encodeEntities,
  decode: decodeEntities
})
