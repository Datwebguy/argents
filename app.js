(() => {
  const ARC = {
    id: "0x13b2",
    decimalId: 5042,
    chainName: "Arc",
    rpcUrls: ["https://rpc.mainnet.arc.io"],
    blockExplorerUrls: ["https://explorer.arc.io"],
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  };
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const PLATFORM_FACTORY_ADDRESS = "0xfC887cB480f257e8a76e823de9066b5B528a66a9";
  const PLATFORM_FACTORY_DEPLOY_BLOCK = 25907676;
  const INITIAL_AGENT_ADDRESS = "0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F";
  const STORAGE_KEY = "argents.agentRecords.v1";
  const FACTORY_PREFIX = "argents.factory.v1.";
  const $ = (selector) => document.querySelector(selector);
  const connectButton = $("#connect-button");
  const connectLabel = $("#connect-label");
  const balanceValue = $("#wallet-balance");
  const walletFoot = $("#wallet-foot");
  const chainStatus = $("#chain-status");
  const chainDot = document.querySelector(".chain-live-dot");
  const agentDialog = $("#agent-dialog");
  const transactionDialog = $("#transaction-dialog");
  const toast = $("#toast");
  let toastTimer;
  let activeAccount = null;
  let transactionTarget = null;
  let transactionAction = "deposit";

  function showToast(message, kind = "success") {
    toast.textContent = message;
    toast.classList.toggle("error", kind === "error");
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4200);
  }

  function shorten(address) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  function formatUsdc(value, decimals = 6) {
    const amount = Number(value) / 10 ** decimals;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: amount >= 10000 ? 0 : 2,
    }).format(amount);
  }

  function parseUsdc(value) {
    const [whole, fractional = ""] = String(value).split(".");
    if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(fractional) || fractional.length > 6) {
      throw new Error("Enter a valid USDC amount with up to 6 decimal places.");
    }
    return BigInt(whole || "0") * 1000000n + BigInt((fractional + "000000").slice(0, 6));
  }

  function getAllAgents() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function saveAgent(record) {
    const existing = getAllAgents().filter((agent) => agent.address.toLowerCase() !== record.address.toLowerCase());
    existing.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
  }

  function visibleAgents() {
    const agents = getAllAgents();
    if (!activeAccount) return agents;
    return agents.filter((agent) => agent.owner.toLowerCase() === activeAccount.toLowerCase());
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));
  }

  function renderAgents() {
    const agents = visibleAgents();
    const count = agents.length;
    $("#agent-count").textContent = count;
    $("#heading-agent-count").textContent = count;
    $("#metric-agents").innerHTML = `${count}<span class="metric-unit"> ${count === 1 ? "agent" : "agents"}</span>`;
    $("#agents-empty").hidden = count !== 0;
    const list = $("#agent-list");
    list.hidden = count === 0;
    list.innerHTML = agents.map((agent, index) => `
      <div class="agent-row" data-agent-index="${index}">
        <div class="agent-avatar">${escapeHtml(agent.name.trim().slice(0, 1).toUpperCase())}</div>
        <div class="agent-data"><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.mode || "Vault")} · Daily limit ${escapeHtml(formatUsdc(BigInt(agent.dailyLimit), 6))} USDC</small></div>
        <span class="agent-draft-state agent-contract-state">ON ARC</span>
        <span class="agent-balance" data-balance-for="${escapeHtml(agent.address)}">… USDC</span>
        <a class="agent-explorer" href="https://explorer.arc.io/address/${encodeURIComponent(agent.address)}" target="_blank" rel="noreferrer" aria-label="Open agent vault in Arc explorer">↗</a>
        <div class="agent-controls"><button class="agent-action" data-action="deposit" data-agent-index="${index}">Fund</button><button class="agent-action" data-action="withdraw" data-agent-index="${index}">Withdraw</button><button class="agent-action" data-action="limit" data-agent-index="${index}">Rules</button></div>
        <div class="agent-mode-note">Vault created by ${shorten(agent.owner)} · Agent automation is not connected</div>
      </div>`).join("");
    if (window.ethereum && activeAccount && window.ethereum.request) refreshAgentBalances(agents);
  }

  async function loadArtifacts(contractName) {
    const base = "./contracts/artifacts/contracts_ArgentsAgent_sol_";
    const [abiResponse, binResponse] = contractName === "ArgentsAgentFactory"
      ? await Promise.all([
          fetch(`${base}ArgentsAgentFactory.abi`),
          fetch(`${base}ArgentsAgentFactory.bin`),
        ])
      : await Promise.all([
          fetch(`${base}ArgentsAgentVault.abi`),
          fetch(`${base}ArgentsAgentVault.bin`),
        ]);
    if (!abiResponse.ok || !binResponse.ok) throw new Error("Contract artifacts could not be loaded. Serve the project from its root folder.");
    const abi = await abiResponse.json();
    const bytecode = (await binResponse.text()).trim();
    return { abi, bytecode: `0x${bytecode}` };
  }

  function provider() {
    if (!window.ethereum) throw new Error("No browser wallet detected. Install an EVM wallet to continue.");
    if (!window.ethers) throw new Error("Could not load the wallet connection library. Refresh and try again.");
    return new window.ethers.BrowserProvider(window.ethereum, "any");
  }

  async function getSigner() {
    const browserProvider = provider();
    const signer = await browserProvider.getSigner();
    activeAccount = await signer.getAddress();
    return { browserProvider, signer };
  }

  async function ensureArc() {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC.id }],
      });
    } catch (error) {
      if (error.code !== 4902 && error.code !== -32603) throw error;
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [ARC] });
    }
    const actual = await window.ethereum.request({ method: "eth_chainId" });
    if (actual.toLowerCase() !== ARC.id) throw new Error("Switch your wallet to Arc Mainnet to continue.");
  }

  async function refreshAgentBalances(agents = visibleAgents()) {
    const browserProvider = provider();
    const vaultAbi = (await loadArtifacts("ArgentsAgentVault")).abi;
    await Promise.allSettled(agents.map(async (agent) => {
      const vault = new window.ethers.Contract(agent.address, vaultAbi, browserProvider);
      const balance = await vault.balance();
      const element = document.querySelector(`[data-balance-for="${agent.address.toLowerCase()}"]`) ||
        Array.from(document.querySelectorAll("[data-balance-for]")).find((node) => node.dataset.balanceFor.toLowerCase() === agent.address.toLowerCase());
      if (element) element.textContent = `${formatUsdc(balance, 6)} USDC`;
    }));
  }

  async function refreshActivity(agents = visibleAgents()) {
    if (!agents.length || !activeAccount) return;
    const browserProvider = provider();
    const vaultAbi = (await loadArtifacts("ArgentsAgentVault")).abi;
    const latestBlock = await browserProvider.getBlockNumber();
    const eventGroups = await Promise.allSettled(agents.filter((agent) => Number.isInteger(agent.createdBlock)).map(async (agent) => {
      const vault = new window.ethers.Contract(agent.address, vaultAbi, browserProvider);
      const fromBlock = agent.createdBlock;
      const [deposits, withdrawals, limitChanges] = await Promise.all([
        vault.queryFilter(vault.filters.Deposited(), fromBlock, latestBlock),
        vault.queryFilter(vault.filters.Withdrawn(), fromBlock, latestBlock),
        vault.queryFilter(vault.filters.DailySpendLimitUpdated(), fromBlock, latestBlock),
      ]);
      return [
        ...deposits.map((event) => ({ kind: "deposit", agent, amount: event.args.amount, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
        ...withdrawals.map((event) => ({ kind: "withdrawal", agent, amount: event.args.amount, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
        ...limitChanges.map((event) => ({ kind: "limit", agent, amount: event.args.newLimit, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
      ];
    }));
    const entries = eventGroups.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    entries.sort((a, b) => b.blockNumber - a.blockNumber || b.index - a.index);
    const container = $("#activity-body");
    if (!entries.length) {
      container.innerHTML = `<div class="activity-empty-icon">✓</div>
        <p>Wallet connected on Arc Mainnet. Current block: <span style="color:#d0f16d;font-family:var(--mono)">${latestBlock.toLocaleString("en-US")}</span>.</p>
        <a class="inline-link" href="https://explorer.arc.io/address/${activeAccount}" target="_blank" rel="noreferrer">View wallet on explorer <span>↗</span></a>`;
      return;
    }
    container.innerHTML = `<div class="onchain-activity-list">${entries.slice(0, 5).map((entry) => {
      const label = entry.kind === "deposit" ? "USDC deposited" : entry.kind === "withdrawal" ? "USDC withdrawn" : "Daily limit updated";
      const value = entry.kind === "limit" ? `${formatUsdc(entry.amount, 6)} USDC limit` : `${entry.kind === "deposit" ? "+" : "−"}${formatUsdc(entry.amount, 6)} USDC`;
      return `<div class="onchain-activity-row">
        <span class="activity-event-mark ${entry.kind}">${entry.kind === "deposit" ? "↓" : entry.kind === "withdrawal" ? "↑" : "≡"}</span>
        <div class="activity-event-copy"><strong>${escapeHtml(entry.agent.name)}</strong><small>${label} · block ${entry.blockNumber.toLocaleString("en-US")}</small></div>
        <span class="activity-event-value">${value}</span>
        <a href="https://explorer.arc.io/tx/${entry.txHash}" target="_blank" rel="noreferrer" aria-label="Verify transaction on Arc Explorer">↗</a>
      </div>`;
    }).join("")}</div>`;
  }

  async function restoreAgentsFromChain(account) {
    const factoryAddress = PLATFORM_FACTORY_ADDRESS || localStorage.getItem(`${FACTORY_PREFIX}${account.toLowerCase()}`);
    if (!factoryAddress) return;
    const browserProvider = provider();
    const factoryArtifact = await loadArtifacts("ArgentsAgentFactory");
    const vaultArtifact = await loadArtifacts("ArgentsAgentVault");
    const factory = new window.ethers.Contract(factoryAddress, factoryArtifact.abi, browserProvider);
    const chainAddresses = await factory.agentsOf(account);
    const records = getAllAgents();
    const known = new Set(records.map((agent) => agent.address.toLowerCase()));
    const missingAddresses = chainAddresses.filter((address) => !known.has(address.toLowerCase()));
    const latestBlock = await browserProvider.getBlockNumber();
    const recovered = await Promise.allSettled(missingAddresses.map(async (address) => {
      const vault = new window.ethers.Contract(address, vaultArtifact.abi, browserProvider);
      const [name, owner, dailyLimit] = await Promise.all([vault.name(), vault.owner(), vault.dailySpendLimit()]);
      const created = await factory.queryFilter(
        factory.filters.AgentCreated(null, address),
        PLATFORM_FACTORY_DEPLOY_BLOCK,
        latestBlock,
      );
      saveAgent({
        address,
        owner,
        name,
        mode: address.toLowerCase() === INITIAL_AGENT_ADDRESS.toLowerCase() ? "Yield" : "Vault",
        dailyLimit: String(dailyLimit),
        createdBlock: created[0]?.blockNumber ?? null,
        createdAt: null,
      });
    }));
    if (recovered.some((result) => result.status === "fulfilled")) {
      showToast("Agent vaults restored from your Arc factory.");
    }
  }

  async function syncWallet(account = activeAccount) {
    if (!window.ethereum || !account) return;
    activeAccount = account;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId.toLowerCase() !== ARC.id) {
      chainStatus.textContent = "Switch to Arc Mainnet";
      chainDot.classList.remove("is-live");
      balanceValue.innerHTML = `—<span class="metric-unit"> USDC</span>`;
      walletFoot.textContent = "Wallet is connected to another network";
      $("#network-caption").textContent = "Switch to Arc Mainnet";
      return;
    }

    const [balanceHex, blockHex] = await Promise.all([
      window.ethereum.request({ method: "eth_getBalance", params: [account, "latest"] }),
      window.ethereum.request({ method: "eth_blockNumber" }),
    ]);
    const blockNumber = Number(BigInt(blockHex)).toLocaleString("en-US");
    try {
      await restoreAgentsFromChain(account);
    } catch {
      // Wallet balance and network status remain useful if factory reads are unavailable.
    }
    balanceValue.innerHTML = `${formatUsdc(BigInt(balanceHex), 18)}<span class="metric-unit"> USDC</span>`;
    walletFoot.innerHTML = `<span class="status-dash"></span>Live native USDC · Arc block ${blockNumber}`;
    chainStatus.textContent = "Connected to Arc";
    chainDot.classList.add("is-live");
    $("#network-caption").textContent = "USDC is gas";
    $("#live-status").textContent = "Connected";
    $("#activity-body").innerHTML = `<div class="activity-empty-icon">✓</div>
      <p>Wallet connected on Arc Mainnet. Current block: <span style="color:#d0f16d;font-family:var(--mono)">${blockNumber}</span>.</p>
      <a class="inline-link" href="https://explorer.arc.io/address/${account}" target="_blank" rel="noreferrer">View wallet on explorer <span>↗</span></a>`;
    renderAgents();
    refreshActivity(visibleAgents()).catch(() => {});
  }

  async function connectWallet() {
    if (!window.ethereum) {
      showToast("Install an EVM wallet, then add Arc Mainnet to connect.", "error");
      return false;
    }
    connectButton.disabled = true;
    connectLabel.textContent = "Connecting…";
    try {
      await ensureArc();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts[0]) throw new Error("No wallet account was returned.");
      activeAccount = accounts[0];
      connectButton.classList.add("connected");
      connectLabel.textContent = shorten(activeAccount);
      await syncWallet(activeAccount);
      showToast("Wallet connected to Arc Mainnet.");
      return true;
    } catch (error) {
      if (error.code === 4001) showToast("Wallet request cancelled.", "error");
      else showToast(error.message || "Could not connect to Arc Mainnet.", "error");
      connectLabel.textContent = activeAccount ? shorten(activeAccount) : "Connect wallet";
      return false;
    } finally {
      connectButton.disabled = false;
    }
  }

  async function ensureConnected() {
    if (!activeAccount) {
      const connected = await connectWallet();
      if (!connected) return false;
    }
    await ensureArc();
    return true;
  }

  async function getFactory(signer, owner) {
    const key = `${FACTORY_PREFIX}${owner.toLowerCase()}`;
    let address = PLATFORM_FACTORY_ADDRESS || localStorage.getItem(key);
    const factoryArtifact = await loadArtifacts("ArgentsAgentFactory");
    if (address) {
      const existing = new window.ethers.Contract(address, factoryArtifact.abi, signer);
      const configuredUsdc = await existing.usdc();
      if (configuredUsdc.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
        localStorage.setItem(key, address);
        return existing;
      }
      localStorage.removeItem(key);
    }

    $("#create-agent-submit").innerHTML = "Deploying factory…";
    const factoryCode = new window.ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, signer);
    const factory = await factoryCode.deploy(USDC_ADDRESS);
    showToast("Confirm factory deployment in your wallet. Arc gas is paid in USDC.");
    await factory.waitForDeployment();
    address = await factory.getAddress();
    localStorage.setItem(key, address);
    return factory;
  }

  async function createAgent(event) {
    event.preventDefault();
    const submit = $("#create-agent-submit");
    const original = "Create on Arc <span>→</span>";
    submit.disabled = true;
    try {
      if (!await ensureConnected()) return;
      const formData = new FormData(event.currentTarget);
      const name = String(formData.get("name") || "").trim();
      const mode = String(formData.get("mode") || "Yield");
      const limit = String(formData.get("limit") || "100");
      if (!name) throw new Error("Enter a name for this agent.");
      const { signer } = await getSigner();
      const owner = await signer.getAddress();
      const factory = await getFactory(signer, owner);
      submit.textContent = "Creating vault…";
      showToast("Confirm agent vault creation in your wallet.");
      const limitInBaseUnits = parseUsdc(limit);
      const transaction = await factory.createAgent(name, limitInBaseUnits);
      const receipt = await transaction.wait();
      const createdEvent = receipt.logs.map((log) => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      }).find((eventLog) => eventLog?.name === "AgentCreated");
      if (!createdEvent) throw new Error("The transaction completed, but the agent address was not found in its receipt.");
      const address = createdEvent.args.agent;
      saveAgent({ address, owner, name, mode, dailyLimit: String(limitInBaseUnits), createdBlock: receipt.blockNumber, createdAt: new Date().toISOString() });
      renderAgents();
      agentDialog.close();
      event.currentTarget.reset();
      $("#agent-limit").value = "100";
      showToast(`${name} is live on Arc. Open the vault address to verify it.`);
      $("#activity-body").innerHTML = `<div class="activity-empty-icon">✓</div><p><strong>${escapeHtml(name)}</strong> vault deployed at <span style="font-family:var(--mono)">${shorten(address)}</span>.</p><a class="inline-link" href="https://explorer.arc.io/address/${address}" target="_blank" rel="noreferrer">Verify on Arc Explorer <span>↗</span></a>`;
      refreshActivity(visibleAgents()).catch(() => {});
    } catch (error) {
      if (error.code === 4001) showToast("Transaction cancelled in wallet.", "error");
      else showToast(error.shortMessage || error.message || "Could not create the agent on Arc.", "error");
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  }

  function openAgentDialog(mode = "Yield") {
    $("#agent-mode").value = mode;
    agentDialog.showModal();
    setTimeout(() => $("#agent-name").focus(), 80);
  }

  function openTransactionDialog(agent, action) {
    transactionTarget = agent;
    transactionAction = action;
    const isDeposit = action === "deposit";
    const isWithdraw = action === "withdraw";
    const isLimit = action === "limit";
    $("#transaction-title").textContent = isDeposit ? `Fund ${agent.name}.` : isWithdraw ? `Withdraw from ${agent.name}.` : `Update ${agent.name}'s limit.`;
    $("#transaction-copy").textContent = isDeposit
      ? "Approve USDC, then deposit it into this agent's Arc vault."
      : isWithdraw
        ? `USDC will be sent from the vault to your connected wallet. Daily limit: ${formatUsdc(BigInt(agent.dailyLimit), 6)} USDC.`
        : `Set the maximum amount this vault can withdraw in one day. Current limit: ${formatUsdc(BigInt(agent.dailyLimit), 6)} USDC.`;
    $("#transaction-submit").innerHTML = isDeposit ? "Approve and deposit <span>→</span>" : isWithdraw ? "Withdraw to my wallet <span>→</span>" : "Update limit on Arc <span>→</span>";
    $("#transaction-amount").value = "";
    transactionDialog.showModal();
    setTimeout(() => $("#transaction-amount").focus(), 80);
  }

  async function runVaultTransaction(event) {
    event.preventDefault();
    const submit = $("#transaction-submit");
    const original = transactionAction === "deposit" ? "Approve and deposit <span>→</span>" : transactionAction === "withdraw" ? "Withdraw to my wallet <span>→</span>" : "Update limit on Arc <span>→</span>";
    submit.disabled = true;
    try {
      if (!await ensureConnected()) return;
      const amount = parseUsdc($("#transaction-amount").value);
      if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
      const { signer } = await getSigner();
      const vaultArtifact = await loadArtifacts("ArgentsAgentVault");
      const vault = new window.ethers.Contract(transactionTarget.address, vaultArtifact.abi, signer);
      if (transactionAction === "deposit") {
        const erc20Abi = ["function approve(address spender, uint256 value) external returns (bool)"];
        const usdc = new window.ethers.Contract(USDC_ADDRESS, erc20Abi, signer);
        submit.textContent = "Approving USDC…";
        showToast("Review and confirm the USDC approval in your wallet.");
        const approval = await usdc.approve(transactionTarget.address, amount);
        await approval.wait();
        submit.textContent = "Depositing…";
        showToast("Approval confirmed. Review the deposit transaction in your wallet.");
        const deposit = await vault.deposit(amount);
        await deposit.wait();
        showToast(`${formatUsdc(amount, 6)} USDC deposited into ${transactionTarget.name}.`);
      } else if (transactionAction === "withdraw") {
        submit.textContent = "Withdrawing…";
        showToast("Review and confirm the withdrawal in your wallet.");
        const withdrawal = await vault.withdraw(activeAccount, amount);
        await withdrawal.wait();
        showToast(`${formatUsdc(amount, 6)} USDC withdrawn to your wallet.`);
      } else {
        submit.textContent = "Updating limit…";
        showToast("Review and confirm the new withdrawal limit in your wallet.");
        const update = await vault.setDailySpendLimit(amount);
        await update.wait();
        const records = getAllAgents().map((agent) => agent.address.toLowerCase() === transactionTarget.address.toLowerCase()
          ? { ...agent, dailyLimit: String(amount) }
          : agent);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        showToast(`Daily limit for ${transactionTarget.name} updated on Arc.`);
      }
      transactionDialog.close();
      await syncWallet(activeAccount);
    } catch (error) {
      if (error.code === 4001) showToast("Transaction cancelled in wallet.", "error");
      else showToast(error.shortMessage || error.message || "Vault transaction failed.", "error");
    } finally {
      submit.disabled = false;
      submit.innerHTML = original;
    }
  }

  connectButton.addEventListener("click", connectWallet);
  $("#activity-connect").addEventListener("click", connectWallet);
  $("#new-agent-button").addEventListener("click", () => openAgentDialog());
  $("#empty-create").addEventListener("click", () => openAgentDialog());
  $("#view-agents").addEventListener("click", () => $("#agents").scrollIntoView({ behavior: "smooth" }));
  document.querySelectorAll("[data-create-mode]").forEach((button) => {
    button.addEventListener("click", () => openAgentDialog(button.dataset.createMode));
  });
  $("#agent-form").addEventListener("submit", createAgent);
  $("#transaction-form").addEventListener("submit", runVaultTransaction);
  $("#agent-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const agent = visibleAgents()[Number(button.dataset.agentIndex)];
    if (agent) openTransactionDialog(agent, button.dataset.action);
  });

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", (accounts) => {
      activeAccount = accounts[0] || null;
      if (activeAccount) {
        connectButton.classList.add("connected");
        connectLabel.textContent = shorten(activeAccount);
        syncWallet(activeAccount).catch(() => showToast("Unable to refresh wallet data.", "error"));
      } else {
        connectButton.classList.remove("connected");
        connectLabel.textContent = "Connect wallet";
        balanceValue.innerHTML = `—<span class="metric-unit"> USDC</span>`;
        walletFoot.textContent = "Connect to read your live Arc balance";
        chainStatus.textContent = "Waiting for wallet";
        chainDot.classList.remove("is-live");
        renderAgents();
      }
    });
    window.ethereum.on?.("chainChanged", () => {
      if (activeAccount) syncWallet(activeAccount).catch(() => showToast("Unable to refresh network data.", "error"));
    });
    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts?.[0]) {
        activeAccount = accounts[0];
        connectButton.classList.add("connected");
        connectLabel.textContent = shorten(activeAccount);
        syncWallet(activeAccount).catch(() => {});
      }
    }).catch(() => {});
  }

  renderAgents();
})();
