// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISignalsUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface ISignalsVault {
    function owner() external view returns (address);
    function usdc() external view returns (address);
}

/// @notice Paid report workflow for Argents Signals custody vaults.
/// @dev Deliveries are public URIs. Publishers must use an encrypted or otherwise access-controlled URI for private reports.
contract ArgentsSignals {
    error NotPublisher();
    error NotBuyer();
    error InvalidVault();
    error InvalidInput();
    error UnknownRecord();
    error AlreadyDelivered();
    error AlreadyAcknowledged();
    error PaymentFailed();
    error Reentered();

    struct Offer {
        address publisher;
        address vault;
        uint256 price;
        string title;
    }

    struct Order {
        uint256 offerId;
        address buyer;
        string deliveryUri;
        bool acknowledged;
    }

    ISignalsUSDC public immutable usdc;
    uint256 public offerCount;
    uint256 public orderCount;
    mapping(uint256 => Offer) private offers;
    mapping(uint256 => Order) private orders;
    uint256 private entered;

    event OfferCreated(uint256 indexed offerId, address indexed publisher, address indexed vault, uint256 price, string title);
    event OrderPaid(uint256 indexed orderId, uint256 indexed offerId, address indexed buyer, uint256 price, address vault);
    event OrderDelivered(uint256 indexed orderId, string deliveryUri);
    event ReceiptAcknowledged(uint256 indexed orderId, address indexed buyer);

    modifier nonReentrant() {
        if (entered != 0) revert Reentered();
        entered = 1;
        _;
        entered = 0;
    }

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert InvalidInput();
        usdc = ISignalsUSDC(usdc_);
    }

    function createOffer(address vault, string calldata title, uint256 price) external returns (uint256 offerId) {
        if (vault.code.length == 0 || bytes(title).length == 0 || bytes(title).length > 80 || price == 0) revert InvalidInput();
        try ISignalsVault(vault).owner() returns (address publisher) {
            if (publisher != msg.sender) revert NotPublisher();
        } catch { revert InvalidVault(); }
        try ISignalsVault(vault).usdc() returns (address token) {
            if (token != address(usdc)) revert InvalidVault();
        } catch { revert InvalidVault(); }
        offerId = ++offerCount;
        offers[offerId] = Offer(msg.sender, vault, price, title);
        emit OfferCreated(offerId, msg.sender, vault, price, title);
    }

    function buy(uint256 offerId) external nonReentrant returns (uint256 orderId) {
        Offer storage offer = offers[offerId];
        if (offer.publisher == address(0)) revert UnknownRecord();
        orderId = ++orderCount;
        orders[orderId] = Order(offerId, msg.sender, "", false);
        if (!usdc.transferFrom(msg.sender, offer.vault, offer.price)) revert PaymentFailed();
        emit OrderPaid(orderId, offerId, msg.sender, offer.price, offer.vault);
    }

    function deliver(uint256 orderId, string calldata deliveryUri) external {
        Order storage order = orders[orderId];
        if (order.buyer == address(0)) revert UnknownRecord();
        if (offers[order.offerId].publisher != msg.sender) revert NotPublisher();
        if (bytes(order.deliveryUri).length != 0) revert AlreadyDelivered();
        if (bytes(deliveryUri).length == 0 || bytes(deliveryUri).length > 512) revert InvalidInput();
        order.deliveryUri = deliveryUri;
        emit OrderDelivered(orderId, deliveryUri);
    }

    function acknowledge(uint256 orderId) external {
        Order storage order = orders[orderId];
        if (order.buyer == address(0)) revert UnknownRecord();
        if (order.buyer != msg.sender) revert NotBuyer();
        if (bytes(order.deliveryUri).length == 0) revert InvalidInput();
        if (order.acknowledged) revert AlreadyAcknowledged();
        order.acknowledged = true;
        emit ReceiptAcknowledged(orderId, msg.sender);
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        if (offers[offerId].publisher == address(0)) revert UnknownRecord();
        return offers[offerId];
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        if (orders[orderId].buyer == address(0)) revert UnknownRecord();
        return orders[orderId];
    }
}
