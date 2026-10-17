// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockUSDC.sol";

/// @dev Test-only 1:1 share vault standing in for Morpho Galaxy USDC.
contract MockMorpho {
    MockUSDC public immutable token;
    mapping(address => uint256) public balanceOf;

    constructor(MockUSDC token_) { token = token_; }

    function asset() external view returns (address) { return address(token); }
    function previewRedeem(uint256 shares) external pure returns (uint256) { return shares; }

    function deposit(uint256 assets, address receiver) external returns (uint256) {
        token.transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += assets;
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256) {
        balanceOf[owner] -= assets;
        token.transfer(receiver, assets);
        return assets;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        balanceOf[owner] -= shares;
        token.transfer(receiver, shares);
        return shares;
    }
}
