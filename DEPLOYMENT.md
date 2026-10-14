# Deployment

## Live Arc Mainnet deployment

- App: https://argents-live.funolive9.chatgpt.site
- Chain ID: `5042`
- RPC: https://rpc.mainnet.arc.io
- USDC: `0x3600000000000000000000000000000000000000`
- Factory: `0xfC887cB480f257e8a76e823de9066b5B528a66a9`
- First vault: `0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F`
- Deployment transactions: [factory](https://explorer.arc.io/tx/0x82e544e28dd98c2b8a1e92a19dc67be4823eb6da14b1c7b01a588049dafd644e), [vault](https://explorer.arc.io/tx/0xb6603e13a1b78874f88f426d390c645362834baa45cf2d49b174990fb2ed43de)

## Reproduce locally

1. Serve the project root with `python -m http.server 4173`.
2. Open `http://localhost:4173` in a browser with an EVM wallet.
3. Connect to Arc Mainnet; the app uses the deployed shared factory.
4. Create a vault, then approve USDC and deposit only the amount you intend to hold there.

The wallet must hold native USDC for Arc gas. Deposits use the Arc USDC contract and its ERC-20 allowance flow.

## Verified on chain

- Factory deployment and first vault creation are confirmed on Arc Mainnet.
- The first vault owner, name, 100 USDC daily cap, and zero USDC balance were read back from the deployed contracts.
- Both deployed addresses have runtime bytecode.
- Contract source compiles with Solidity `0.8.30`.

Funding, withdrawal, browser wallet interaction, yield execution, and public discovery have not been end-to-end verified. The contract code has not received an independent security audit.
