// Set ARGENTS_KEY_FILE to a local private-key file. Never commit or print that file.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');

const RPC = 'https://rpc.mainnet.arc.io';
const USDC = '0x3600000000000000000000000000000000000000';
const STRATEGY = '0x8E357432CC12ff425c36432F312968aEb16112AF';
const OWNER = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
const artifact = (ext) => fs.readFileSync(path.join(__dirname, 'artifacts', `contracts_ArgentsAutopilotYield_sol_ArgentsAutopilotYieldFactory.${ext}`), 'utf8');

async function main() {
  if (!process.env.ARGENTS_KEY_FILE) throw new Error('Set ARGENTS_KEY_FILE.');
  const raw = fs.readFileSync(process.env.ARGENTS_KEY_FILE, 'utf8').trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(raw)) throw new Error('Expected one hex private key in the key file.');
  const provider = new ethers.JsonRpcProvider(RPC, 5042);
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
  if (wallet.address.toLowerCase() !== OWNER.toLowerCase()) throw new Error('Unexpected deployer.');
  if ((await provider.getNetwork()).chainId !== 5042n) throw new Error('Wrong chain.');
  const morpho = new ethers.Contract(STRATEGY, ['function asset() view returns (address)'], provider);
  if ((await morpho.asset()).toLowerCase() !== USDC.toLowerCase()) throw new Error('Strategy is not Arc USDC.');
  const factory = new ethers.ContractFactory(JSON.parse(artifact('abi')), `0x${artifact('bin').trim()}`, wallet);
  const tx = await factory.getDeployTransaction(USDC, STRATEGY);
  const gas = await provider.estimateGas({ ...tx, from: wallet.address });
  const fee = await provider.getFeeData();
  const balance = await provider.getBalance(wallet.address);
  const cost = gas * (fee.gasPrice || 0n);
  console.log(JSON.stringify({ gas: String(gas), estimatedCostUSDC: ethers.formatEther(cost), availableGasUSDC: ethers.formatEther(balance) }));
  if (process.argv[2] !== '--deploy') return;
  const reserve = ethers.parseEther('0.003');
  if (balance < cost + reserve) throw new Error(`Insufficient gas balance for deployment plus ${ethers.formatEther(reserve)} USDC reserve.`);
  // Arc uses a stable native-USDC gas price. Pin this deployment to the estimate so
  // ethers does not add a large gas-limit buffer that can exceed a small gas balance.
  const contract = await factory.deploy(USDC, STRATEGY, { gasLimit: gas, gasPrice: fee.gasPrice || 20_000_000_000n });
  const receipt = await contract.deploymentTransaction().wait();
  console.log(JSON.stringify({ factoryAddress: await contract.getAddress(), txHash: receipt.hash, blockNumber: receipt.blockNumber }));
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
