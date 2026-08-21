# SOCx query packs

Ready to run hunting queries for the platforms a SOC actually uses, packaged in
a small declarative format that the
[SOCx browser extension](https://github.com/AlessioMobilia/SOCx) loads by
default.

Two things live here:

- **IOC packs** — take a list of indicators and produce the query that looks for
  them, in the right field, for the right platform.
- **Standard packs** — hunting queries that need no indicator at all: encoded
  PowerShell, Office spawning a shell, password spraying, inbox forwarding
  rules, cleared event logs.

Everything is data. There is no executable content in a pack, by design.

---

## What is in the box

| | Count |
|---|---|
| Query languages (dialects) | **22** |
| Packs | **14** |
| Templates | **139** |

### Platforms

| Platform | IOC pack | Standard pack | Dialect |
|---|---|---|---|
| Microsoft Defender XDR | ✅ 12 | ✅ 17 | `kql` |
| Microsoft Sentinel | ✅ 9 | ✅ 12 | `kql` |
| Splunk | ✅ 10 | ✅ 13 | `spl` |
| Google SecOps (Chronicle) | ✅ 8 | ✅ 3 | `udm` |
| CrowdStrike Falcon LogScale / NG-SIEM | ✅ 6 | ✅ 3 | `logscale` |
| Palo Alto Cortex XDR / XSIAM | ✅ 6 | ✅ 2 | `xql` |
| Elastic Security | ✅ 6 | ✅ 3 | `esql`, `lucene` |
| IBM QRadar | ✅ 2 | — | `aql` |
| FortiSIEM | ✅ 5 ⚠️ | — | `fortisiem` |
| Trend Vision One | ✅ 7 ⚠️ | — | `trend-v1` |
| SentinelOne | ✅ 3 | — | `s1ql` |
| Rapid7 InsightIDR, Sumo Logic, Devo, Securonix, ArcSight, NetWitness, Graylog | ✅ | — | various |
| osquery / Sophos Live Discover, grep, ripgrep, PowerShell | ✅ | — | `sql`, `regex`, `powershell` |

⚠️ = shipped as `verified: false`. FortiSIEM and Trend Vision One attribute
names vary by release and by parser, so those templates are a starting point to
validate against your own tenant, not a guarantee. Everything else uses
documented, stable field names.

---

## Using it

### From the extension

The catalogue is preconfigured in SOCx. Nothing to do: open the query palette
and start typing.

To pin a specific release instead of tracking `main`, replace the source URL in
**Options → Query packs** with a tag:

```
https://raw.githubusercontent.com/AlessioMobilia/socx-query-packs/v1.0.0/index.json
```

### Your own packs

Add any URL that serves a valid `index.json` or a single pack file — a GitHub or
GitLab repository (public or private with a token), a gist, or an internal HTTP
server. SOCx rewrites `blob` links to their raw form for you, so pasting the URL
from the browser address bar works.

Internal GitLab is supported: the rewrite is based on the `/-/blob/` path, not
on the hostname.

### Writing a pack without writing JSON

SOCx ships a rule builder: compose a template with a form, preview the rendered
query against sample indicators, save it to your personal library, then
**Export pack** to get a file that is valid against this repository's schema.
Send it as a pull request, or host it for your own team.

---

## Contributing

Pull requests welcome, especially for the platforms marked ⚠️ and for languages
that are not covered yet.

```bash
node scripts/validate.mjs
```

The validator checks what a JSON Schema cannot: that referenced dialects exist,
that group paths resolve, that placeholders and filters are known, that every
indicator template actually binds its types, and that `index.json` matches the
files on disk. CI runs it on every pull request.

Read [CONTRIBUTING.md](CONTRIBUTING.md) first — in particular the rule about
never committing customer data or internal hostnames.

---

## Documentation

| Document | What it covers |
|---|---|
| [docs/SCHEMA.md](docs/SCHEMA.md) | every field of the index, pack and template, plus the trust model |
| [docs/TEMPLATE-SYNTAX.md](docs/TEMPLATE-SYNTAX.md) | placeholders, filters, escaping, chunking, per type bindings |
| [docs/DIALECTS.md](docs/DIALECTS.md) | what a dialect is, the six escape strategies, the 22 shipped languages |
| [docs/AUTHORING.md](docs/AUTHORING.md) | groups and subgroups, writing good queries, the builder, the checklist |

---

## Safety notes

A query pack is fetched over the network and produces text that an analyst
pastes into a production SIEM. That is a real trust boundary, and the format is
built around it:

- packs contain **no code** — escaping strategies are identifiers resolved
  inside the extension, so a pack cannot ship or weaken its own escaping
- `open` URLs **never fire automatically**; the analyst clicks and the
  destination host is approved once per pack
- sources are **pinned by content hash**, and a change is shown as a diff before
  it is adopted
- ids are **namespaced per source**, so a remote pack cannot silently shadow a
  built-in or a personal template

Read the queries before you run them. They are short on purpose.

---

## Licence

MIT — see [LICENSE](LICENSE). Queries derived from published research carry a
`reference` field pointing at the original source.
