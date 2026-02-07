// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICloudDreamCore.sol";
import "./interfaces/IPancakeRouter02.sol";

contract DreamTreasury is Ownable {
    ICloudDreamCore public core;
    IPancakeRouter02 public swapRouter;
    
    address public wishToken;
    address public WBNB;
    
    // 配置
    bool public buybackEnabled = false;
    uint256 public buybackPercent = 7000; // 70%

    // 回购执行事件
    event BuybackExecuted(uint256 bnbAmount, uint256 tokensReceived);

    constructor(address _core, address _router, address _wishToken, address _wbnb) Ownable(msg.sender) {
        core = ICloudDreamCore(_core);
        swapRouter = IPancakeRouter02(_router);
        wishToken = _wishToken;
        WBNB = _wbnb;
    }

    // --- 管理员配置 ---
    function setCore(address _core) external onlyOwner {
        core = ICloudDreamCore(_core);
    }
    
    function setConfig(bool _enabled, uint256 _percent) external onlyOwner {
        buybackEnabled = _enabled;
        buybackPercent = _percent;
    }

    // --- 核心逻辑 ---

    /**
     * @notice 执行回购 (Swap BNB -> WISH)
     * @dev Core 发送 BNB 到此处，本合约进行 Swap，并将 WISH 转回 Core
     */
    function executeBuyback() external payable {
        require(buybackEnabled, unicode"回购未开启");
        require(msg.value > 0, unicode"BNB 数额必须大于 0");
        
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = wishToken;

        uint256 initialBalance = IERC20(wishToken).balanceOf(address(this));

        // 计算最小输出 (5% 滑点保护)
        uint256[] memory expectedAmounts = swapRouter.getAmountsOut(msg.value, path);
        uint256 minAmount = (expectedAmounts[1] * 95) / 100;

        try swapRouter.swapExactETHForTokens{value: msg.value}(
            minAmount,
            path,
            address(this), // 代币先回到本合约
            block.timestamp + 300
        ) {
            uint256 finalBalance = IERC20(wishToken).balanceOf(address(this));
            uint256 received = finalBalance - initialBalance;
            
            // 将 WISH 代币转回 Core
            IERC20(wishToken).transfer(address(core), received);
            
            emit BuybackExecuted(msg.value, received);
        } catch {
            // 如果 Swap 失败，将 BNB 退回 Core
            payable(address(core)).transfer(msg.value);
        }
    }

    // 允许接收 BNB 进行 Swap
    receive() external payable {}
}
