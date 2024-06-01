import { decodeEntities, decodeAttributes, encodeEntities } from './decode.mjs'
import Tokenizer from './tokenizer.mjs'
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

  #find (fn, findAll, parsleyOnly) {
    if (!findAll) return walk(this).next().value ?? null
    return [...walk(this)]

    function * walk (parsley) {
      if (fn(parsley)) {
        yield parsley
        return
      }

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

  add (child) {
    if (typeof child === 'string') {
      child = ParsleyText.fromDecoded(child)
    } else if (!(child instanceof Parsley)) {
      throw new Error('Can only add text or a Parsley')
    }
    this.#children.push(child)
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

  static create (type, attr = {}, children = []) {
    const p = new Parsley()
    p.#type = type
    p.#attr = attr
    children.forEach(child => p.add(child))
    return p
  }

  static from (xml, { safe = false, allowUnclosed = false } = {}) {
    if (!xml || typeof xml !== 'string') {
      if (safe) return null
      throw new Error('Not a valid string')
    }

    try {
      const p = Parsley.#fromText(xml, allowUnclosed)
      return p
    } catch (err) {
      if (safe) return null
      throw err
    }
  }

  static #fromText (xml, allowUnclosed) {
    const tok = new Tokenizer()
    const stack = [] // stack of parent elems
    let curr // the current element
    let root // the final root

    tok.on('text', ({ content }) => {
      if (!curr) return
      const pt = ParsleyText.from(content)
      curr.#children.push(pt)
    })

    tok.on('cdata', ({ content }) => {
      if (!curr) return
      const pt = ParsleyText.fromDecoded(content)
      curr.#children.push(pt)
    })

    tok.on('tagOpen', ({ type, attr, selfClose }) => {
      const p = new Parsley()
      p.#type = type
      p.#rawAttr = attr ?? ''
      root = root ?? p // first parsley becomes the root
      if (curr) curr.#children.push(p)
      if (!selfClose) {
        if (curr) stack.push(curr)
        curr = p
      }
    })

    tok.on('tagClose', ({ type }) => {
      // keep going up the stack until we find this
      while (true) {
        if (curr && curr.type === type) {
          curr = stack.pop()
          break
        } else if (allowUnclosed && curr) {
          curr = stack.pop()
        } else {
          throw new MismatchedClose(type)
        }
      }
    })

    tok.push(xml)
    if (curr) throw new UnclosedTag(curr.type)
    if (!tok.atEOD) throw new UnexpectedEOF()
    return root
  }
}

class ParsleyText {
  #rawText = undefined
  #text = undefined

  static from (text) {
    const pt = new ParsleyText()
    pt.#rawText = text
    return pt
  }

  static fromDecoded (text) {
    const pt = new ParsleyText()
    pt.#text = text
    return pt
  }

  get text () {
    if (this.#text !== undefined) return this.#text
    this.#text = decodeEntities(this.#rawText)
    return this.#text
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
