import { decodeEntities, decodeAttributes, encodeEntities } from './decode.mjs'
import Parser from './parser.mjs'
import {
  UnexpectedInput,
  MismatchedClose,
  UnclosedTag,
  UnexpectedEOF
} from './errors.mjs'

const { entries, fromEntries } = Object
const customInspect = Symbol.for('nodejs.util.inspect.custom')

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
  // Getters & inspection
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
    return this.#children
  }

  /* c8 ignore start */
  [customInspect] (depth, opts) {
    if (depth < 0) return opts.stylize('[Parsley]', 'string')
    return `Parsley<${opts.stylize(this.type, 'string')}>`
  }
  /* c8 ignore stop */

  // -----------------------------------------------------
  //
  // Reconstruct & adjust
  //

  toXml () {
    if (!this.#type) return ''

    const attr = entries(this.attr)
      .map(([k, v]) => ` ${k}="${encodeEntities(v)}"`)
      .join('')

    const children = this.#children
      .map(child =>
        child.isElement ? child.toXml() : encodeEntities(child.toString())
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
      .filter(child => child.isElement || !child.isEmpty)
    return p
  }

  // -----------------------------------------------------
  //
  // Iterator & searches
  //

  * walk () {
    if (!this.type) return
    yield this
    for (const child of this.#children) {
      if (child.isElement) {
        yield * child
      } else {
        yield child
      }
    }
  }

  getText () {
    return this.walk()
      .filter(p => !p.isElement)
      .map(p => p.toString())
      .toArray()
      .join('')
  }

  find (typeIsh) {
    // the lazy way
    return this.findAll(typeIsh)[0]
  }

  findAll (typeIsh) {
    let fn = p => p.isElement && p.type === typeIsh
    if (typeIsh.includes('.')) {
      const [type, klass] = typeIsh.split('.')
      fn = p =>
        p.isElement &&
        p.type === type &&
        p.attr.class?.split(' ').includes(klass)
    }
    return this.walk()
      .filter(fn)
      .toArray()
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
Object.assign(Parsley.prototype, {
  isElement: true,
  [Symbol.iterator]: Parsley.prototype.walk
})

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

  toString () {
    if (this.#text !== undefined) return this.#text
    this.#text = decodeEntities(this.#rawText)
    return this.#text
  }

  /* c8 ignore start */
  [customInspect] (depth, opts) {
    if (depth < 0) return opts.stylize('[Text]', 'string')
    return `Text(${opts.stylize(this.toString(), 'string')})`
  }
  /* c8 ignore stop */

  get text () {
    return this.toString()
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
ParsleyText.prototype.isElement = false

Object.assign(Parsley, {
  UnexpectedInput,
  MismatchedClose,
  UnclosedTag,
  UnexpectedEOF,
  encode: encodeEntities,
  decode: decodeEntities
})
