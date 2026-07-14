# actual-truelayer-sync

Syncs bank and credit card transactions from [TrueLayer](https://truelayer.com/) into [Actual Budget](https://actualbudget.org/). Runs as a scheduled Docker container.

**Supported banks:** Any UK bank supported by TrueLayer's Open Banking or OAuth connections (Monzo, Starling, Barclays, HSBC, Lloyds, NatWest, Santander, and many more).

---

## Prerequisites

- Docker and Docker Compose
- A self-hosted [Actual Budget](https://actualbudget.org/) instance
- A free [TrueLayer developer account](https://console.truelayer.com/)

---

## TrueLayer Setup

1. Sign up at the [TrueLayer Console](https://console.truelayer.com/).
2. Create a new project and switch it from **Sandbox** to **Live** mode to access real bank data.
3. Under **Redirect URIs**, add a redirect URI. The TrueLayer console provides a convenient one you can use:
   ```
   https://console.truelayer.com/redirect-page
   ```
4. Copy your **Client ID** and **Client Secret** — you'll need them shortly.

---

## Docker Setup

Use an immutable `sha-...` image tag from the trusted repository workflow. Create owner-only runtime directories and credential files before starting the container:

```bash
cp compose.example.yml docker-compose.yml
cp example.env .env
install -d -m 0700 data secrets
install -m 0600 /dev/null secrets/actual-session-token
install -m 0600 /dev/null secrets/actual-sync-id
install -m 0600 /dev/null secrets/truelayer-client-secret
```

Populate the three credential files without committing them or placing their values in `.env`. The application rejects symlinks, empty files, and any mode other than `0600`.

Edit `.env` with only non-secret settings:

- `ACTUAL_TRUELAYER_SYNC_IMAGE`: immutable published SHA tag or digest
- `ACTUAL_SERVER_URL`: URL of your Actual Budget instance
- `TRUELAYER_CLIENT_ID`: public identifier from the TrueLayer Console
- `CRON_SCHEDULE`: optional schedule; leave unset through setup and acceptance testing

---

## Adding Your First Bank Connection

The setup script handles the OAuth flow and writes `config.json` and `state.json` into your data directory interactively.

**Run via Docker (recommended):**

```
docker compose run --rm actual-truelayer-sync npm run setup
```

**Run locally** (requires Node 24+):

```
npm install
npm run dev:setup
```

The script will:

1. Ask whether this is a bank account or credit card connection
2. Build a TrueLayer auth URL for you to open in your browser
3. Ask you to paste back the redirect URL after authenticating
4. Let you select which accounts to add and map them to Actual Budget accounts
5. Require an inclusive first-import date for every mapped account
6. Write owner-only `config.json` and `state.json` files to your data directory

Run it again for each additional bank you want to add.

---

## Account Discovery

Use the interactive setup command for OAuth consent, discovery, and mapping. Normal logs deliberately omit TrueLayer and Actual identifiers; manual token exchange and identifier discovery through logs are not supported.

---

## Config Reference

Configuration is split across two files in your data directory.

### `config.json`

Defines which accounts to sync and how. See `config.example.json` for a full example.

| Field                    | Required | Description                                                                                                                                                                                                                                                      |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`                | Yes      | Must be `2`                                                                                                                                                                                                                                                      |
| `includeCategoryInNotes` | No       | Appends TrueLayer transaction category to the notes field (default: `false`)                                                                                                                                                                                     |
| `lookbackDays`           | No       | How many days back to fetch on first sync for an account (default: `14`). Note: TrueLayer currently appears to ignore the `from` date parameter and returns all available transactions regardless — this field is retained in case TrueLayer honour it in future |
| `connections`            | Yes      | Array of bank connections (see below)                                                                                                                                                                                                                            |

**Connection fields:**

| Field      | Required | Description                                                        |
| ---------- | -------- | ------------------------------------------------------------------ |
| `name`     | Yes      | Unique label, used in logs and to match state                      |
| `isCard`   | No       | Set to `true` if this connection is a credit/charge card provider  |
| `accounts` | Yes      | Array of mapped accounts; use interactive setup to create mappings |

**Account fields:**

| Field             | Required | Description                                                                                                         |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `trueLayerId`     | Yes      | TrueLayer `account_id` for this account                                                                             |
| `actualId`        | Yes      | Actual Budget account ID                                                                                            |
| `friendlyName`    | Yes      | Label used in logs                                                                                                  |
| `importStartDate` | Yes      | Inclusive `YYYY-MM-DD` boundary; older provider transactions are always discarded locally                           |
| `flip`            | No       | Inverts transaction amounts. Credit card accounts have amounts flipped automatically; use `flip: false` to override |
| `isCard`          | No       | Overrides the connection-level `isCard` for this specific account                                                   |

### `state.json`

Stores refresh tokens and last sync dates. Writes are atomic and mode `0600`; you should not edit this file manually.

See `state.example.json` for the expected structure.

> **Note:** Both files are excluded from Docker image builds. Mount them via the `./actual-truelayer-sync/data:/app/data` volume in your compose file.

---

## Running

Start the container:

```
docker compose up -d
```

By default the sync runs once on startup and exits. Set `CRON_SCHEDULE` in your `.env` to run on a schedule:

```
CRON_SCHEDULE=17 */6 * * *   # Every 6 hours at minute 17
```

Set `TZ` to ensure the schedule fires at the expected local time:

```
TZ=Europe/London
```

View logs:

```
docker compose logs -f actual-truelayer-sync
```

The image health check accepts only fresh successful state. One-shot failures exit nonzero; scheduled failures keep the process available for the next attempt but mark the container unhealthy.

---

## Migrating from v1

If you have an existing `config.json` from before the config/state split, see [MIGRATION.md](MIGRATION.md).

---

## Use of AI

This project has made use of AI tooling throughout development:

- **Code review** — reviewing sync logic, error handling, and edge cases; catching bugs and suggesting improvements
- **Test writing** — generating unit tests for config loading, sync logic, and transaction mapping
- **The setup script** — `src/setup.ts`, including the OAuth flow, interactive prompts, and file writing logic, was written with AI assistance
- **Documentation** — this README was written with AI assistance

The intent is to be transparent about this. All AI-generated code has been reviewed and tested by the author.

---

## License

MIT
