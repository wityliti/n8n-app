# n8n-nodes-afforestation

Plant trees and record climate impact on [Afforestation.org](https://afforestation.org) from your n8n workflows.

This package contains two nodes:

- **Afforestation**: plant trees, record impact, and get your impact stats.
- **Afforestation Trigger**: start a workflow when new impact is recorded or your totals change.

## Installation

In n8n, go to **Settings > Community Nodes > Install** and enter `n8n-nodes-afforestation`.

See n8n's [community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/) for self-hosted setups.

## Credentials

1. In your Afforestation.org company dashboard, open **API Keys** and create a key. It starts with `afor_`.
2. Give the key the scopes for what you will use:

   | Scope | Needed for |
   |---|---|
   | `trees:plant` | Plant Trees |
   | `impact:write` | Record Impact |
   | `impact:read` | Afforestation Trigger: New Impact Entry |
   | `stats:read` | Get Stats, Afforestation Trigger: Stats Changed, and the credential test |

3. In n8n, create an **Afforestation API** credential and paste the key. Leave **Base URL** as `https://afforestation.org` unless you use a staging environment.

## Operations

### Afforestation

| Operation | What it does |
|---|---|
| Plant Trees | Plants 1 to 10,000 trees for your company. You can attach a reference ID, a reference type (such as Shopify order) and JSON metadata. |
| Record Impact | Records trees planted, CO₂ offset in kilograms, or both. Use it for impact from other sources. |
| Get Stats | Returns total and monthly trees and CO₂ offset, and your active goal's progress. |

Plant Trees and Record Impact both return the new entry as `id`, `treesPlanted`, `co2OffsetKg` (a number, in kilograms) and `createdAt`.

> **Turn off "Retry On Fail" for Plant Trees and Record Impact.** The API does not de-duplicate requests, so a retry can plant trees twice.

### Afforestation Trigger

The trigger polls Afforestation.org on n8n's polling schedule.

| Event | What it does |
|---|---|
| New Impact Entry | Emits one item per new impact entry, from any source (API, Shopify, dashboard), oldest first. Each entry is emitted once. |
| Stats Changed | Emits your current stats when total trees or total CO₂ offset change. |

When you activate a workflow, the trigger notes where things stand and emits nothing for existing entries. Each poll emits up to 1,000 new entries, oldest first; if more are waiting, the rest come on the next poll. **Fetch Test Event** returns the most recent entry or the current stats without changing what the trigger has seen.

## Development

```bash
npm install
npm test        # unit tests
npm run lint    # n8n's community node rules
npm run dev     # start a local n8n with these nodes linked in
```

## License

[MIT](LICENSE)
