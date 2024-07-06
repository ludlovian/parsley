import Tokenizer from './tokenizer.mjs'
import { MismatchedClose, UnclosedTag, UnexpectedEOF } from './errors.mjs'

const HTML_VOID_TAGS = new Set([
  ...['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img'],
  ...['input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']
])

export default class Parser {
  #tokenizer
  #loose
  #root
  #current
  #voidTags
  #stack = []

  constructor (opts = {}) {
    const {
      newElem,
      newRawText,
      newText,
      allowUnclosed,
      loose,
      html,
      ...rest
    } = opts
    this.#tokenizer = new Tokenizer(rest)
    this.#loose = loose
    if (html) this.#voidTags = HTML_VOID_TAGS

    this.#tokenizer
      .on('text', ({ content }) => {
        if (!this.#current) return
        this.#current.add(newRawText(content))
      })
      .on('cdata', ({ content }) => {
        if (!this.#current) return
        this.#current.add(newText(content))
      })
      .on('tagOpen', ({ type, attr, selfClose }) => {
        if (this.#voidTags && this.#voidTags.has(type)) selfClose = true
        const p = newElem(type, attr ?? '')
        this.#root ??= p
        if (this.#current) this.#current.add(p)
        if (!selfClose) {
          if (this.#current) this.#stack.push(this.#current)
          this.#current = p
        }
      })
      .on('tagClose', ({ type }) => {
        while (true) {
          if (this.#current && this.#current.type === type) {
            this.#current = this.#stack.pop()
            return
          } else if ((allowUnclosed || loose) && this.#current) {
            this.#current = this.#stack.pop()
          } else {
            if (loose) return
            throw new MismatchedClose(type)
          }
        }
      })
  }

  push (xml) {
    this.#tokenizer.push(xml)
    return this
  }

  end () {
    if (this.#loose) return this.#root
    if (this.#current) throw new UnclosedTag(this.#current.type)
    if (!this.#tokenizer.atEOD) throw new UnexpectedEOF()
    return this.#root
  }
}
