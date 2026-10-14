# Deployment

## Live Arc Mainnet deployment

- App: https://argents-live.funolive9.chatgpt.site
- Chain ID: `5042`
- RPC: https://rpc.mainnet.arc.io
- USDC: `0x3600000000000000000000000000000000000000`
- Yield factory: `0x02B78468aDA29F698eB6E488EB28d757aA671b6E`
- Yield V2 agent: `0x9eac69A950a13B40BE06547bE833Df653FE32Db8`
- Morpho Galaxy USDC: `0x8E357432CC12ff425c36432F312968aEb16112AF`
- Mode factory: `0x1A9555E261E39830317461a767f8D7B5fBF01c5d` ([deployment](https://explorer.arc.io/tx/0x9db4fa2e80a265a280249135f1712528045365d63cec2600078ded476ba0f710))
- Signals marketplace: `0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68` ([deployment](https://explorer.arc.io/tx/0x55653aae6a337c6d37eedce2d59f978e0415ac49c4d4dae1365f175b1f9d18d2))
- Signals vault: `0x70baA8a0c215D9DbD05A340CA89E2129649ca04e` ([creation](https://explorer.arc.io/tx/0x57e4f1e13b07357ec0bc73d9ba4e69ee615826c825cdf77f9c69381d682fb6b1))
- Treasury vault: `0xcAbD3D35448E768e591210eEE216b672C8Ed19f3` ([creation](https://explorer.arc.io/tx/0x1518bf98fb464d4a8d265ca2e917101ca0ebe8ab58d4be466fccd1af930ca273))
- First Signals offer: ID `1`, 0.01 USDC ([publication](https://explorer.arc.io/tx/0x390aae3efcb76d8705b4d8129d9f2ed303861b534c62d798bce2f502e58c6e3c))
- Yield deployment transactions: [factory](https://explorer.arc.io/tx/0x0b46605051a8fb884232c055dc3bdcbe376ec99f8e77c1220b8b81cab6fb59a9), [agent](https://explorer.arc.io/tx/0xa4c8a39bdd0dc9aa52c4ffa3d2091bda3d8aac17f3e04b7c4bfdcbefcfdcdafc)
- Yield round trip transactions: [deposit](https://explorer.arc.io/tx/0x09d8e3406eed8dc386f046ea296d9a0d6e7205ba9bf90b3b89aac5df48804afe), [deploy to Morpho](https://explorer.arc.io/tx/0x156f849e41303a4b4bcfc7d2508fda760cddb9e0fdc031d550fa6d01a802fb1f), [withdraw](https://explorer.arc.io/tx/0x375d3d3c864d662faa4fdb207db4c68fead373138756df56a2e5fd5218b53ac9)
- Legacy factory: `0xfC887cB480f257e8a76e823de9066b5B528a66a9`; legacy vault: `0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F`

## Reproduce locally

1. Serve the project root with `python -m http.server 4173`.
2. Open `http://localhost:4173` in a browser with an EVM wallet.
3. Connect to Arc Mainnet; the app uses the deployed shared factory.
4. Create a Yield vault, then approve USDC and deposit only the amount you intend to hold there.
5. Select **Deploy yield** to move a chosen amount of idle vault USDC to Morpho. The wallet signs that transaction separately.
6. For Signals, create a Signals agent, publish an offer, then have a buyer pay, the publisher deliver an HTTPS link, and the buyer confirm receipt. The URI is public on chain.
7. For Treasury, create a Treasury agent, fund it or transfer Arc USDC directly to its copied address, then use **Send USDC** to choose a recipient under its daily cap.

The wallet must hold native USDC for Arc gas. Deposits use the Arc USDC contract and its ERC-20 allowance flow.

## Verified on chain

- Both factory deployments and their first vaults are confirmed on Arc Mainnet.
- The Yield factory's USDC and Morpho strategy addresses, and the first Yield agent's owner, name, and 100 USDC daily cap were read back from Arc.
- Deposit, strategy deployment, and withdrawal events were read from Arc. The vault's cumulative totals are 0.02 USDC deposited and 0.01 USDC withdrawn; its remaining invested value was 0.01 USDC at the last check.
- Both deployed addresses have runtime bytecode.
- Contract source compiles with Solidity `0.8.30`.
- Mode factory, Signals marketplace, Signals vault, Treasury vault, and the first offer are deployed and can be read on Arc.
- Signals buyer payment, delivery, acknowledgement, and Treasury recipient send have not yet been completed with capital.
- A browser wallet deposit and withdrawal round trip on the legacy vault was confirmed by the project owner.

Public Yield discovery and current-value ranking are live through client-side Arc event scans. No earned yield has been verified. The contracts have not received an independent security audit; see [SECURITY.md](SECURITY.md).
