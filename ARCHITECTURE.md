# Architecture

## High-level components

- Frontend (agent creation, dashboard, discovery)
- Agent wallet layer
- Mode logic (Yield / Signals / Treasury)
- Activity and history storage
- Ranking / discovery view
- Funding interface

## Data flow (simplified)

1. User action → Agent configuration
2. Funding → Agent wallet
3. Mode execution → On-chain or payment actions
4. Results → History and balance updates
5. Updates → Dashboard and public views

## Notes

- All value movement occurs in USDC on Arc
- Wallet controls and rules are enforced at the agent level
- History is derived from observable activity

## Placeholders

- Specific contract addresses: `[CONTRACTS]`
- Indexing / data source: `[DATA_SOURCE]`
- Frontend stack: `[FRONTEND_STACK]`
