# Integrations

## Status

The app uses Arc Mainnet USDC, Argents-owned vault contracts, and a direct Morpho Galaxy USDC vault integration for Yield. It does **not** use the Circle Earn Kit SDK. The Circle Agent Wallets, Gateway Nanopayments, Onramp Kit, CCTP, and Gateway integrations below remain planned and are not connected. Signals uses a direct Arc USDC payment contract rather than Gateway Nanopayments.

## Primary integrations for Argents

### Agent Wallets
- Purpose: Dedicated wallet per agent with spending controls
- Docs: https://developers.circle.com/agent-stack/agent-wallets
- Planned for: Managed wallets and spending policy. Current implementation uses dedicated owner-controlled smart contract vaults instead.

### Nanopayments (Gateway)
- Purpose: Gas-free sub-cent USDC payments for services and signals
- Docs: https://developers.circle.com/gateway-nanopayments
- Planned for: Smaller Signals payments. Current Signals marketplace uses direct Arc USDC `transferFrom` into the publisher vault.

### Earn Kit / Morpho
- Purpose: USDC yield deployment
- Context: Morpho is live on Arc as credit infrastructure; Earn Kit provides the integration layer
- Current implementation: Argents Yield V2 calls Morpho Galaxy USDC directly. Earn Kit is not used.

### Onramp Kit
- Purpose: Easy USDC funding via familiar payment methods
- Planned for: Fiat-to-USDC funding. Current funding uses wallet deposits or direct Arc USDC transfers to a copied vault address.

### CCTP / Gateway
- Purpose: Move USDC across supported chains into Arc agent wallets
- Docs: https://developers.circle.com/cctp and Gateway docs
- Planned for: Cross-chain capital inflow. The current app expects funds to arrive as Arc USDC.

## Notes

Integration details and exact SDK versions should be confirmed against the latest Circle and Arc documentation at implementation time.
All value movement targets USDC on Arc mainnet.
