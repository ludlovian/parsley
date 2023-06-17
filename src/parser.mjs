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
    // Reads an entire XML element, incluidng its children.
    // When called, the current char is pointing at the opening bracket
    // When it returns, it is pointing just *after* the closing bracket
    i++
    if (i === len) raise(ERR_UNEXPECTED_EOF)
    const c = xml[i]
    if (c === '?') return readPI()
    if (c === '!' && xml.slice(i + 1, i + 3) === '--') return readComment()
    if (c === '!' && xml.slice(i + 1, i + 8) === '[CDATA[') return readCData()
    const type = readUntil('/>' + WS)
    const attr = readAttributes()
    if (xml[i] === '/') {
      // It is a self-closing element
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
    // Reads the attributes in an element's open tag - which may be none
    // Starts with the pointer just after the tag name
    // Returns once it hits either a '/' (for a self-close) or '>' for a
    // normal element open tag
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
    // Reads the children of an element, These could be:
    // - text element
    // - PI or comment or other element which should be IGNOREd
    // - regular XML element
    //
    // Returns either when it hits EOF (if allowEOF is set) or when it
    // enoucnters the parent element's close tag
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
    // Processing instructions and XML declarations are treated as
    // ignorable text elements
    i++
    skipUntil('?>')
    return IGNORE
  }

  function readComment () {
    // Comments are treated as ignorable text elements
    i += 3
    skipUntil('-->')
    return IGNORE
  }

  function readCData () {
    // CDATA blocks are treated as raw (undecoded) text elements
    i += 8
    const j = i
    skipUntil(']]>')
    return xml.slice(j, i - 3)
  }

  function readUntil (chars, allowEOF) {
    // Reads until it hits one of the termniation characters (or EOF if allowed)
    // and returns the word found.
    const j = i
    for (; i < len; i++) {
      if (chars.includes(xml[i])) return xml.slice(j, i)
    }
    if (!allowEOF) raise(ERR_UNEXPECTED_EOF)
    return xml.slice(j)
  }

  function skipUntil (match) {
    // Moves until after it has found an exact text match. On return, the
    // current pointer is pointing at the first char after the match text
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
    // skips forward (if needed) to jump over whitespace
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
