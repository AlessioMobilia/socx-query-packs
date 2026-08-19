# Contributing

Thanks for adding a query. A few rules keep this repository usable by people who
will paste its output straight into a production SIEM.

## Never commit

- customer names, internal hostnames, internal IP ranges, usernames
- API keys, tenant ids, workspace ids
- anything copied out of a real incident without sanitising it

Examples use documentation ranges (`203.0.113.0/24`, `198.51.100.0/24`,
`192.0.2.0/24`) and `example.com`.

## Before opening a pull request

```bash
node scripts/validate.mjs
```

The validator must pass with zero errors. It checks dialect references, group
paths, placeholder and filter names, indicator bindings, the `kind` versus
folder match, and that `index.json` agrees with the files on disk.

## What makes a query mergeable

1. **It ran.** State in the pull request which platform and version you ran it
   against. If you could not run it, set `"verified": false` on the pack and say
   so — an honest starting point is welcome, a guess presented as tested is not.
2. **It projects useful columns.** Timestamp, host, user, process, the matched
   value. Not `*`.
3. **It has a description.** One or two sentences on what question it answers
   and what noise to expect.
4. **It is named after the question**, not after the table.
5. **Its exclusions are explained.** If you filter out a noisy process, say why
   in a comment inside the query.

## Adding a platform

1. Add the dialect to `dialects/dialects.json` if the language is new. Pick one
   of the six existing escape strategies — new escaping code belongs in the
   extension, not in a pack.
2. Create `packs/ioc/<platform>.json` and/or `packs/standard/<platform>.json`.
3. Declare `groups` so the templates land in a sensible menu.
4. Add the entry to `index.json` with the exact template count.
5. Run the validator.

## Style

- English for names, descriptions and comments.
- Two space indentation in JSON.
- Template and group ids in `lowercase-with-dashes`.
- Keep group labels short: they have to fit inside a context menu.

## Provenance

If a query comes from published research or another open repository, add a
`reference` URL to the template and keep the original licence in mind. Do not
copy content that is not licensed for redistribution.
