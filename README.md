# Parsley
Ultra-light html/xml parser

## Why?

For myself. To simply parse HTML/XML responses in JS.

The underlying parser copes with most valid XML, including
- basic elements, attributes & children
- comments
- XML declarations & processing instructions
- CDATA blocks

It does not validate. It doesn't cope with DTDs. It applies no semantic knowledge.

I use it to parse simple XML. And also to build simple XML.

## Parsley

A simple _whole-text-at-a-time_ approach.

```
import Parsley from 'parsley'

const p = Parsley.from(xmlText)
```

A Parsley is simply an object representing the XML element from
opening tag to the end of the closing tag. At the root level, this is simply
the XML document.

It has three properties:
- `type` a string with the element type
- `attr` an object of the attribute key/values
- `children` an array of child Parsley objects and/or strings

Attribute values and text elements have the basic XML entities decoded.

### Parsley.from(xml, options) => Parsley

Parses the xml and returns the Parsley.

#### Options

Valid options are:
- safe (true/false) - if set, then any errors will not throw but result in `null` being returned
- allowUnclosed - if set, this will permit closing tags to be absent, and will assume them where it can

### Parsley.create(type, attr, children)

Creates one manually

### .add(stringOrParsley)

Adds a child to the current Parsley

### .text => String

The first text element in this Parsley

### .textAll => [String, ...]

An array of all the text elements in it

### .xml() => String

Rebuilds the xml representation

### .clone() => Parsley

Produces a clone

### .find(condition, opts) => Parsley | null

Finds the first child (or grand\*-child) matching the condition.
If there is no such then it returns `null`.

If the condition is a regular string, then it is a match on the `type`.


#### Options

##### blank = (true|false)

If set, then `.find` will always return a Parsley - a blank one if the condition
was not found.

### .findAll(condition) => [Parsley,...]

Returns an array of all the matching children as Parsleys, which might be empty


