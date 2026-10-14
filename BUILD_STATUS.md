# Argents build status

## Live Arc product

- Wallet connection, address copy, disconnect, and native USDC balance.
- Dedicated USDC vault per agent. Yield, Signals, and Treasury modes are selected at creation. New Signals and Treasury modes are recorded by an on-chain mode factory and recover across browsers.
- Yield: fund, deploy to Morpho Galaxy USDC, withdraw, track invested and idle balances, view current value and net result. Morpho accrual happens in the position after deployment. Deployment is initiated and signed by the owner.
- Signals: publisher creates a priced offer from a Signals vault; buyer pays Arc USDC into that vault; publisher delivers an HTTPS link; buyer acknowledges receipt. Offer, payment, delivery, and receipt are recorded on Arc. This is a manual publisher workflow.
- Treasury: receive Arc USDC at the vault address, fund from the connected wallet, send to a chosen Arc address under the UTC-day withdrawal cap, and view incoming and outgoing activity.
- Public discovery ranks Yield agents by current value and Signals/Treasury agents by vault balance. The Signals marketplace lists offers publicly.

## Demonstrated on Arc

- A Yield vault was funded, deployed into Morpho, and partially withdrawn. Transaction links are in [DEPLOYMENT.md](DEPLOYMENT.md).
- Signals marketplace, mode factory, and one Signals and one Treasury vault are deployed. A Signals offer has been published. The buyer payment, delivery, acknowledgement, and Treasury send paths have **not** yet been exercised with capital. They are implemented but should not be represented as verified round trips.

## Remaining limitations

- No unattended agent runtime: wallet owners initiate strategy deployment, report delivery, and Treasury sends. Morpho position value changes without further owner transactions.
- No Circle Agent Wallets, Gateway Nanopayments, Earn Kit SDK, Onramp Kit, CCTP, or Gateway integration. Argents uses its own Arc contracts and direct USDC transactions. See [INTEGRATIONS.md](INTEGRATIONS.md).
- Signals delivery URI is public on chain. Use an access-controlled link for private reports. Buyer payment goes directly to the publisher vault; there is no escrow or refund mechanism.
- Public discovery reads events in each browser and is capped in its display. A hosted indexer and broader history view are future work.
- Contracts are unaudited; see [SECURITY.md](SECURITY.md).
