// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAutopilotUSDC {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAutopilotMorphoVault {
    function asset() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function previewRedeem(uint256) external view returns (uint256);
    function deposit(uint256, address) external returns (uint256);
    function withdraw(uint256, address, address) external returns (uint256);
}

/// @notice A rules-based Yield agent: it maintains an owner-selected Morpho allocation when funded or rebalanced.
/// @dev The strategy and USDC token are immutable. Anyone may call rebalance, but cannot withdraw funds.
contract ArgentsAutopilotYieldVault {
    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidAsset();
    error InvalidAllocation();
    error LimitExceeded();
    error TokenTransferFailed();
    error Reentered();

    address public immutable owner;
    IAutopilotUSDC public immutable usdc;
    IAutopilotMorphoVault public immutable strategy;
    string public name;
    uint256 public dailySpendLimit;
    uint16 public allocationBps;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    mapping(uint256 => uint256) public spentByDay;
    uint256 private entered;

    event Deposited(address indexed owner, uint256 amount, uint256 idleBalance);
    event Withdrawn(address indexed owner, address indexed recipient, uint256 amount, uint256 daySpent);
    event DailySpendLimitUpdated(uint256 previousLimit, uint256 newLimit);
    event AllocationUpdated(uint16 previousAllocationBps, uint16 newAllocationBps);
    event Rebalanced(uint256 deployedAssets, uint256 recalledAssets, uint256 targetStrategyAssets);

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

    constructor(address owner_, address usdc_, address strategy_, string memory name_, uint256 dailySpendLimit_, uint16 allocationBps_) {
        if (owner_ == address(0) || usdc_ == address(0) || strategy_ == address(0)) revert ZeroAddress();
        if (allocationBps_ > 10_000) revert InvalidAllocation();
        if (IAutopilotMorphoVault(strategy_).asset() != usdc_) revert InvalidAsset();
        owner = owner_;
        usdc = IAutopilotUSDC(usdc_);
        strategy = IAutopilotMorphoVault(strategy_);
        name = name_;
        dailySpendLimit = dailySpendLimit_;
        allocationBps = allocationBps_;
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TokenTransferFailed();
        totalDeposited += amount;
        emit Deposited(msg.sender, amount, usdc.balanceOf(address(this)));
        _rebalance();
    }

    /// @notice Restore the configured allocation. Anyone can call this, but recalled funds always stay in this vault.
    function rebalance() external nonReentrant {
        _rebalance();
    }

    function setAllocationBps(uint16 newAllocationBps) external onlyOwner nonReentrant {
        if (newAllocationBps > 10_000) revert InvalidAllocation();
        uint16 oldAllocationBps = allocationBps;
        allocationBps = newAllocationBps;
        emit AllocationUpdated(oldAllocationBps, newAllocationBps);
        _rebalance();
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

    function balance() public view returns (uint256) { return usdc.balanceOf(address(this)); }
    function strategyShares() public view returns (uint256) { return strategy.balanceOf(address(this)); }
    function strategyAssets() public view returns (uint256) { return strategy.previewRedeem(strategyShares()); }
    function totalAssets() public view returns (uint256) { return balance() + strategyAssets(); }

    function _rebalance() internal {
        uint256 total = totalAssets();
        uint256 target = total * allocationBps / 10_000;
        uint256 invested = strategyAssets();
        if (invested > target) {
            uint256 recalled = invested - target;
            strategy.withdraw(recalled, address(this), address(this));
            emit Rebalanced(0, recalled, target);
            return;
        }
        if (invested == target) {
            emit Rebalanced(0, 0, target);
            return;
        }
        uint256 amount = target - invested;
        uint256 idle = balance();
        if (amount > idle) amount = idle;
        if (amount == 0) {
            emit Rebalanced(0, 0, target);
            return;
        }
        if (!usdc.approve(address(strategy), amount)) revert TokenTransferFailed();
        strategy.deposit(amount, address(this));
        if (!usdc.approve(address(strategy), 0)) revert TokenTransferFailed();
        emit Rebalanced(amount, 0, target);
    }
}

contract ArgentsAutopilotYieldFactory {
    error ZeroAddress();
    error EmptyName();
    error InvalidNameLength();
    error InvalidAsset();
    error InvalidAllocation();

    address public immutable usdc;
    address public immutable strategy;
    mapping(address => address[]) private agents;

    event AgentCreated(address indexed owner, address indexed agent, string name, uint256 dailySpendLimit, uint16 allocationBps, uint256 createdAt);

    constructor(address usdc_, address strategy_) {
        if (usdc_ == address(0) || strategy_ == address(0)) revert ZeroAddress();
        if (IAutopilotMorphoVault(strategy_).asset() != usdc_) revert InvalidAsset();
        usdc = usdc_;
        strategy = strategy_;
    }

    function createAgent(string calldata name, uint256 dailySpendLimit, uint16 allocationBps) external returns (address agent) {
        uint256 length = bytes(name).length;
        if (length == 0) revert EmptyName();
        if (length > 32) revert InvalidNameLength();
        if (allocationBps > 10_000) revert InvalidAllocation();
        agent = address(new ArgentsAutopilotYieldVault(msg.sender, usdc, strategy, name, dailySpendLimit, allocationBps));
        agents[msg.sender].push(agent);
        emit AgentCreated(msg.sender, agent, name, dailySpendLimit, allocationBps, block.timestamp);
    }

    function agentsOf(address owner) external view returns (address[] memory) { return agents[owner]; }
}
