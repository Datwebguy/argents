const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const USDC = (n) => ethers.parseUnits(String(n), 6);
const DAY = 24 * 60 * 60;

async function setup() {
  const [owner, other, buyer] = await ethers.getSigners();
  const usdc = await (await ethers.getContractFactory('MockUSDC')).deploy();
  const morpho = await (await ethers.getContractFactory('MockMorpho')).deploy(usdc);
  await usdc.mint(owner.address, USDC(1000));
  await usdc.mint(buyer.address, USDC(1000));
  return { owner, other, buyer, usdc, morpho };
}

async function deployVault(kind, { owner, usdc, morpho }, cap = USDC(100), bps = 5000) {
  let factory;
  if (kind === 'agent') {
    factory = await (await ethers.getContractFactory('ArgentsAgentFactory')).deploy(usdc);
    await factory.createAgent('Treasury', cap);
  } else if (kind === 'yield') {
    factory = await (await ethers.getContractFactory('ArgentsYieldFactory')).deploy(usdc, morpho);
    await factory.createAgent('Yield', cap);
  } else {
    factory = await (await ethers.getContractFactory('ArgentsAutopilotYieldFactory')).deploy(usdc, morpho);
    await factory.createAgent('Autopilot', cap, bps);
  }
  const [addr] = await factory.agentsOf(owner.address);
  const name = { agent: 'ArgentsAgentVault', yield: 'ArgentsYieldVault', autopilot: 'ArgentsAutopilotYieldVault' }[kind];
  const vault = await ethers.getContractAt(name, addr);
  await usdc.approve(addr, USDC(1000));
  return vault;
}

for (const kind of ['agent', 'yield', 'autopilot']) {
  describe(`${kind} vault: shared guardrails`, () => {
    let ctx, vault;
    beforeEach(async () => {
      ctx = await setup();
      vault = await deployVault(kind, ctx);
      await vault.deposit(USDC(500));
    });

    it('withdraws within the daily cap', async () => {
      await vault.withdraw(ctx.owner.address, USDC(60));
      expect(await vault.spentByDay(Math.floor((await time.latest()) / DAY))).to.equal(USDC(60));
    });

    it('reverts LimitExceeded above the cap', async () => {
      await expect(vault.withdraw(ctx.owner.address, USDC(101))).to.be.revertedWithCustomError(vault, 'LimitExceeded');
    });

    it('counts cumulative withdrawals in one UTC day', async () => {
      await vault.withdraw(ctx.owner.address, USDC(60));
      await expect(vault.withdraw(ctx.owner.address, USDC(41))).to.be.revertedWithCustomError(vault, 'LimitExceeded');
      await vault.withdraw(ctx.owner.address, USDC(40));
    });

    it('resets the cap at the next UTC day', async () => {
      await vault.withdraw(ctx.owner.address, USDC(100));
      await time.increase(DAY);
      await vault.withdraw(ctx.owner.address, USDC(100));
    });

    it('blocks non-owners from every owner action', async () => {
      const v = vault.connect(ctx.other);
      await expect(v.withdraw(ctx.other.address, USDC(1))).to.be.revertedWithCustomError(vault, 'NotOwner');
      await expect(v.deposit(USDC(1))).to.be.revertedWithCustomError(vault, 'NotOwner');
      await expect(v.setDailySpendLimit(USDC(1000000))).to.be.revertedWithCustomError(vault, 'NotOwner');
    });

    it('rejects zero amount and zero recipient', async () => {
      await expect(vault.withdraw(ctx.owner.address, 0)).to.be.revertedWithCustomError(vault, 'ZeroAmount');
      await expect(vault.deposit(0)).to.be.revertedWithCustomError(vault, 'ZeroAmount');
      await expect(vault.withdraw(ethers.ZeroAddress, USDC(1))).to.be.revertedWithCustomError(vault, 'ZeroAddress');
    });
  });
}

describe('factory input validation', () => {
  it('rejects empty and over-long names', async () => {
    const ctx = await setup();
    const f = await (await ethers.getContractFactory('ArgentsAgentFactory')).deploy(ctx.usdc);
    await expect(f.createAgent('', 1)).to.be.revertedWithCustomError(f, 'EmptyName');
    await expect(f.createAgent('x'.repeat(33), 1)).to.be.revertedWithCustomError(f, 'InvalidNameLength');
    await f.createAgent('x'.repeat(32), 1);
  });

  it('rejects a strategy whose asset is not the vault USDC (Yield and Autopilot)', async () => {
    const ctx = await setup();
    const otherToken = await (await ethers.getContractFactory('MockUSDC')).deploy();
    const wrong = await (await ethers.getContractFactory('MockMorpho')).deploy(otherToken);
    const Y = await ethers.getContractFactory('ArgentsYieldFactory');
    const A = await ethers.getContractFactory('ArgentsAutopilotYieldFactory');
    await expect(Y.deploy(ctx.usdc, wrong)).to.be.revertedWithCustomError(Y, 'InvalidAsset');
    await expect(A.deploy(ctx.usdc, wrong)).to.be.revertedWithCustomError(A, 'InvalidAsset');
  });
});

describe('yield vault: manual strategy', () => {
  it('deploys idle USDC and recalls it, keeping totalAssets reconciled', async () => {
    const ctx = await setup();
    const vault = await deployVault('yield', ctx);
    await vault.deposit(USDC(200));
    await vault.deployYield(USDC(150), 1);
    expect(await vault.balance()).to.equal(USDC(50));
    expect(await vault.strategyAssets()).to.equal(USDC(150));
    expect(await vault.totalAssets()).to.equal(USDC(200));
    await vault.recallYield(USDC(100), 1);
    expect(await vault.totalAssets()).to.equal(USDC(200));
    expect(await vault.balance()).to.equal(USDC(150));
  });

  it('rejects deploying more than idle, and slippage', async () => {
    const ctx = await setup();
    const vault = await deployVault('yield', ctx);
    await vault.deposit(USDC(10));
    await expect(vault.deployYield(USDC(11), 1)).to.be.revertedWithCustomError(vault, 'InsufficientIdle');
    await expect(vault.deployYield(USDC(5), USDC(6))).to.be.revertedWithCustomError(vault, 'SlippageExceeded');
  });

  it('recalls Morpho shares to honor a withdrawal larger than idle', async () => {
    const ctx = await setup();
    const vault = await deployVault('yield', ctx);
    await vault.deposit(USDC(200));
    await vault.deployYield(USDC(190), 1);
    await vault.withdraw(ctx.other.address, USDC(60));
    expect(await ctx.usdc.balanceOf(ctx.other.address)).to.equal(USDC(60));
    expect(await vault.totalAssets()).to.equal(USDC(140));
  });
});

describe('autopilot vault: allocation rule', () => {
  it('applies the allocation on deposit', async () => {
    const ctx = await setup();
    const vault = await deployVault('autopilot', ctx, USDC(100), 7000);
    await vault.deposit(USDC(100));
    expect(await vault.strategyAssets()).to.equal(USDC(70));
    expect(await vault.balance()).to.equal(USDC(30));
    expect(await vault.totalAssets()).to.equal(USDC(100));
  });

  it('rebalances when the owner changes the target, up and down', async () => {
    const ctx = await setup();
    const vault = await deployVault('autopilot', ctx, USDC(100), 5000);
    await vault.deposit(USDC(100));
    await vault.setAllocationBps(10000);
    expect(await vault.strategyAssets()).to.equal(USDC(100));
    await vault.setAllocationBps(0);
    expect(await vault.strategyAssets()).to.equal(0);
    expect(await vault.balance()).to.equal(USDC(100));
  });

  it('rejects allocations above 100% at the factory and setter; only the owner can set', async () => {
    const ctx = await setup();
    const f = await (await ethers.getContractFactory('ArgentsAutopilotYieldFactory')).deploy(ctx.usdc, ctx.morpho);
    await expect(f.createAgent('Bad', USDC(1), 10001)).to.be.revertedWithCustomError(f, 'InvalidAllocation');
    const vault = await deployVault('autopilot', ctx);
    await expect(vault.setAllocationBps(10001)).to.be.revertedWithCustomError(vault, 'InvalidAllocation');
    await expect(vault.connect(ctx.other).setAllocationBps(1)).to.be.revertedWithCustomError(vault, 'NotOwner');
  });

  it('lets anyone call rebalance but never moves funds out of the vault', async () => {
    const ctx = await setup();
    const vault = await deployVault('autopilot', ctx, USDC(100), 5000);
    await vault.deposit(USDC(100));
    // Drift the vault by donating idle USDC, then restore the rule as a stranger.
    await ctx.usdc.mint(await vault.getAddress(), USDC(100));
    const before = await vault.totalAssets();
    const strangerBefore = await ctx.usdc.balanceOf(ctx.other.address);
    await vault.connect(ctx.other).rebalance();
    expect(await vault.totalAssets()).to.equal(before);
    expect(await vault.strategyAssets()).to.equal(USDC(100));
    expect(await ctx.usdc.balanceOf(ctx.other.address)).to.equal(strangerBefore);
  });

  it('withdraw recalls from Morpho and still enforces the cap', async () => {
    const ctx = await setup();
    const vault = await deployVault('autopilot', ctx, USDC(100), 10000);
    await vault.deposit(USDC(300));
    await vault.withdraw(ctx.other.address, USDC(80));
    expect(await ctx.usdc.balanceOf(ctx.other.address)).to.equal(USDC(80));
    await expect(vault.withdraw(ctx.other.address, USDC(21))).to.be.revertedWithCustomError(vault, 'LimitExceeded');
  });
});

describe('signals marketplace', () => {
  async function market() {
    const ctx = await setup();
    const f = await (await ethers.getContractFactory('ArgentsAgentFactory')).deploy(ctx.usdc);
    await f.createAgent('Publisher', USDC(100));
    const [vault] = await f.agentsOf(ctx.owner.address);
    const signals = await (await ethers.getContractFactory('ArgentsSignals')).deploy(ctx.usdc);
    await ctx.usdc.connect(ctx.buyer).approve(await signals.getAddress(), USDC(1000));
    return { ...ctx, vault, signals };
  }

  it('settles payment straight into the publisher vault and records the receipt flow', async () => {
    const c = await market();
    await c.signals.createOffer(c.vault, 'Report', USDC(25));
    await c.signals.connect(c.buyer).buy(1);
    expect(await c.usdc.balanceOf(c.vault)).to.equal(USDC(25));
    await c.signals.deliver(1, 'https://example.com/r');
    await c.signals.connect(c.buyer).acknowledge(1);
    const order = await c.signals.getOrder(1);
    expect(order.acknowledged).to.equal(true);
    expect(order.deliveryUri).to.equal('https://example.com/r');
  });

  it('only the vault owner can publish an offer; bad inputs revert', async () => {
    const c = await market();
    await expect(c.signals.connect(c.other).createOffer(c.vault, 'Report', USDC(1))).to.be.revertedWithCustomError(c.signals, 'NotPublisher');
    await expect(c.signals.createOffer(c.vault, '', USDC(1))).to.be.revertedWithCustomError(c.signals, 'InvalidInput');
    await expect(c.signals.createOffer(c.vault, 'R', 0)).to.be.revertedWithCustomError(c.signals, 'InvalidInput');
    await expect(c.signals.createOffer(c.other.address, 'R', 1)).to.be.revertedWithCustomError(c.signals, 'InvalidInput');
  });

  it('enforces delivery and acknowledgement roles and one-time transitions', async () => {
    const c = await market();
    await c.signals.createOffer(c.vault, 'Report', USDC(25));
    await c.signals.connect(c.buyer).buy(1);
    await expect(c.signals.connect(c.other).deliver(1, 'https://x')).to.be.revertedWithCustomError(c.signals, 'NotPublisher');
    await expect(c.signals.connect(c.buyer).acknowledge(1)).to.be.revertedWithCustomError(c.signals, 'InvalidInput');
    await c.signals.deliver(1, 'https://x');
    await expect(c.signals.deliver(1, 'https://y')).to.be.revertedWithCustomError(c.signals, 'AlreadyDelivered');
    await expect(c.signals.connect(c.other).acknowledge(1)).to.be.revertedWithCustomError(c.signals, 'NotBuyer');
    await c.signals.connect(c.buyer).acknowledge(1);
    await expect(c.signals.connect(c.buyer).acknowledge(1)).to.be.revertedWithCustomError(c.signals, 'AlreadyAcknowledged');
    await expect(c.signals.connect(c.buyer).buy(99)).to.be.revertedWithCustomError(c.signals, 'UnknownRecord');
  });
});

describe('mode factory', () => {
  it('registers Signals (1) and Treasury (2) only', async () => {
    const ctx = await setup();
    const f = await (await ethers.getContractFactory('ArgentsModeFactory')).deploy(ctx.usdc);
    await expect(f.createAgent('A', 1, 0)).to.be.revertedWithCustomError(f, 'InvalidMode');
    await expect(f.createAgent('A', 1, 3)).to.be.revertedWithCustomError(f, 'InvalidMode');
    await expect(f.createAgent('', 1, 1)).to.be.revertedWithCustomError(f, 'InvalidName');
    await f.createAgent('S', 1, 1);
    await f.createAgent('T', 1, 2);
    const [s, t] = await f.agentsOf(ctx.owner.address);
    expect(await f.modeOf(s)).to.equal(1);
    expect(await f.modeOf(t)).to.equal(2);
  });
});
