const AMP = '&'
const DQ = '"'
const SQ = "'"
const EQ = '='

const decodes = [
  ['&amp;', '&'],
  ['&gt;', '>'],
  ['&lt;', '<'],
  ['&apos;', "'"],
  ['&quot;', '"']
]

export function isWhitespace (c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r'
}

const encodeChar = (() => {
  const encodes = Object.fromEntries(
    decodes.map(([code, char]) => [char, code])
  )
  return x => encodes[x]
})()

export function decodeEntities (buffer) {
  // shortcut
  if (buffer.indexOf(AMP) === -1) return buffer

  let out = ''
  while (buffer.length !== 0) {
    const ix = buffer.indexOf(AMP)
    if (ix === -1) {
      out = out + buffer
      break
    }

    if (ix > 0) out = out + buffer.slice(0, ix)

    let found = false
    for (const [code, value] of decodes) {
      if (buffer.slice(ix, ix + code.length) === code) {
        out += value
        buffer = buffer.slice(ix + code.length)
        found = true
        break
      }
    }
    if (!found) {
      // A code, but an unknown one, so we simply add in the '&' and carry on
      out += AMP
      buffer = buffer.slice(ix + 1)
    }
  }
  return out
}

export function encodeEntities (buffer) {
  const len = buffer.length
  let out = ''
  let start = 0
  for (let i = 0; i < len; i++) {
    const c = buffer.charAt(i)
    const code = encodeChar(c)
    if (code) {
      out += buffer.slice(start, i) + code
      start = i + 1
    }
  }
  if (start < len) out += buffer.slice(start)
  return out
}

export function decodeAttributes (buffer) {
  if (!buffer) return {}

  // first we split by whitespace outside quotes
  const len = buffer.length
  let quote = ''
  const arr = []
  let j = 0
  for (let i = 0; i < len; i++) {
    const c = buffer.charAt(i)
    if (quote) {
      if (quote === c) quote = ''
    } else if (c === SQ || c === DQ) {
      quote = c
    } else if (isWhitespace(c)) {
      arr.push(buffer.slice(j, i))
      j = i + 1
    }
  }
  if (j < len) arr.push(buffer.slice(j))

  // now we remove blank and process each on
  const attrs = {}
  for (const kvLine of arr.map(x => x.trim()).filter(Boolean)) {
    const ix = kvLine.indexOf(EQ)
    if (ix === -1) {
      attrs[kvLine] = true
      continue
    }
    const key = kvLine.slice(0, ix)
    let value = kvLine.slice(ix + 1)
    const first = value.at(0)
    const last = value.at(-1)
    if ((first === DQ && last === DQ) || (first === SQ && last === SQ)) {
      value = value.slice(1, -1)
    }
    attrs[key] = value
  }
  return attrs
}
