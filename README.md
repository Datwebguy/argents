# Argents

Argents creates owner-controlled USDC agent vaults on Arc. Yield deploys into Morpho, Signals records paid report delivery, and Treasury controls USDC sends. Each vault has a daily withdrawal limit.

## Live deployment

- App: https://argents.vercel.app (backup: https://argents-live.funolive9.chatgpt.site)
- Public source: https://github.com/Datwebguy/argents
- Builder profile: https://github.com/Datwebguy
- Network: Arc Mainnet (chain ID `5042`)
- Yield factory: [`0x02B78468aDA29F698eB6E488EB28d757aA671b6E`](https://explorer.arc.io/address/0x02B78468aDA29F698eB6E488EB28d757aA671b6E)
- First Yield V2 agent: [`0x9eac69A950a13B40BE06547bE833Df653FE32Db8`](https://explorer.arc.io/address/0x9eac69A950a13B40BE06547bE833Df653FE32Db8)
- Morpho Galaxy USDC strategy: [`0x8E357432CC12ff425c36432F312968aEb16112AF`](https://explorer.arc.io/address/0x8E357432CC12ff425c36432F312968aEb16112AF)
- Mode factory: [`0x1A9555E261E39830317461a767f8D7B5fBF01c5d`](https://explorer.arc.io/address/0x1A9555E261E39830317461a767f8D7B5fBF01c5d)
- Signals marketplace: [`0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68`](https://explorer.arc.io/address/0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68)
- Legacy factory and vault: [`0xfC887cB480f257e8a76e823de9066b5B528a66a9`](https://explorer.arc.io/address/0xfC887cB480f257e8a76e823de9066b5B528a66a9), [`0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F`](https://explorer.arc.io/address/0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F)
- Deployment record: [deployments.arc-mainnet.json](deployments.arc-mainnet.json)

The first Yield V2 agent completed a live funding, Morpho deployment, and withdrawal round trip. At the last on-chain check, it had received 0.02 USDC, withdrawn 0.01 USDC, and retained 0.01 USDC in Morpho shares. This demonstrates capital movement; it does not demonstrate earned yield.

## Current build

- Connect an EVM wallet to Arc Mainnet and read its live native USDC balance and current block.
- Create a dedicated vault contract for each agent through the shared Yield or mode factory.
- Fund a vault with USDC after approving the transfer.
- Deploy idle Yield agent USDC to Galaxy USDC on Morpho. The agent vault owns the strategy shares.
- Follow each agent in the Yield positions section: idle USDC, USDC invested in Morpho, current value, cumulative deposits and withdrawals, and net result. Values refresh every 30 seconds while the page is visible, and users can refresh them manually.
- Discover public Yield agents from Arc factory events and rank them by current vault value without connecting a wallet. The page caches its last scanned block and reads live balances from each vault.
- Withdraw USDC to the connected owner wallet, subject to the vault's daily limit. Yield withdrawals recall strategy funds when the Morpho vault has liquidity.
- Change a vault's daily limit on chain and review deposit, withdrawal, and limit events with Arc Explorer links.
- Verify wallet and agent vault addresses through Arc Explorer.
- Publish Signals offers, pay from a buyer wallet, deliver an HTTPS link after payment, and confirm receipt on chain. Payments go directly to the publisher's vault.
- Send Treasury USDC to a recipient under the vault's daily cap. Copy a vault address to receive direct Arc USDC transfers.
- Discover Signals and Treasury agents publicly by mode and vault balance.

Yield strategy operations, Signals delivery, and Treasury sends are owner-signed and are not automated. The Signals buyer payment and Treasury send paths have not yet been exercised with capital. See [BUILD_STATUS.md](BUILD_STATUS.md).

## Run locally

Serve the repository root over HTTP so the browser can load the compiled contract artifacts:

```powershell
python -m http.server 4173
```

Then open http://localhost:4173.

Connect a wallet configured for Arc Mainnet. Yield creation uses the deployed shared factory. Funding requires a USDC approval and deposit; deploying to Morpho is a separate wallet-signed transaction. Arc uses USDC for gas, so the wallet needs a small USDC balance for transactions.

## Arc Mainnet

- Chain ID: `5042` (`0x13b2`)
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: https://explorer.arc.io
- Native asset / gas: USDC
- USDC contract: `0x3600000000000000000000000000000000000000`

## Contracts

Source: [contracts/ArgentsYield.sol](contracts/ArgentsYield.sol), [contracts/ArgentsAgent.sol](contracts/ArgentsAgent.sol), [contracts/ArgentsModes.sol](contracts/ArgentsModes.sol), and [contracts/ArgentsSignals.sol](contracts/ArgentsSignals.sol). Compiled ABI and bytecode are in `contracts/artifacts/` and are loaded by the browser app.

On reconnect, the app reloads agents from the shared factories and reads their balances from Arc. The browser caches creation blocks for the activity view. Vault addresses and balances remain on-chain and can be opened independently in Arc Explorer.

## Prototype limits

- No autonomous strategy execution; the owner signs capital deployment and withdrawals
- Morpho strategy value and withdrawal liquidity can change; the contracts have no guaranteed return or redemption schedule
- No hosted agent runtime; owner-signed actions operate the vault
- Public discovery is a client-side Arc log scan; it has no hosted indexer and may slow as the number of agents grows
- Smart contracts have not received an independent security audit
- Signals delivery links are public on chain; publishers must use access-controlled links for private reports. Payments are not escrowed and there is no refund path.
- The displayed net result is current value plus cumulative withdrawals minus deposits; direct USDC or Morpho share transfers into a vault can affect it

See [SECURITY.md](SECURITY.md) for the internal contract review and residual risks.

## Hackathon

Argents is being built for [Arc Microgrants](https://dorahacks.io/hackathon/arc-microgrants/detail). The submission needs a working Arc Mainnet deployment and a public repository; see [HACKATHON.md](HACKATHON.md) for the checklist.
