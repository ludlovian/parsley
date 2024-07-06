import { UnexpectedInput } from './errors.mjs'
import { isWhitespace } from './decode.mjs'
import Emitter from './emitter.mjs'

// Token
//
// These are the different types of token that can be encountered
//

class Token {
  buffer
  contentStart
  contentEnd
  consumed

  // parse
  //
  // parses the buffer for this kind of token. Returns:
  // - undefined if not enough data has arrived
  // - { data, consumed } if we can turn this into data to be emitted
  // - { tokenType } if we should change token type
  // - throws an Error if one encountered

  parse (buffer) {
    this.buffer = buffer
    // have we matched the start yet?
    if (!this.matchesStart()) return undefined

    // have we matched the end yet?
    if (!this.matchesEnd()) return undefined

    const content = this.buffer.slice(this.contentStart, this.contentEnd)
    const tokenType = this.changeType(content)
    if (tokenType) return { tokenType }

    const data = this.format(content)
    return { data, consumed: this.consumed }
  }

  // Generic processing to be over-ridden at times

  matchesStart () {
    const s = this.startText
    const soFar = this.buffer.slice(0, s.length)
    if (s && !s.startsWith(soFar)) {
      throw new UnexpectedInput(soFar)
    }
    if (this.buffer.length < s.length) return false
    this.contentStart = s.length
    return true
  }

  matchesEnd () {
    const s = this.endText
    const i = this.buffer.indexOf(s, this.contentStart)
    if (i === -1) return false
    this.contentEnd = i
    this.consumed = i + s.length
    return true
  }

  changeType () {}

  format (content) {
    return { content }
  }
}

class TextToken extends Token {
  name = 'text'
  startText = ''
  endText = '<'

  matchesEnd () {
    // the text doesnt acutally conusme the open bracket
    if (super.matchesEnd()) {
      this.consumed--
      return true
    }
    return false
  }
}

class PIToken extends Token {
  name = 'pi'
  startText = '<?'
  endText = '>'
}

class CDataToken extends Token {
  name = 'cdata'
  startText = '<![CDATA['
  endText = ']]>'
}

class CommentToken extends Token {
  name = 'comment'
  startText = '<!--'
  endText = '-->'
}

class DTDToken extends Token {
  name = 'dtd'
  startText = '<!'

  matchesEnd () {
    // DTDs only end on a close bracket outside [...] blocks
    const len = this.buffer.length
    let bracketDepth = 0
    for (let i = this.contentStart; i < len; i++) {
      const char = this.buffer.charAt(i)
      if (char === '>' && !bracketDepth) {
        this.contentEnd = i
        this.consumed = i + 1
        return true
      } else if (char === '[') {
        bracketDepth++
      } else if (char === ']') {
        bracketDepth--
      }
    }
    return false
  }
}

class ScriptToken extends Token {
  name = 'script'
  startText = '<script'
  endText = '</script>'
  format (content) {
    content = this.startText + content + this.endText
    return { content }
  }
}

class TagOpenToken extends Token {
  name = 'tagOpen'
  startText = '<'
  endText = '>'

  changeType (content) {
    if (content.startsWith('script')) return 'script'
  }

  format (content) {
    content = content.trim()
    const data = {}
    if (content.endsWith('/')) {
      data.selfClose = true
      content = content.slice(0, -1)
    }
    data.type = content

    const len = content.length
    for (let i = 0; i < len; i++) {
      if (isWhitespace(content.charAt(i))) {
        data.type = content.slice(0, i)
        data.attr = content.slice(i).trim()
        break
      }
    }
    return data
  }
}

class FuzzyTagOpenToken extends TagOpenToken {
  // permits '<' in the attributes inside quotes
  matchesEnd () {
    const len = this.buffer.length
    let quote = ''
    for (let i = this.contentStart; i < len; i++) {
      const char = this.buffer.charAt(i)
      if (quote) {
        if (char === quote) quote = ''
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (char === '>') {
        this.contentEnd = i
        this.consumed = i + 1
        return true
      }
    }
    return false
  }
}

class TagCloseToken extends Token {
  name = 'tagClose'
  startText = '</'
  endText = '>'
  format (content) {
    return { type: content.trim() }
  }
}

// Tokenizer
//
// Instances of this class turn an XML stream into tokens which
// are then emitted to the listener
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

export default class Tokenizer extends Emitter {
  #buffer = ''
  #pos = 0
  #token
  #tokenTypes = {
    text: TextToken,
    pi: PIToken,
    cdata: CDataToken,
    comment: CommentToken,
    dtd: DTDToken,
    script: ScriptToken,
    tagOpen: FuzzyTagOpenToken,
    tagClose: TagCloseToken
  }

  constructor (opts = {}) {
    super()
    if (opts.simpleTagOpen) {
      this.#tokenTypes.tagOpen = TagOpenToken
    }
  }

  // ---------------------------------------------------
  //
  // Emit & listen
  //

  onAll (callback) {
    return super.onAll(Object.keys(this.#tokenTypes), callback)
  }

  // ---------------------------------------------------
  //
  // Getters & setters
  //

  get buffer () {
    return this.#buffer
  }

  get atEOD () {
    return !this.buffer.trim()
  }

  get pos () {
    return this.#pos
  }

  // ---------------------------------------------------
  //
  // Push & parse
  //

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
    if (this.#token) return this.#parseToken()
    const len = this.#buffer.length
    if (!len) return undefined

    let char = this.#buffer.charAt(0)

    if (char !== '<') return this.#selectToken('text')

    if (len < 2) return undefined
    char = this.#buffer.charAt(1)

    if (char === '?') return this.#selectToken('pi')

    // CDATA, Comment, DTD - all start with !
    if (char === '!') {
      if (len < 3) return undefined
      char = this.#buffer.charAt(2)
      if (char === '[') return this.#selectToken('cdata')
      if (char === '-') return this.#selectToken('comment')
      return this.#selectToken('dtd')
    }

    if (char === '/') return this.#selectToken('tagClose')

    return this.#selectToken('tagOpen')
  }

  #parseToken () {
    const tok = this.#token
    try {
      const result = tok.parse(this.#buffer)
      if (!result) return undefined
      if (result.tokenType) return this.#selectToken(result.tokenType)
      this.#token = undefined
      this.emit(tok.name, result.data)
      return result.consumed
    } catch (err) {
      err.pos = this.#pos
      throw err
    }
  }

  #selectToken (tokenType) {
    const Type = this.#tokenTypes[tokenType]
    this.#token = new Type()
    return this.#parseToken()
  }
}
