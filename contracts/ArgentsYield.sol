// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IYieldToken {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface IMorphoYieldVault {
    function asset() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function previewRedeem(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function withdraw(uint256, address, address) external returns (uint256);
    function redeem(uint256, address, address) external returns (uint256);
}

/// @notice Owner-operated Arc USDC vault with an immutable Morpho Vault V2 strategy.
/// @dev A user must explicitly invest. Strategy returns can fall and withdrawals can fail when liquidity is unavailable.
contract ArgentsYieldVault {
    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidAsset();
    error LimitExceeded();
    error InsufficientIdle();
    error SlippageExceeded();
    error TokenTransferFailed();
    error Reentered();

    address public immutable owner;
    IYieldToken public immutable usdc;
    IMorphoYieldVault public immutable strategy;
    string public name;
    uint256 public dailySpendLimit;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    mapping(uint256 => uint256) public spentByDay;
    uint256 private entered;

    event Deposited(address indexed owner, uint256 amount, uint256 idleBalance);
    event Withdrawn(address indexed owner, address indexed recipient, uint256 amount, uint256 daySpent);
    event DailySpendLimitUpdated(uint256 previousLimit, uint256 newLimit);
    event YieldDeployed(uint256 assets, uint256 shares);
    event YieldRecalled(uint256 shares, uint256 assets);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (entered != 0) revert Reentered();
        entered = 1;
        _;
        entered = 0;
    }

    constructor(address owner_, address usdc_, address strategy_, string memory name_, uint256 dailySpendLimit_) {
        if (owner_ == address(0) || usdc_ == address(0) || strategy_ == address(0)) revert ZeroAddress();
        if (IMorphoYieldVault(strategy_).asset() != usdc_) revert InvalidAsset();
        owner = owner_;
        usdc = IYieldToken(usdc_);
        strategy = IMorphoYieldVault(strategy_);
        name = name_;
        dailySpendLimit = dailySpendLimit_;
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TokenTransferFailed();
        totalDeposited += amount;
        emit Deposited(msg.sender, amount, usdc.balanceOf(address(this)));
    }

    function deployYield(uint256 amount, uint256 minShares) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > balance()) revert InsufficientIdle();
        if (!usdc.approve(address(strategy), amount)) revert TokenTransferFailed();
        uint256 shares = strategy.deposit(amount, address(this));
        if (shares < minShares || shares == 0) revert SlippageExceeded();
        if (!usdc.approve(address(strategy), 0)) revert TokenTransferFailed();
        emit YieldDeployed(amount, shares);
    }

    function recallYield(uint256 shares, uint256 minAssets) external onlyOwner nonReentrant {
        if (shares == 0) revert ZeroAmount();
        uint256 assets = strategy.redeem(shares, address(this), address(this));
        if (assets < minAssets) revert SlippageExceeded();
        emit YieldRecalled(shares, assets);
    }

    function withdraw(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 day = block.timestamp / 1 days;
        uint256 nextSpent = spentByDay[day] + amount;
        if (nextSpent > dailySpendLimit) revert LimitExceeded();
        uint256 idle = balance();
        if (amount > idle) strategy.withdraw(amount - idle, address(this), address(this));
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

    function balance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function strategyShares() public view returns (uint256) {
        return strategy.balanceOf(address(this));
    }

    function strategyAssets() public view returns (uint256) {
        return strategy.previewRedeem(strategyShares());
    }

    function totalAssets() external view returns (uint256) {
        return balance() + strategyAssets();
    }
}

contract ArgentsYieldFactory {
    error ZeroAddress();
    error EmptyName();
    error InvalidNameLength();
    error InvalidAsset();

    address public immutable usdc;
    address public immutable strategy;
    mapping(address => address[]) private agents;

    event AgentCreated(address indexed owner, address indexed agent, string name, uint256 dailySpendLimit, uint256 createdAt);

    constructor(address usdc_, address strategy_) {
        if (usdc_ == address(0) || strategy_ == address(0)) revert ZeroAddress();
        if (IMorphoYieldVault(strategy_).asset() != usdc_) revert InvalidAsset();
        usdc = usdc_;
        strategy = strategy_;
    }

    function createAgent(string calldata name, uint256 dailySpendLimit) external returns (address agent) {
        uint256 length = bytes(name).length;
        if (length == 0) revert EmptyName();
        if (length > 32) revert InvalidNameLength();
        agent = address(new ArgentsYieldVault(msg.sender, usdc, strategy, name, dailySpendLimit));
        agents[msg.sender].push(agent);
        emit AgentCreated(msg.sender, agent, name, dailySpendLimit, block.timestamp);
    }

    function agentsOf(address owner) external view returns (address[] memory) {
        return agents[owner];
    }
}
