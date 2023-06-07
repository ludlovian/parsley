const STATES = 'text|name|ws|close|attr|value|dqvalue|sqvalue'.split('|')
const S = Object.fromEntries(STATES.map((s, i) => [s, i]))

function nextState (s, c) {
  if (s === S.text) {
    if (c === '<') return S.name
  } else if (s === S.name) {
    if (c === '>') return S.text
    if (c === '/') return S.close
    if (c === ' ') return S.ws
  } else if (s === S.ws) {
    if (c === '>') return S.text
    if (c === '/') return S.close
    if (c !== ' ') return S.attr
  } else if (s === S.close) {
    if (c === '>') return S.text
  } else if (s === S.attr) {
    if (c === '=') return S.value
    if (c === ' ') return S.ws
    if (c === '>') return S.text
  } else if (s === S.value) {
    if (c === '"') return S.dqvalue
    if (c === "'") return S.sqvalue
  } else if (s === S.dqvalue) {
    if (c === '"') return S.ws
  } else if (s === S.sqvalue) {
    if (c === "'") return S.ws
  }
  return s
}

function transition (ctx, from, to) {
  const { stack, buffer, curr } = ctx
  ctx.buffer = ''
  if (from === S.text) {
    if (buffer) ctx.curr[2].push(buffer)
  } else if (from === S.name) {
    if (to === S.close) {
      assert(!buffer, 'Invalid character')
    } else {
      stack.push(curr)
      ctx.curr = [buffer, {}, []]
    }
  } else if (from === S.close) {
    const prev = stack.pop()
    assert(!buffer || buffer === curr[0], 'Unmatching close')
    prev[2].push(ctx.h(...curr))
    ctx.curr = prev
  } else if (from === S.ws) {
    if (to === S.attr) ctx.buffer = ctx.char
  } else if (from === S.attr) {
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
      /* {
        const { buffer, curr, stack } = ctx
        const data = JSON.stringify({ buffer, curr, stack })
        console.log(ctx.char, STATES[state], STATES[next], data)
      } */
      state = next
    }
    assert(state === S.text, 'Unclosed tag')
    assert(!ctx.stack.length, 'Unclosed document')
    return ctx.curr[2][0]
  } catch (err) {
    err.message += ` char "${xml[i]}" at pos ${i + 1}`
    throw err
  }
}

function assert (ok, msg) {
  if (!ok) throw new Error(msg)
}
