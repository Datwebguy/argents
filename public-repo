# Argents — Submission Working Notes

Use this file as an accuracy checklist while preparing the DoraHacks entry. It is not a finished submission response; update it from the deployed build and write the final description in your own words.

## Current implementation facts

- The browser app connects to Arc Mainnet and reads the connected wallet's native USDC balance and block height.
- The connected wallet can deploy an Argents factory and create a separate smart-contract vault for each agent.
- Vaults accept USDC deposits after the owner approves the token transfer.
- Vault withdrawals go to the owner wallet and are checked against the configured daily spend limit.
- The owner can update the daily limit on chain; deposit, withdrawal, and limit-change events link to Arc Explorer.
- Each create, approve, deposit, and withdrawal transaction is signed by the user in their wallet.

## Not implemented yet

- Yield source integration or automated capital deployment
- Agent runtime or autonomous signing
- Paid Signals delivery
- Public agent discovery, ranking, or cross-user indexing

## Arc usage to describe accurately

- Arc Mainnet hosts the factory and individual agent vault contracts.
- Native USDC pays Arc transaction fees; ERC-20 USDC is used for vault deposits and withdrawals.
- Network: Arc Mainnet, chain ID `5042`
- USDC contract: `0x3600000000000000000000000000000000000000`

## Links to fill after publication

- Live deployment: `[DEPLOYMENT_URL]`
- Public repository: `[REPO_URL]`
- Example factory / vault / transaction: `[CONTRACT_LINKS]`
- Public builder profile: `[BUILDER_PROFILE_URL]`

## Final checks

- Confirm app is live and its Arc Mainnet transactions work.
- Confirm the repo is public and contains the exact deployed source.
- Include an explorer link to a successful agent creation and, if available, funding transaction.
- Do not describe Yield, Signals, Treasury automation, or third-party integrations as implemented until they work in the live build.
