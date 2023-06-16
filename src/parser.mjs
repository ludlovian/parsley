// import Debug from 'debug'
const ERR_INVALID_DOC = 'Invalid document'
const ERR_MISMATCH_CLOSE = 'Mismatched close'
const ERR_UNEXPECTED_EOF = 'Unexpected EOF'
const ERR_INVALID_TAG = 'Invalid tag'

const WS = ' \t\n'
const IGNORE = {}

export default function parse (h, xml, opts = {}) {
  const { decode = parse.decode } = opts
  let i = 0
  const len = xml.length

  const x = readChildren(true)
  if (i < len) raise(ERR_INVALID_DOC)
  return x.length > 1 ? x : x.length === 1 ? x[0] : null

  function readElement () {
    i++
    if (i === len) raise(ERR_UNEXPECTED_EOF)
    const c = xml[i]
    if (c === '?') return readPI()
    if (c === '!' && xml.slice(i + 1, i + 3) === '--') return readComment()
    if (c === '!' && xml.slice(i + 1, i + 8) === '[CDATA[') return readCData()
    const type = readUntil('/>' + WS)
    const attr = readAttributes()
    if (xml[i] === '/') {
      i++
      skipWhitespace()
      if (xml[i] !== '>') raise(ERR_INVALID_TAG)
      i++
      return h(type, attr, [])
    }
    i++
    const children = readChildren()
    i += 2
    const closeType = readUntil('>' + WS)
    if (closeType !== type) raise(ERR_MISMATCH_CLOSE)
    skipWhitespace()
    if (xml[i] !== '>') raise(ERR_INVALID_TAG)
    i++
    return h(type, attr, children)
  }

  function readAttributes () {
    const attr = {}
    while (true) {
      skipWhitespace()
      const c = xml[i]
      if (c === '/' || c === '>') return attr
      const name = readUntil('=' + WS)
      skipWhitespace()
      if (xml[i] !== '=') raise(ERR_INVALID_TAG)
      i++
      skipWhitespace()
      const quote = xml[i]
      if (quote !== '"' && quote !== "'") raise(ERR_INVALID_TAG)
      i++
      attr[name] = decode(readUntil(quote))
      i++
    }
  }

  function readChildren (allowEOF) {
    const children = []
    while (i < len) {
      if (xml[i] === '<') {
        if (xml[i + 1] === '/') {
          return children
        }
        const child = readElement()
        if (child === IGNORE) continue
        children.push(child)
      } else {
        children.push(decode(readUntil('<', allowEOF)))
      }
    }
    if (!allowEOF) raise(ERR_UNEXPECTED_EOF)
    return children
  }

  function readPI () {
    i++
    skipUntil('?>')
    return IGNORE
  }
  function readComment () {
    i += 3
    skipUntil('-->')
    return IGNORE
  }
  function readCData () {
    i += 8
    const j = i
    skipUntil(']]>')
    return xml.slice(j, i - 3)
  }

  function readUntil (chars, allowEOF) {
    const j = i
    for (; i < len; i++) {
      if (chars.includes(xml[i])) return xml.slice(j, i)
    }
    if (!allowEOF) raise(ERR_UNEXPECTED_EOF)
    return xml.slice(j)
  }

  function skipUntil (match) {
    const n = match.length
    for (; i < len - n + 1; i++) {
      if (xml.slice(i, i + n) === match) {
        i += n
        return
      }
    }
    raise(ERR_UNEXPECTED_EOF)
  }

  function skipWhitespace () {
    for (; i < len; i++) {
      if (!WS.includes(xml[i])) return
    }
    raise(ERR_UNEXPECTED_EOF)
  }

  function raise (msg) {
    const e = new parse.ParseError(msg)
    e.pos = i < len ? i : null
    throw e
  }
}
parse.ParseError = class ParseError extends Error {}

const ENTITIES = { lt: '<', gt: '>', amp: '&', apos: "'", quot: '"' }
const decodes = Object.fromEntries(
  Object.entries(ENTITIES).map(([name, val]) => [`&${name};`, val])
)
const decodeRgx = /&(?:lt|gt|amp|apos|quot);/g
parse.decode = s =>
  s && typeof s === 'string' ? s.replace(decodeRgx, x => decodes[x]) : s

const encodes = Object.fromEntries(
  Object.entries(ENTITIES).map(([name, val]) => [val, `&${name};`])
)
const encodeRgx = /[<>&'"]/g
parse.encode = s =>
  s && typeof s === 'string' ? s.replace(encodeRgx, c => encodes[c]) : s
