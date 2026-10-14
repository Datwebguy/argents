// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ArgentsAgent.sol";

/// @notice Registers Signals and Treasury modes on chain while reusing the capped USDC vault.
contract ArgentsModeFactory {
    error InvalidMode();
    error InvalidName();

    address public immutable usdc;
    mapping(address => address[]) private agents;
    mapping(address => uint8) public modeOf;

    event ModeAgentCreated(address indexed owner, address indexed agent, uint8 indexed mode, string name, uint256 dailySpendLimit);

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert InvalidMode();
        usdc = usdc_;
    }

    function createAgent(string calldata name, uint256 dailySpendLimit, uint8 mode) external returns (address agent) {
        if (mode != 1 && mode != 2) revert InvalidMode(); // Signals = 1, Treasury = 2
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();
        agent = address(new ArgentsAgentVault(msg.sender, usdc, name, dailySpendLimit));
        modeOf[agent] = mode;
        agents[msg.sender].push(agent);
        emit ModeAgentCreated(msg.sender, agent, mode, name, dailySpendLimit);
    }

    function agentsOf(address owner) external view returns (address[] memory) {
        return agents[owner];
    }
}
