// A DataString is an encapsulation of a string, to be read sequentially
// as data.
//
// It has a peek method (next) and read methods including reading while
// a condition is met, or until a condition is met

export default class DataString {
  constructor (data) {
    this.pos = 0
    this.data = data
    this.len = data.length
  }

  get atEOF () {
    return this.pos >= this.len
  }

  next (numChars = 1) {
    const { pos, data } = this
    return data.slice(pos, pos + numChars)
  }

  read (numChars = 1) {
    const { pos, data, len } = this
    if (pos + numChars > len) throw new DataString.UnexpectedEOF()
    this.pos += numChars
    return data.slice(pos, this.pos)
  }

  readWhile (chars) {
    // Reads the string whilst the current character is one of the given ones
    // It returns all those read, and will end on the first non-matching
    // char
    //
    const { data, pos, len } = this
    for (let i = pos; i < len; this.pos = ++i) {
      if (!chars.includes(data[i])) {
        return data.slice(pos, i)
      }
    }
    throw new DataString.UnexpectedEOF()
  }

  readUntilOneOf (chars, { allowEOF = false } = {}) {
    // Reads the string until it hits one of the terminating characters
    // Returns the chars read, not including the terminator, leaving the
    // string pointing at the matching char
    //
    const { data, pos, len } = this
    for (let i = pos; i < len; this.pos = ++i) {
      if (chars.includes(data[i])) return data.slice(pos, i)
    }
    if (!allowEOF) throw new DataString.UnexpectedEOF()
    return data.slice(pos)
  }

  readUntilExact (match) {
    // Reads until it meets the exact terminating string.
    // Returns the characters read, without the termination. But it
    // advances past the terminator.
    //
    const { data, pos, len } = this
    const n = match.length
    for (let i = pos; i <= len - n; this.pos = ++i) {
      if (data.slice(i, i + n) === match) {
        this.pos = i + n
        return data.slice(pos, i)
      }
    }
    throw new DataString.UnexpectedEOF()
  }

  static UnexpectedEOF = class UnexpectedEOF extends Error {
    // ignored because parser.mjs uses its own errors, so this one
    // gets replaced at runtime.
    //
    /* c8 ignore next 3 */
    constructor () {
      super('Unexpected EOF')
    }
  }
}
