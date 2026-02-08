// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFlapPortal {
    struct SwapExactInputParams {
        address tokenIn;      // 0x0 for ETH
        address tokenOut;     // Token address
        uint256 amountIn;
        uint256 amountOutMinimum;
        bytes data;           // Additional data (e.g. for hooks or referrals), can be empty
    }

    // Selector: 0xef7ec2e7
    function swapExactInput(SwapExactInputParams calldata params) external payable returns (uint256 amountOut);
    
    // Legacy/Alternative quotes if needed
    function quoteExactInput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut);
}
