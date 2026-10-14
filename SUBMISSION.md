# Argents — Submission Readiness Notes

This file tracks verified facts and remaining checks. It is not a paste-ready hackathon submission; write the final project description in the team's own words.

## Links

- Live app: https://argents-live.funolive9.chatgpt.site
- Public repository: https://github.com/Datwebguy/argents
- Builder profile: https://github.com/Datwebguy
- Arc factory: https://explorer.arc.io/address/0xfC887cB480f257e8a76e823de9066b5B528a66a9
- First vault: https://explorer.arc.io/address/0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F
- Yield factory: https://explorer.arc.io/address/0x02B78468aDA29F698eB6E488EB28d757aA671b6E
- Yield V2 agent: https://explorer.arc.io/address/0x9eac69A950a13B40BE06547bE833Df653FE32Db8

## Verified implementation

- Legacy and Yield V2 factories and first vaults deployed on Arc Mainnet.
- The Yield V2 vault's owner, name, 100 USDC daily withdrawal cap, Morpho strategy, zero assets, and zero shares were read from chain.
- The public app and its JavaScript return HTTP 200.
- The app connects to Arc wallets, creates dedicated vaults, and includes funding, withdrawal, limit, activity, and owner-signed Morpho strategy interfaces.
- The project owner confirmed a browser wallet deposit and withdrawal round trip on the legacy vault.

## Limitations to state accurately

- No Yield V2 strategy transaction with funds has been observed yet; no yield has been earned or verified.
- Signals and Treasury are prototype mode labels, not operational services.
- No autonomous agent runtime or cross-user public discovery/indexer exists.
- The Yield V2 funding, deployment, and redemption flow has not been end-to-end exercised.
- The contracts have not received an independent security audit.

## Before submitting

- Run the live Yield V2 create, deposit, Morpho deployment, withdrawal, and activity flow in a browser wallet.
- Confirm the public app, source repository, and builder profile are linked in the hackathon entry.
- Keep the project description limited to the verified implementation above.
