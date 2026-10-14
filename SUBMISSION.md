# Argents — Submission Readiness Notes

This file tracks verified facts and remaining checks. It is not a paste-ready hackathon submission; write the final project description in the team's own words.

## Links

- Live app: https://argents-live.funolive9.chatgpt.site
- Public repository: https://github.com/Datwebguy/argents
- Builder profile: https://github.com/Datwebguy
- Arc factory: https://explorer.arc.io/address/0xfC887cB480f257e8a76e823de9066b5B528a66a9
- First vault: https://explorer.arc.io/address/0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F

## Verified implementation

- Shared factory and first Argents Yield vault deployed on Arc Mainnet.
- The vault owner, name, 100 USDC daily withdrawal cap, and zero vault balance were read from chain.
- The public app and its JavaScript return HTTP 200.
- The app connects to Arc wallets, creates dedicated vaults, and includes funding, withdrawal, rules, and activity interfaces.

## Limitations to state accurately

- No yield strategy or Earn Kit / Morpho integration is connected.
- Signals and Treasury are prototype mode labels, not operational services.
- No autonomous agent runtime or cross-user public discovery/indexer exists.
- Browser wallet funding and withdrawal have not been end-to-end exercised.
- The contracts have not received an independent security audit.

## Before submitting

- Run the live create, deposit, withdrawal, and activity flow in a browser wallet.
- Confirm the public app, source repository, and builder profile are linked in the hackathon entry.
- Keep the project description limited to the verified implementation above.
