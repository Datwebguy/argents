# Argents — Submission Readiness Notes

This file tracks verified facts and remaining checks. It is not a paste-ready hackathon submission; write the final project description in the team's own words.

## Links

- Live app: https://argents.vercel.app (backup: https://argents-live.funolive9.chatgpt.site)
- Public repository: https://github.com/Datwebguy/argents
- Builder profile: https://github.com/Datwebguy
- Arc factory: https://explorer.arc.io/address/0xfC887cB480f257e8a76e823de9066b5B528a66a9
- First vault: https://explorer.arc.io/address/0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F
- Yield factory: https://explorer.arc.io/address/0x02B78468aDA29F698eB6E488EB28d757aA671b6E
- Yield V2 agent: https://explorer.arc.io/address/0x9eac69A950a13B40BE06547bE833Df653FE32Db8
- Mode factory: https://explorer.arc.io/address/0x1A9555E261E39830317461a767f8D7B5fBF01c5d
- Signals marketplace: https://explorer.arc.io/address/0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68
- Signals vault: https://explorer.arc.io/address/0x70baA8a0c215D9DbD05A340CA89E2129649ca04e
- Treasury vault: https://explorer.arc.io/address/0xcAbD3D35448E768e591210eEE216b672C8Ed19f3

## Verified implementation

- Legacy and Yield V2 factories and first vaults deployed on Arc Mainnet.
- The Yield V2 vault's owner, name, 100 USDC daily withdrawal cap, Morpho strategy, and current position were read from chain.
- The public app and its JavaScript return HTTP 200.
- The app connects to Arc wallets, creates dedicated vaults, and includes funding, withdrawal, limit, activity, and owner-signed Morpho strategy interfaces.
- Public Yield discovery scans the Arc factory's creation events and ranks current vault values without a connected wallet.
- The project owner confirmed a browser wallet deposit and withdrawal round trip on the legacy vault.
- The project owner completed a Yield V2 funding, Morpho deployment, and partial withdrawal round trip. The on-chain vault totals are 0.02 USDC deposited, 0.01 USDC withdrawn, and 0.01 USDC invested at the last check.
- The mode factory and Signals marketplace are deployed. One Signals vault, one Treasury vault, and a 0.01 USDC Signals offer were created on Arc.

## Limitations to state accurately

- No earned yield has been verified; the live transaction demonstrates capital deployment and redemption.
- Signals and Treasury have transaction paths in the app, but the buyer payment, delivery, receipt, and Treasury recipient send paths have not yet been completed with capital. Do not describe them as verified round trips.
- Signals delivery is manual, public on chain, and has no escrow or refund path.
- Circle Agent Wallets, Gateway Nanopayments, Onramp Kit, CCTP, Gateway, and Earn Kit SDK are not integrated. Yield calls Morpho directly.
- No autonomous agent runtime or hosted public discovery indexer exists. Discovery reads on-chain logs in the browser.
- The displayed net result can include direct token transfers into a vault and is not a protocol-only yield figure.
- The contracts have not received an independent security audit.

## Before submitting

- Confirm the live deployment and public repository still open at submission time.
- Confirm the public app, source repository, and builder profile are linked in the hackathon entry.
- Keep the project description limited to the verified implementation above.
