import parser from './parser.mjs'

export default class Parsley {
  static from (xml) {
    const p = parser(createElement)
    let elem = p.parse(xml)
    if (Array.isArray(elem)) {
      elem = elem.find(e => e instanceof Parsley)
    }
    return elem
  }

  xml () {
    const attr = Object.entries(this.attr).map(([k, v]) =>
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
    return find(this, p => typeof p === 'string', true)
  }

  get textAll () {
    return find(this, p => typeof p === 'string', false)
  }

  find (fn) {
    return find(this, makeCondition(fn), true)
  }

  findAll (fn) {
    return find(this, makeCondition(fn), false)
  }

  trimWS () {
    const isWS = p => typeof p === 'string' && p.trim() === ''
    this.children = this.children.filter(p => !isWS(p))
    for (const child of this.children) {
      if (child instanceof Parsley) child.trimWS()
    }
    return this
  }
}

Parsley.encode = encode
Parsley.decode = decode

function find (p, cond, first) {
  if (cond(p)) return first ? p : [p]
  if (!(p instanceof Parsley)) return null
  let ret = []
  for (const child of p.children) {
    const found = find(child, cond, first)
    if (found) {
      if (first) return found
      ret = ret.concat(found)
    }
  }
  return first ? null : ret
}

function makeCondition (cond) {
  return typeof cond === 'string'
    ? p => p instanceof Parsley && p.type === cond
    : p => p instanceof Parsley && cond(p)
}

const encodes = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;'
}

const decodes = Object.fromEntries(
  Object.entries(encodes).map(([a, b]) => [b, a])
)

function encode (s) {
  return s.replace(/[<>&'"]/g, c => encodes[c])
}

function decode (s) {
  return s.replace(/&(?:lt|gt|amp|apos|quot);/g, c => decodes[c])
}

function createElement (type, attr, children) {
  for (const k in attr) {
    const v = attr[k]
    if (v && typeof v === 'string') attr[k] = decode(v)
  }
  children = children.map(child =>
    typeof child === 'string' ? decode(child) : child
  )
  return Object.assign(new Parsley(), { type, attr, children })
}
