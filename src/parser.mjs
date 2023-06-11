// import Debug from 'debug'

class StateMachine {
  stateNames = 'text|tagOpen|pi|tagName|tagWS|close|attrName|attrVal|dqVal|sqVal'.split(
    '|'
  )

  states = Object.fromEntries(this.stateNames.map((name, ix) => [name, ix]))

  // debug = Debug('parsley:parser')

  constructor (createElement) {
    this.createElement = createElement
  }

  run (xml) {
    let i
    let state = this.states.text
    let char

    this.stack = []
    this.type = ''
    this.attr = {}
    this.children = []
    this.buffer = ''

    try {
      for (i = 0; i < xml.length; i++) {
        char = xml[i]
        const prevBuffer = this.buffer
        const newState = this.step(state, char)

        if (newState === state) {
          this.buffer += char
        } else if (prevBuffer === this.buffer) {
          this.buffer = ''
        }

        // /* c8 ignore start */
        // if (this.debug.enabled) {
        //   this.debug(
        //     char,
        //     this.stateNames[state],
        //     this.stateNames[newState],
        //     JSON.stringify({
        //       buffer: this.buffer,
        //       curr: [this.type, this.attr, this.children],
        //       stack: this.stack
        //     })
        //   )
        // }
        // /* c8 ignore stop */

        state = newState
      }
    } catch (err) {
      err.message += `(char: "${char}", pos: ${i + 1})`
      throw err
    }

    assert(state === this.states.text, 'Unclosed tag at EOF')
    assert(!this.stack.length, 'Unclosed document at EOF')
    if (this.buffer) this.children.push(this.buffer)
    return this.children.length > 1 ? this.children : this.children[0]
  }

  storeText (text) {
    if (!text) return
    this.children.push(text)
  }

  startElement () {
    const { type, attr, children } = this
    this.stack.push({ type, attr, children })
    this.type = ''
    this.attr = {}
    this.children = []
  }

  endElement () {
    /* c8 ignore next */
    assert(this.stack.length > 0, 'Missing open')
    const parent = this.stack.pop()
    assert(!this.buffer || this.buffer === this.type, 'Unmatched close')
    const elem = this.createElement(this.type, this.attr, this.children)
    parent.children.push(elem)
    Object.assign(this, parent)
  }

  setAttr (name, value) {
    this.key = name
    this.attr[name] = value
  }

  step (s, c) {
    const S = this.states
    if (s === S.text) {
      if (c === '<') {
        this.storeText(this.buffer)
        return S.tagOpen
      }
    } else if (s === S.tagOpen) {
      if (c === '/') return S.close
      if (c === '?') return S.pi
      this.buffer = c
      this.startElement()
      return S.tagName
    } else if (s === S.tagName) {
      this.type = this.buffer
      if (c === '>') return S.text
      if (c === ' ') return S.tagWS
    } else if (s === S.close) {
      if (c === '>') {
        this.endElement()
        return S.text
      }
    } else if (s === S.tagWS) {
      if (c === '>') {
        return S.text
      } else if (c === '/') {
        return S.close
      } else if (c !== ' ') {
        this.buffer = c
        return S.attrName
      }
    } else if (s === S.attrName) {
      if (c === '=') {
        this.setAttr(this.buffer)
        return S.attrVal
      } else if (c === ' ') {
        this.setAttr(this.buffer, true)
        return S.tagWS
      } else if (c === '>') {
        this.setAttr(this.buffer, true)
        return S.text
      }
    } else if (s === S.attrVal) {
      if (c === '"') return S.dqVal
      if (c === "'") return S.sqVal
      assert(false, 'Unquoted attribute value')
    } else if (s === S.dqVal) {
      if (c === '"') {
        this.setAttr(this.key, this.buffer)
        return S.tagWS
      }
    } else if (s === S.sqVal) {
      if (c === "'") {
        this.setAttr(this.key, this.buffer)
        return S.tagWS
      }
    } else if (s === S.pi) {
      if (c === '>') return S.text
    }
    return s
  }
}

function assert (ok, msg) {
  if (!ok) throw new Error(msg)
}

export default function parser (creator) {
  const machine = new StateMachine(creator)
  const parse = xml => machine.run(xml)
  return { parse }
}
