# Course Completion Credential DApp

This project is built on the [Midnight Network](https://midnight.network/).

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.30.0-1abc9c.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://shields.io/)


> **Use this repo as a template. Do not fork it.**
>  
> This repository is intended to be used via GitHub's "Use this template" flow.  
> Forking this repo is discouraged, as forks are not tracked as independent projects.

A Midnight smart contract example demonstrating a course completion credential with zero-knowledge proofs on testnet. An issuer can issue a single course completion credential at a time, revoke it, and a verifier can confirm that a student completed a given course without the student's identity ever being written to the ledger.

## How It Works

When a credential is issued, the student's private identifier (name, email, or ID) is never stored on-chain. Instead, the issuer:

1. Hashes the student identifier (SHA-256) and combines it with a randomly generated `salt` to compute a hiding **commitment** that *is* stored on the ledger, together with the course name.
2. Hands the student the identifier and `salt` **out of band** (in private).

A verifier can later confirm the credential by recomputing the commitment from the identifier and salt the student reveals to them directly, and comparing it with the on-chain value. No transaction is submitted during verification, and the identifier never needs to be published.

## Project Structure

```
course-completion-verification/
├── contract/               # Smart contract in Compact language
│   └── src/               # Contract source and utilities
├── api/                   # Methods, classes and types for CLI and UI
├── bboard-cli/            # Command-line interface
│   └── src/               # CLI implementation
└── bboard-ui/             # Web browser interface
    └── src/               # Web UI implementation
```

## Prerequisites

### 1. Node.js Version Check

You need Node.js:

```bash
node --version
```

Expected output: `v24.11.1` or higher. The repository includes an [.nvmrc](./.nvmrc) pinned to `24.11.1`.

If you get a lower version: [Install Node.js LTS](https://nodejs.org/).

### 2. Docker Installation

The [proof server](https://docs.midnight.network/develop/tutorial/using/proof-server) runs in Docker and is required for both CLI and UI to generate zero-knowledge proofs:

```bash
docker --version
```

Expected output: `Docker version X.X.X`.

If Docker is not found: [Install Docker Desktop](https://docs.docker.com/desktop/). Make sure Docker Desktop is running.

### 3. Lace Wallet Extension (UI Only)

For the web interface, install the official Lace wallet extension on [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia) (tested with version 1.36.0).

After installing, set up the Midnight wallet:

1. Create a **new wallet** — Midnight will appear as a network option
2. Set **Network** to **Preprod**
3. Set **Proof server** to **Local (http://localhost:6300)** — this must point to your local proof server started via Docker
4. Click **Enter Wallet**
5. Fund your wallet with tNIGHT tokens from the [Preprod Faucet](https://midnight-tmnight-preprod.nethermind.dev/)
6. Go to **Tokens** in the wallet, click **Generate tDUST**, and confirm the transaction — tDUST tokens are required to pay transaction fees on preprod

## Setup Instructions

### Install Project Dependencies

```bash
npm install
```

This repository uses npm workspaces. Run installation once from the repository root.

### Compile the Smart Contract

The Compact compiler (`compactc 0.31.0`) generates TypeScript bindings and zero-knowledge circuits from the smart contract source code:

```bash
cd contract
npm run compact    # Compiles the Compact contract
npm run build      # Copies compiled files to dist/
cd ..
```

Expected output:

```
> compact
> compact compile src/course-credential.compact ./src/managed/course-credential

Compiling 2 circuits:
  circuit "issueCredential" (k=14, rows=10070)
  circuit "revokeCredential" (k=14, rows=10087)

> build
> rm -rf dist && tsc --project tsconfig.build.json && cp -Rf ./src/managed ./dist/managed && cp ./src/course-credential.compact ./dist

```

### Build the CLI Interface

```bash
cd bboard-cli
npm run build
cd ..
```

### Build the UI Interface (Optional)

Only needed if you want to use the web interface:

```bash
cd bboard-ui
npm run build
cd ..
```

## Option 1: CLI Interface

### Start the Proof Server

The CLI requires a local proof server running in Docker:

```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
```

This uses `midnightntwrk/proof-server:8.0.3` on `http://127.0.0.1:6300`.

### Run the CLI

```bash
# For preprod network
npm run preprod-remote

# For preview network
npm run preview-remote
```

### Using the CLI

#### Create a Wallet

1. Choose option `1` to build a fresh wallet
2. The system will generate a wallet address and seed
3. **Save both the address and seed** - you'll need them later

Expected output is similar to:

```
Your wallet seed is: [64-character hex string]
Using unshielded address: mn_addr_preprod1hdvtst70zfgd8wvh7l8ppp7mcrxnjn56wc5hlxpwflz3fxdykaesrw0ln4 waiting for funds...
```

#### Fund Your Wallet

Before deploying contracts, you need testnet tokens.

1. Copy your wallet address from the output above
2. Visit the [faucet](https://midnight-tmnight-preprod.nethermind.dev/)
3. Paste your address and request funds
4. Wait for the CLI to detect the funds (takes 2-3 minutes)

Expected output after funding is similar to:

```
Your NIGHT wallet balance is: 1000000000
```

#### Deploy or Join a Contract

Choose option `1` to deploy a new contract (and act as an **issuer**), or option `2` to join an existing one (and act as a **verifier**).

Expected output when deploying:

```
Deployed contract at address: [contract address]
```

#### Issue a Credential

The issuer can now:

1. Choose **Issue a course completion credential**
2. Enter the course name and the student's private identifier
3. The CLI prints a **credential bundle** — share it with the student, in private:

```
Issued credential for course: 'Mathematics 101'
Credential issued. Share the following bundle with the student:
  Contract address:   [contract address]
  Course:             Mathematics 101
  Student identifier: alice@example.com
  Salt:               0x[64-character hex string]
```

The student later reveals the identifier and salt to a verifier.

#### Verify a Credential

A verifier who has joined the contract can:

1. Choose **Verify a credential**
2. Enter the course, the student identifier and salt revealed by the student
3. The CLI reports whether the credential is valid, or the reason it failed (no active credential, course mismatch, or commitment mismatch)

#### Other Actions

- **Revoke the current credential** — only the issuer can do this
- **Display the current ledger state** — known by everyone
- **Display the current private state** — known only to this DApp instance
- **Display the current derived state** — known only to this DApp instance

Each action creates a real transaction on Midnight Testnet using zero-knowledge proofs generated by the proof server (except verification, which is performed locally and writes nothing to the ledger).

## Option 2: Web UI Interface

The web interface uses the same proof server and requires additional browser setup.

### Start the Proof Server (if not already running)

If you haven't started the proof server for the CLI, start it now:

```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
cd ..
```

Verify it's running:

```bash
docker ps
```

### Start the Web Interface

The UI can run against preprod or preview networks:

```bash
cd bboard-ui

# For preprod network
npm run build:start

# For preview network
npm run build:start:preview
```

The UI will be available at:

- http://127.0.0.1:8080

### Browser Setup

1. **Open the UI URL** in a browser with Lace wallet extension installed
2. **Set up Lace wallet** if it's your first time
3. **Authorize the application** when Lace wallet prompts
4. Use the course completion credential web interface:
   - **Create or join** a course completion credential contract
   - **Issue** a credential — the resulting student identifier and salt are shown in a dialog to share with the student
   - **Revoke** the current credential (issuer only)
   - **Verify** a credential by entering the course, student identifier and salt revealed by the student

## Useful Links

- Get Testnet tNIGHT on [Preprod Faucet](https://midnight-tmnight-preprod.nethermind.dev/) or [Preview Faucet](https://midnight-tmnight-preview.nethermind.dev/)
- [Midnight Documentation](https://docs.midnight.network/examples/dapps/bboard) - Complete developer guide
- [Compatibility Matrix](https://docs.midnight.network/relnotes/support-matrix) - Current supported Midnight component versions
- [Compact Language Guide](https://docs.midnight.network/compact/writing) - Smart contract language reference
- Get Lace wallet on the [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia)

## Troubleshooting

| Common Issue                       | Solution                                                                                                  |
| ---------------------------------- |-----------------------------------------------------------------------------------------------------------|
| `npm install` fails                | Ensure you're using Node `v24.11.1` or newer. Older Node versions can install with warnings but are not the target runtime |
| Contract compilation fails         | Ensure the Compact toolchain is installed and run `npm run compact` from `contract/`                      |
| Network connection timeout         | CLI requires internet connection, restart if connection times out                                         |
| Token funding takes too long       | Wait 1-2 minutes, funding is automatic in CLI                                                             |
| "Application not authorized" error | Start proof server: `docker compose -f proof-server-local.yml up -d`                                      |
| Lace wallet not detected           | Install Lace wallet browser extension and refresh page                                                    |
| Docker issues                      | Ensure Docker Desktop is running, check `docker --version`                                                |
| Port 6300 in use                   | Run `docker compose down` then restart services                                                           |
| Dependencies won't install         | Use Node.js LTS version. For older npm versions, you may need `--legacy-peer-deps`                        |
| Contract deployment fails          | Verify wallet has sufficient balance and network connection                                               |

## Notes

- CLI and UI can run simultaneously and share the same proof server
- Proof server (Docker) is required for both CLI and UI to generate zero-knowledge proofs
- Contract must be compiled before building CLI or UI
- Fund your wallet using the testnet faucet before deploying contracts

## Implementation Notes

- **Transaction fee configuration**  
  The default `additionalFeeOverhead` value (`500_000_000_000_000_000n`) from `@midnight-ntwrk/testkit-js` is required on the `undeployed` network. Lower values can fail with `BalanceCheckOverspend` on the node side. On remote networks, that overhead requires too much dust, so the CLI overrides it to `1_000n`.
- CLI private state is stored per contract address, matching the `Midnight.js 4.x` private-state provider model.
- The student identifier is hashed with SHA-256 and committed on-chain together with a salt; the identifier itself never appears on the ledger, so a leaked ledger does not reveal who completed a course.
