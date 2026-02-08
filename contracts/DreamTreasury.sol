// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICloudDreamCore.sol"; 
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IFlapPortal.sol";

/**
 * @title DreamTreasury (云梦国库 & 资金管理)
 * @dev 系统的资金托管中心。负责：
 *      1. 资金托管：持有所有 BNB 和 WISH 代币储备。
 *      2. 支付执行：响应业务合约 (Seeker/Oracle) 的指令进行转账。
 *      3. 代币回购：提供将 BNB 兑换为 WISH 并注入奖池的功能。
 *      安全说明：不包含核心游戏逻辑，只作为"银行"执行经过授权的指令。
 */
contract DreamTreasury is Initializable, UUPSUpgradeable {
    
    // --- 外部合约引用 ---
    /// @notice 核心配置合约 (用于权限校验)
    ICloudDreamCore public core;
    
    /// @notice [DEPRECATED] 原 DEX 路由合约 (保留名称以兼容存储布局)
    IPancakeRouter02 public swapRouter;
    
    // --- 资产地址 ---
    address public wishToken;
    address public wbnb; // [DEPRECATED] 原 WBNB 地址 (保留名称以兼容存储布局)
    
    // --- 配置参数 ---
    /// @notice 是否开启回购功能
    bool public buybackEnabled;
    
    /// @notice 回购比例 (基点)，例如 7000 表示 70% 的收入用于回购
    uint256 public buybackPercent; 
    
    /// @notice 回购滑点保护 (基点)，例如 9500 表示 95% (5%滑点)
    uint256 public buybackSlippage; 

    // --- 新增状态变量 (Storage Gap 之后) ---
    /// @notice Flap Portal 合约地址 (内盘回购)
    address public flapPortal;

    // --- 事件定义 ---
    event PayoutExecuted(address indexed to, uint256 amount, string currency); // 支付执行事件 (currency: "BNB" | "WISH")
    event BuybackExecuted(uint256 bnbAmount, uint256 tokensReceived); // 回购执行事件
    event BuybackFailed(string reason); // 回购失败事件
    event FundsReceived(address indexed sender, uint256 amount); // 资金接收事件
    event BuybackFailedBytes(bytes data); // 详细错误数据
    event PortalUpdated(address indexed newPortal);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice 初始化函数
     * @param _core Core合约地址
     * @param _flapPortal Flap Portal 地址
     * @param _wishToken WISH 代币地址
     */
    function initialize(
        address _core,
        address _flapPortal,
        address _wishToken
    ) public initializer {
        __UUPSUpgradeable_init();

        core = ICloudDreamCore(_core);
        flapPortal = _flapPortal;
        wishToken = _wishToken;
        
        buybackEnabled = true;
        buybackPercent = 7000; // 默认 70%
        buybackSlippage = 9500; // 默认 5% 滑点
    }

    // --- 鉴权修饰符 (Modifiers) ---
    
    /**
     * @dev UUPS 升级鉴权：仅 Owner (通常是 Core Admin 多签) 可升级
     */
    function _authorizeUpgrade(address newImplementation) internal override {
        require(
            core.hasRole(core.UPGRADER_ROLE(), msg.sender),
            "Treasury: unauthorized upgrade"
        );
    }

    /// @dev 仅允许 DreamSeeker (寻真) 合约调用
    modifier onlySeeker() {
        require(msg.sender == core.seeker(), unicode"Treasury: 仅限 Seeker 调用");
        _;
    }

    /// @dev 仅允许 DreamDrifter (听澜) 合约调用
    modifier onlyDrifter() {
        require(msg.sender == core.drifter(), unicode"Treasury: 仅限 Drifter 调用");
        _;
    }
    
    /// @dev 仅允许 DreamOracle (问天) 合约调用
    modifier onlyOracle() {
        require(msg.sender == core.oracle(), unicode"Treasury: 仅限 Oracle 调用");
        _;
    }

    // --- 核心资金操作 (Core Fund Operations) ---

    /**
     * @notice 接收 BNB 并发出事件
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }

    /**
     * @notice 执行代币支付 (Payout Token)
     * @dev 供业务合约调用，向用户发放奖励（如寻真奖金、分红）。
     * @param to 接收用户地址
     * @param amount 支付金额 (Wei)
     */
    function payoutToken(address to, uint256 amount) external onlySeeker {
        require(to != address(0), unicode"无效地址");
        if (amount == 0) return;
        
        require(IERC20(wishToken).balanceOf(address(this)) >= amount, unicode"Treasury: 代币余额不足");
        IERC20(wishToken).transfer(to, amount);
        
        emit PayoutExecuted(to, amount, "WISH");
    }

    /**
     * @notice 执行 BNB 支付 (Payout BNB)
     * @dev 供业务合约调用，向用户发放 BNB 奖励（如保底奖励、Oracle 奖金）。
     * @param to 接收用户地址
     * @param amount 支付金额 (Wei)
     */
    function payoutBNB(address to, uint256 amount) external {
        // 允许 Seeker 和 Oracle 调用支付 BNB
        require(
            msg.sender == core.seeker() || msg.sender == core.oracle(), 
            unicode"Treasury: 无权调用 payoutBNB"
        );
        require(to != address(0), unicode"无效地址");
        if (amount == 0) return;
        
        require(address(this).balance >= amount, unicode"Treasury: BNB 余额不足");
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, unicode"Treasury: BNB 转账失败");
        
        emit PayoutExecuted(to, amount, "BNB");
    }

    /**
     * @notice 执行市场回购 (Execute Buyback) - Flap 内盘版
     * @dev 将持有的 BNB 在 Flap 内盘买入 WISH 代币，用于补充奖池。
     * @param amount 用于回购的 BNB 数量 (0 表示全部余额)
     */
    function executeBuyback(uint256 amount) external {
        // 鉴权: 仅允许特定角色或为了测试允许任何人 (当前逻辑为 Open for ease of testing/triggering)
        // require(core.hasRole(core.OPERATOR_ROLE(), msg.sender), "Treasury: unauthorized");
        
        // 如果 amount == 0, 使用合约内所有余额
        uint256 available = amount;
        if (amount == 0) {
            available = address(this).balance;
        }
        
        // 应用回购比例 (例如 70%)
        uint256 amountToSwap = (available * buybackPercent) / 10000;
        
        require(amountToSwap > 0, "Treasury: No funds to buyback");

        // Flap Portal Interaction
        // 构建参数: (tokenIn=0x0, tokenOut=wishToken, amountIn=amountToSwap, minOut=0, data="")
        IFlapPortal.SwapExactInputParams memory params = IFlapPortal.SwapExactInputParams({
            tokenIn: address(0), // Native BNB
            tokenOut: wishToken,
            amountIn: amountToSwap,
            amountOutMinimum: 0, // 生产环境应计算滑点
            data: ""
        });

        // 调用 Portal
        try IFlapPortal(flapPortal).swapExactInput{value: amountToSwap}(params) returns (uint256 amtOut) {
            emit BuybackExecuted(amountToSwap, amtOut);
        } catch Error(string memory reason) {
            emit BuybackFailed(reason);
        } catch (bytes memory lowLevelData) {
            emit BuybackFailed("LowLevelError");
            emit BuybackFailedBytes(lowLevelData);
        }
    }

    // --- 管理员配置 (Admin Config) ---
    
    /**
     * @notice 设置回购参数 (需 CONFIG_ROLE)
     */
    function setConfig(bool _enabled, uint256 _percent, uint256 _slippage) external {
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Treasury: unauthorized config"
        );
        buybackEnabled = _enabled;
        buybackPercent = _percent;
        buybackSlippage = _slippage;
    }

    /**
     * @notice 设置 Flap Portal 地址 (需 Admin)
     */
    function setFlapPortal(address _portal) external {
        require(
            core.hasRole(0x00, msg.sender), // DEFAULT_ADMIN_ROLE
            "Treasury: only admin"
        );
        flapPortal = _portal;
        emit PortalUpdated(_portal);
    }

    /**
     * @notice 设置 WISH 代币地址 (需 Admin)
     * @dev 用于迁移到 Flap 发射的新代币
     */
    function setWishToken(address _token) external {
        require(
            core.hasRole(0x00, msg.sender), // DEFAULT_ADMIN_ROLE
            "Treasury: only admin"
        );
        wishToken = _token;
    }
    
    /**
     * @notice 更新核心合约地址 (需 Admin)
     * @dev 仅紧急情况下迁移 Core 合约使用
     */
    function setCore(address _core) external {
        require(
            core.hasRole(0x00, msg.sender), // DEFAULT_ADMIN_ROLE is 0x00
            "Treasury: only admin"
        );
        core = ICloudDreamCore(_core);
    }
}
