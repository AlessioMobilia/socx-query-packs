# Authoring a pack

## Two kinds, two folders

| Kind | Folder | `requiresIocs` | What it is |
|---|---|---|---|
| `ioc` | `packs/ioc/` | `true` on every template | queries parameterised on a list of indicators |
| `standard` | `packs/standard/` | `false` on every template | hunting queries that take no indicator |

They live apart because SOCx configures them separately: the extension keeps one
list of source URLs for indicator packs and another for standard packs. They
still land in the same palette, tagged by kind, so the analyst searches once.

The validator refuses a pack whose `kind` does not match its folder, and refuses
a template whose `requiresIocs` contradicts the pack kind.

## Groups and subgroups

A pack declares its own menu hierarchy. Two levels are supported: a group and
its children. Templates reference a group by path.

```jsonc
"groups": [
  { "id": "network", "label": "Network", "order": 10,
    "children": [
      { "id": "egress", "label": "Egress and C2" },
      { "id": "dns",    "label": "DNS" }
    ] },
  { "id": "identity", "label": "Identity", "order": 20 }
],

"templates": [
  { "id": "network-contact", "group": "network/egress", "...": "..." },
  { "id": "failed-logons",   "group": "identity",       "...": "..." }
]
```

Rules:

- `order` sorts groups; groups without one sort alphabetically after the ordered ones.
- A template may sit directly in a top level group (`"group": "identity"`).
- A template pointing at an undeclared group is **still shown**, under a group
  synthesised from its path. The validator warns instead of failing, so a typo
  never hides a query from the analyst.
- A template with no `group` lands in *Uncategorised*.
- Groups drive both the palette sections and the context menu submenus, so keep
  labels short — they have to fit in a menu.

## Writing good queries

- **Project the columns an analyst needs to triage**, not `*`. Timestamp, host,
  user, process, and the matched value.
- **Summarise where it helps.** For scoping, one row per host beats a thousand
  raw events. Ship both variants when both are useful.
- **Put the noisy exclusions in the query**, with a comment saying why. A hunt
  nobody can run without editing is a hunt nobody runs.
- **Name the template after the question it answers**, not after the table it
  reads.
- **Fill in `description`.** It is shown in the palette under the name and is
  often the only thing the analyst reads before running.
- Add `mitre` technique ids when they apply, and a `reference` URL when the
  query is derived from published research.

## Marking a pack unverified

Set `"verified": false` at pack level when the field names have not been checked
against a live tenant. FortiSIEM and Trend Vision One ship this way on purpose:
their attribute names vary by release and by parser. The extension shows those
templates with a warning badge instead of pretending they are ready.

Be honest here. A wrong field name that fails loudly costs a minute; one that
silently returns zero rows costs an investigation.

## Building a pack from the extension

You do not have to write JSON by hand. In SOCx, **Options → Query packs →
Rule builder** lets you compose a template with a form — name, group, dialect,
per type bindings, variables, body — with a live preview of the rendered query
against sample indicators.

When you are happy with it:

1. Save it to your personal library, which lives in the extension storage.
2. Use **Export pack** to get a `socx.querypack/v1` file, already valid.
3. Open a pull request here with that file, or host it yourself and add the URL
   to the team's source list.

The builder emits exactly the format this repository validates, so a pack
exported from the extension passes CI unchanged.

## Checklist before opening a pull request

```bash
node scripts/validate.mjs
```

- [ ] `node scripts/validate.mjs` passes
- [ ] pack `id` is unique and stable
- [ ] every template has a `description`
- [ ] the pack is listed in `index.json` with the right template count
- [ ] queries were run against a real tenant, or the pack is marked `verified: false`
- [ ] no customer data, hostnames or internal addresses left in the examples
