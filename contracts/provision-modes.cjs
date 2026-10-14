// Creates empty demo Signals and Treasury vaults. Never moves user USDC capital.
// Set ARGENTS_KEY_FILE to a local private-key file; do not commit it.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const RPC = 'https://rpc.mainnet.arc.io';
const FACTORY = '0x1A9555E261E39830317461a767f8D7B5fBF01c5d';
const EXPECTED_OWNER = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
async function main() {
  if (!process.env.ARGENTS_KEY_FILE) throw new Error('Set ARGENTS_KEY_FILE.');
  const raw = fs.readFileSync(process.env.ARGENTS_KEY_FILE, 'utf8').trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(raw)) throw new Error('Expected one hex private key in the key file.');
  const provider = new ethers.JsonRpcProvider(RPC, 5042);
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
  if (wallet.address.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) throw new Error('Unexpected deployer.');
  const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts', 'contracts_ArgentsModes_sol_ArgentsModeFactory.abi'), 'utf8'));
  const factory = new ethers.Contract(FACTORY, abi, wallet);
  const names = [['Argents Signals', 1], ['Argents Treasury', 2]];
  const fee = await provider.getFeeData();
  const balance = await provider.getBalance(wallet.address);
  let costs = 0n;
  for (const [name, mode] of names) {
    const gas = await factory.createAgent.estimateGas(name, 100_000_000n, mode);
    costs += gas * (fee.gasPrice || 0n);
    console.log(JSON.stringify({ name, gas: String(gas), estimatedCostUSDC: ethers.formatEther(gas * (fee.gasPrice || 0n)) }));
  }
  console.log(JSON.stringify({ estimatedTotalUSDC: ethers.formatEther(costs), availableGasUSDC: ethers.formatEther(balance) }));
  if (process.argv[2] !== '--create') return;
  if (balance < costs + ethers.parseEther('0.01')) throw new Error('Insufficient gas balance for both agents and a reserve.');
  for (const [name, mode] of names) {
    const transaction = await factory.createAgent(name, 100_000_000n, mode);
    const receipt = await transaction.wait();
    const event = receipt.logs.map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } }).find((entry) => entry?.name === 'ModeAgentCreated');
    if (!event) throw new Error('Mode agent creation event missing.');
    console.log(JSON.stringify({ name, mode, address: event.args.agent, txHash: receipt.hash, blockNumber: receipt.blockNumber }));
  }
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
