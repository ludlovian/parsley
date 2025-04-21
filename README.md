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

It has three read only properties:
- `type` a string with the element type
- `attr` an object of the attribute key/values
- `children` an array of [`Parsley` | `ParsleyText`]

Attribute values and text elements have the basic XML entities decoded.

### Parsley.from(xml, options) => Parsley

Parses the xml and returns the Parsley.

Parsleys created from xml have laziness built in. In particular, the atributes
and text are not decoded unless accessed. This allows most of the XML to be
skipped over quickly.

NB the API has changed a bit - oops.

#### Options

Valid options are:
#### safe
if set, any errors will not throw but result in `null` being returned

#### simpleTagOpen
Normally, tag opens check for `>` not inside quotes to cope with unescaped
close bracket being in attributes.

This turns that off, replacing it instead with a simple search for `>`. This
copes with unmatched quotes at the risk of a bracket in attributes. Neither
should really happen, but the world is imperfect.

#### allowUnclosed
Permits closing tags to be assumed if missing, eg `<a><b></a>`

#### html
Assumes the known HTML void tags are self closing, eg `<link>` becomes `<link />`

#### loose
A loosey-goosey mode which includes `simpleTagOpen`, `allowUnclosed` and `html` but also
accepts unfinished XML and returns the best it can. Never throws anything

### Parsley.create(type, attr, children)

Creates one manually

### .add(stringOrParsley)

Adds a child to the current Parsley. Strings are automatically
wrapped in a ParsleyText

### .isElement

Returns `true`. Allows you to see if this is a `Parsley` or
`ParsleyText`

### .getText() => string|undefined

Returns all the text elements under this one (or its children)
joining them all together.

Really a convenience for:
```
this.walk()
    .filter(p => !p.isElement)
    .map(p => p.toText())
    .toArray()
```

### .toXml() => String

Rebuilds the xml representation

### .clone() => Parsley

Produces a clone

### .trim() => Parsley

Produces a clone with no extraneous whitespace

### * .walk() => <iterator>

Returns an `Iterator` which will walk over this element and
all its descendants recursively. Can then be used with 
standard iterator operators

### .find(type) => Parsley|undefined

Finds the first element of the given type. If `type.class`
is given, it will look for the first type with the given class

Just another convernience around `.walk`

### .find(type) => [Parsley]

Like `.find` but finds all the elements matching the type (and class).
