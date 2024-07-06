export class UnexpectedInput extends Error {
  constructor (xml) {
    super(`Unexpected input: ${xml}`)
  }
}

export class MismatchedClose extends Error {
  constructor (type) {
    super(`Mismatched close: ${type}`)
  }
}

export class UnclosedTag extends Error {
  constructor (type) {
    super(`Unclosed tag: ${type}`)
  }
}

export class UnexpectedEOF extends Error {
  constructor () {
    super('Unexpected EOF')
  }
}
