// Run with ARGENTS_KEY_FILE set to a local private-key file; never commit that file.
// Requires ethers v6 available via NODE_PATH. Estimates gas before deployment.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');

const RPC = 'https://rpc.mainnet.arc.io';
const USDC = '0x3600000000000000000000000000000000000000';
const STRATEGY = '0x8E357432CC12ff425c36432F312968aEb16112AF';
const EXPECTED_OWNER = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
const DEPLOYED_FACTORY = '0x02B78468aDA29F698eB6E488EB28d757aA671b6E';
const artifact = (name, ext) => fs.readFileSync(path.join(__dirname, 'artifacts', `contracts_ArgentsYield_sol_${name}.${ext}`), 'utf8');

async function main() {
  if (!process.env.ARGENTS_KEY_FILE) throw new Error('Set ARGENTS_KEY_FILE to a local private-key file.');
  const raw = fs.readFileSync(process.env.ARGENTS_KEY_FILE, 'utf8').trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(raw)) throw new Error('Expected one hex private key in the key file.');
  const provider = new ethers.JsonRpcProvider(RPC, 5042);
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
  if (wallet.address.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) throw new Error('Key file address does not match expected deployer.');
  const chain = await provider.getNetwork();
  if (chain.chainId !== 5042n) throw new Error('Wrong chain.');
  const strategy = new ethers.Contract(STRATEGY, ['function asset() view returns (address)'], provider);
  if ((await strategy.asset()).toLowerCase() !== USDC.toLowerCase()) throw new Error('Strategy underlying asset is not Arc USDC.');
  const factory = new ethers.ContractFactory(JSON.parse(artifact('ArgentsYieldFactory', 'abi')), `0x${artifact('ArgentsYieldFactory', 'bin').trim()}`, wallet);
  const deployTx = await factory.getDeployTransaction(USDC, STRATEGY);
  const gas = await provider.estimateGas({ ...deployTx, from: wallet.address });
  const fee = await provider.getFeeData();
  const balance = await provider.getBalance(wallet.address);
  const estimatedCost = gas * (fee.gasPrice || 0n);
  console.log(JSON.stringify({ owner: wallet.address, gas: gas.toString(), gasPrice: String(fee.gasPrice), estimatedCostUSDC: ethers.formatEther(estimatedCost), balanceUSDC: ethers.formatEther(balance) }));
  if (process.argv[2] === '--create') {
    const liveFactory = new ethers.Contract(DEPLOYED_FACTORY, JSON.parse(artifact('ArgentsYieldFactory', 'abi')), wallet);
    const name = 'Argents Yield V2';
    const limit = 100_000_000n;
    const createGas = await liveFactory.createAgent.estimateGas(name, limit);
    const createCost = createGas * (fee.gasPrice || 0n);
    console.log(JSON.stringify({ createGas: String(createGas), estimatedCreateCostUSDC: ethers.formatEther(createCost) }));
    if (balance < createCost * 2n) throw new Error('Balance is too low for agent creation plus gas reserve.');
    const tx = await liveFactory.createAgent(name, limit);
    const receipt = await tx.wait();
    const event = receipt.logs.map((log) => { try { return liveFactory.interface.parseLog(log); } catch { return null; } }).find((item) => item?.name === 'AgentCreated');
    if (!event) throw new Error('Agent creation event was not found.');
    console.log(JSON.stringify({ agentAddress: event.args.agent, txHash: receipt.hash, blockNumber: receipt.blockNumber }));
    return;
  }
  if (process.argv[2] !== '--deploy') return;
  if (balance < estimatedCost * 2n) throw new Error('Balance is too low for deployment plus a gas reserve.');
  const contract = await factory.deploy(USDC, STRATEGY);
  const receipt = await contract.deploymentTransaction().wait();
  console.log(JSON.stringify({ factoryAddress: await contract.getAddress(), txHash: receipt.hash, blockNumber: receipt.blockNumber }));
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
