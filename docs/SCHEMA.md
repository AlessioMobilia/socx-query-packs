# Pack format reference

Machine readable schema: [`schema/querypack.schema.json`](../schema/querypack.schema.json).
Enforced by [`scripts/validate.mjs`](../scripts/validate.mjs), which checks the
things a JSON Schema cannot — dialect references, group paths, placeholder
names, indicator bindings and index consistency.

## Repository layout

```
index.json                 catalogue fetched first by the extension
dialects/dialects.json     every query language definition
packs/ioc/*.json           indicator parameterised packs
packs/standard/*.json      indicator free hunting packs
schema/*.json              JSON Schema
scripts/validate.mjs       validator, run by CI
```

## Index — `socx.packindex/v1`

The single URL an analyst adds to SOCx. It lists what is available without
forcing the extension to download everything.

| Field | Notes |
|---|---|
| `schema` | `socx.packindex/v1` |
| `dialects` | relative path to the dialect file |
| `packs[]` | `id`, `kind`, `name`, `dialect`, `path`, `templates`, `verified` |

`templates` is the exact count in the pack file; the validator fails if the two
drift apart, which is how a stale index gets caught.

## Pack — `socx.querypack/v1`

| Field | Required | Notes |
|---|---|---|
| `schema` | yes | `socx.querypack/v1` |
| `id` | yes | lowercase, dashes, unique within a source |
| `kind` | yes | `ioc` or `standard`, must match the folder |
| `name` | yes | shown in the palette and in settings |
| `description` | — | shown under the name |
| `dialect` | yes | default dialect id for the templates |
| `vendor`, `author`, `homepage`, `version`, `license` | — | metadata |
| `verified` | — | `false` marks unvalidated field names |
| `match` | — | how the console is recognised: `hostnames`, `urlPatterns`, `pathHint` |
| `targets` | — | named console instances for multi tenant setups |
| `variables` | — | analyst supplied values with defaults and options |
| `groups` | — | two level menu hierarchy, see [AUTHORING](AUTHORING.md) |
| `templates` | yes | at least one |

### `match`

Drives the palette filter and the `documentUrlPatterns` of the context menu, so
the templates for a console only appear on that console.

```jsonc
"match": {
  "hostnames": ["portal.azure.com"],
  "pathHint": "(?i)(sentinel|SecurityInsights)"
}
```

`pathHint` exists because several products share one hostname — Sentinel lives
inside the Azure portal alongside everything else. Internal consoles are added
by the analyst as custom targets in SOCx settings; a pack does not need to know
about them.

### `variables`

```jsonc
{ "id": "range", "label": "Time range", "default": "7d",
  "options": ["24h", "7d", "30d"], "description": "Passed to ago()." }
```

Variables are what make a pack portable between organisations: index names,
table names, time windows and console hostnames belong here, not hard coded in
the body.

## Template

| Field | Required | Notes |
|---|---|---|
| `id` | yes | unique within the pack |
| `name` | yes | the question it answers |
| `description` | — | shown in the palette |
| `group` | — | `parent` or `parent/child` |
| `tags` | — | searched by the palette |
| `dialect` | — | overrides the pack dialect for this template |
| `requiresIocs` | — | defaults to `true`; `false` in standard packs |
| `byType` | when indicators are needed | per type `table`, `field`, `op` |
| `excludePrivate` | — | drop RFC1918 before rendering |
| `body` | yes | the query text with placeholders |
| `open` | — | URL template to open the query in the console |
| `maxItems` | — | overrides the dialect chunk size |
| `reference`, `mitre` | — | provenance and ATT&CK mapping |

Placeholders and filters are documented in
[TEMPLATE-SYNTAX](TEMPLATE-SYNTAX.md); dialects in [DIALECTS](DIALECTS.md).

## Trust model

A pack is fetched over the network, so it is treated as untrusted data:

- **No executable content.** No JavaScript, no expressions, no custom escaping —
  the escape strategy is an identifier resolved inside the extension.
- **Unknown fields are dropped**, not passed through.
- **`open` never fires by itself.** The analyst clicks, the destination host is
  shown, and the host has to be approved once per pack.
- **Content is pinned by hash.** When a source changes, SOCx shows a diff and
  asks before adopting it, instead of updating silently.
- **Namespaced ids.** A remote pack cannot shadow a built-in or a personal
  template; collisions are surfaced, not resolved behind your back.

Pin a source to a tag or a commit rather than to a branch if you want
reproducibility:

```
https://raw.githubusercontent.com/AlessioMobilia/socx-query-packs/v1.0.0/index.json
```
