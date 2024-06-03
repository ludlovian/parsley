import { UnexpectedInput } from './errors.mjs'
import { isWhitespace } from './decode.mjs'

// Tokenizer
//
// Instances of this class turn an XML stream into tokens.
//
// These tokens are:
//
// - tagOpen - the start of an XML element
// - tagClose - the end of an XML element
// - pi - processing instruction
// - dtd - doc type definition
// - text - the text inside an element
// - comment - the text of a comment
// - cdata - the text of a CDATA element
// - script - the text inside a script
//
// It does no real validaiton, especially ensuring closes match opens. That
// should be done at a slightly higher level.
//
// It also does no element decoding, nor parses the attribute strings. Neither
// may be necessary, and so can be done lazily later if needed.

const TYPE = {
  text: { start: '', end: textEnd, emit: 'text' },
  pi: { start: '<?', end: '>', emit: 'pi' },
  cdata: { start: '<![CDATA[', end: ']]>', emit: 'cdata' },
  comment: { start: '<!--', end: '-->', emit: 'comment' },
  dtd: { start: '<!', end: dtdEnd, emit: 'dtd' },
  script: { start: '<script', end: '</script>', emit: emitScript },
  tagClose: { start: '</', end: '>', emit: emitTagClose },
  tagOpen: {
    start: '<',
    end: tagOpenEnd,
    except: maybeScript,
    emit: emitTagOpen
  }
}

export default class Tokenizer {
  #callbacks = { __proto__: null }
  #buffer = ''
  #pos = 0

  onAll (callback) {
    for (const tokenType of Object.keys(TYPE)) {
      this.on(tokenType, data => callback(tokenType, data))
    }
  }

  on (tokenType, callback) {
    this.#callbacks[tokenType] = callback
  }

  #emit (tokenType, data) {
    const callback = this.#callbacks[tokenType]
    if (!callback) return
    callback(data)
  }

  get buffer () {
    return this.#buffer
  }

  get atEOD () {
    return !this.buffer.trim()
  }

  get pos () {
    return this.#pos
  }

  push (data) {
    this.#buffer += data
    while (true) {
      const consumed = this.#parseBuffer()
      if (consumed) {
        this.#pos += consumed
        this.#buffer = this.#buffer.slice(consumed)
      } else {
        break
      }
    }
  }

  #parseBuffer () {
    const len = this.#buffer.length

    // Return if not enought data yet
    if (!len) return undefined

    let char = this.#buffer.charAt(0)

    // is it a text element
    if (char !== '<') return this.#parseToken(TYPE.text)

    if (len < 2) return undefined // need more data
    char = this.#buffer.charAt(1)

    // Processing instruction
    if (char === '?') return this.#parseToken(TYPE.pi)

    // CDATA, Comment, DTD - all start with !
    if (char === '!') {
      // Need at least one more charatcer
      if (len < 3) return undefined
      char = this.#buffer.charAt(2)
      if (char === '[') return this.#parseToken(TYPE.cdata)
      if (char === '-') return this.#parseToken(TYPE.comment)
      return this.#parseToken(TYPE.dtd)
    }

    if (char === '/') return this.#parseToken(TYPE.tagClose)

    // regular tag, but it might be a <script> which we treat differently
    return this.#parseToken(TYPE.tagOpen)
  }

  #parseToken (t) {
    const len = this.#buffer.length

    // does the data we have match it so far
    const soFar = this.#buffer.slice(0, t.start.length)
    if (t.start.indexOf(soFar) === -1) {
      throw new UnexpectedInput(soFar, this.#pos)
    }

    // do we have enough to count as a start?
    if (len < t.start.length) return undefined

    const contentStart = t.start.length

    // can we find the end
    let contentEnd
    let consumed

    if (typeof t.end === 'string') {
      contentEnd = this.#buffer.indexOf(t.end, contentStart)
      if (contentEnd === -1) return undefined // not yet found the end

      consumed = contentEnd + t.end.length
    } else {
      const result = t.end(this.#buffer, contentStart)
      if (result === undefined) {
        return undefined // not yet found the end
      }
      ;[contentEnd, consumed] = result
    }

    const content = this.#buffer.slice(contentStart, contentEnd)

    if (t.except) {
      const newType = t.except(content)
      if (newType) return this.#parseToken(newType)
    }

    if (typeof t.emit === 'string') {
      this.#emit(t.emit, { content })
    } else {
      const [tokenType, data] = t.emit(content)
      this.#emit(tokenType, data)
    }
    return consumed
  }
}

function textEnd (buffer, start) {
  const ix = buffer.indexOf('<', start)
  if (ix === -1) return undefined
  return [ix, ix]
}

function dtdEnd (buffer, start) {
  // DTD's end on a ">" but only outside '['...']' blocks
  const len = buffer.length
  let bracketDepth = 0
  for (let i = start; i < len; i++) {
    const char = buffer.charAt(i)
    if (char === '>' && !bracketDepth) {
      return [i, i + 1]
    } else if (char === '[') {
      bracketDepth++
    } else if (char === ']') {
      bracketDepth--
    }
  }
  return undefined
}

function tagOpenEnd (buffer, start) {
  // open tags can have '>'s inside attributes, so we skip over anything in
  // quotes (single or double)
  const len = buffer.length
  let quote = ''
  for (let i = start; i < len; i++) {
    const char = buffer.charAt(i)
    if (quote) {
      if (quote === char) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '>') {
      return [i, i + 1]
    }
  }
  return undefined
}

function maybeScript (content) {
  return content.startsWith('script') ? TYPE.script : undefined
}

function emitTagClose (content) {
  return ['tagClose', { type: content.trim() }]
}

function emitScript (content) {
  // add back in the start and end
  content = TYPE.script.start + content + TYPE.script.end
  return ['script', { content }]
}

function emitTagOpen (content) {
  content = content.trim()
  const data = {}
  if (content.endsWith('/')) {
    data.selfClose = true
    content = content.slice(0, -1)
  }

  data.type = content

  // now split on first whitespace
  const len = content.length
  for (let i = 0; i < len; i++) {
    if (isWhitespace(content.charAt(i))) {
      data.type = content.slice(0, i)
      data.attr = content.slice(i).trim()
      break
    }
  }

  return ['tagOpen', data]
}
