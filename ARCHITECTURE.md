# Architecture

## High-level components

- Frontend (agent creation, dashboard, discovery)
- Arc smart-contract vaults owned by each connected wallet
- Yield V2 vault with an immutable Morpho Galaxy USDC strategy
- Legacy custody vaults used by Signals and Treasury prototypes
- On-chain event history and browser-cached agent metadata
- Funding interface

## Data flow (simplified)

1. User action → Agent configuration
2. Funding → Agent wallet
3. Owner-signed Yield deployment → Morpho shares held by the agent vault
4. On-chain events and balances → dashboard activity and position value
5. Withdrawals → idle USDC first, then Morpho redemption subject to liquidity and the daily cap

## Notes

- All value movement occurs in USDC on Arc
- Daily withdrawal caps are enforced by the vault contracts
- History is read from on-chain vault events; no external indexer is used
- Strategy earnings are estimated from current value plus cumulative withdrawals minus deposits; they may be negative

## Current limits

- Strategy actions require an owner wallet signature; no autonomous runtime is running
- Signals, Treasury, public ranking, and cross-user discovery are not operational
- Current Yield V2 agent has no funded position
