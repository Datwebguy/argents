// Read-only Arc Mainnet checks for the deployed mode factory and Signals market.
const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const RPC = 'https://rpc.mainnet.arc.io';
const USDC = '0x3600000000000000000000000000000000000000';
const FACTORY = '0x1A9555E261E39830317461a767f8D7B5fBF01c5d';
const MARKET = '0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68';
const SIGNALS = '0x70baA8a0c215D9DbD05A340CA89E2129649ca04e';
const TREASURY = '0xcAbD3D35448E768e591210eEE216b672C8Ed19f3';
const OWNER = '0x67471d8d542111F15481e599E5FF89529EFE60CA';
const abi = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts', file), 'utf8'));
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, 5042);
  if ((await provider.getNetwork()).chainId !== 5042n) throw new Error('Wrong chain.');
  const factory = new ethers.Contract(FACTORY, abi('contracts_ArgentsModes_sol_ArgentsModeFactory.abi'), provider);
  const market = new ethers.Contract(MARKET, abi('contracts_ArgentsSignals_sol_ArgentsSignals.abi'), provider);
  const vaultAbi = abi('contracts_ArgentsAgent_sol_ArgentsAgentVault.abi');
  const signalsVault = new ethers.Contract(SIGNALS, vaultAbi, provider);
  const treasuryVault = new ethers.Contract(TREASURY, vaultAbi, provider);
  const [factoryCode, marketCode, factoryUsdc, marketUsdc, agents, signalsMode, treasuryMode, signalsOwner, treasuryOwner, offerCount, offer] = await Promise.all([
    provider.getCode(FACTORY), provider.getCode(MARKET), factory.usdc(), market.usdc(), factory.agentsOf(OWNER),
    factory.modeOf(SIGNALS), factory.modeOf(TREASURY), signalsVault.owner(), treasuryVault.owner(), market.offerCount(), market.getOffer(1),
  ]);
  if (factoryCode === '0x' || marketCode === '0x') throw new Error('Missing deployed code.');
  if ([factoryUsdc, marketUsdc].some((address) => address.toLowerCase() !== USDC.toLowerCase())) throw new Error('Wrong USDC.');
  if (!agents.some((address) => address.toLowerCase() === SIGNALS.toLowerCase()) || !agents.some((address) => address.toLowerCase() === TREASURY.toLowerCase())) throw new Error('Mode vault missing from factory.');
  if (signalsMode !== 1n || treasuryMode !== 2n || signalsOwner.toLowerCase() !== OWNER.toLowerCase() || treasuryOwner.toLowerCase() !== OWNER.toLowerCase()) throw new Error('Mode or owner mismatch.');
  if (offerCount < 1n || offer.vault.toLowerCase() !== SIGNALS.toLowerCase() || offer.price !== 10000n) throw new Error('Demo offer mismatch.');
  console.log(JSON.stringify({ chainId: 5042, signalsMode: Number(signalsMode), treasuryMode: Number(treasuryMode), factoryAgentCount: agents.length, offerCount: String(offerCount), firstOfferPriceUSDC: ethers.formatUnits(offer.price, 6) }));
}
main().catch((error) => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
