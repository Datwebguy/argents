# Integrations

## Status

These are the intended integrations from the initial product plan. They are not connected in the current prototype. The current app deploys Argents vault contracts directly and calls Arc USDC for deposits and withdrawals; it does not use Circle Agent Wallets, Gateway Nanopayments, Earn Kit / Morpho, Onramp Kit, CCTP, or Gateway yet.

## Primary integrations for Argents

### Agent Wallets
- Purpose: Dedicated wallet per agent with spending controls
- Docs: https://developers.circle.com/agent-stack/agent-wallets
- Used for: All modes (balance ownership, rule enforcement)

### Nanopayments (Gateway)
- Purpose: Gas-free sub-cent USDC payments for services and signals
- Docs: https://developers.circle.com/gateway-nanopayments
- Used for: Signals mode (selling/buying alerts), agent-to-agent payments

### Earn Kit / Morpho
- Purpose: USDC yield deployment
- Context: Morpho is live on Arc as credit infrastructure; Earn Kit provides the integration layer
- Used for: Yield mode

### Onramp Kit
- Purpose: Easy USDC funding via familiar payment methods
- Used for: Agent funding flow

### CCTP / Gateway
- Purpose: Move USDC across supported chains into Arc agent wallets
- Docs: https://developers.circle.com/cctp and Gateway docs
- Used for: Optional capital inflow

## Notes

Integration details and exact SDK versions should be confirmed against the latest Circle and Arc documentation at implementation time.
All value movement targets USDC on Arc mainnet.
