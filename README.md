# Parsley
Ultra-light xml parser

## Why?

For myself. To simply parse XML responses in JS.

The underlying parser is a very simplt state machine. It will throw on bad XML,
but doesn't cope with anything other than plain vanilla.

## Parsley

A simple _whole-text-at-a-time_ approach.

```
import Parsley from 'scrapie/parsley'

const p = Parsley.from(xmlText)
```

A Parsley is simply an object representing the XML element from
opening tag to the end of the closing tag.

It has three properties:
- `type` a string
- `attr` an object
- `children` an array of Parsley objects and/or strings

### .text => String

The first text element in this Parsley

### .textAll => [String, ...]

An array of all the text elements in it

### .xml() => String

Rebuilds the xml representation

### .find(condition) => Parsley | null

Finds the first child (or grand...-child) matching the condition.
If there is no such then it returns `null`.

If the condition is a string, then it is simply a match on the `type`.

### .findAll(condition) => [Parsley,...]

Returns an array of all the matching children as Parsleys.
