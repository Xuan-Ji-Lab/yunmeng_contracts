// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICloudDreamCore.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IDreamSeeker.sol";
import "./interfaces/IDreamTreasury.sol"; // Assuming IDreamTreasury is needed for the inheritance

contract DreamTreasury is IDreamTreasury, Ownable {
    ICloudDreamCore public core;
    IDreamSeeker public seeker;
    IPancakeRouter02 public swapRouter;
    
    // --- Abyss Logic State ---
    
    // Dividend Tracking
    uint256 public dividendPerShareToken;
    mapping(address => uint256) public xDividendPerShareToken;

    // Constants
    uint256 public constant ABYSS_WINNER_SHARE = 50;
    uint256 public constant ABYSS_DIVIDEND_SHARE = 30;

    // Events
    event DividendClaimed(address indexed user, uint256 amount);
    event AbyssWinHandled(address indexed user, uint256 winnerReward, uint256 dividendAdded, bool isGrandFinale);
    
    modifier onlySeeker() {
        require(msg.sender == address(seeker), unicode"Only Seeker");
        _;
    }
    
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

    function setSeeker(address _seeker) external onlyOwner {
        seeker = IDreamSeeker(_seeker);
    }
    
    function setConfig(bool _enabled, uint256 _percent) external onlyOwner {
        buybackEnabled = _enabled;
        buybackPercent = _percent;
    }

    // --- 核心逻辑 ---

    /**
     * @notice 处理归墟大奖逻辑 (完全复刻 CloudDreamProtocol)
     */
    function handleAbyssWin(address user, bool isGrandFinale, bool isNewHolder) external override onlySeeker returns (uint256) {
        require(wishToken != address(0), unicode"Token not set");
        
        // 0. 初始化新用户分红游标
        // 如果是新用户，或者之前的游标无效（虽然默认是0，但这里防止意外），设置为当前值
        // 关键：新加入者不享受以前的分红
        if (isNewHolder) {
            xDividendPerShareToken[user] = dividendPerShareToken;
        }
        
        // 1. 获取 Core 的 Token 余额 (视为当前奖池)
        uint256 totalTokenPool = IERC20(wishToken).balanceOf(address(core));
        uint256 winnerReward = 0;
        uint256 dividendAdded = 0;
        
        // 获取归墟之主总数 (从 Seeker 获取，且已包含当前 User)
        uint256 totalAbyssHolders = seeker.totalAbyssHolders();

        if (isGrandFinale) {
            // --- 终局机制 (Grand Finale) ---
            // 将 Core 全部余额用于分红
            if (totalTokenPool > 0) {
                 // 转入 Treasury
                try core.distributeTokenReward(address(this), totalTokenPool) {
                    if (totalAbyssHolders > 0) {
                        dividendPerShareToken += (totalTokenPool * 1e18) / totalAbyssHolders;
                        dividendAdded = totalTokenPool;
                    }
                } catch {}
            }
            // Winner reward is included in dividend share
            winnerReward = totalTokenPool / (totalAbyssHolders > 0 ? totalAbyssHolders : 1);
        } else {
            // --- 标准机制 (50/30/20) ---
            if (totalTokenPool > 0) {
                // 1. Winner Reward (50%)
                winnerReward = (totalTokenPool * ABYSS_WINNER_SHARE) / 100;
                try core.distributeTokenReward(user, winnerReward) {} catch { 
                    winnerReward = 0; 
                }

                // 2. Dividend Reward (30%)
                uint256 dividendAmount = (totalTokenPool * ABYSS_DIVIDEND_SHARE) / 100;
                
                // 转入 Treasury 作为分红池
                try core.distributeTokenReward(address(this), dividendAmount) {
                    if (totalAbyssHolders > 0) {
                        dividendPerShareToken += (dividendAmount * 1e18) / totalAbyssHolders;
                        dividendAdded = dividendAmount;
                    }
                } catch {}
            }
        }
        
        emit AbyssWinHandled(user, winnerReward, dividendAdded, isGrandFinale);
        return winnerReward;
    }

    /**
     * @notice 查询未领取分红
     */
    function getUnclaimedDividend(address user) public view override returns (uint256) {
        // 需要检查是否是归墟之主
        if (!seeker.isAbyssHolder(user)) return 0;
        
        uint256 share = dividendPerShareToken - xDividendPerShareToken[user];
        return share / 1e18; 
    }

    /**
     * @notice 领取分红
     */
    function claimDividend() external override {
        uint256 pending = getUnclaimedDividend(msg.sender);
        require(pending > 0, unicode"无可用分红");
        
        // 更新用户标记
        xDividendPerShareToken[msg.sender] = dividendPerShareToken;
        
        // Treasury 直接发奖 (资金已在 Treasury)
        require(IERC20(wishToken).transfer(msg.sender, pending), unicode"Token 转账失败");
        emit DividendClaimed(msg.sender, pending);
    }

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
