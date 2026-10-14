# Argents handover

Last updated: 14 October 2026, Africa/Lagos time.

## Project goal

Argents is a live Arc Mainnet app for owner-controlled USDC agents. It has three modes:

- **Yield**: hold Arc USDC in a dedicated vault, deploy it to Morpho Galaxy USDC, and track the position.
- **Signals**: publish a priced report offer, accept USDC payment into a Signals vault, deliver an HTTPS link, and record buyer receipt.
- **Treasury**: receive USDC and send to a selected Arc address under a daily spending cap.

The product is for the Arc Microgrants hackathon. It must remain truthful about what has been deployed and what flows have actually been exercised.

## Current live links

- App: https://argents-live.funolive9.chatgpt.site
- Public GitHub repository: https://github.com/Datwebguy/argents
- Arc explorer: https://explorer.arc.io
- Hackathon: https://dorahacks.io/hackathon/arc-microgrants/detail

## Working directory and mirrors

The canonical Sites checkout is:

```text
C:\Users\hflhgjlhjh\Downloads\ARGENTS\sites\argents-live
```

The following are mirrors and must be kept in sync after source edits:

- `sites\argents-live\dist`
- `C:\Users\hflhgjlhjh\Downloads\ARGENTS`
- `C:\Users\hflhgjlhjh\Downloads\ARGENTS\public-repo`

The GitHub remote is configured in `public-repo` as `github`. The dedicated Signals workspace and this handover were published in commit `d3a7008`. Check `git status` before further work.

## Arc deployments

| Purpose | Address |
|---|---|
| Arc network | Chain ID `5042` |
| Native USDC / gas token | `0x3600000000000000000000000000000000000000` |
| Legacy vault factory | `0xfC887cB480f257e8a76e823de9066b5B528a66a9` |
| Yield V2 factory | `0x02B78468aDA29F698eB6E488EB28d757aA671b6E` |
| Morpho Galaxy USDC | `0x8E357432CC12ff425c36432F312968aEb16112AF` |
| Mode factory | `0x1A9555E261E39830317461a767f8D7B5fBF01c5d` |
| Signals marketplace | `0xa7C755ab5aa2a17062Dc6D45ea8594Ff43ac9A68` |
| Demonstration Signals vault | `0x70baA8a0c215D9DbD05A340CA89E2129649ca04e` |
| Demonstration Treasury vault | `0xcAbD3D35448E768e591210eEE216b672C8Ed19f3` |
| Demonstration Yield vault | `0x9eac69A950a13B40BE06547bE833Df653FE32Db8` |

The full transaction record is in `deployments.arc-mainnet.json` and `DEPLOYMENT.md`.

## Verified facts

- Yield V2 completed an onchain deposit of 0.02 USDC, Morpho deployment, and partial 0.01 USDC withdrawal. This proves deployment and redemption, but does **not** prove earned yield.
- The Mode factory, Signals marketplace, Signals vault, Treasury vault, and a 0.01 USDC Signals offer are deployed on Arc.
- Signals buyer payment, publisher delivery, buyer receipt acknowledgement, and Treasury send are implemented but have **not** been exercised with capital. Do not claim they have been verified end to end.
- The live site loads the Yield discovery, public mode discovery, and Signals offer data in a headless browser.

## Current UI work

The overview previously placed the full Signals marketplace below all dashboard content. The user asked for a clearer and more constructive layout because the tiny `publish offers and track orders` link was easy to miss.

The current published change turns Signals into its own hash route:

- `#signals` renders a dedicated page.
- Sidebar has a visible **Signals** navigation item.
- Each Signals agent receives a clear **Manage Signals →** action.
- The Signals page is split into three steps: browse reports, sell a report, then manage orders.
- The overview no longer renders the full Signals marketplace.

The involved files are `index.html`, `app.js`, and `styles.css`. They are mirrored, pushed, and live in Sites version 19. The next agent should retain this layout unless the user requests a different structure.

## Important implementation details

### Frontend

- `app.js` uses Ethers from `vendor/ethers.umd.min.js`.
- Wallet network is Arc Mainnet, chain `5042`, RPC `https://rpc.mainnet.arc.io`.
- `syncView()` selects the `#signals` route based on the URL hash and hides other overview content when Signals is open.
- `renderAgents()` shows the mode-specific controls. Signals has **Manage Signals →**; Treasury has **Send USDC**.
- `refreshSignals()` reads offers and orders directly from the deployed Signals contract.

### Contracts

- `contracts/ArgentsYield.sol`: owner-controlled Yield vault and factory.
- `contracts/ArgentsAgent.sol`: generic capped USDC vault and legacy factory.
- `contracts/ArgentsModes.sol`: mode-aware Signals/Treasury factory. Mode `1` = Signals, `2` = Treasury.
- `contracts/ArgentsSignals.sol`: offer, payment, delivery URI, and buyer acknowledgement flow.
- Browser artifacts are stored in `contracts/artifacts/`; do not change Solidity without recompiling the ABI and bytecode files.

### Security and product limits

- Never print, commit, or expose the private key stored in `C:\Users\hflhgjlhjh\Downloads\wallet.txt`.
- Do not move user capital without a specific amount from the user. Deployment gas can be estimated before onchain transactions.
- Signals payment goes directly to the publisher vault. There is no escrow or refund function.
- Delivery URIs are public on chain, so private reports need an access-controlled link.
- Treasury and Signals actions require the owner's wallet signature. There is no unattended agent runtime.
- The owner can change the daily cap immediately, so it is not a separate approval system.
- Circle Agent Wallets, Gateway Nanopayments, Onramp, CCTP, Gateway, and Earn Kit SDK are not integrated. Yield calls Morpho directly.

## Validation commands

Use the canonical checkout:

```powershell
node --check app.js
git diff --check
```

Read-only contract verification:

```powershell
$env:NODE_PATH="$env:TEMP\argents-deploy\node_modules"
node contracts/verify-modes.cjs
```

To check the live site after deployment:

```powershell
$edge='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
& $edge --headless=new --disable-gpu --no-first-run --no-default-browser-check --virtual-time-budget=8000 --dump-dom 'https://argents-live.funolive9.chatgpt.site/'
```

The previous output confirmed one public Yield agent, two public mode agents, and one public Signals offer.

## Publish workflow

1. Copy modified canonical files to `dist`, the root mirror, and `public-repo`.
2. In `public-repo`, commit and push to `github main`.
3. Publish the Sites source using `site-workflow.mjs` with project ID `appgprj_6acf58fd4c8481919cbddbe93c050bb0`.
4. Obtain a short-lived Sites source credential through `mcp__codex_apps__sites_create_source_repository_write_credential` with `project_id`.
5. Feed that credential to the workflow helper, save the resulting commit SHA as a site version, and deploy that exact version.
6. Verify the deployment status succeeds and the live app returns HTTP 200.

The previous publish used this command in a `cmd.exe` terminal:

```text
set PATH=C:\Users\hflhgjlhjh\AppData\Local\Programs\Git\bin;%PATH% && cd /d C:\Users\hflhgjlhjh\Downloads\ARGENTS\sites\argents-live && node C:\Users\hflhgjlhjh\.codex\plugins\cache\openai-curated-remote\sites\1.0.1\scripts\site-workflow.mjs --project-id appgprj_6acf58fd4c8481919cbddbe93c050bb0
```

Never include the issued credential token in shell output, a repository, or user-facing messages.

## Documentation

- `BUILD_STATUS.md` is the concise truthful product status.
- `DEPLOYMENT.md` holds links and deployment evidence.
- `SECURITY.md` holds the known security limits.
- `INTEGRATIONS.md` clearly says which planned integrations are not wired.
- `SUBMISSION.md` is factual readiness notes, not copy to misrepresent the hackathon submission.

## Recommended next work

1. Finish and publish the dedicated Signals page UI change described above.
2. Test Signals purchase, delivery, receipt, and Treasury send with intentionally tiny explicitly authorized amounts, if the owner wants that evidence.
3. Improve the core dashboard navigation for Yield and Treasury in the same way if the user asks.
4. Only describe flows in the hackathon entry that have direct onchain evidence.
