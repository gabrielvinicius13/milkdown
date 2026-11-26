if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}

Object.defineProperty(Element.prototype, 'getClientRects', {
  value() {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* iterate() {},
    }
  },
})

Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  value() {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }
  },
})

Object.defineProperty(Range.prototype, 'getClientRects', {
  value() {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* iterate() {},
    }
  },
})

Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
  value() {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }
  },
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value() {},
})
