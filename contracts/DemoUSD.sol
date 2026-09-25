// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Worthless testnet token for the SafeReceipt demo. It exists so a demo
 * approve() hits real ERC20 code on Monad testnet and sets a real allowance,
 * instead of calling an address with no contract. Anyone can mint.
 */
contract DemoUSD is ERC20 {
    constructor() ERC20("SafeReceipt Demo USD", "dUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        require(amount <= 1_000_000 * 10 ** 6, "Mint at most 1M per call");
        _mint(to, amount);
    }
}
