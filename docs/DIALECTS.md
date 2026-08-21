# Dialects

A **dialect** is a query *language*, not a product. Three levels are kept apart
on purpose:

| Level | What it is | Example |
|---|---|---|
| Dialect | the syntax rules of a language | `kql`, `spl`, `udm` |
| Target | a console where that language is spoken | Defender XDR, `splunk.corp.local` |
| Pack | templates written for one dialect | *Defender XDR — IOC hunting* |

Defender XDR and Sentinel share the `kql` dialect but need different packs,
because their tables and fields differ. Elastic alone speaks three of them.

## Why the record exists

The dialect is the only place where correctness-critical logic lives. It answers
four questions the template author should never have to think about:

1. how a value is quoted and escaped
2. how a list of values is rendered
3. whether the time window belongs in the query text at all
4. how long a query is allowed to get

## Fields

```jsonc
{
  "id": "kql",
  "label": "Kusto Query Language (Microsoft)",
  "vendors": ["Microsoft Defender XDR", "Microsoft Sentinel"],
  "statementStyle": "piped",        // piped | sql | boolean
  "escape": "backslash",            // fixed enum, see below
  "quote": "\"",
  "listStrategy": "in-operator",    // in-operator | or-expansion | regex-alternation
  "listOpen": "(", "listClose": ")", "separator": ", ",
  "operators": { "equals": "==", "in": "in~", "contains": "has_any", "regex": "matches regex",
                 "and": "and", "or": "or", "not": "not" },
  "comment": "// ",
  "timeInQuery": true,
  "timeExpression": "ago({{value}})",
  "caseInsensitive": "~",
  "maxItems": 100,
  "maxLength": 8000
}
```

### `escape` — a fixed list, on purpose

| Strategy | Rule | Used by |
|---|---|---|
| `backslash` | backslash-escape the quote and the backslash inside double quotes | KQL, SPL, LogScale, XQL, ES\|QL, S1QL |
| `sql-quote` | double the single quote | AQL, SQL |
| `lucene` | backslash-escape `+ - && \|\| ! ( ) { } [ ] ^ " ~ * ? : \ /` | Lucene, Kibana KQL, Trend, Graylog |
| `regex` | escape every regex metacharacter | grep, PowerShell, regex filters |
| `json` | JSON string escaping | API payload templates |
| `none` | no escaping — numeric or enumerated values only | NetWitness meta lists |

A pack may define a new dialect, but it must pick one of these strategies. It
cannot ship its own escaping code. Otherwise a remote pack could declare a
dialect with no escaping at all and inject arbitrary conditions into queries the
analyst pastes into a production SIEM.

### `listStrategy` — three shapes cover every language

| Strategy | Rendered as | Used by |
|---|---|---|
| `in-operator` | `f in ("a", "b")` | KQL, SPL, XQL, AQL, ES\|QL, FortiSIEM, LEQL |
| `or-expansion` | `(f = "a" OR f = "b")` | UDM, Lucene, ArcSight, Trend |
| `regex-alternation` | `f = /(a\|b)/` | LogScale, grep, PowerShell |

### `timeInQuery`

Some consoles take the time window from their own picker. Forcing a time filter
into the query text is wrong there and sometimes a syntax error. Chronicle,
Cortex XDR, LogScale, Elastic Discover and Trend all set `timeInQuery: false`.

## Shipped dialects

| id | Language | Platforms |
|---|---|---|
| `kql` | Kusto Query Language | Defender XDR, Sentinel, Azure Data Explorer |
| `spl` | Search Processing Language | Splunk Enterprise, Splunk Cloud |
| `udm` | UDM Search | Google SecOps / Chronicle |
| `yaral` | YARA-L 2.0 | Google SecOps detection rules (export target) |
| `logscale` | LogScale Query Language | CrowdStrike Falcon LogScale, NG-SIEM, Humio |
| `xql` | XQL | Cortex XDR, Cortex XSIAM |
| `aql` | Ariel Query Language | IBM QRadar |
| `lucene` | Lucene | Elasticsearch, Kibana, OpenSearch, Graylog, Carbon Black |
| `es-kql` | Kibana Query Language | Elastic — **not** the Microsoft KQL |
| `esql` | ES\|QL | Elasticsearch 8.11+ |
| `fortisiem` | Analytics filter | FortiSIEM |
| `trend-v1` | Vision One Search | Trend Micro Vision One / XDR |
| `s1ql` | Deep Visibility | SentinelOne Singularity |
| `leql` | Log Entry Query Language | Rapid7 InsightIDR, InsightOps |
| `sumo` | Sumo Logic search | Sumo Logic |
| `devo` | LINQ | Devo |
| `spotter` | Spotter | Securonix |
| `ccl` | Common Condition Language | ArcSight ESM, Logger |
| `nwql` | NetWitness query | RSA NetWitness |
| `sql` | SQL (osquery style) | Sophos Live Discover, osquery, Fleet, Velociraptor |
| `regex` | Regular expression | grep, ripgrep, any text log |
| `powershell` | PowerShell | Windows hosts |

> **Naming collision worth remembering.** `kql` is Microsoft's Kusto. `es-kql`
> is Elastic's Kibana Query Language. Three identical letters, two unrelated
> languages. Packs must not mix them up.

## Adding a dialect

Append an object to `dialects/dialects.json`, then add at least one template
that exercises it — `scripts/validate.mjs` will not let a dialect be referenced
before it exists, and CI runs the validator on every pull request.
