import DataString from './datastring.mjs'

const { assign, entries, fromEntries } = Object

const WS = ' \t\n'
const IGNORE = {}

export default function parse (make, xml, opts = {}) {
  const data = new DataString(xml)
  opts = { decode: parse.decode, make, ...opts }

  const elements = readMultipleElements(data, { ...opts, allowEOF: true })
  if (!data.atEOF) throw new InvalidDoc()

  if (!elements.length) return null
  if (elements.length === 1) return elements[0]
  return elements
}

function readMultipleElements (data, { allowEOF = false, ...opts }) {
  const result = []
  while (true) {
    // run out of data
    //
    if (data.atEOF) {
      if (allowEOF) return result
      throw new UnexpectedEOF()
    }

    // reached a close tag to go up a level
    if (data.next(2) === '</') return result

    // gather and store, unless it is to be ignored
    const el = readElementOrText(data, opts)
    if (el !== IGNORE) result.push(el)
  }
}

function readElementOrText (data, opts) {
  const { decode } = opts
  if (data.next() === '<') return readElement(data, opts)
  return decode(data.readUntilOneOf('<', { allowEOF: true }))
}

function readElement (data, opts) {
  // Reads an entire XML element, including its children
  // An element can be:
  // - CDATA
  // - Processing instruction
  // - Script
  // - Regular XML element
  //
  // This consumes the whole element and returns it, either as
  // text, or an object made by the factory, or the special code IGNORE
  //
  const { make, allowUnclosed } = opts

  data.read() // consume open bracket

  // Deal with special cases
  //
  const c = data.next()
  if (c === '?') return readPI(data)
  if (c === '!' && data.next(3) === '!--') return readComment(data)
  if (c === '!' && data.next(8) === '![CDATA[') return readCData(data)
  if (data.next(6) === 'script') return readScript(data)

  // A plain old XML element, with type and attributes
  //
  const type = data.readUntilOneOf('/>' + WS)

  const attr = readAttributes(data, opts)

  // Is it self-closing
  //
  if (data.next() === '/') {
    data.read()
    data.readWhile(WS)
    if (data.read() !== '>') throw new InvalidTag()
    return make(type, attr, [])
  }

  // It has children, so read until we get to a close tag
  //

  data.read() // consume close bracket at end of open tag

  const children = readMultipleElements(data, opts)

  // now at start of a close tag - is it ours?
  const pos = data.pos // store the pos to reset if not ours
  data.read(2)
  const closeType = data.readUntilOneOf('>' + WS)
  if (closeType !== type) {
    if (allowUnclosed) {
      // reset the position back
      data.pos = pos
      return make(type, attr, children)
    }
    throw new MismatchedClose()
  }

  data.readWhile(WS)
  if (data.read() !== '>') throw new InvalidTag()

  return make(type, attr, children)
}

function readAttributes (data, opts) {
  // Reads the attributes in an element's open tag - which may be none
  // Starts with the pointer just after the tag name
  // Returns once it hits either a '/' (for a self-close) or '>' for a
  // normal element open tag

  const { decode } = opts

  const attr = {}

  while (true) {
    data.readWhile(WS)

    // are we at the end of the tag?
    const c = data.next()
    if (c === '/' || c === '>') return attr

    const name = data.readUntilOneOf('=' + WS)
    data.readWhile(WS)

    if (data.read() !== '=') throw new InvalidTag()
    data.readWhile(WS)

    // values must be quoted with single or double quotes
    const quote = data.read()
    if (quote !== '"' && quote !== "'") throw new InvalidTag()

    attr[name] = decode(data.readUntilExact(quote))
  }
}

function readPI (data) {
  // Processing instructions and XML declarations are treated as
  // ignorable text elements
  data.read()
  data.readUntilExact('?>')
  return IGNORE
}

function readComment (data) {
  // Comments are treated as ignorable text elements
  data.read(3)
  data.readUntilExact('-->')
  return IGNORE
}

function readScript (data) {
  // scripts are treated as ignorable text elements
  data.read(6)
  data.readUntilExact('</script>')
  return IGNORE
}

function readCData (data) {
  // CDATA blocks are treated as raw (undecoded) text elements
  data.read(8)
  const result = data.readUntilExact(']]>')
  return result
}

class ParseError extends Error {
  constructor () {
    super(new.target.message)
  }
}

class InvalidDoc extends ParseError {
  static message = 'Invalid document'
}

class MismatchedClose extends ParseError {
  static message = 'Mismatched close'
}

class InvalidTag extends ParseError {
  static message = 'Invalid tag'
}

class UnexpectedEOF extends ParseError {
  static message = 'Unexpected EOF'
}

const ENTITIES = { lt: '<', gt: '>', amp: '&', apos: "'", quot: '"' }
const decodes = fromEntries(
  entries(ENTITIES).map(([name, val]) => [`&${name};`, val])
)
const encodes = fromEntries(
  entries(ENTITIES).map(([name, val]) => [val, `&${name};`])
)

const decodeRgx = /&(?:lt|gt|amp|apos|quot);/g
const encodeRgx = /[<>&'"]/g

function decode (s) {
  return s && typeof s === 'string' ? s.replace(decodeRgx, x => decodes[x]) : s
}

function encode (s) {
  return s && typeof s === 'string' ? s.replace(encodeRgx, c => encodes[c]) : s
}

DataString.UnexpectedEOF = UnexpectedEOF
assign(
  parse,
  {
    ParseError,
    InvalidDoc,
    InvalidTag,
    MismatchedClose,
    UnexpectedEOF
  },
  { decode, encode }
)
