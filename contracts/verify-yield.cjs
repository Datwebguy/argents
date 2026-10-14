const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const artifacts = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts', `contracts_ArgentsYield_sol_${name}.abi`), 'utf8'));

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.arc.io', 5042);
  const owner = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
  const factory = new ethers.Contract('0x02B78468aDA29F698eB6E488EB28d757aA671b6E', artifacts('ArgentsYieldFactory'), provider);
  const agents = await factory.agentsOf(owner);
  const vault = new ethers.Contract('0x9eac69A950a13B40BE06547bE833Df653FE32Db8', artifacts('ArgentsYieldVault'), provider);
  const [chain, factoryCode, vaultCode, usdc, strategy, vaultOwner, name, limit, assets, idle, shares, invested, deposited, withdrawn] = await Promise.all([
    provider.getNetwork(), provider.getCode(await factory.getAddress()), provider.getCode(await vault.getAddress()), factory.usdc(), factory.strategy(), vault.owner(), vault.name(), vault.dailySpendLimit(), vault.totalAssets(), vault.balance(), vault.strategyShares(), vault.strategyAssets(), vault.totalDeposited(), vault.totalWithdrawn(),
  ]);
  console.log(JSON.stringify({ chainId: String(chain.chainId), factoryHasCode: factoryCode !== '0x', vaultHasCode: vaultCode !== '0x', agents, usdc, strategy, vaultOwner, name, dailyLimitBaseUnits: String(limit), totalAssetsBaseUnits: String(assets), idleBaseUnits: String(idle), investedBaseUnits: String(invested), totalDepositedBaseUnits: String(deposited), totalWithdrawnBaseUnits: String(withdrawn), shares: String(shares) }, null, 2));
  const latestBlock = await provider.getBlockNumber();
  const events = [];
  for (let fromBlock = 25926701; fromBlock <= latestBlock; fromBlock += 2000) {
    const logs = await provider.getLogs({ address: await vault.getAddress(), fromBlock, toBlock: Math.min(fromBlock + 1999, latestBlock) });
    for (const log of logs) {
      try {
        const parsed = vault.interface.parseLog(log);
        if (['Deposited', 'YieldDeployed', 'Withdrawn', 'YieldRecalled'].includes(parsed.name)) {
          events.push({ name: parsed.name, blockNumber: log.blockNumber, txHash: log.transactionHash });
        }
      } catch { /* Other contract events are irrelevant here. */ }
    }
  }
  console.log(JSON.stringify({ activityEvents: events }, null, 2));
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
