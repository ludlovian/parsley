// Simple emitter
export default class Emitter {
  #listeners = {}
  on (msg, fn) {
    this.#listeners[msg] = fn
    return this
  }

  onAll (msgs, fn) {
    msgs.forEach(msg => this.on(msg, data => fn(msg, data)))
  }

  emit (msg, data) {
    const fn = this.#listeners[msg]
    if (fn) fn(data)
  }
}
