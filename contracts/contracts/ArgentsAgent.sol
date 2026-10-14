// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IArgentsUSDC {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/// @title ArgentsAgentVault
/// @notice A user-owned USDC vault with a daily withdrawal ceiling.
/// @dev This prototype is user-operated. It does not execute strategies or promise yield.
contract ArgentsAgentVault {
    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error LimitExceeded();
    error TokenTransferFailed();

    address public immutable owner;
    IArgentsUSDC public immutable usdc;
    string public name;
    uint256 public dailySpendLimit;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    mapping(uint256 day => uint256 amount) public spentByDay;

    event Deposited(address indexed owner, uint256 amount, uint256 balance);
    event Withdrawn(address indexed owner, address indexed recipient, uint256 amount, uint256 daySpent);
    event DailySpendLimitUpdated(uint256 previousLimit, uint256 newLimit);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, address usdc_, string memory name_, uint256 dailySpendLimit_) {
        if (owner_ == address(0) || usdc_ == address(0)) revert ZeroAddress();
        owner = owner_;
        usdc = IArgentsUSDC(usdc_);
        name = name_;
        dailySpendLimit = dailySpendLimit_;
    }

    function deposit(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TokenTransferFailed();
        totalDeposited += amount;
        emit Deposited(msg.sender, amount, usdc.balanceOf(address(this)));
    }

    function withdraw(address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 day = block.timestamp / 1 days;
        uint256 nextSpent = spentByDay[day] + amount;
        if (nextSpent > dailySpendLimit) revert LimitExceeded();

        spentByDay[day] = nextSpent;
        totalWithdrawn += amount;
        if (!usdc.transfer(recipient, amount)) revert TokenTransferFailed();
        emit Withdrawn(msg.sender, recipient, amount, nextSpent);
    }

    function setDailySpendLimit(uint256 newLimit) external onlyOwner {
        uint256 oldLimit = dailySpendLimit;
        dailySpendLimit = newLimit;
        emit DailySpendLimitUpdated(oldLimit, newLimit);
    }

    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}

/// @title ArgentsAgentFactory
/// @notice Deploys a dedicated USDC vault contract for each agent.
contract ArgentsAgentFactory {
    error ZeroAddress();
    error EmptyName();
    error InvalidNameLength();

    address public immutable usdc;
    mapping(address owner => address[] vaults) private _agents;

    event AgentCreated(
        address indexed owner,
        address indexed agent,
        string name,
        uint256 dailySpendLimit,
        uint256 createdAt
    );

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    function createAgent(string calldata name, uint256 dailySpendLimit) external returns (address agent) {
        bytes calldata rawName = bytes(name);
        if (rawName.length == 0) revert EmptyName();
        if (rawName.length > 32) revert InvalidNameLength();

        agent = address(new ArgentsAgentVault(msg.sender, usdc, name, dailySpendLimit));
        _agents[msg.sender].push(agent);
        emit AgentCreated(msg.sender, agent, name, dailySpendLimit, block.timestamp);
    }

    function agentsOf(address owner) external view returns (address[] memory) {
        return _agents[owner];
    }
}
