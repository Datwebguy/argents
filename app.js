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
  const YIELD_FACTORY_ADDRESS = "0x02B78468aDA29F698eB6E488EB28d757aA671b6E";
  const YIELD_FACTORY_DEPLOY_BLOCK = 25926643;
  const YIELD_INITIAL_AGENT = "0x9eac69A950a13B40BE06547bE833Df653FE32Db8";
  const YIELD_STRATEGY_ADDRESS = "0x8E357432CC12ff425c36432F312968aEb16112AF";
  const INITIAL_AGENT_ADDRESS = "0x5Fc1df20c04FB0DEbB1B168B3A3D650F1F91f29F";
  const STORAGE_KEY = "argents.agentRecords.v1";
  const FACTORY_PREFIX = "argents.factory.v1.";
  const MANUAL_DISCONNECT_KEY = "argents.manualDisconnect.v1";
  const $ = (selector) => document.querySelector(selector);
  const connectButton = $("#connect-button");
  const connectLabel = $("#connect-label");
  const walletMenu = $("#wallet-menu");
  const walletMenuAddress = $("#wallet-menu-address");
  const balanceValue = $("#wallet-balance");
  const walletFoot = $("#wallet-foot");
  const walletControls = $("#wallet-controls");
  const walletAddress = $("#wallet-address");
  const chainStatus = $("#chain-status");
  const chainDot = document.querySelector(".chain-live-dot");
  const agentDialog = $("#agent-dialog");
  const transactionDialog = $("#transaction-dialog");
  const toast = $("#toast");
  let toastTimer;
  let activeAccount = null;
  let transactionTarget = null;
  let transactionAction = "deposit";
  const isYieldV2 = (agent) => agent.kind === "yield-v2";
  const vaultType = (agent) => isYieldV2(agent) ? "ArgentsYieldVault" : "ArgentsAgentVault";

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

  function formatPreciseUsdc(value) {
    const amount = Number(value) / 1e6;
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(amount);
  }

  function formatSignedUsdc(value) {
    return `${value < 0n ? "−" : value > 0n ? "+" : ""}${formatPreciseUsdc(value < 0n ? -value : value)} USDC`;
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
    if (!activeAccount) return [];
    return agents.filter((agent) => agent.owner.toLowerCase() === activeAccount.toLowerCase());
  }

  function closeWalletMenu() {
    walletMenu.hidden = true;
    connectButton.setAttribute("aria-expanded", "false");
  }

  function disconnectFromApp(showMessage = true) {
    if (showMessage) localStorage.setItem(MANUAL_DISCONNECT_KEY, "1");
    activeAccount = null;
    connectButton.classList.remove("connected");
    connectButton.disabled = false;
    connectLabel.textContent = "Connect wallet";
    connectButton.title = "Connect wallet";
    closeWalletMenu();
    walletMenuAddress.textContent = "";
    walletControls.hidden = true;
    walletAddress.textContent = "";
    balanceValue.innerHTML = `—<span class="metric-unit"> USDC</span>`;
    $("#yield-result").innerHTML = `—<span class="metric-unit"> USDC</span>`;
    $("#yield-result-foot").textContent = "Connect to read Morpho positions";
    walletFoot.textContent = "Connect to read your live Arc balance";
    chainStatus.textContent = "Waiting for wallet";
    chainDot.classList.remove("is-live");
    $("#network-caption").textContent = "USDC is gas";
    $("#activity-body").innerHTML = `<div class="activity-empty-icon">⌁</div>
      <p>Connect a wallet to read its live balance and vault status from Arc Mainnet.</p>
      <button class="inline-link" id="activity-connect">Connect wallet <span>→</span></button>`;
    renderAgents();
    if (showMessage) showToast("Disconnected in Argents. Use Connect wallet to reconnect.");
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
        <div class="agent-data"><strong>${escapeHtml(agent.name)}</strong><small>${isYieldV2(agent) ? "Morpho Yield" : escapeHtml(agent.mode || "Vault")} · Withdrawal cap ${escapeHtml(formatUsdc(BigInt(agent.dailyLimit), 6))} USDC/day</small></div>
        <span class="agent-draft-state agent-contract-state">ON ARC</span>
        <span class="agent-balance" data-balance-for="${escapeHtml(agent.address)}">… USDC</span>
        <a class="agent-explorer" href="https://explorer.arc.io/address/${encodeURIComponent(agent.address)}" target="_blank" rel="noreferrer" aria-label="Open agent vault in Arc explorer">↗</a>
        <div class="agent-controls"><button class="agent-action" data-action="deposit" data-agent-index="${index}">Fund</button>${isYieldV2(agent) ? `<button class="agent-action" data-action="deploy" data-agent-index="${index}">Deploy yield</button>` : ""}<button class="agent-action" data-action="withdraw" data-agent-index="${index}">Withdraw</button><button class="agent-action" data-action="limit" data-agent-index="${index}" aria-label="Set daily withdrawal cap for ${escapeHtml(agent.name)}">Limit</button></div>
        <div class="agent-mode-note">${isYieldV2(agent) ? `Strategy: <a href="https://explorer.arc.io/address/${YIELD_STRATEGY_ADDRESS}" target="_blank" rel="noreferrer">Galaxy USDC on Morpho ↗</a> · Wallet signed deployment` : "Legacy custody vault · No yield strategy"}</div>
      </div>`).join("");
    const yieldAgents = agents.filter(isYieldV2);
    $("#yield-positions").hidden = yieldAgents.length === 0;
    $("#yield-positions-list").innerHTML = yieldAgents.map((agent) => `
      <div class="yield-position-card" data-position-for="${escapeHtml(agent.address.toLowerCase())}">
        <div class="yield-position-heading"><div><strong>${escapeHtml(agent.name)}</strong><small>Galaxy USDC · Morpho on Arc</small></div><a href="https://explorer.arc.io/address/${encodeURIComponent(agent.address)}" target="_blank" rel="noreferrer">View vault ↗</a></div>
        <div class="yield-position-grid">
          <div><span>Current value</span><strong data-position="assets">Loading…</strong></div>
          <div><span>Invested in Morpho</span><strong data-position="invested">Loading…</strong></div>
          <div><span>Idle in agent</span><strong data-position="idle">Loading…</strong></div>
          <div><span>Net result</span><strong data-position="result">Loading…</strong></div>
        </div>
        <p class="yield-position-note" data-position="basis">Reading deposits and withdrawals from Arc…</p>
      </div>`).join("");
    if (window.ethereum && activeAccount && window.ethereum.request) refreshAgentBalances(agents).catch(() => {
      $("#yield-updated").textContent = "Could not read Arc positions. Refresh values to try again.";
    });
  }

  async function loadArtifacts(contractName) {
    const source = contractName.startsWith("ArgentsYield") ? "ArgentsYield" : "ArgentsAgent";
    const base = `./contracts/artifacts/contracts_${source}_sol_${contractName}`;
    const [abiResponse, binResponse] = await Promise.all([fetch(`${base}.abi`), fetch(`${base}.bin`)]);
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
    const abis = await Promise.all([loadArtifacts("ArgentsAgentVault"), loadArtifacts("ArgentsYieldVault")]);
    const results = await Promise.allSettled(agents.map(async (agent) => {
      const vault = new window.ethers.Contract(agent.address, abis[isYieldV2(agent) ? 1 : 0].abi, browserProvider);
      let balance;
      let result = null;
      if (isYieldV2(agent)) {
        const [idle, invested, deposited, withdrawn] = await Promise.all([
          vault.balance(), vault.strategyAssets(), vault.totalDeposited(), vault.totalWithdrawn(),
        ]);
        balance = idle + invested;
        result = balance + withdrawn - deposited;
        const card = Array.from(document.querySelectorAll("[data-position-for]"))
          .find((node) => node.dataset.positionFor === agent.address.toLowerCase());
        if (card) {
          card.querySelector('[data-position="assets"]').textContent = `${formatPreciseUsdc(balance)} USDC`;
          card.querySelector('[data-position="invested"]').textContent = `${formatPreciseUsdc(invested)} USDC`;
          card.querySelector('[data-position="idle"]').textContent = `${formatPreciseUsdc(idle)} USDC`;
          const resultNode = card.querySelector('[data-position="result"]');
          resultNode.textContent = formatSignedUsdc(result);
          resultNode.classList.toggle("negative", result < 0n);
          card.querySelector('[data-position="basis"]').textContent = `Deposited ${formatPreciseUsdc(deposited)} USDC · Withdrawn ${formatPreciseUsdc(withdrawn)} USDC · Result = current value + withdrawals − deposits`;
        }
      } else balance = await vault.balance();
      const element = document.querySelector(`[data-balance-for="${agent.address.toLowerCase()}"]`) ||
        Array.from(document.querySelectorAll("[data-balance-for]")).find((node) => node.dataset.balanceFor.toLowerCase() === agent.address.toLowerCase());
      if (element) element.textContent = `${formatUsdc(balance, 6)} USDC`;
      return result;
    }));
    const yieldAgents = agents.filter(isYieldV2);
    const failures = results.filter((item, index) => isYieldV2(agents[index]) && item.status === "rejected");
    const result = results.reduce((sum, item) => item.status === "fulfilled" && item.value !== null ? sum + item.value : sum, 0n);
    $("#yield-result").innerHTML = failures.length ? `—<span class="metric-unit"> USDC</span>` : `${result < 0n ? "−" : ""}${formatPreciseUsdc(result < 0n ? -result : result)}<span class="metric-unit"> USDC</span>`;
    $("#yield-result-foot").textContent = failures.length ? "Unable to read every Yield position; refresh again" : yieldAgents.length ? "Current value plus withdrawals minus deposits" : "Create a Morpho Yield agent to track results";
    $("#yield-updated").textContent = failures.length ? "Some positions could not be read from Arc. Refresh values to try again." : `Values read from Arc · Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function refreshActivity(agents = visibleAgents()) {
    if (!agents.length || !activeAccount) return;
    const browserProvider = provider();
    const [legacy, yieldVault] = await Promise.all([loadArtifacts("ArgentsAgentVault"), loadArtifacts("ArgentsYieldVault")]);
    const latestBlock = await browserProvider.getBlockNumber();
    const eventGroups = await Promise.allSettled(agents.filter((agent) => Number.isInteger(agent.createdBlock)).map(async (agent) => {
      const vault = new window.ethers.Contract(agent.address, isYieldV2(agent) ? yieldVault.abi : legacy.abi, browserProvider);
      const fromBlock = agent.createdBlock;
      const [deposits, withdrawals, limitChanges] = await Promise.all([
        vault.queryFilter(vault.filters.Deposited(), fromBlock, latestBlock),
        vault.queryFilter(vault.filters.Withdrawn(), fromBlock, latestBlock),
        vault.queryFilter(vault.filters.DailySpendLimitUpdated(), fromBlock, latestBlock),
      ]);
      const strategyEvents = isYieldV2(agent) ? await Promise.all([
        vault.queryFilter(vault.filters.YieldDeployed(), fromBlock, latestBlock),
        vault.queryFilter(vault.filters.YieldRecalled(), fromBlock, latestBlock),
      ]) : [[], []];
      return [
        ...deposits.map((event) => ({ kind: "deposit", agent, amount: event.args.amount, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
        ...withdrawals.map((event) => ({ kind: "withdrawal", agent, amount: event.args.amount, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
        ...limitChanges.map((event) => ({ kind: "limit", agent, amount: event.args.newLimit, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
        ...strategyEvents[0].map((event) => ({ kind: "deploy", agent, amount: event.args.assets, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
        ...strategyEvents[1].map((event) => ({ kind: "recall", agent, amount: event.args.assets, blockNumber: event.blockNumber, txHash: event.transactionHash, index: event.index })),
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
      const label = { deposit: "USDC deposited", withdrawal: "USDC withdrawn", deploy: "USDC deployed to Morpho", recall: "USDC recalled from Morpho", limit: "Daily limit updated" }[entry.kind];
      const value = entry.kind === "limit" ? `${formatUsdc(entry.amount, 6)} USDC limit` : `${entry.kind === "deposit" ? "+" : entry.kind === "withdrawal" ? "−" : ""}${formatUsdc(entry.amount, 6)} USDC`;
      return `<div class="onchain-activity-row">
        <span class="activity-event-mark ${entry.kind}">${entry.kind === "deposit" ? "↓" : entry.kind === "withdrawal" ? "↑" : entry.kind === "deploy" ? "↗" : "≡"}</span>
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
    const vaultArtifact = await loadArtifacts("ArgentsAgentVault");
    // Recover the original deployed vault independently of the factory log query.
    // Some RPC providers reject large historical log ranges even when direct reads work.
    if (account.toLowerCase() === "0x67471d8d542111f15481e599e5ff89529efe60ca") {
      const known = new window.ethers.Contract(INITIAL_AGENT_ADDRESS, vaultArtifact.abi, browserProvider);
      const [owner, name, dailyLimit] = await Promise.all([
        known.owner(), known.name(), known.dailySpendLimit(),
      ]);
      if (owner.toLowerCase() === account.toLowerCase()) {
        saveAgent({
          address: INITIAL_AGENT_ADDRESS,
          owner,
          name,
          mode: "Legacy vault",
          dailyLimit: String(dailyLimit),
          createdBlock: 25907688,
          createdAt: null,
        });
      }
    }
    const factoryArtifact = await loadArtifacts("ArgentsAgentFactory");
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

  async function restoreYieldAgents(account) {
    const browserProvider = provider();
    const factoryAbi = (await loadArtifacts("ArgentsYieldFactory")).abi;
    const vaultAbi = (await loadArtifacts("ArgentsYieldVault")).abi;
    const factory = new window.ethers.Contract(YIELD_FACTORY_ADDRESS, factoryAbi, browserProvider);
    const addresses = await factory.agentsOf(account);
    const latestBlock = await browserProvider.getBlockNumber();
    await Promise.allSettled(addresses.map(async (address) => {
      const vault = new window.ethers.Contract(address, vaultAbi, browserProvider);
      const [owner, name, dailyLimit] = await Promise.all([vault.owner(), vault.name(), vault.dailySpendLimit()]);
      if (owner.toLowerCase() !== account.toLowerCase()) return;
      const existing = getAllAgents().find((agent) => agent.address.toLowerCase() === address.toLowerCase());
      let createdBlock = existing?.createdBlock || null;
      if (!createdBlock) {
        if (address.toLowerCase() === YIELD_INITIAL_AGENT.toLowerCase()) createdBlock = 25926701;
        else {
          const events = await factory.queryFilter(factory.filters.AgentCreated(null, address), YIELD_FACTORY_DEPLOY_BLOCK, latestBlock);
          createdBlock = events[0]?.blockNumber ?? null;
        }
      }
      saveAgent({ address, owner, name, mode: "Yield", kind: "yield-v2", dailyLimit: String(dailyLimit), createdBlock, createdAt: existing?.createdAt || null });
    }));
  }

  async function syncWallet(account = activeAccount) {
    if (!window.ethereum || !account) return;
    if (walletMenuAddress.textContent && walletMenuAddress.textContent.toLowerCase() !== account.toLowerCase()) closeWalletMenu();
    activeAccount = account;
    connectButton.classList.add("connected");
    connectLabel.textContent = shorten(account);
    connectButton.title = "Wallet options";
    walletMenuAddress.textContent = account;
    walletControls.hidden = false;
    walletAddress.textContent = account;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (activeAccount?.toLowerCase() !== account.toLowerCase() || localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1") return;
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
      await restoreAgentsFromChain(account).catch(() => {});
      await restoreYieldAgents(account).catch(() => {});
    } catch {
      // Wallet balance and network status remain useful if factory reads are unavailable.
    }
    if (activeAccount?.toLowerCase() !== account.toLowerCase() || localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1") return;
    balanceValue.innerHTML = `${formatUsdc(BigInt(balanceHex), 18)}<span class="metric-unit"> USDC</span>`;
    walletFoot.innerHTML = `<span class="status-dash"></span>Live native USDC · Arc block ${blockNumber}`;
    chainStatus.textContent = "Connected to Arc";
    chainDot.classList.add("is-live");
    $("#network-caption").textContent = "USDC is gas";
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
      localStorage.removeItem(MANUAL_DISCONNECT_KEY);
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

  async function getFactory(signer, owner, mode) {
    if (mode === "Yield") {
      const artifact = await loadArtifacts("ArgentsYieldFactory");
      const factory = new window.ethers.Contract(YIELD_FACTORY_ADDRESS, artifact.abi, signer);
      const [configuredUsdc, configuredStrategy] = await Promise.all([factory.usdc(), factory.strategy()]);
      if (configuredUsdc.toLowerCase() !== USDC_ADDRESS.toLowerCase() || configuredStrategy.toLowerCase() !== YIELD_STRATEGY_ADDRESS.toLowerCase()) throw new Error("Yield factory configuration does not match Arc USDC and the selected strategy.");
      return factory;
    }
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
      const factory = await getFactory(signer, owner, mode);
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
      saveAgent({ address, owner, name, mode, kind: mode === "Yield" ? "yield-v2" : "legacy", dailyLimit: String(limitInBaseUnits), createdBlock: receipt.blockNumber, createdAt: new Date().toISOString() });
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
    const isDeploy = action === "deploy";
    $("#transaction-title").textContent = isDeposit ? `Fund ${agent.name}.` : isWithdraw ? `Withdraw from ${agent.name}.` : isDeploy ? `Deploy ${agent.name}'s USDC.` : `Set ${agent.name}'s daily withdrawal cap.`;
    $("#transaction-copy").textContent = isDeposit
      ? "Deposit USDC from your wallet into this agent vault. Incoming deposits are not restricted by the withdrawal cap."
      : isWithdraw
        ? "Withdraw USDC to your wallet, up to the remaining daily cap. Invested USDC is recalled automatically when the strategy has liquidity."
        : isDeploy
          ? "Move idle USDC from this agent vault into Galaxy USDC on Morpho. Your wallet signs this action. Strategy value can fall, and withdrawals depend on liquidity."
          : "Set the total USDC this vault can withdraw during one UTC day. Deposits do not count toward this cap.";
    $("#transaction-amount-label").textContent = isLimit ? "New daily withdrawal cap" : "Amount";
    $("#transaction-amount").step = "0.01";
    $("#transaction-amount").min = isLimit ? "0" : "0.01";
    $("#transaction-amount").placeholder = isLimit ? formatUsdc(BigInt(agent.dailyLimit), 6) : "0.00";
    $("#transaction-submit").innerHTML = isDeposit ? "Approve and deposit <span>→</span>" : isWithdraw ? "Withdraw to my wallet <span>→</span>" : isDeploy ? "Deploy to Morpho <span>→</span>" : "Save withdrawal cap <span>→</span>";
    $("#transaction-amount").value = "";
    $("#dialog-wallet-balance").textContent = "Loading…";
    $("#dialog-vault-balance").textContent = "Loading…";
    $("#dialog-daily-cap").textContent = "Loading…";
    $("#dialog-remaining-cap").textContent = "Loading…";
    $("#transaction-rule-note").textContent = "Loading live balances and today's withdrawal allowance from Arc…";
    transactionDialog.showModal();
    refreshTransactionBalances(agent, action).catch(() => {
      $("#dialog-wallet-balance").textContent = "Unavailable";
      $("#dialog-vault-balance").textContent = "Unavailable";
      $("#dialog-daily-cap").textContent = "Unavailable";
      $("#dialog-remaining-cap").textContent = "Unavailable";
      $("#transaction-rule-note").textContent = "Could not read live balances. Check your Arc connection and try again.";
    });
    setTimeout(() => $("#transaction-amount").focus(), 80);
  }

  async function refreshTransactionBalances(agent, action) {
    const browserProvider = provider();
    const vaultAbi = (await loadArtifacts(vaultType(agent))).abi;
    const token = new window.ethers.Contract(USDC_ADDRESS, ["function balanceOf(address account) view returns (uint256)"], browserProvider);
    const vault = new window.ethers.Contract(agent.address, vaultAbi, browserProvider);
    const [walletBalance, vaultBalance, dailyCap, latestBlock] = await Promise.all([
      token.balanceOf(activeAccount),
      isYieldV2(agent) ? vault.totalAssets() : vault.balance(),
      vault.dailySpendLimit(),
      browserProvider.getBlock("latest"),
    ]);
    if (!latestBlock) throw new Error("Latest Arc block is unavailable.");
    const currentDay = BigInt(latestBlock.timestamp) / 86400n;
    const spentToday = await vault.spentByDay(currentDay);
    const remaining = dailyCap > spentToday ? dailyCap - spentToday : 0n;
    $("#dialog-wallet-balance").textContent = `${formatUsdc(walletBalance, 6)} USDC`;
    $("#dialog-vault-balance").textContent = `${formatUsdc(vaultBalance, 6)} USDC`;
    $("#dialog-vault-label").textContent = isYieldV2(agent) ? "Agent total value" : "Agent vault";
    const position = $("#transaction-position");
    position.hidden = !isYieldV2(agent);
    if (isYieldV2(agent)) {
      const [idle, invested] = await Promise.all([vault.balance(), vault.strategyAssets()]);
      $("#dialog-idle-balance").textContent = `${formatUsdc(idle, 6)} USDC`;
      $("#dialog-invested-balance").textContent = `${formatUsdc(invested, 6)} USDC`;
    }
    $("#dialog-daily-cap").textContent = `${formatUsdc(dailyCap, 6)} USDC`;
    $("#dialog-remaining-cap").textContent = `${formatUsdc(remaining, 6)} USDC`;
    $("#transaction-rule-note").textContent = action === "limit"
      ? `Withdrawals already made today: ${formatUsdc(spentToday, 6)} USDC. The allowance resets at 00:00 UTC; lowering the cap does not reset today's withdrawals. Set the cap to 0 to pause withdrawals. Arc uses USDC for gas.`
      : action === "deploy"
        ? "Only idle agent USDC can be deployed. Morpho mints strategy shares to this agent vault. Earnings are variable and capital is at risk."
      : action === "deposit"
        ? `The daily cap limits withdrawals only. You have withdrawn ${formatUsdc(spentToday, 6)} USDC today; the remaining allowance resets at 00:00 UTC. Arc uses USDC for gas.`
        : `This withdrawal uses today's remaining allowance. ${formatUsdc(spentToday, 6)} USDC has been withdrawn today; the cap resets at 00:00 UTC. Arc uses USDC for gas.`;
  }

  async function runVaultTransaction(event) {
    event.preventDefault();
    const submit = $("#transaction-submit");
    const original = transactionAction === "deposit" ? "Approve and deposit <span>→</span>" : transactionAction === "withdraw" ? "Withdraw to my wallet <span>→</span>" : transactionAction === "deploy" ? "Deploy to Morpho <span>→</span>" : "Save withdrawal cap <span>→</span>";
    submit.disabled = true;
    try {
      if (!await ensureConnected()) return;
      const amount = parseUsdc($("#transaction-amount").value);
      if (transactionAction !== "limit" && amount <= 0n) throw new Error("Enter an amount greater than zero.");
      const { signer } = await getSigner();
      const vaultArtifact = await loadArtifacts(vaultType(transactionTarget));
      const vault = new window.ethers.Contract(transactionTarget.address, vaultArtifact.abi, signer);
      if (transactionAction === "deposit") {
        const erc20Abi = [
          "function approve(address spender, uint256 value) external returns (bool)",
          "function balanceOf(address account) view returns (uint256)",
        ];
        const usdc = new window.ethers.Contract(USDC_ADDRESS, erc20Abi, signer);
        const walletBalance = await usdc.balanceOf(activeAccount);
        if (amount > walletBalance) throw new Error(`Your wallet has ${formatUsdc(walletBalance, 6)} USDC available.`);
        submit.textContent = "Approving USDC…";
        showToast("Review and confirm the USDC approval in your wallet.");
        const approval = await usdc.approve(transactionTarget.address, amount);
        await approval.wait();
        submit.textContent = "Depositing…";
        showToast("Approval confirmed. Review the deposit transaction in your wallet.");
        const deposit = await vault.deposit(amount);
        await deposit.wait();
        showToast(`${formatUsdc(amount, 6)} USDC deposited into ${transactionTarget.name}.`);
      } else if (transactionAction === "deploy") {
        if (!isYieldV2(transactionTarget)) throw new Error("This vault has no yield strategy.");
        const idle = await vault.balance();
        if (amount > idle) throw new Error(`Only ${formatUsdc(idle, 6)} USDC is idle in this agent.`);
        const strategy = new window.ethers.Contract(YIELD_STRATEGY_ADDRESS, ["function previewDeposit(uint256 assets) view returns (uint256)"], signer);
        const expectedShares = await strategy.previewDeposit(amount);
        if (expectedShares === 0n) throw new Error("The strategy would mint no shares for this amount.");
        const minShares = expectedShares * 995n / 1000n;
        submit.textContent = "Deploying to Morpho…";
        showToast("Review the strategy deployment in your wallet.");
        const deployment = await vault.deployYield(amount, minShares);
        await deployment.wait();
        showToast(`${formatUsdc(amount, 6)} USDC deployed to Morpho from ${transactionTarget.name}.`);
      } else if (transactionAction === "withdraw") {
        const [vaultBalance, dailyCap, latestBlock] = await Promise.all([
          isYieldV2(transactionTarget) ? vault.totalAssets() : vault.balance(),
          vault.dailySpendLimit(),
          signer.provider.getBlock("latest"),
        ]);
        if (!latestBlock) throw new Error("Could not read the latest Arc block. Try again.");
        const currentDay = BigInt(latestBlock.timestamp) / 86400n;
        const spentToday = await vault.spentByDay(currentDay);
        const remaining = dailyCap > spentToday ? dailyCap - spentToday : 0n;
        if (amount > vaultBalance) throw new Error(`The vault has ${formatUsdc(vaultBalance, 6)} USDC available.`);
        if (amount > remaining) throw new Error(`Only ${formatUsdc(remaining, 6)} USDC remains under today's withdrawal cap.`);
        submit.textContent = "Withdrawing…";
        showToast("Review and confirm the withdrawal in your wallet.");
        const withdrawal = await vault.withdraw(activeAccount, amount);
        await withdrawal.wait();
        showToast(`${formatUsdc(amount, 6)} USDC withdrawn to your wallet.`);
      } else {
        submit.textContent = "Updating limit…";
        showToast("Review and confirm the new daily withdrawal cap in your wallet.");
        const update = await vault.setDailySpendLimit(amount);
        await update.wait();
        const records = getAllAgents().map((agent) => agent.address.toLowerCase() === transactionTarget.address.toLowerCase()
          ? { ...agent, dailyLimit: String(amount) }
          : agent);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        showToast(`Daily withdrawal cap for ${transactionTarget.name} updated on Arc.`);
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

  connectButton.addEventListener("click", () => {
    if (!activeAccount) {
      connectWallet();
      return;
    }
    walletMenu.hidden = !walletMenu.hidden;
    connectButton.setAttribute("aria-expanded", String(!walletMenu.hidden));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".header-wallet-group")) closeWalletMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !walletMenu.hidden) {
      closeWalletMenu();
      connectButton.focus();
    }
  });
  $("#activity-body").addEventListener("click", (event) => {
    if (event.target.closest("#activity-connect")) connectWallet();
  });
  async function copyWalletAddress() {
    if (!activeAccount) return;
    try {
      await navigator.clipboard.writeText(activeAccount);
      showToast("Wallet address copied.");
      closeWalletMenu();
    } catch {
      showToast("Could not copy the address. Select and copy it manually.", "error");
    }
  }
  $("#copy-address").addEventListener("click", copyWalletAddress);
  $("#header-copy-address").addEventListener("click", copyWalletAddress);
  $("#disconnect-wallet").addEventListener("click", () => disconnectFromApp());
  $("#header-disconnect").addEventListener("click", () => disconnectFromApp());
  $("#new-agent-button").addEventListener("click", () => openAgentDialog());
  $("#empty-create").addEventListener("click", () => openAgentDialog());
  $("#view-agents").addEventListener("click", () => $("#agents").scrollIntoView({ behavior: "smooth" }));
  $("#yield-refresh").addEventListener("click", () => {
    $("#yield-updated").textContent = "Refreshing positions from Arc…";
    refreshAgentBalances().catch(() => {
      $("#yield-updated").textContent = "Could not read Arc positions. Check your connection and try again.";
    });
  });
  setInterval(() => {
    if (activeAccount && document.visibilityState === "visible") refreshAgentBalances().catch(() => {});
  }, 30000);
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
      if (localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1") return;
      activeAccount = accounts[0] || null;
      if (activeAccount) {
        connectButton.classList.add("connected");
        connectLabel.textContent = shorten(activeAccount);
        syncWallet(activeAccount).catch(() => showToast("Unable to refresh wallet data.", "error"));
      } else {
        disconnectFromApp(false);
      }
    });
    window.ethereum.on?.("chainChanged", () => {
      if (activeAccount) syncWallet(activeAccount).catch(() => showToast("Unable to refresh network data.", "error"));
    });
    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      if (localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1") return;
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
