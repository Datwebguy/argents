# Security notes

This is an internal source review of the deployed Argents vaults and browser app. It is not an independent audit or a guarantee of safety.

## Controls reviewed

- Only a vault's immutable owner can deposit through the vault interface, deploy or recall Morpho shares, withdraw, or change the daily withdrawal cap.
- The Yield V2 vault checks that its immutable Morpho strategy accepts the configured Arc USDC asset.
- Yield deployment approves only the selected USDC amount and resets the strategy allowance after deposit.
- External value-moving functions in Yield V2 use a reentrancy guard. A withdrawal counts toward the UTC-day cap before USDC leaves the vault.
- The browser renders on-chain agent names as escaped text, and transaction actions use the connected wallet to sign.
- The browser serves its pinned ethers library from the app's own static files.

## Material limits

- The owner can change the daily cap immediately. It is a spending rule for the app's normal flow, not protection against a compromised owner wallet.
- Morpho is an external strategy. Its value can fall, and redemption may fail when liquidity or permissions do not permit withdrawal.
- `withdraw` requests an exact USDC amount from Morpho if idle USDC is insufficient. It does not bound the number of strategy shares that may be burned at execution time.
- The vault has no separate emergency function to transfer strategy shares to the owner if ordinary redemption becomes unavailable.
- The displayed net result equals current vault value plus cumulative withdrawals minus deposits. Direct USDC or Morpho share transfers into the vault can affect this figure. It does not isolate protocol earnings.
- Public discovery reads factory events and vault balances from Arc in each browser; it has no trusted hosted indexer and may become slow as usage grows.
- Signals uses direct payment to the publisher vault. The contract records payment before delivery, but it cannot ensure a useful report is delivered. It has no escrow or refund path. Delivery URIs are public on chain; private content needs separate access control.
- The Signals contract accepts any compatible owner-controlled USDC vault, not only vaults registered as Signals. The app selects Signals vaults, but the contract itself does not enforce the mode.
- Treasury sends enforce the same withdrawal cap as owner withdrawals. The owner can raise that cap immediately, so it is not an independent approval control.
- Signals delivery and Treasury spending remain wallet signed; there is no unattended execution or separate agent key.

## Evidence

The first Yield V2 vault completed a live deposit, Morpho deployment, and partial withdrawal. Transaction links and current deployment addresses are in [DEPLOYMENT.md](DEPLOYMENT.md). The position can change after any later transaction or strategy accrual.

No formal audit, fuzzing campaign, or third-party review has been completed. Keep deposits small until those checks and an emergency exit design are completed.
