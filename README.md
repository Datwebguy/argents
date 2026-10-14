# Argents

Argents creates owner-controlled USDC agent vaults on Arc. Yield agents can place idle USDC into a Morpho Vault V2 strategy through an explicit wallet-signed action. Each vault has a daily withdrawal limit.

## Live deployment

- App: https://argents-live.funolive9.chatgpt.site
- Public source: https://github.com/Datwebguy/argents
- Builder profile: https://github.com/Datwebguy
- Network: Arc Mainnet (chain ID `5042`)
- Yield factory: [`0x02B78468aDA29F698eB6E488EB28d757aA671b6E`](https://explorer.arc.io/address/0x02B78468aDA29F698eB6E488EB28d757aA671b6E)
- First Yield V2 agent: [`0x9eac69A950a13B40BE06547bE833Df653FE32Db8`](https://explorer.arc.io/address/0x9eac69A950a13B40BE06547bE833Df653FE32Db8)
- Morpho Galaxy USDC strategy: [`0x8E357432CC12ff425c36432F312968aEb16112AF`](https://explorer.arc.io/address/0x8E357432CC12ff425c36432F312968aEb16112AF)
- Legacy factory and vault: [`0xfC887cB480f257e8a76e823de9066b5B528a66a9`](https://explorer.arc.io/address/0xfC887cB480f257e8a76e823de9066b5B528a66a9), [`0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F`](https://explorer.arc.io/address/0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F)
- Deployment record: [deployments.arc-mainnet.json](deployments.arc-mainnet.json)

The first Yield V2 agent is empty. No USDC has been invested through Argents yet, so the live deployment does not demonstrate earned yield.

## Current build

- Connect an EVM wallet to Arc Mainnet and read its live native USDC balance and current block.
- Create a dedicated vault contract for each agent through the shared Yield or legacy factory.
- Fund a vault with USDC after approving the transfer.
- Deploy idle Yield agent USDC to Galaxy USDC on Morpho. The agent vault owns the strategy shares.
- View idle assets, invested assets, total value, and the position result derived from on-chain amounts.
- Withdraw USDC to the connected owner wallet, subject to the vault's daily limit. Yield withdrawals recall strategy funds when the Morpho vault has liquidity.
- Change a vault's daily limit on chain and review deposit, withdrawal, and limit events with Arc Explorer links.
- Verify wallet and agent vault addresses through Arc Explorer.

Signals and Treasury still use custody vaults; paid signal delivery and autonomous treasury execution are not implemented. Yield strategy operations are owner-signed and are not automated.

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

Source: [contracts/ArgentsYield.sol](contracts/ArgentsYield.sol) and [contracts/ArgentsAgent.sol](contracts/ArgentsAgent.sol). Compiled ABI and bytecode are in `contracts/artifacts/` and are loaded by the browser app.

On reconnect, the app reloads agents from the shared factories and reads their balances from Arc. The browser caches creation blocks for the activity view. Vault addresses and balances remain on-chain and can be opened independently in Arc Explorer.

## Prototype limits

- No autonomous strategy execution; the owner signs capital deployment and withdrawals
- Morpho strategy value and withdrawal liquidity can change; the contracts have no guaranteed return or redemption schedule
- No hosted agent runtime; owner-signed actions operate the vault
- No server-side indexer or cross-user public ranking
- Smart contracts have not received an independent security audit

## Hackathon

Argents is being built for [Arc Microgrants](https://dorahacks.io/hackathon/arc-microgrants/detail). The submission needs a working Arc Mainnet deployment and a public repository; see [HACKATHON.md](HACKATHON.md) for the checklist.
