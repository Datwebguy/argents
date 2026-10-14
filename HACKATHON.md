# Arc Microgrants Build Brief

## Program

- Program: Arc Microgrants | Circle, hosted on DoraHacks
- Official page: https://dorahacks.io/hackathon/arc-microgrants/detail
- Arc community details: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq
- Submission deadline: October 14, 2026 at 23:59 ET

## What the project must show

- A live deployment that is working on Arc Mainnet when submitted
- A public repository
- A link to the live deployment
- A short description of the project and its use of Arc
- A public builder profile (GitHub, X, or Farcaster)

## Fit and evaluation

The program supports proofs of concept, tiny apps, demos, prototypes, hackathon continuations, experimental infrastructure, and early technical experiments running on Arc Mainnet.

The stated review factors are relevance to Arc, technical credibility, the quality of the build, and whether it is worth taking further. Promise matters more than traction for this program.

## Argents build priorities

1. Ship one complete, demonstrable Arc Mainnet flow.
2. Make Arc's role visible in the live experience and verifiable with on-chain activity.
3. Prioritize the Yield mode; keep Signals and Treasury secondary until the core flow works.
4. Describe only integrations and behavior that are implemented and verifiable.
5. Publish the app and source repository before submitting.

## Submission readiness

- [x] Live app opens and the legacy Arc Mainnet deposit and withdrawal flow was exercised by the project owner
- [x] Yield V2 funding, Morpho deployment, and redemption were exercised end-to-end in a browser wallet and confirmed on Arc
- [x] Public repository is accessible: https://github.com/Datwebguy/argents
- [x] Live app and repository links are ready
- [x] Project description states what Argents does and exactly how it uses Arc (see README.md)
- [x] Public builder profile is available: https://github.com/Datwebguy
- [x] Prototype limitations are clearly stated; no unobserved earnings are presented as live
- [x] Public Yield agent discovery and current-value ranking read from Arc without a connected wallet

The app URL is https://argents-live.funolive9.chatgpt.site. The Yield V2 factory and first agent are verified on Arc Mainnet. The first agent received 0.02 USDC, deployed it to Morpho Galaxy USDC, and withdrew 0.01 USDC. Its remaining position was 0.01 USDC at the last on-chain check. No earned yield has been demonstrated.

## Arc network note

Arc uses USDC to pay gas. The app must make clear when a wallet needs USDC for transaction fees.
