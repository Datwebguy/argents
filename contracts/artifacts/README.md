# Compiled contract artifacts

These ABI and bytecode files are consumed by the browser app to deploy the factory and agent vault contracts.

They were compiled from `contracts/ArgentsAgent.sol` with Solidity `0.8.30` using:

```powershell
npx --yes solc@0.8.30 --bin --abi --output-dir contracts/artifacts contracts/ArgentsAgent.sol
```

Recompile after changing the Solidity source so the browser artifacts stay in sync.
