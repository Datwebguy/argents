# Deployment

## Live Arc Mainnet deployment

- App: https://argents-live.funolive9.chatgpt.site
- Chain ID: `5042`
- RPC: https://rpc.mainnet.arc.io
- USDC: `0x3600000000000000000000000000000000000000`
- Yield factory: `0x02B78468aDA29F698eB6E488EB28d757aA671b6E`
- Yield V2 agent: `0x9eac69A950a13B40BE06547bE833Df653FE32Db8`
- Morpho Galaxy USDC: `0x8E357432CC12ff425c36432F312968aEb16112AF`
- Yield deployment transactions: [factory](https://explorer.arc.io/tx/0x0b46605051a8fb884232c055dc3bdcbe376ec99f8e77c1220b8b81cab6fb59a9), [agent](https://explorer.arc.io/tx/0xa4c8a39bdd0dc9aa52c4ffa3d2091bda3d8aac17f3e04b7c4bfdcbefcfdcdafc)
- Legacy factory: `0xfC887cB480f257e8a76e823de9066b5B528a66a9`; legacy vault: `0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F`

## Reproduce locally

1. Serve the project root with `python -m http.server 4173`.
2. Open `http://localhost:4173` in a browser with an EVM wallet.
3. Connect to Arc Mainnet; the app uses the deployed shared factory.
4. Create a Yield vault, then approve USDC and deposit only the amount you intend to hold there.
5. Select **Deploy yield** to move a chosen amount of idle vault USDC to Morpho. The wallet signs that transaction separately.

The wallet must hold native USDC for Arc gas. Deposits use the Arc USDC contract and its ERC-20 allowance flow.

## Verified on chain

- Both factory deployments and their first vaults are confirmed on Arc Mainnet.
- The Yield factory's USDC and Morpho strategy addresses, and the first Yield agent's owner, name, 100 USDC daily cap, zero assets, and zero strategy shares were read back from Arc.
- Both deployed addresses have runtime bytecode.
- Contract source compiles with Solidity `0.8.30`.
- A browser wallet deposit and withdrawal round trip on the legacy vault was confirmed by the project owner.

Yield deposit, strategy deployment, and strategy withdrawal have not yet been exercised with funds. No cross-user public discovery or ranking is live. The contracts have not received an independent security audit.
