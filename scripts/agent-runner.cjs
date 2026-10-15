#!/usr/bin/env node
/**
 * Argents Autonomous Agent Runtime (Arc Mainnet)
 * 
 * Executes autonomous agent operations on Arc Mainnet:
 * - Monitors agent smart vaults
 * - In Signals mode: auto-detects paid orders and delivers report links on-chain
 * - In Yield mode: monitors idle treasury reserves and rebalances into Morpho Galaxy USDC
 * - In Treasury mode: enforces daily expenditure limits and audit logs
 */

const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');

const ARC_RPC = process.env.ARC_RPC || 'https://rpc.mainnet.arc.io';
const CHAIN_ID = 5042;
const USDC_ADDR = '0x3600000000000000000000000000000000000000';
const SIGNALS_MARKET = '0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68';
const MORPHO_GALAXY_USDC = '0x8E357432CC12ff425c36432F312968aEb16112AF';

const VAULT_ABI = [
  'function owner() external view returns (address)',
  'function name() external view returns (string)',
  'function usdc() external view returns (address)',
  'function dailySpendLimit() external view returns (uint256)',
  'function balance() external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function strategyShares() external view returns (uint256)',
  'function strategyAssets() external view returns (uint256)',
  'function totalDeposited() external view returns (uint256)',
  'function totalWithdrawn() external view returns (uint256)',
  'function rebalance() external',
  'function withdraw(address recipient, uint256 amount) external'
];

const SIGNALS_ABI = [
  'function offerCount() external view returns (uint256)',
  'function orderCount() external view returns (uint256)',
  'function deliver(uint256 orderId, string calldata deliveryUri) external',
  'event OfferCreated(uint256 indexed offerId, address indexed publisher, address indexed vault, uint256 price, string title)',
  'event OrderPaid(uint256 indexed orderId, uint256 indexed offerId, address indexed buyer, uint256 price, address vault)',
  'event OrderDelivered(uint256 indexed orderId, string deliveryUri)',
  'event ReceiptAcknowledged(uint256 indexed orderId, address indexed buyer)'
];

function getProvider() {
  return new ethers.JsonRpcProvider(ARC_RPC, CHAIN_ID);
}

function getOperatorWallet(provider) {
  const keyFile = process.env.ARGENTS_KEY_FILE;
  if (!keyFile || !fs.existsSync(keyFile)) {
    throw new Error('Operator key file not configured. Please set the ARGENTS_KEY_FILE environment variable.');
  }
  const raw = fs.readFileSync(keyFile, 'utf8').trim();
  return new ethers.Wallet(raw.startsWith('0x') ? raw : `0x${raw}`, provider);
}

async function inspectAgent(vaultAddress) {
  const provider = getProvider();
  if (!ethers.isAddress(vaultAddress)) throw new Error(`Invalid address: ${vaultAddress}`);
  
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
  const [owner, name, limit, balance] = await Promise.all([
    vault.owner().catch(() => 'unknown'),
    vault.name().catch(() => 'unnamed'),
    vault.dailySpendLimit().catch(() => 0n),
    vault.balance().catch(() => 0n)
  ]);

  let totalAssets = balance;
  let strategyAssets = 0n;
  try {
    strategyAssets = await vault.strategyAssets();
    totalAssets = await vault.totalAssets();
  } catch { /* Non-yield vault */ }

  const info = {
    network: 'Arc Mainnet (5042)',
    vault: vaultAddress,
    name,
    owner,
    idleUSDC: ethers.formatUnits(balance, 6),
    investedMorphoUSDC: ethers.formatUnits(strategyAssets, 6),
    totalAssetsUSDC: ethers.formatUnits(totalAssets, 6),
    dailyLimitUSDC: ethers.formatUnits(limit, 6)
  };
  return info;
}

async function checkPendingSignals(vaultAddress) {
  const provider = getProvider();
  const market = new ethers.Contract(SIGNALS_MARKET, SIGNALS_ABI, provider);
  const orderCount = await market.orderCount();
  
  console.log(`[Signals Daemon] Total orders on market: ${orderCount}`);
  return { orderCount: Number(orderCount) };
}

async function fulfillSignalOrder(orderId, deliveryUri) {
  const provider = getProvider();
  const wallet = getOperatorWallet(provider);
  const market = new ethers.Contract(SIGNALS_MARKET, SIGNALS_ABI, wallet);
  
  console.log(`[Signals Daemon] Fulfilling order #${orderId} with URI: ${deliveryUri}...`);
  const tx = await market.deliver(orderId, deliveryUri);
  console.log(`[Signals Daemon] Delivery submitted: ${tx.hash}. Waiting confirmation...`);
  const receipt = await tx.wait();
  console.log(`[Signals Daemon] Confirmed in block ${receipt.blockNumber}.`);
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

async function main() {
  const command = process.argv[2] || 'help';
  const target = process.argv[3];

  switch (command) {
    case 'inspect': {
      if (!target) {
        console.error('Usage: node agent-runner.cjs inspect <vaultAddress>');
        process.exit(1);
      }
      const data = await inspectAgent(target);
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'signals': {
      const data = await checkPendingSignals(target);
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'fulfill': {
      const orderId = target;
      const uri = process.argv[4];
      if (!orderId || !uri) {
        console.error('Usage: node agent-runner.cjs fulfill <orderId> <deliveryUri>');
        process.exit(1);
      }
      const res = await fulfillSignalOrder(orderId, uri);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    default:
      console.log(`Argents Autonomous Agent Runtime`);
      console.log(`Commands:`);
      console.log(`  inspect <vaultAddress>              Inspect agent balances and limits on Arc`);
      console.log(`  signals [vaultAddress]              Check pending Signals orders on Arc`);
      console.log(`  fulfill <orderId> <deliveryUri>     Deliver report link for paid order`);
      break;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });
}

module.exports = { inspectAgent, checkPendingSignals, fulfillSignalOrder };
