# Argents

Argents is an early prototype for creating and operating USDC agent vaults on Arc. Each agent receives a dedicated smart-contract vault with an owner-controlled daily withdrawal limit.

## Live deployment

- App: https://argents-live.funolive9.chatgpt.site
- Network: Arc Mainnet (chain ID `5042`)
- Shared factory: [`0xfC887cB480f257e8a76e823de9066b5B528a66a9`](https://explorer.arc.io/address/0xfC887cB480f257e8a76e823de9066b5B528a66a9)
- First vault, Argents Yield: [`0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F`](https://explorer.arc.io/address/0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F)
- Deployment record: [deployments.arc-mainnet.json](deployments.arc-mainnet.json)

The first vault is empty. The app creates and tracks USDC vaults, but it does not yet deploy funds to a yield protocol or run autonomous agents.

## Current build

- Connect an EVM wallet to Arc Mainnet and read its live native USDC balance and current block.
- Deploy a personal Argents factory on first use.
- Create a dedicated vault contract for each agent.
- Fund a vault with USDC after approving the transfer.
- Withdraw USDC to the connected owner wallet, subject to the vault's daily limit.
- Change a vault's daily limit on chain and review deposit, withdrawal, and limit events with Arc Explorer links.
- Verify wallet and agent vault addresses through Arc Explorer.

The UI supports Yield, Signals, and Treasury labels, but it does not run a yield strategy or deliver paid signals yet. The Yield mode is currently a vault and rules prototype; no Earn Kit, Morpho, or other yield adapter is connected.

## Run locally

Serve the repository root over HTTP so the browser can load the compiled contract artifacts:

```powershell
python -m http.server 4173
```

Then open http://localhost:4173.

Connect a wallet configured for Arc Mainnet. On first agent creation, the app asks the wallet to deploy a factory and then create an agent vault. Each wallet prompt must be reviewed and approved separately. Arc uses USDC for gas, so the wallet needs a small USDC balance for transactions.

## Arc Mainnet

- Chain ID: `5042` (`0x13b2`)
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: https://explorer.arc.io
- Native asset / gas: USDC
- USDC contract: `0x3600000000000000000000000000000000000000`

## Contracts

Source: [contracts/ArgentsAgent.sol](contracts/ArgentsAgent.sol). Compiled ABI and bytecode are in `contracts/artifacts/` and are loaded by the browser app.

Each user's browser stores their factory address in local storage. On reconnect, the app reloads the agent addresses, names, and daily limits from that factory. The browser also caches the selected mode and creation block for the activity view, so keep the same site origin to retain those details. Vault addresses and balances remain on-chain and can be opened independently in Arc Explorer.

## Prototype limits

- No yield protocol adapter or automated capital deployment
- No hosted agent runtime; owner-signed actions operate the vault
- No server-side indexer or cross-device agent discovery
- Smart contracts have not received an independent security audit

## Hackathon

Argents is being built for [Arc Microgrants](https://dorahacks.io/hackathon/arc-microgrants/detail). The submission needs a working Arc Mainnet deployment and a public repository; see [HACKATHON.md](HACKATHON.md) for the checklist.
