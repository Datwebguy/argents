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
  const SIGNALS_ADDRESS = "0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68";
  const MODE_FACTORY_ADDRESS = "0x1A9555E261E39830317461a767f8D7B5fBF01c5d";
  const MODE_FACTORY_DEPLOY_BLOCK = 25932927;
  const DISCOVERY_STORAGE_KEY = "argents.discovery.yield-v2.v1";
  const DISCOVERY_SCAN_STEP = 2000;
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
  let discoveryPending = null;
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
      maximumFractionDigits: decimals === 6 ? 6 : amount >= 10000 ? 0 : 2,
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
    if (reownModal) {
      reownModal.disconnect?.().catch(() => {});
    }
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
    const pageEmpty = $("#agents-page-empty");
    if (pageEmpty) pageEmpty.hidden = count !== 0;
    const list = $("#agent-list");
    const pageList = $("#agents-page-list");
    const viewCount = $("#view-agents-count");
    if (viewCount) viewCount.textContent = count;
    list.hidden = count === 0;
    if (pageList) pageList.hidden = count === 0;
    const renderedRows = agents.map((agent, index) => `
      <div class="agent-row" data-agent-index="${index}">
        <div class="agent-avatar">${escapeHtml(agent.name.trim().slice(0, 1).toUpperCase())}</div>
        <div class="agent-data"><strong>${escapeHtml(agent.name)}</strong><small>${isYieldV2(agent) ? "Morpho Yield" : escapeHtml(agent.mode || "Vault")} · Withdrawal cap ${escapeHtml(formatUsdc(BigInt(agent.dailyLimit), 6))} USDC/day</small></div>
        <span class="agent-draft-state agent-contract-state">ACTIVE</span>
        <span class="agent-balance" data-balance-for="${escapeHtml(agent.address)}">… USDC</span>
        <a class="agent-explorer" href="https://explorer.arc.io/address/${encodeURIComponent(agent.address)}" target="_blank" rel="noreferrer" aria-label="Open agent in explorer">↗</a>
        <div class="agent-controls">${agent.mode === "Signals" ? `<a class="agent-action agent-manage-link" href="#signals">Manage Signals →</a>` : ""}<button class="agent-action" data-action="deposit" data-agent-index="${index}">Fund</button><button class="agent-action" data-copy-vault="${escapeHtml(agent.address)}" type="button">Copy address</button>${isYieldV2(agent) ? `<button class="agent-action" data-action="deploy" data-agent-index="${index}">Deploy yield</button>` : ""}<button class="agent-action" data-action="withdraw" data-agent-index="${index}">Withdraw</button>${agent.mode === "Treasury" ? `<button class="agent-action" data-action="send" data-agent-index="${index}">Send USDC</button>` : ""}<button class="agent-action" data-action="limit" data-agent-index="${index}" aria-label="Set daily withdrawal cap for ${escapeHtml(agent.name)}">Limit</button></div>
        <div class="agent-mode-note">${isYieldV2(agent) ? `Strategy: <a href="https://explorer.arc.io/address/${YIELD_STRATEGY_ADDRESS}" target="_blank" rel="noreferrer">Galaxy USDC on Morpho ↗</a> · Approved from your wallet` : agent.mode === "Signals" ? "Sell reports for USDC · Payments stay with this agent" : agent.mode === "Treasury" ? "Receives USDC directly · Transfers require your approval and respect your daily limit" : "Standard custody · Direct holdings"}</div>
      </div>`).join("");
    list.innerHTML = renderedRows;
    if (pageList) pageList.innerHTML = renderedRows;
    $("#signal-vault").innerHTML = `<option value="">Select a Signals agent</option>${agents.filter((agent) => agent.mode === "Signals").map((agent) => `<option value="${escapeHtml(agent.address)}">${escapeHtml(agent.name)} · ${shorten(agent.address)}</option>`).join("")}`;
    const yieldAgents = agents.filter(isYieldV2);
    const yieldEmpty = $("#yield-empty");
    if (yieldEmpty) yieldEmpty.hidden = yieldAgents.length !== 0;
    const yieldList = $("#yield-positions-list");
    if (yieldList) yieldList.hidden = yieldAgents.length === 0;
    if (yieldAgents.length === 0) {
      $("#yield-result").innerHTML = 'Morpho<span class="metric-unit"> Galaxy</span>';
      $("#yield-result-foot").innerHTML = '<a href="#yield" style="color:var(--lime); text-decoration:none;">View active Arc yield strategy ↗</a>';
    }
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
    if (getWallet() && activeAccount && getWallet().request) refreshAgentBalances(agents).catch(() => {
      $("#yield-updated").textContent = "Could not read Arc positions. Refresh values to try again.";
    });
  }

  async function loadArtifacts(contractName) {
    const source = contractName.startsWith("ArgentsYield") ? "ArgentsYield" : contractName === "ArgentsSignals" ? "ArgentsSignals" : contractName === "ArgentsModeFactory" ? "ArgentsModes" : "ArgentsAgent";
    const base = `./contracts/artifacts/contracts_${source}_sol_${contractName}`;
    const [abiResponse, binResponse] = await Promise.all([fetch(`${base}.abi`), fetch(`${base}.bin`)]);
    if (!abiResponse.ok || !binResponse.ok) throw new Error("Contract artifacts could not be loaded. Serve the project from its root folder.");
    const abi = await abiResponse.json();
    const bytecode = (await binResponse.text()).trim();
    return { abi, bytecode: `0x${bytecode}` };
  }

  const REOWN_PROJECT_ID = "5e0237c8b46078873a253229145e1409";
  let reownModal = null;

  async function initReown() {
    if (typeof window === "undefined" || reownModal) return;
    try {
      const { createAppKit } = await import("https://esm.sh/@reown/appkit@1.8.24");
      const { EthersAdapter } = await import("https://esm.sh/@reown/appkit-adapter-ethers@1.8.24");

      const arcNetwork = {
        id: 5042,
        name: "Arc Mainnet",
        network: "arc",
        nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
        rpcUrls: {
          default: { http: ["https://rpc.mainnet.arc.io"] },
          public: { http: ["https://rpc.mainnet.arc.io"] },
        },
        blockExplorers: {
          default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
        },
      };

      reownModal = createAppKit({
        adapters: [new EthersAdapter()],
        networks: [arcNetwork],
        defaultNetwork: arcNetwork,
        metadata: {
          name: "Argents",
          description: "Owner-controlled USDC agents on Arc",
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.svg`],
        },
        projectId: REOWN_PROJECT_ID,
        features: {
          analytics: false,
          email: false,
          socials: false,
        },
        themeMode: "dark",
        themeVariables: {
          "--w3m-accent": "#d0f16d",
          "--w3m-border-radius-master": "2px",
        },
      });
      window.reownAppKit = reownModal;

      const handleReownState = () => {
        const addr = reownModal.getAddress?.();
        if (addr && addr.toLowerCase() !== activeAccount?.toLowerCase()) {
          activeAccount = addr;
          localStorage.removeItem(MANUAL_DISCONNECT_KEY);
          connectButton.classList.add("connected");
          connectLabel.textContent = shorten(addr);
          const p = reownModal.getProvider?.();
          if (p) setupWalletListeners(p);
          syncWallet(addr).catch(() => {});
        } else if (!addr && activeAccount && localStorage.getItem(MANUAL_DISCONNECT_KEY) === "1") {
          disconnectFromApp(false);
        }
      };

      reownModal.subscribeState?.(handleReownState);
      reownModal.subscribeEvents?.((event) => {
        if (["CONNECT_SUCCESS", "MODAL_CLOSE", "DISCONNECT_SUCCESS"].includes(event?.data?.event)) {
          handleReownState();
        }
      });

      handleReownState();
    } catch (err) {
      console.warn("Reown AppKit initialization deferred or unavailable:", err);
    }
  }

  let eip6963Providers = [];
  if (typeof window !== "undefined") {
    window.addEventListener("eip6963:announceProvider", (event) => {
      if (event?.detail?.provider && !eip6963Providers.some((p) => p.info?.uuid === event.detail.info?.uuid)) {
        eip6963Providers.push(event.detail);
        setupWalletListeners(event.detail.provider);
      }
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  function getWallet() {
    if (reownModal) {
      const p = reownModal.getWalletProvider?.() || reownModal.getProvider?.();
      if (p) return p;
    }
    if (eip6963Providers.length > 0 && eip6963Providers[0].provider) {
      return eip6963Providers[0].provider;
    }
    if (typeof window !== "undefined") {
      if (window.ethereum) {
        if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
          return window.ethereum.providers.find((p) => p.isMetaMask) || window.ethereum.providers[0];
        }
        return window.ethereum;
      }
      if (window.rabby) return window.rabby;
      if (window.phantom?.ethereum) return window.phantom.ethereum;
      if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
      if (window.okxwallet) return window.okxwallet;
    }
    return null;
  }

  let _readProvider = null;
  function getReadProvider() {
    if (!_readProvider && typeof window !== "undefined" && window.ethers) {
      _readProvider = new window.ethers.JsonRpcProvider(ARC.rpcUrls[0], ARC.decimalId);
    }
    return _readProvider;
  }

  function setupWalletListeners(wallet) {
    if (!wallet || wallet._argentsListenersAttached) return;
    wallet._argentsListenersAttached = true;
    wallet.on?.("accountsChanged", (accounts) => {
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
    wallet.on?.("chainChanged", () => {
      if (activeAccount) syncWallet(activeAccount).catch(() => showToast("Unable to refresh network data.", "error"));
    });
  }

  function provider() {
    const wallet = getWallet();
    if (!wallet) throw new Error("No browser wallet detected. Install an EVM wallet to continue.");
    if (!window.ethers) throw new Error("Could not load the wallet connection library. Refresh and try again.");
    return new window.ethers.BrowserProvider(wallet, "any");
  }

  async function getSigner() {
    const browserProvider = provider();
    const signer = await browserProvider.getSigner();
    activeAccount = await signer.getAddress();
    return { browserProvider, signer };
  }

  async function ensureArc() {
    const wallet = getWallet();
    if (!wallet) throw new Error("No browser wallet detected.");
    try {
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC.id }],
      });
    } catch (error) {
      if (error.code !== 4902 && error.code !== -32603) throw error;
      await wallet.request({ method: "wallet_addEthereumChain", params: [ARC] });
    }
    const actual = await wallet.request({ method: "eth_chainId" });
    if (actual.toLowerCase() !== ARC.id) throw new Error("Switch your wallet to Arc Mainnet to continue.");
  }

  async function refreshAgentBalances(agents = visibleAgents()) {
    const browserProvider = getReadProvider() || (getWallet() ? provider() : null);
    if (!browserProvider) return;
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
          card.querySelector('[data-position="basis"]').textContent = `Deposited ${formatPreciseUsdc(deposited)} USDC · Withdrawn ${formatPreciseUsdc(withdrawn)} USDC · Result = current value + withdrawals − deposits. Direct transfers can affect this figure.`;
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

  function discoveryCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY) || "null");
      if (cached?.factory === YIELD_FACTORY_ADDRESS.toLowerCase() &&
          Number.isInteger(cached.lastBlock) && Array.isArray(cached.records) &&
          cached.records.every((record) => /^0x[a-fA-F0-9]{40}$/.test(record.address) && /^0x[a-fA-F0-9]{40}$/.test(record.owner))) return cached;
    } catch { /* Rescan from the factory deployment block. */ }
    return { factory: YIELD_FACTORY_ADDRESS.toLowerCase(), lastBlock: YIELD_FACTORY_DEPLOY_BLOCK - 1, records: [] };
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function getLogsWithRetry(provider, filter, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await provider.getLogs(filter);
      } catch (err) {
        if (attempt === maxRetries - 1) throw err;
        await wait(200 * (attempt + 1));
      }
    }
  }

  async function refreshDiscovery() {
    if (discoveryPending) return discoveryPending;
    discoveryPending = (async () => {
      const status = $("#discovery-status");
      const button = $("#discovery-refresh");
      button.disabled = true;
      try {
        if (!window.ethers) throw new Error("Could not load the Arc reader. Reload the page.");
        const publicProvider = new window.ethers.JsonRpcProvider(ARC.rpcUrls[0], ARC.decimalId);
        const factoryAbi = (await loadArtifacts("ArgentsYieldFactory")).abi;
        const vaultAbi = (await loadArtifacts("ArgentsYieldVault")).abi;
        const factoryInterface = new window.ethers.Interface(factoryAbi);
        const topic = factoryInterface.getEvent("AgentCreated").topicHash;
        const latest = await publicProvider.getBlockNumber();
        const cache = discoveryCache();
        if (cache.lastBlock > latest) {
          cache.lastBlock = YIELD_FACTORY_DEPLOY_BLOCK - 1;
          cache.records = [];
        }
        // Re-read a small overlap so a temporarily delayed RPC log cannot be missed forever.
        for (let from = Math.max(cache.lastBlock - 63, YIELD_FACTORY_DEPLOY_BLOCK); from <= latest;) {
          const to = Math.min(from + DISCOVERY_SCAN_STEP - 1, latest);
          status.textContent = `Syncing agents…`;
          const logs = await getLogsWithRetry(publicProvider, { address: YIELD_FACTORY_ADDRESS, fromBlock: from, toBlock: to, topics: [topic] });
          const known = new Set(cache.records.map((record) => record.address.toLowerCase()));
          for (const log of logs) {
            const event = factoryInterface.parseLog(log);
            const address = event.args.agent;
            if (!known.has(address.toLowerCase())) {
              cache.records.push({ address, owner: event.args.owner, createdBlock: log.blockNumber });
              known.add(address.toLowerCase());
            }
          }
          cache.lastBlock = to;
          localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(cache));
          from = to + 1;
          await wait(80);
        }
        status.textContent = `Reading ${cache.records.length} agent ${cache.records.length === 1 ? "position" : "positions"} from Arc…`;
        const positions = [];
        for (let start = 0; start < cache.records.length; start += 8) {
          const batch = await Promise.allSettled(cache.records.slice(start, start + 8).map(async (record) => {
            if (!window.ethers.isAddress(record.address) || !window.ethers.isAddress(record.owner)) return null;
            const vault = new window.ethers.Contract(record.address, vaultAbi, publicProvider);
            const [name, owner, assets, deposited, withdrawn] = await Promise.all([
              vault.name(), vault.owner(), vault.totalAssets(), vault.totalDeposited(), vault.totalWithdrawn(),
            ]);
            if (owner.toLowerCase() !== record.owner.toLowerCase()) return null;
            return { address: record.address, owner, name, assets, result: assets + withdrawn - deposited };
          }));
          for (const item of batch) if (item.status === "fulfilled" && item.value) positions.push(item.value);
        }
        positions.sort((a, b) => a.assets === b.assets ? a.address.localeCompare(b.address) : a.assets > b.assets ? -1 : 1);
        $("#discovery-list").innerHTML = positions.length ? positions.slice(0, 20).map((agent, index) => `
          <div class="discovery-row">
            <span class="discovery-rank">${String(index + 1).padStart(2, "0")}</span>
            <div class="discovery-identity"><strong>${escapeHtml(agent.name)}</strong><small>By ${shorten(agent.owner)} · ${shorten(agent.address)}</small></div>
            <div class="discovery-value"><span>CURRENT VALUE</span><strong>${formatPreciseUsdc(agent.assets)} USDC</strong></div>
            <div class="discovery-value discovery-result"><span>NET RESULT</span><strong class="${agent.result < 0n ? "negative" : ""}">${formatSignedUsdc(agent.result)}</strong></div>
            <a class="discovery-open" href="https://explorer.arc.io/address/${encodeURIComponent(agent.address)}" target="_blank" rel="noreferrer" aria-label="View ${escapeHtml(agent.name)} on Arc Explorer">↗</a>
          </div>`).join("") : `<p class="discovery-intro">No Yield agents found on Arc yet.</p>`;
        status.textContent = `${positions.length} public Yield ${positions.length === 1 ? "agent" : "agents"} · Ranked by current vault value · Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      } catch (error) {
        const msg = error.shortMessage || error.message || "";
        status.textContent = (msg.includes("coalesce") || msg.includes("rate limit"))
          ? "Arc public RPC busy. Click 'Refresh public ranking' in a few seconds."
          : (msg || "Could not load public agents from Arc. Refresh to try again.");
      } finally {
        button.disabled = false;
      }
    })().finally(() => { discoveryPending = null; });
    return discoveryPending;
  }

  async function refreshModeDiscovery() {
    const status = $("#mode-discovery-status");
    try {
      const reader = new window.ethers.JsonRpcProvider(ARC.rpcUrls[0], ARC.decimalId);
      const factoryAbi = (await loadArtifacts("ArgentsModeFactory")).abi;
      const vaultAbi = (await loadArtifacts("ArgentsAgentVault")).abi;
      const iface = new window.ethers.Interface(factoryAbi);
      const topic = iface.getEvent("ModeAgentCreated").topicHash;
      const latest = await reader.getBlockNumber();
      const records = [];
      for (let from = MODE_FACTORY_DEPLOY_BLOCK; from <= latest; from += DISCOVERY_SCAN_STEP) {
        const logs = await getLogsWithRetry(reader, { address: MODE_FACTORY_ADDRESS, fromBlock: from, toBlock: Math.min(latest, from + DISCOVERY_SCAN_STEP - 1), topics: [topic] });
        for (const log of logs) {
          const event = iface.parseLog(log);
          records.push({ address: event.args.agent, owner: event.args.owner, mode: Number(event.args.mode) === 1 ? "Signals" : "Treasury", name: event.args.name });
        }
        await wait(80);
      }
      const values = await Promise.allSettled(records.map(async (record) => {
        const vault = new window.ethers.Contract(record.address, vaultAbi, reader);
        const [owner, balance] = await Promise.all([vault.owner(), vault.balance()]);
        return owner.toLowerCase() === record.owner.toLowerCase() ? { ...record, balance } : null;
      }));
      const positions = values.filter((item) => item.status === "fulfilled" && item.value).map((item) => item.value);
      positions.sort((a, b) => a.balance === b.balance ? a.address.localeCompare(b.address) : a.balance > b.balance ? -1 : 1);
      $("#mode-discovery-list").innerHTML = positions.length ? positions.slice(0, 20).map((agent, index) => `
        <div class="discovery-row"><span class="discovery-rank">${String(index + 1).padStart(2, "0")}</span><div class="discovery-identity"><strong>${escapeHtml(agent.name)} · ${agent.mode}</strong><small>By ${shorten(agent.owner)} · ${shorten(agent.address)}</small></div><div class="discovery-value"><span>VAULT BALANCE</span><strong>${formatPreciseUsdc(agent.balance)} USDC</strong></div><a class="discovery-open" href="https://explorer.arc.io/address/${agent.address}" target="_blank" rel="noreferrer">↗</a></div>`).join("") : `<p class="discovery-intro">No public Signals or Treasury agents found yet.</p>`;
      status.textContent = `${positions.length} public Signals and Treasury ${positions.length === 1 ? "agent" : "agents"} · Ranked by vault balance`;
    } catch (error) {
      const msg = error.shortMessage || error.message || "";
      status.textContent = (msg.includes("coalesce") || msg.includes("rate limit"))
        ? "Arc public RPC busy. Click refresh in a moment."
        : (msg || "Could not read public mode agents from Arc.");
    }
  }

  async function signalsContract(runner) {
    const { abi } = await loadArtifacts("ArgentsSignals");
    return new window.ethers.Contract(SIGNALS_ADDRESS, abi, runner);
  }

  async function refreshSignals() {
    const status = $("#signals-status");
    try {
      if (!window.ethers) throw new Error("Wallet library is unavailable.");
      const reader = new window.ethers.JsonRpcProvider(ARC.rpcUrls[0], ARC.decimalId);
      const market = await signalsContract(reader);
      const [offerCount, orderCount] = await Promise.all([market.offerCount(), market.orderCount()]);
      const offerIds = Array.from({ length: Math.min(Number(offerCount), 50) }, (_, i) => Number(offerCount) - i);
      const orderIds = Array.from({ length: Math.min(Number(orderCount), 100) }, (_, i) => Number(orderCount) - i);
      const [offerResults, orderResults] = await Promise.all([
        Promise.allSettled(offerIds.map((id) => market.getOffer(id).then((offer) => ({ id, offer })))),
        Promise.allSettled(orderIds.map((id) => market.getOrder(id).then((order) => ({ id, order })))),
      ]);
      const offers = offerResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
      const orders = orderResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
      $("#signal-offers").innerHTML = offers.length ? offers.map(({ id, offer }) => `
        <div class="signal-row"><div><strong>${escapeHtml(offer.title)}</strong><small>Offer #${id} · ${shorten(offer.publisher)} · <a href="https://explorer.arc.io/address/${offer.vault}" target="_blank" rel="noreferrer">Payment vault ↗</a></small></div><span>${formatPreciseUsdc(offer.price)} USDC</span><button class="agent-action" type="button" data-signal-buy="${id}">Buy report</button></div>`).join("") : `<p class="signal-empty">No paid reports published yet.</p>`;
      const visibleOrders = orders.filter(({ order }) => activeAccount && (order.buyer.toLowerCase() === activeAccount.toLowerCase() || offers.some(({ id, offer }) => BigInt(id) === order.offerId && offer.publisher.toLowerCase() === activeAccount.toLowerCase())));
      $("#signal-orders").innerHTML = visibleOrders.length ? visibleOrders.map(({ id, order }) => {
        const offer = offers.find((record) => BigInt(record.id) === order.offerId)?.offer;
        const isPublisher = offer?.publisher.toLowerCase() === activeAccount?.toLowerCase();
        const isBuyer = order.buyer.toLowerCase() === activeAccount?.toLowerCase();
        const delivered = Boolean(order.deliveryUri);
        return `<div class="signal-order"><div><strong>Order #${id} · ${escapeHtml(offer?.title || `Offer #${order.offerId}`)}</strong><small>${order.acknowledged ? "Receipt confirmed" : delivered ? "Delivered on Arc" : "Paid · Awaiting delivery"} · Buyer ${shorten(order.buyer)}</small></div>${delivered ? /^https:\/\//i.test(order.deliveryUri) ? `<a class="signal-uri" href="${escapeHtml(order.deliveryUri)}" target="_blank" rel="noreferrer">Open delivery ↗</a>` : `<code class="signal-uri">${escapeHtml(order.deliveryUri)}</code>` : ""}${isPublisher && !delivered ? `<div class="signal-deliver"><input data-signal-uri="${id}" maxlength="512" placeholder="https://… delivery link" aria-label="Delivery link for order ${id}" /><button class="agent-action" type="button" data-signal-deliver="${id}">Deliver</button></div>` : ""}${isBuyer && delivered && !order.acknowledged ? `<button class="agent-action" type="button" data-signal-ack="${id}">Confirm receipt</button>` : ""}</div>`;
      }).join("") : `<p class="signal-empty">Connect the buying or publishing wallet to see its orders.</p>`;
      status.textContent = `${offerCount} offers · ${orderCount} paid orders · Data read from Arc`;
    } catch (error) {
      status.textContent = error.shortMessage || error.message || "Could not read Signals data from Arc.";
    }
  }

  async function publishSignal(event) {
    event.preventDefault();
    try {
      if (!await ensureConnected()) return;
      const vaultAddress = $("#signal-vault").value;
      const title = $("#signal-title").value.trim();
      const price = parseUsdc($("#signal-price").value);
      if (!vaultAddress || !title || price <= 0n) throw new Error("Choose your Signals vault, report title, and a price above zero.");
      const { signer } = await getSigner();
      const market = await signalsContract(signer);
      showToast("Confirm the paid report offer in your wallet.");
      await (await market.createOffer(vaultAddress, title, price)).wait();
      $("#signal-title").value = "";
      $("#signal-price").value = "";
      showToast("Paid report offer published on Arc.");
      await refreshSignals();
    } catch (error) { showToast(error.shortMessage || error.message || "Could not publish offer.", "error"); }
  }

  async function signalAction(event) {
    const button = event.target.closest("[data-signal-buy], [data-signal-deliver], [data-signal-ack]");
    if (!button) return;
    button.disabled = true;
    try {
      if (!await ensureConnected()) return;
      const { signer } = await getSigner();
      const market = await signalsContract(signer);
      if (button.dataset.signalBuy) {
        const offerId = BigInt(button.dataset.signalBuy);
        const offer = await market.getOffer(offerId);
        const token = new window.ethers.Contract(USDC_ADDRESS, ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"], signer);
        if (await token.balanceOf(activeAccount) < offer.price) throw new Error("Your wallet does not have enough Arc USDC for this report.");
        if (await token.allowance(activeAccount, SIGNALS_ADDRESS) < offer.price) {
          showToast("Approve the report price in your wallet.");
          await (await token.approve(SIGNALS_ADDRESS, offer.price)).wait();
        }
        showToast("Confirm payment. USDC goes directly to the publisher's vault.");
        await (await market.buy(offerId)).wait();
        showToast("Paid. The publisher can now deliver your report.");
      } else if (button.dataset.signalDeliver) {
        const orderId = BigInt(button.dataset.signalDeliver);
        const uri = document.querySelector(`[data-signal-uri="${orderId}"]`)?.value.trim();
        if (!uri || !/^https:\/\//i.test(uri)) throw new Error("Enter an HTTPS delivery link. The link is public on chain.");
        showToast("Confirm the delivery link in your wallet.");
        await (await market.deliver(orderId, uri)).wait();
        showToast("Delivery recorded on Arc.");
      } else {
        showToast("Confirm receipt in your wallet.");
        await (await market.acknowledge(BigInt(button.dataset.signalAck))).wait();
        showToast("Receipt confirmed on Arc.");
      }
      await refreshSignals();
      await syncWallet(activeAccount);
    } catch (error) { showToast(error.shortMessage || error.message || "Signals transaction failed.", "error"); }
    finally { button.disabled = false; }
  }

  async function refreshActivity(agents = visibleAgents()) {
    if (!agents.length || !activeAccount) return;
    const browserProvider = getReadProvider() || (getWallet() ? provider() : null);
    if (!browserProvider) return;
    const [legacy, yieldVault] = await Promise.all([loadArtifacts("ArgentsAgentVault"), loadArtifacts("ArgentsYieldVault")]);
    const latestBlock = await browserProvider.getBlockNumber();
    const eventGroups = await Promise.allSettled(agents.filter((agent) => Number.isInteger(agent.createdBlock)).map(async (agent) => {
      const vault = new window.ethers.Contract(agent.address, isYieldV2(agent) ? yieldVault.abi : legacy.abi, browserProvider);
      const entries = [];
      for (let fromBlock = agent.createdBlock; fromBlock <= latestBlock; fromBlock += 2000) {
        const toBlock = Math.min(fromBlock + 1999, latestBlock);
        const logs = await browserProvider.getLogs({ address: agent.address, fromBlock, toBlock });
        for (const log of logs) {
          let event;
          try { event = vault.interface.parseLog(log); } catch { continue; }
          const kind = { Deposited: "deposit", Withdrawn: "withdrawal", DailySpendLimitUpdated: "limit", YieldDeployed: "deploy", YieldRecalled: "recall" }[event?.name];
          if (!kind) continue;
          const amount = kind === "limit" ? event.args.newLimit : kind === "recall" ? event.args.assets : event.args.amount ?? event.args.assets;
          entries.push({ kind, agent, amount, recipient: event.args.recipient || null, blockNumber: log.blockNumber, txHash: log.transactionHash, index: log.index });
        }
        if (!isYieldV2(agent)) {
          const transfers = await browserProvider.getLogs({
            address: USDC_ADDRESS, fromBlock, toBlock,
            topics: [window.ethers.id("Transfer(address,address,uint256)"), null, window.ethers.zeroPadValue(agent.address, 32)],
          });
          for (const log of transfers) entries.push({ kind: "inflow", agent, amount: BigInt(log.data), blockNumber: log.blockNumber, txHash: log.transactionHash, index: log.index });
        }
      }
      const depositTransactions = new Set(entries.filter((entry) => entry.kind === "deposit").map((entry) => entry.txHash));
      return entries.filter((entry) => entry.kind !== "inflow" || !depositTransactions.has(entry.txHash));
    }));
    const entries = eventGroups.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    entries.sort((a, b) => b.blockNumber - a.blockNumber || b.index - a.index);
    const container = $("#activity-body"); const fullList = $("#activity-full-list");
    if (!entries.length) {
      if (eventGroups.some((result) => result.status === "rejected")) {
        container.innerHTML = `<div class="activity-empty-icon">!</div><p>Could not load vault history from Arc. Reload the page or view the vault on Arc Explorer.</p>`;
        return;
      }
      container.innerHTML = `<div class="activity-empty-icon">✓</div>
        <p>Wallet connected. Ready to deploy and fund agents.</p>
        <a class="inline-link" href="https://explorer.arc.io/address/${activeAccount}" target="_blank" rel="noreferrer">View in explorer <span>↗</span></a>`;
      return;
    }
    const renderedEntries = `<div class="onchain-activity-list">${entries.slice(0, 30).map((entry) => {
      const label = { deposit: "USDC deposited", inflow: "USDC received", withdrawal: entry.recipient ? `USDC sent to ${shorten(entry.recipient)}` : "USDC withdrawn", deploy: "USDC deployed to Morpho", recall: "USDC recalled from Morpho", limit: "Daily limit updated" }[entry.kind];
      const value = entry.kind === "limit" ? `${formatUsdc(entry.amount, 6)} USDC limit` : `${["deposit", "inflow"].includes(entry.kind) ? "+" : entry.kind === "withdrawal" ? "−" : ""}${formatUsdc(entry.amount, 6)} USDC`;
      return `<div class="onchain-activity-row">
        <span class="activity-event-mark ${entry.kind}">${entry.kind === "deposit" ? "↓" : entry.kind === "withdrawal" ? "↑" : entry.kind === "deploy" ? "↗" : "≡"}</span>
        <div class="activity-event-copy"><strong>${escapeHtml(entry.agent.name)}</strong><small>${label}</small></div>
        <span class="activity-event-value">${value}</span>
        <a href="https://explorer.arc.io/tx/${entry.txHash}" target="_blank" rel="noreferrer" aria-label="Verify transaction on Arc Explorer">↗</a>
      </div>`;
    }).join("")}</div>`;
    container.innerHTML = renderedEntries;
    if (fullList) fullList.innerHTML = renderedEntries;
  }

  async function findCreationBlock(factory, address, deploymentBlock, latestBlock, eventName = "AgentCreated") {
    for (let fromBlock = deploymentBlock; fromBlock <= latestBlock; fromBlock += 2000) {
      const events = await factory.queryFilter(factory.filters[eventName](null, address), fromBlock, Math.min(fromBlock + 1999, latestBlock));
      if (events.length) return events[0].blockNumber;
    }
    return null;
  }

  async function restoreAgentsFromChain(account) {
    const factoryAddress = PLATFORM_FACTORY_ADDRESS || localStorage.getItem(`${FACTORY_PREFIX}${account.toLowerCase()}`);
    if (!factoryAddress) return;
    const browserProvider = getReadProvider() || (getWallet() ? provider() : null);
    if (!browserProvider) return;
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
      const createdBlock = await findCreationBlock(factory, address, PLATFORM_FACTORY_DEPLOY_BLOCK, latestBlock);
      saveAgent({
        address,
        owner,
        name,
        mode: address.toLowerCase() === INITIAL_AGENT_ADDRESS.toLowerCase() ? "Yield" : "Vault",
        dailyLimit: String(dailyLimit),
        createdBlock,
        createdAt: null,
      });
    }));
    if (recovered.some((result) => result.status === "fulfilled")) {
      showToast("Agent vaults restored from your Arc factory.");
    }
  }

  async function restoreYieldAgents(account) {
    const browserProvider = getReadProvider() || (getWallet() ? provider() : null);
    if (!browserProvider) return;
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
          createdBlock = await findCreationBlock(factory, address, YIELD_FACTORY_DEPLOY_BLOCK, latestBlock);
        }
      }
      saveAgent({ address, owner, name, mode: "Yield", kind: "yield-v2", dailyLimit: String(dailyLimit), createdBlock, createdAt: existing?.createdAt || null });
    }));
  }

  async function restoreModeAgents(account) {
    const browserProvider = getReadProvider() || (getWallet() ? provider() : null);
    if (!browserProvider) return;
    const factoryAbi = (await loadArtifacts("ArgentsModeFactory")).abi;
    const vaultAbi = (await loadArtifacts("ArgentsAgentVault")).abi;
    const factory = new window.ethers.Contract(MODE_FACTORY_ADDRESS, factoryAbi, browserProvider);
    const addresses = await factory.agentsOf(account);
    const latestBlock = await browserProvider.getBlockNumber();
    await Promise.allSettled(addresses.map(async (address) => {
      const vault = new window.ethers.Contract(address, vaultAbi, browserProvider);
      const [owner, name, dailyLimit, modeNumber] = await Promise.all([vault.owner(), vault.name(), vault.dailySpendLimit(), factory.modeOf(address)]);
      if (owner.toLowerCase() !== account.toLowerCase() || ![1n, 2n].includes(modeNumber)) return;
      const existing = getAllAgents().find((agent) => agent.address.toLowerCase() === address.toLowerCase());
      const createdBlock = existing?.createdBlock || await findCreationBlock(factory, address, MODE_FACTORY_DEPLOY_BLOCK, latestBlock, "ModeAgentCreated");
      saveAgent({ address, owner, name, mode: modeNumber === 1n ? "Signals" : "Treasury", kind: "mode-v1", dailyLimit: String(dailyLimit), createdBlock, createdAt: existing?.createdAt || null });
    }));
  }

  
  const GENESIS_YIELD_AGENT = {
    address: "0x9eac69A950a13B40BE06547bE833Df653FE32Db8",
    name: "Argents Yield Genesis",
    mode: "Morpho Yield",
    dailyLimit: "100000000",
    strategy: "Galaxy USDC on Morpho",
    strategyAddress: YIELD_STRATEGY_ADDRESS,
  };

  async function renderPublicYieldAgents() {
    const list = $("#yield-public-list");
    if (!list) return;

    let idleText = "0.00 USDC";
    let investedText = "0.00 USDC";
    let totalText = "0.00 USDC";
    try {
      const readRpc = getReadProvider();
      if (readRpc) {
        const bal = await readRpc.getBalance(GENESIS_YIELD_AGENT.address);
        idleText = `${formatUsdc(bal, 18)} USDC`;
        totalText = idleText;
        try {
          const vaultAbi = (await loadArtifacts("ArgentsYieldVault")).abi;
          const vault = new window.ethers.Contract(GENESIS_YIELD_AGENT.address, vaultAbi, readRpc);
          const invested = await vault.strategyAssets().catch(() => 0n);
          if (invested) {
            investedText = `${formatUsdc(invested, 18)} USDC`;
            totalText = `${formatUsdc(BigInt(bal) + BigInt(invested), 18)} USDC`;
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn("Could not read public yield stats:", err);
    }

    list.innerHTML = `
      <div class="public-yield-card">
        <div class="public-yield-top">
          <div class="public-yield-title">
            <strong>${GENESIS_YIELD_AGENT.name}</strong>
            <span class="public-tag">VERIFIED ON ARC</span>
          </div>
          <div class="public-yield-actions">
            <button class="agent-action" data-copy-vault="${GENESIS_YIELD_AGENT.address}" type="button">Copy address</button>
            <a class="agent-explorer" href="https://explorer.arc.io/address/${GENESIS_YIELD_AGENT.address}" target="_blank" rel="noreferrer" aria-label="Open on Arc Explorer">↗</a>
          </div>
        </div>
        <p class="yield-position-note" style="margin-top:0; border-top:0; padding-top:0;">Strategy: <a href="https://explorer.arc.io/address/${YIELD_STRATEGY_ADDRESS}" target="_blank" rel="noreferrer">${GENESIS_YIELD_AGENT.strategy} ↗</a> · Daily spend limit: 100 USDC/day</p>
        <div class="public-yield-meta">
          <div><span>Total Value</span><strong>${totalText}</strong></div>
          <div><span>Invested in Morpho</span><strong>${investedText}</strong></div>
          <div><span>Idle in Agent</span><strong>${idleText}</strong></div>
          <div><span>Daily Outflow Cap</span><strong>100 USDC/day</strong></div>
        </div>
      </div>
    `;
  }

  async function syncWallet(account = activeAccount) {
    if (!account) return;
    if (walletMenuAddress.textContent && walletMenuAddress.textContent.toLowerCase() !== account.toLowerCase()) closeWalletMenu();
    activeAccount = account;
    localStorage.removeItem(MANUAL_DISCONNECT_KEY);
    connectButton.classList.add("connected");
    connectLabel.textContent = shorten(account);
    connectButton.title = "Wallet options";
    walletMenuAddress.textContent = account;
    walletControls.hidden = false;
    walletAddress.textContent = account;
    chainStatus.textContent = "Connected to Arc";
    chainDot.classList.add("is-live");
    $("#network-caption").textContent = "USDC native";
    $("#activity-body").innerHTML = `<div class="activity-empty-icon">✓</div>
      <p>Wallet connected: <strong>${shorten(account)}</strong></p>
      <a class="inline-link" href="https://explorer.arc.io/address/${account}" target="_blank" rel="noreferrer">View in Arc Explorer <span>↗</span></a>`;

    // Safely verify network if wallet is available
    const wallet = getWallet();
    if (wallet && wallet.request) {
      try {
        const chainIdRaw = await wallet.request({ method: "eth_chainId" });
        const chainIdNum = typeof chainIdRaw === "string" ? (chainIdRaw.startsWith("0x") ? parseInt(chainIdRaw, 16) : parseInt(chainIdRaw, 10)) : Number(chainIdRaw);
        if (chainIdNum && chainIdNum !== ARC.decimalId) {
          chainStatus.textContent = "Switch to Arc Mainnet";
          chainDot.classList.remove("is-live");
          walletFoot.textContent = "Wallet is on another network";
          $("#network-caption").textContent = "Switch to Arc Mainnet";
        }
      } catch (err) {
        console.warn("Chain ID check error:", err);
      }
    }

    // Read live balance reliably from Arc RPC
    try {
      const readRpc = getReadProvider();
      if (readRpc) {
        const balance = await readRpc.getBalance(account);
        balanceValue.innerHTML = `${formatUsdc(balance, 18)}<span class="metric-unit"> USDC</span>`;
        walletFoot.innerHTML = `<span class="status-dash"></span>Live balance · Arc Mainnet`;
      }
    } catch (err) {
      console.warn("Public balance read error:", err);
    }

    // Restore on-chain agents
    try {
      await restoreAgentsFromChain(account).catch(() => {});
      await restoreYieldAgents(account).catch(() => {});
      await restoreModeAgents(account).catch(() => {});
    } catch (err) {
      console.warn("Restore agents error:", err);
    }

    renderAgents();
    renderPublicYieldAgents().catch(() => {});
    refreshActivity(visibleAgents()).catch(() => {});
    refreshSignals().catch(() => {});
  }

  async function connectWallet() {
    if (reownModal) {
      try {
        await reownModal.open();
        return true;
      } catch (err) {
        console.warn("Reown open failed, trying fallback:", err);
      }
    }
    let wallet = getWallet();
    if (!wallet) {
      // Give late-injecting extensions up to 400ms before giving up
      await new Promise((r) => setTimeout(r, 400));
      wallet = getWallet();
    }
    if (!wallet) {
      showToast("No EVM wallet detected. Please ensure MetaMask or Rabby is installed and enabled on this page.", "error");
      return false;
    }
    setupWalletListeners(wallet);
    connectButton.disabled = true;
    connectLabel.textContent = "Connecting…";
    try {
      await ensureArc();
      const accounts = await wallet.request({ method: "eth_requestAccounts" });
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
    if (mode === "Signals" || mode === "Treasury") {
      const artifact = await loadArtifacts("ArgentsModeFactory");
      const factory = new window.ethers.Contract(MODE_FACTORY_ADDRESS, artifact.abi, signer);
      if ((await factory.usdc()).toLowerCase() !== USDC_ADDRESS.toLowerCase()) throw new Error("Mode factory does not use Arc USDC.");
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
      const transaction = mode === "Yield" ? await factory.createAgent(name, limitInBaseUnits) : await factory.createAgent(name, limitInBaseUnits, mode === "Signals" ? 1 : 2);
      const receipt = await transaction.wait();
      const createdEvent = receipt.logs.map((log) => {
        try { return factory.interface.parseLog(log); } catch { return null; }
      }).find((eventLog) => eventLog?.name === (mode === "Yield" ? "AgentCreated" : "ModeAgentCreated"));
      if (!createdEvent) throw new Error("The transaction completed, but the agent address was not found in its receipt.");
      const address = createdEvent.args.agent;
      saveAgent({ address, owner, name, mode, kind: mode === "Yield" ? "yield-v2" : "mode-v1", dailyLimit: String(limitInBaseUnits), createdBlock: receipt.blockNumber, createdAt: new Date().toISOString() });
      renderAgents();
      agentDialog.close();
      event.currentTarget.reset();
      $("#agent-limit").value = "100";
      showToast(`${name} is live on Arc. Open the vault address to verify it.`);
      $("#activity-body").innerHTML = `<div class="activity-empty-icon">✓</div><p><strong>${escapeHtml(name)}</strong> vault deployed at <span style="font-family:var(--mono)">${shorten(address)}</span>.</p><a class="inline-link" href="https://explorer.arc.io/address/${address}" target="_blank" rel="noreferrer">Verify on Arc Explorer <span>↗</span></a>`;
      refreshActivity(visibleAgents()).catch(() => {});
      if (mode === "Yield") refreshDiscovery().catch(() => {});
      else refreshModeDiscovery().catch(() => {});
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
    const isSend = action === "send";
    $("#transaction-title").textContent = isDeposit ? `Fund ${agent.name}.` : isWithdraw ? `Withdraw from ${agent.name}.` : isSend ? `Send from ${agent.name}.` : isDeploy ? `Deploy ${agent.name}'s USDC.` : `Set ${agent.name}'s daily withdrawal cap.`;
    $("#transaction-copy").textContent = isDeposit
      ? "Deposit USDC from your wallet into this agent vault. Incoming deposits are not restricted by the withdrawal cap."
      : isWithdraw
        ? "Withdraw USDC to your wallet, up to the remaining daily cap. Invested USDC is recalled automatically when the strategy has liquidity."
        : isSend
          ? "Send USDC from this Treasury vault to an Arc address. Your wallet signs the transfer and the amount counts toward today's withdrawal cap."
        : isDeploy
          ? "Move idle USDC from this agent vault into Galaxy USDC on Morpho. Your wallet signs this action. Strategy value can fall, and withdrawals depend on liquidity."
          : "Set the total USDC this vault can withdraw during one UTC day. Deposits do not count toward this cap.";
    $("#transaction-amount-label").textContent = isLimit ? "New daily withdrawal cap" : "Amount";
    $("#transaction-amount").step = "0.000001";
    $("#transaction-amount").min = isLimit ? "0" : "0.000001";
    $("#transaction-amount").placeholder = isLimit ? formatUsdc(BigInt(agent.dailyLimit), 6) : "0.00";
    $("#transaction-submit").innerHTML = isDeposit ? "Approve and deposit <span>→</span>" : isWithdraw ? "Withdraw to my wallet <span>→</span>" : isSend ? "Send from Treasury <span>→</span>" : isDeploy ? "Deploy to Morpho <span>→</span>" : "Save withdrawal cap <span>→</span>";
    $("#transaction-amount").value = "";
    $("#transaction-recipient-wrap").hidden = !isSend;
    $("#transaction-recipient").required = isSend;
    $("#transaction-recipient").value = "";
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
      ? `Withdrawals made today: ${formatUsdc(spentToday, 6)} USDC. Daily limits reset at midnight. Set the cap to 0 to pause withdrawals.`
      : action === "deploy"
        ? "Idle USDC will be deployed into the Morpho yield strategy. Your wallet will approve the transaction."
      : action === "deposit"
        ? `Deposited USDC is immediately available to your agent. Daily limits apply only to withdrawals.`
        : `This withdrawal uses today's remaining allowance (${formatUsdc(remaining, 6)} USDC available). Limits reset daily.`;
  }

  async function runVaultTransaction(event) {
    event.preventDefault();
    const submit = $("#transaction-submit");
    const original = transactionAction === "deposit" ? "Approve and deposit <span>→</span>" : transactionAction === "withdraw" ? "Withdraw to my wallet <span>→</span>" : transactionAction === "send" ? "Send from Treasury <span>→</span>" : transactionAction === "deploy" ? "Deploy to Morpho <span>→</span>" : "Save withdrawal cap <span>→</span>";
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
      } else if (transactionAction === "withdraw" || transactionAction === "send") {
        if (transactionAction === "send" && transactionTarget.mode !== "Treasury") throw new Error("Only Treasury agents can send to a recipient here.");
        const recipient = transactionAction === "send" ? $("#transaction-recipient").value.trim() : activeAccount;
        if (!window.ethers.isAddress(recipient) || recipient === window.ethers.ZeroAddress) throw new Error("Enter a valid Arc recipient address.");
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
        const withdrawal = await vault.withdraw(recipient, amount);
        await withdrawal.wait();
        showToast(`${formatUsdc(amount, 6)} USDC sent to ${transactionAction === "send" ? shorten(recipient) : "your wallet"}.`);
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

  const VIEW_MAP = {
    overview: "view-overview",
    agents: "view-agents",
    "my-agents": "view-agents",
    yield: "view-yield",
    "yield-positions": "view-yield",
    signals: "view-signals",
    activity: "view-activity",
    discover: "view-discover",
    security: "view-security",
  };

  const VIEW_TITLES = {
    overview: "Overview",
    agents: "My agents",
    "my-agents": "My agents",
    yield: "Yield positions",
    "yield-positions": "Yield positions",
    signals: "Signals",
    activity: "Activity",
    discover: "Discover",
    security: "Security",
  };

  function syncView() {
    const rawTarget = window.location.hash.slice(1).toLowerCase() || "overview";
    const target = VIEW_MAP[rawTarget] ? rawTarget : "overview";
    const activeViewId = VIEW_MAP[target];

    document.querySelectorAll(".view-page").forEach((page) => {
      page.hidden = page.id !== activeViewId;
    });

    const title = VIEW_TITLES[target] || "Overview";
    const breadcrumb = document.querySelector(".breadcrumbs strong");
    if (breadcrumb) breadcrumb.textContent = title;

    document.querySelectorAll(".primary-nav .nav-link").forEach((link) => {
      const href = link.getAttribute("href")?.slice(1).toLowerCase();
      const isActive = href === target ||
        (target.startsWith("yield") && href?.startsWith("yield")) ||
        (target.startsWith("agent") && href?.startsWith("agent"));
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    document.querySelectorAll(".mobile-nav-item").forEach((item) => {
      const href = item.getAttribute("href")?.slice(1).toLowerCase();
      const isActive = href === target ||
        (target.startsWith("yield") && href?.startsWith("yield")) ||
        (target.startsWith("agent") && href?.startsWith("agent"));
      item.classList.toggle("active", isActive);
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    window.scrollTo({ top: 0, behavior: "instant" });
  }

  window.addEventListener("hashchange", syncView);

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
  $("#signals-create-agent").addEventListener("click", () => openAgentDialog("Signals"));
  $("#empty-create").addEventListener("click", () => openAgentDialog());
  $("#view-agents").addEventListener("click", () => $("#agents").scrollIntoView({ behavior: "smooth" }));
  $("#yield-refresh").addEventListener("click", () => {
    $("#yield-updated").textContent = "Refreshing positions from Arc…";
    refreshAgentBalances().catch(() => {
      $("#yield-updated").textContent = "Could not read Arc positions. Check your connection and try again.";
    });
  });
  $("#discovery-refresh").addEventListener("click", () => { refreshDiscovery(); refreshModeDiscovery(); });
  $("#signals-refresh").addEventListener("click", refreshSignals);
  $("#signal-offer-form").addEventListener("submit", publishSignal);
  $("#signals").addEventListener("click", signalAction);
  setInterval(() => {
    if (activeAccount && document.visibilityState === "visible") refreshAgentBalances().catch(() => {});
  }, 30000);
  document.querySelectorAll("[data-create-mode]").forEach((button) => {
    button.addEventListener("click", () => openAgentDialog(button.dataset.createMode));
  });
  $("#agent-form").addEventListener("submit", createAgent);
  $("#transaction-form").addEventListener("submit", runVaultTransaction);
  $("#agent-list").addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-vault]");
    if (copyButton) {
      navigator.clipboard.writeText(copyButton.dataset.copyVault).then(() => showToast("Agent vault address copied. Send Arc USDC only.")).catch(() => showToast("Could not copy the vault address.", "error"));
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const agent = visibleAgents()[Number(button.dataset.agentIndex)];
    if (agent) openTransactionDialog(agent, button.dataset.action);
  });

  const initialWallet = getWallet();
  if (initialWallet) {
    setupWalletListeners(initialWallet);
    initialWallet.request({ method: "eth_accounts" }).then((accounts) => {
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
  syncView();
  initReown().catch(() => {});
  $("#agents-page-list")?.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-vault]");
    if (copyButton) {
      navigator.clipboard.writeText(copyButton.dataset.copyVault).then(() => showToast("Agent vault address copied. Send Arc USDC only.")).catch(() => showToast("Could not copy the vault address.", "error"));
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const agent = visibleAgents()[Number(button.dataset.agentIndex)];
    if (agent) openTransactionDialog(agent, button.dataset.action);
  });
  $("#agents-view-create")?.addEventListener("click", () => openAgentDialog());
  $("#agents-page-empty-create")?.addEventListener("click", () => openAgentDialog());
  $("#yield-empty-create")?.addEventListener("click", () => openAgentDialog("Yield"));
  $("#view-agents")?.addEventListener("click", () => { window.location.hash = "#agents"; });
  refreshDiscovery().catch(() => {});
  refreshModeDiscovery().catch(() => {});
  refreshSignals().catch(() => {});

  $("#yield-strategy-deploy")?.addEventListener("click", () => openAgentDialog("Yield"));
  $("#yield-public-refresh")?.addEventListener("click", () => renderPublicYieldAgents());
  $("#yield-public-list")?.addEventListener("click", (event) => {
    const copyBtn = event.target.closest("[data-copy-vault]");
    if (copyBtn) {
      navigator.clipboard.writeText(copyBtn.dataset.copyVault).then(() => showToast("Agent vault address copied. Send Arc USDC only.")).catch(() => showToast("Could not copy the vault address.", "error"));
    }
  });
  renderPublicYieldAgents().catch(() => {});

})();
