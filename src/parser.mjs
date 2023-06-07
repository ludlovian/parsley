const STATES = 'text|name|ws|close|attr|value|dqvalue|sqvalue|pi'.split('|')
const S = Object.fromEntries(STATES.map((s, i) => [s, i]))
const DEBUG = false

function nextState (s, c) {
  if (s === S.text) {
    // In text
    if (c === '<') return S.name
  } else if (s === S.name) {
    // Gathering tag name
    if (c === '>') return S.text
    if (c === '/') return S.close
    if (c === ' ') return S.ws
    if (c === '?') return S.pi
  } else if (s === S.ws) {
    // in whitespace in tag
    if (c === '>') return S.text
    if (c === '/') return S.close
    if (c !== ' ') return S.attr
  } else if (s === S.close) {
    // in a closing or selfclose tag
    if (c === '>') return S.text
  } else if (s === S.attr) {
    // gathering an attribute name
    if (c === '=') return S.value
    if (c === ' ') return S.ws
    if (c === '>') return S.text
  } else if (s === S.value) {
    // at the start of a value
    if (c === '"') return S.dqvalue
    if (c === "'") return S.sqvalue
  } else if (s === S.dqvalue) {
    // double-quoted value
    if (c === '"') return S.ws
  } else if (s === S.sqvalue) {
    // single-quoted value
    if (c === "'") return S.ws
  } else if (s === S.pi) {
    // in a processing instruction
    if (c === '>') return S.text
  }
  return s
}

function transition (ctx, from, to) {
  const { stack, buffer, curr } = ctx
  ctx.buffer = ''
  if (from === S.text) {
    // commit the text as a child
    if (buffer) ctx.curr[2].push(buffer)
  } else if (from === S.name) {
    // got tag name
    if (to === S.close) {
      assert(!buffer, 'Invalid character')
    } else if (to === S.pi) {
      assert(!buffer, 'Invalid character')
    } else {
      // open new tag
      stack.push(curr)
      ctx.curr = [buffer, {}, []]
    }
  } else if (from === S.close) {
    // close tag
    const prev = stack.pop()
    assert(!buffer || buffer === curr[0], 'Unmatching close')
    prev[2].push(ctx.h(...curr))
    ctx.curr = prev
  } else if (from === S.ws) {
    // starting a prop name
    if (to === S.attr) ctx.buffer = ctx.char
  } else if (from === S.attr) {
    // the start of value
    const attr = ctx.curr[1]
    ctx.key = buffer
    attr[buffer] = true
  } else if (from === S.dqvalue || from === S.sqvalue) {
    const attr = ctx.curr[1]
    attr[ctx.key] = buffer
  }
}

export default function parser (xml) {
  const ctx = {
    h: this,
    stack: [],
    buffer: '',
    curr: ['', {}, []]
  }
  let state = S.text
  let i
  try {
    for (i = 0; i < xml.length; i++) {
      ctx.char = xml[i]
      const next = nextState(state, ctx.char)
      if (next !== state) transition(ctx, state, next)
      else ctx.buffer += ctx.char
      /* c8 ignore next 5 */
      if (DEBUG) {
        const { buffer, curr, stack } = ctx
        const data = JSON.stringify({ buffer, curr, stack })
        console.log(ctx.char, STATES[state], STATES[next], data)
      }
      state = next
    }
    assert(state === S.text, 'Unclosed tag')
    assert(!ctx.stack.length, 'Unclosed document')
    const elems = ctx.curr[2]
    if (ctx.buffer) elems.push(ctx.buffer)
    return elems.length < 2 ? elems[0] : elems
  } catch (err) {
    err.message += ` char "${xml[i]}" at pos ${i + 1}`
    throw err
  }
}

function assert (ok, msg) {
  if (!ok) throw new Error(msg)
}
