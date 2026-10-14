# Compiled contract artifacts

These ABI and bytecode files are consumed by the browser app to deploy the factory and agent vault contracts.

They were compiled from `contracts/ArgentsAgent.sol` with Solidity `0.8.30` using:

```powershell
npx --yes solc@0.8.30 --bin --abi --base-path . -o contracts/artifacts contracts/ArgentsAgent.sol
```

Recompile after changing the Solidity source so the browser artifacts stay in sync.

Yield V2 artifacts were compiled with optimization enabled:

```powershell
npx --yes solc@0.8.30 --bin --abi --optimize --optimize-runs 200 --base-path . -o contracts/artifacts contracts/ArgentsYield.sol
```

`ArgentsYieldFactory` is deployed at `0x02B78468aDA29F698eB6E488EB28d757aA671b6E` on Arc Mainnet. Its strategy is Morpho Galaxy USDC. The source is unaudited and strategy withdrawal depends on available liquidity.
