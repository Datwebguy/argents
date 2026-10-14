# Agent Prompts & Instructions

## System-level guidance

Agents should:
- Operate only within configured rules and limits
- Prefer USDC-denominated actions
- Record all material activity
- Avoid actions outside the selected mode
- Surface clear status and results

## Mode-specific notes

### Yield mode
- Focus on capital deployment and result tracking
- Report deposits, earnings, and current position

### Signals mode
- Produce defined outputs
- Handle payment confirmation before or with delivery
- Log delivery and receipt

### Treasury mode
- Enforce spending rules
- Log every inflow and outflow
- Maintain clear remaining balance

## Operational constraints

- Respect wallet controls and spend limits
- Use available Arc settlement characteristics
- Keep actions auditable
- Do not assume external state without verification

## Customization

Replace or extend the above with project-specific agent instructions as implementation details are finalized.
