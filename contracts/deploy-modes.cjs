// Set ARGENTS_KEY_FILE to a local private-key file. Never commit that file.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const RPC = 'https://rpc.mainnet.arc.io';
const USDC = '0x3600000000000000000000000000000000000000';
const EXPECTED_OWNER = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
const artifact = (ext) => fs.readFileSync(path.join(__dirname, 'artifacts', `contracts_ArgentsModes_sol_ArgentsModeFactory.${ext}`), 'utf8');
async function main() {
  if (!process.env.ARGENTS_KEY_FILE) throw new Error('Set ARGENTS_KEY_FILE.');
  const raw = fs.readFileSync(process.env.ARGENTS_KEY_FILE, 'utf8').trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(raw)) throw new Error('Expected one hex private key in the key file.');
  const provider = new ethers.JsonRpcProvider(RPC, 5042);
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
  if (wallet.address.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) throw new Error('Unexpected deployer.');
  if ((await provider.getNetwork()).chainId !== 5042n) throw new Error('Wrong chain.');
  const factory = new ethers.ContractFactory(JSON.parse(artifact('abi')), `0x${artifact('bin').trim()}`, wallet);
  const tx = await factory.getDeployTransaction(USDC);
  const gas = await provider.estimateGas({ ...tx, from: wallet.address });
  const fee = await provider.getFeeData();
  const balance = await provider.getBalance(wallet.address);
  const estimatedCost = gas * (fee.gasPrice || 0n);
  console.log(JSON.stringify({ gas: String(gas), estimatedCostUSDC: ethers.formatEther(estimatedCost), availableGasUSDC: ethers.formatEther(balance) }));
  if (process.argv[2] !== '--deploy') return;
  if (balance < estimatedCost * 2n) throw new Error('Insufficient gas balance for deployment plus reserve.');
  const contract = await factory.deploy(USDC);
  const receipt = await contract.deploymentTransaction().wait();
  console.log(JSON.stringify({ contractAddress: await contract.getAddress(), txHash: receipt.hash, blockNumber: receipt.blockNumber }));
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
