# Template syntax

A template body is plain text in the target query language, with placeholders
that SOCx fills in. The syntax is deliberately **not** a programming language:
there are no conditionals, no loops and no expressions. A pack is data, never
code — which is what makes it safe to load one from a URL.

If a template needs a branch, write two templates.

## Placeholders

| Placeholder | Rendered as |
|---|---|
| `{{iocs}}` | the indicator list, using the dialect's quoting and list strategy |
| `{{ioc}}` | a single indicator, when the template is rendered once per indicator |
| `{{field}}` | the `field` of the `byType` binding for the type being rendered |
| `{{table}}` | the `table` of the same binding |
| `{{op}}` | the `op` of the same binding |
| `{{var:name}}` | the value of a pack variable, resolved from its default or from what the analyst typed |
| `{{count}}` | how many indicators went into this query |
| `{{chunk}}` / `{{chunks}}` | current chunk number and total, when the list was split |
| `{{now}}` | ISO 8601 timestamp of the moment the query was generated |
| `{{query}}` | only valid inside `open`: the rendered query text |

## Filters

Filters are appended with `|` and change how a value is rendered.

| Filter | Effect | Typical use |
|---|---|---|
| `raw` | no quoting, no escaping | numeric fields, bare tokens |
| `regex` | regex-escape each value and join into `(a\|b\|c)` | grep, Lucene regex, `matches regex` |
| `json` | JSON array | API payloads |
| `newline` | one value per line | lookup files, CSV upload |
| `or-values` | repeat the value with the dialect's `or` operator | UDM, ArcSight, any language without `IN` |
| `or-terms` | bare terms joined with `OR` | full text search operators |
| `upper` / `lower` | case folding | environments that store hashes uppercase |
| `urlencode`, `base64`, `gzip_base64url` | encoding, only valid inside `open` | opening the query in a console |

Filters chain left to right: `{{query|gzip_base64url}}`.

## Escaping

You never escape anything by hand. The dialect declares one of six strategies
and the extension applies it to every value before it reaches the template:

`backslash`, `sql-quote`, `lucene`, `regex`, `json`, `none`.

This matters more than it looks. A domain containing a quote or a backslash that
is not escaped does not merely break the query — it can silently change what the
query means. Because the strategy is an identifier resolved inside the
extension, a pack cannot ship its own escaping and cannot weaken it.

## Chunking

Every dialect declares `maxItems` and `maxLength`. When a list exceeds either,
the engine emits several queries and exposes `{{chunk}}` and `{{chunks}}` so the
template can label them. A template may override the item count with its own
`maxItems`.

## Per type bindings

`byType` maps an indicator type to the place it lives in the data model. Keys
are `IP`, `Domain`, `URL`, `Email`, `ASN`, `MAC`, `CVE`, `SHA256`, `SHA1`, `MD5`
(and `Hash` if you do not care about the algorithm).

```json
"byType": {
  "IP":     { "field": "RemoteIP",  "op": "in~" },
  "Domain": { "field": "RemoteUrl", "op": "has_any" }
}
```

With a mixed workspace the engine renders **one query per bound type present**,
so a list of IPs and domains produces two queries from a single template. Types
that no template binds are reported back to the analyst as uncovered, rather
than silently dropped.

`excludePrivate: true` drops RFC1918 and reserved addresses before rendering.
Use it for egress hunts; leave it off when you are hunting internal hosts.

## Example

```json
{
  "id": "network-contact",
  "name": "Network connections to the indicators",
  "group": "network/egress",
  "byType": {
    "IP":     { "field": "RemoteIP",  "op": "in~" },
    "Domain": { "field": "RemoteUrl", "op": "has_any" }
  },
  "body": "DeviceNetworkEvents\n| where Timestamp > ago({{var:range}})\n| where {{field}} {{op}} ({{iocs}})"
}
```

Rendered for two IPs with `range = 7d`:

```kql
DeviceNetworkEvents
| where Timestamp > ago(7d)
| where RemoteIP in~ ("203.0.113.10", "198.51.100.7")
```
