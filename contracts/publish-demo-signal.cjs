// Publishes an offer without spending or moving USDC capital.
// Set ARGENTS_KEY_FILE to the local deployer key file; never commit it.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const RPC = 'https://rpc.mainnet.arc.io';
const MARKET = '0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68';
const VAULT = '0x70baA8a0c215D9DbD05A340CA89E2129649ca04e';
const OWNER = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
async function main() {
  if (!process.env.ARGENTS_KEY_FILE) throw new Error('Set ARGENTS_KEY_FILE.');
  const raw = fs.readFileSync(process.env.ARGENTS_KEY_FILE, 'utf8').trim();
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(raw)) throw new Error('Expected one hex private key in the key file.');
  const provider = new ethers.JsonRpcProvider(RPC, 5042);
  const wallet = new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
  if (wallet.address.toLowerCase() !== OWNER.toLowerCase()) throw new Error('Unexpected publisher.');
  const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts', 'contracts_ArgentsSignals_sol_ArgentsSignals.abi'), 'utf8'));
  const market = new ethers.Contract(MARKET, abi, wallet);
  const title = 'Arc USDC market update';
  const price = 10_000n;
  const gas = await market.createOffer.estimateGas(VAULT, title, price);
  const fee = await provider.getFeeData();
  const balance = await provider.getBalance(wallet.address);
  const cost = gas * (fee.gasPrice || 0n);
  console.log(JSON.stringify({ gas: String(gas), estimatedCostUSDC: ethers.formatEther(cost), availableGasUSDC: ethers.formatEther(balance) }));
  if (process.argv[2] !== '--publish') return;
  if (balance < cost + ethers.parseEther('0.01')) throw new Error('Insufficient gas reserve.');
  const receipt = await (await market.createOffer(VAULT, title, price)).wait();
  const event = receipt.logs.map((log) => { try { return market.interface.parseLog(log); } catch { return null; } }).find((entry) => entry?.name === 'OfferCreated');
  console.log(JSON.stringify({ offerId: String(event.args.offerId), txHash: receipt.hash, blockNumber: receipt.blockNumber }));
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
