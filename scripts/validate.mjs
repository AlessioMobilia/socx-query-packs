#!/usr/bin/env node
// Dependency free validator for SOCx query packs.
//
// It checks more than the JSON Schema can: that every dialect referenced by a
// template exists, that every group path resolves, that placeholders are known,
// that ioc packs actually bind their indicator types, and that the index is in
// sync with the files on disk.
//
//   node scripts/validate.mjs

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const errors = []
const warnings = []

const fail = (file, message) => errors.push(`${file}: ${message}`)
const warn = (file, message) => warnings.push(`${file}: ${message}`)

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"))
  } catch (error) {
    fail(path, `is not valid JSON — ${error.message}`)
    return null
  }
}

const IOC_TYPES = new Set([
  "IP", "Domain", "URL", "Email", "ASN", "MAC", "CVE",
  "Hash", "SHA256", "SHA1", "MD5"
])

const KNOWN_FILTERS = new Set([
  "raw", "json", "regex", "newline", "or-values", "or-terms",
  "urlencode", "base64", "gzip_base64url", "upper", "lower"
])

const ESCAPE_STRATEGIES = new Set([
  "backslash", "sql-quote", "lucene", "regex", "json", "none"
])

const LIST_STRATEGIES = new Set([
  "in-operator", "or-expansion", "regex-alternation"
])
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

// ---------------------------------------------------------------- dialects

const dialectsFile = "dialects/dialects.json"
const dialectsDoc = readJson(dialectsFile)
const dialects = new Map()

if (dialectsDoc) {
  if (dialectsDoc.schema !== "socx.dialects/v1") {
    fail(dialectsFile, `unexpected schema "${dialectsDoc.schema}"`)
  }
  for (const dialect of dialectsDoc.dialects ?? []) {
    if (dialects.has(dialect.id)) {
      fail(dialectsFile, `duplicate dialect id "${dialect.id}"`)
    }
    if (!ESCAPE_STRATEGIES.has(dialect.escape)) {
      fail(dialectsFile, `dialect "${dialect.id}" uses unknown escape strategy "${dialect.escape}"`)
    }
    if (!LIST_STRATEGIES.has(dialect.listStrategy)) {
      fail(dialectsFile, `dialect "${dialect.id}" uses unknown list strategy "${dialect.listStrategy}"`)
    }
    if (dialect.timeInQuery === true && !dialect.timeExpression) {
      fail(dialectsFile, `dialect "${dialect.id}" declares timeInQuery but no timeExpression`)
    }
    dialects.set(dialect.id, dialect)
  }
}

// ------------------------------------------------------------------- packs

const packFiles = []
for (const kind of ["ioc", "standard"]) {
  const dir = join(root, "packs", kind)
  if (!existsSync(dir)) continue
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith(".json")) {
      packFiles.push(`packs/${kind}/${entry}`)
    }
  }
}

const packsById = new Map()

const collectGroupPaths = (groups = []) => {
  const paths = new Set()
  for (const group of groups) {
    paths.add(group.id)
    for (const child of group.children ?? []) {
      paths.add(`${group.id}/${child.id}`)
    }
  }
  return paths
}

const placeholderPattern = /\{\{([^}]+)\}\}/g

for (const file of packFiles) {
  const pack = readJson(file)
  if (!pack) continue

  if (pack.schema !== "socx.querypack/v1") {
    fail(file, `unexpected schema "${pack.schema}"`)
  }
  if (!pack.id) {
    fail(file, "missing id")
    continue
  }
  if (packsById.has(pack.id)) {
    fail(file, `duplicate pack id "${pack.id}", already used by ${packsById.get(pack.id)}`)
  }
  packsById.set(pack.id, file)

  const expectedKind = file.includes("/ioc/") ? "ioc" : "standard"
  if (pack.kind !== expectedKind) {
    fail(file, `declares kind "${pack.kind}" but lives in the ${expectedKind} folder`)
  }

  if (pack.dialect && pack.dialect !== "multiple" && !dialects.has(pack.dialect)) {
    fail(file, `references unknown dialect "${pack.dialect}"`)
  }

  // JavaScript has no inline regex flags, so a PCRE style (?i) prefix compiles
  // nowhere and would silently never match.
  const pathHint = pack.match?.pathHint
  if (pathHint) {
    if (pathHint.startsWith("(?i)")) {
      fail(file, "pathHint must not use the (?i) inline flag; matching is already case insensitive")
    }
    try {
      new RegExp(pathHint, "i")
    } catch (error) {
      fail(file, `pathHint is not a valid JavaScript regular expression: ${error.message}`)
    }
  }

  for (const pattern of pack.match?.urlPatterns ?? []) {
    try {
      new RegExp(pattern)
    } catch (error) {
      fail(file, `urlPattern is not a valid JavaScript regular expression: ${error.message}`)
    }
  }

  const groupPaths = collectGroupPaths(pack.groups)
  const variableIds = new Set((pack.variables ?? []).map((variable) => variable.id))
  const templateIds = new Set()

  for (const variable of pack.variables ?? []) {
    const label = `variable "${variable.id ?? "<missing id>"}"`
    if (!variable.id || !ID_PATTERN.test(variable.id) || !variable.label) {
      fail(file, `${label} needs a valid id and label`)
    }
    if (variable.type && !["text", "checkbox"].includes(variable.type)) {
      fail(file, `${label} uses unknown input type "${variable.type}"`)
    }
    if (variable.type === "checkbox") {
      if (variable.default && !["true", "false"].includes(variable.default)) {
        fail(file, `${label} checkbox default must be "true" or "false"`)
      }
      if (variable.options?.length) {
        fail(file, `${label} checkbox must not declare options`)
      }
    }
  }

  for (const template of pack.templates ?? []) {
    const label = `template "${template.id ?? "<missing id>"}"`

    if (!template.id) {
      fail(file, "a template has no id")
      continue
    }
    if (templateIds.has(template.id)) {
      fail(file, `duplicate ${label}`)
    }
    templateIds.add(template.id)

    const dialectId = template.dialect ?? pack.dialect
    if (!dialects.has(dialectId)) {
      fail(file, `${label} references unknown dialect "${dialectId}"`)
    }

    if (template.group && !groupPaths.has(template.group)) {
      warn(file, `${label} points at group "${template.group}" which the pack does not declare`)
    }

    const needsIocs = template.requiresIocs !== false
    if (expectedKind === "ioc" && !needsIocs) {
      fail(file, `${label} sets requiresIocs false inside an ioc pack`)
    }
    if (expectedKind === "standard" && needsIocs) {
      fail(file, `${label} must set requiresIocs to false inside a standard pack`)
    }

    if (needsIocs) {
      if (!template.byType || Object.keys(template.byType).length === 0) {
        fail(file, `${label} needs indicators but declares no byType binding`)
      } else {
        for (const type of Object.keys(template.byType)) {
          if (!IOC_TYPES.has(type)) {
            fail(file, `${label} binds unknown indicator type "${type}"`)
          }
        }
      }
    } else if (template.byType) {
      fail(file, `${label} is indicator free but declares byType`)
    }

    // Placeholder checks
    const body = `${template.body ?? ""}\n${template.open ?? ""}`
    let match
    placeholderPattern.lastIndex = 0
    const used = new Set()
    while ((match = placeholderPattern.exec(body)) !== null) {
      const [name, ...filters] = match[1].split("|").map((part) => part.trim())
      used.add(name)

      for (const filter of filters) {
        const filterName = filter.split(":")[0].trim()
        if (!KNOWN_FILTERS.has(filterName)) {
          fail(file, `${label} uses unknown filter "${filterName}"`)
        }
      }

      if (name.startsWith("var:")) {
        const variableId = name.slice(4)
        if (!variableIds.has(variableId)) {
          fail(file, `${label} uses variable "${variableId}" which the pack does not declare`)
        }
        continue
      }

      const known = ["iocs", "ioc", "field", "table", "op", "count", "chunk", "chunks", "now", "query"]
      if (!known.includes(name)) {
        fail(file, `${label} uses unknown placeholder "${name}"`)
      }
    }

    if (needsIocs && !used.has("iocs") && !used.has("ioc")) {
      fail(file, `${label} needs indicators but never renders them`)
    }

    if (used.has("field") || used.has("table") || used.has("op")) {
      for (const [type, binding] of Object.entries(template.byType ?? {})) {
        if (used.has("field") && !binding.field && binding.field !== "") {
          fail(file, `${label} renders {{field}} but type "${type}" has no field`)
        }
        if (used.has("table") && !binding.table) {
          fail(file, `${label} renders {{table}} but type "${type}" has no table`)
        }
        if (used.has("op") && !binding.op && binding.op !== "") {
          fail(file, `${label} renders {{op}} but type "${type}" has no op`)
        }
      }
    }
  }
}

// ------------------------------------------------------------------- index

const indexFile = "index.json"
const index = readJson(indexFile)

if (index) {
  if (index.schema !== "socx.packindex/v1") {
    fail(indexFile, `unexpected schema "${index.schema}"`)
  }
  if (index.dialects !== dialectsFile) {
    fail(indexFile, `dialects path should be "${dialectsFile}"`)
  }

  const listed = new Set()
  for (const entry of index.packs ?? []) {
    listed.add(entry.path)
    if (!existsSync(join(root, entry.path))) {
      fail(indexFile, `entry "${entry.id}" points at a missing file ${entry.path}`)
      continue
    }
    const pack = readJson(entry.path)
    if (!pack) continue
    if (pack.id !== entry.id) {
      fail(indexFile, `entry "${entry.id}" does not match the pack id "${pack.id}"`)
    }
    if (pack.kind !== entry.kind) {
      fail(indexFile, `entry "${entry.id}" declares kind "${entry.kind}" but the pack says "${pack.kind}"`)
    }
    const actual = (pack.templates ?? []).length
    if (entry.templates !== actual) {
      fail(indexFile, `entry "${entry.id}" claims ${entry.templates} templates, the pack has ${actual}`)
    }
  }

  for (const file of packFiles) {
    if (!listed.has(file)) {
      fail(indexFile, `${file} exists on disk but is not listed in the index`)
    }
  }
}

// ------------------------------------------------------------------ report

for (const message of warnings) {
  console.warn(`warning  ${message}`)
}
for (const message of errors) {
  console.error(`error    ${message}`)
}

const packCount = packsById.size
const templateCount = packFiles
  .map((file) => readJson(file))
  .filter(Boolean)
  .reduce((total, pack) => total + (pack.templates ?? []).length, 0)

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s) found.`)
  process.exit(1)
}

console.log(
  `OK — ${dialects.size} dialects, ${packCount} packs, ${templateCount} templates, ${warnings.length} warning(s).`
)
