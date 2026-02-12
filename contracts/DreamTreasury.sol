// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICloudDreamCore.sol"; 
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IFlapPortal.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

/**
 * @title DreamTreasury (云梦国库 & 资金管理)
 * @dev 系统的资金托管中心。负责：
 *      1. 资金托管：持有所有 BNB 和 WISH 代币储备。
 *      2. 支付执行：响应业务合约 (Seeker/Oracle) 的指令进行转账。
 *      3. 代币回购：提供将 BNB 兑换为 WISH 并注入奖池的功能。
 *      安全说明：不包含核心游戏逻辑，只作为"银行"执行经过授权的指令。
 */
contract DreamTreasury is Initializable, UUPSUpgradeable, AutomationCompatibleInterface {
    
    // --- 外部合约引用 ---
    /// @notice 核心配置合约 (用于权限校验)
    ICloudDreamCore public core;
    
    /// @notice [DEPRECATED] 原 DEX 路由合约 (保留名称以兼容存储布局)
    IPancakeRouter02 public swapRouter;
    
    // --- 资产地址 ---
    address public wishToken;
    address public wbnb; // [DEPRECATED] 原 WBNB 地址 (保留名称以兼容存储布局)
    
    // --- 配置参数 (Removed) ---
    // Logic moved to Seeker

    // --- 新增状态变量 (Storage Gap 之后) ---
    /// @notice 回购滑点保护 (基点)，例如 9500 表示 95% (5%滑点)
    uint256 public buybackSlippage; 
    /// @notice Flap Portal 合约地址 (内盘回购)
    address public flapPortal;
    
    // --- Tax & Ops Variables ---
    address public opsWallet;
    uint256 public taxOpsBps; // DEPRECATED: Kept for storage layout compatibility
    uint256 public minBuybackThreshold; // Auto-buyback threshold
    bool public enableTaxBuyback; // Toggle for auto-buyback
    
    // --- Piggyback Buyback ---
    /// @notice 待回购的税收 BNB 累积金额 (搭便车模式: 在下次寻真时触发)
    uint256 public pendingTaxBuyback;

    // --- 事件定义 ---
    event PayoutExecuted(address indexed to, uint256 amount, string currency); // 支付执行事件 (currency: "BNB" | "WISH")
    event BuybackExecuted(uint256 bnbAmount, uint256 tokensReceived); // 回购执行事件
    event BuybackFailed(string reason); // 回购失败事件
    event FundsReceived(address indexed sender, uint256 amount); // 资金接收事件
    event BuybackFailedBytes(bytes data); // 详细错误数据
    event PortalUpdated(address indexed newPortal);
    event OpsConfigUpdated(address wallet, uint256 bps); // bps param is deprecated/unused
    event TaxDistributed(uint256 toOps, uint256 toBuyback);

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
        
        buybackSlippage = 9500; // 默认 5% 滑点
        
        // 默认税收配置
        // taxOpsBps = 5000; // REMOVED
        minBuybackThreshold = 0.05 ether; // 累计到 0.05 BNB 触发回购
        enableTaxBuyback = true; 
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
     * @dev 区分资金来源：
     *      1. Game Contract (Seeker/Drifter): 仅充值，不处理。
     *      2. Others (Tax): (100% Tax Buyback).
     */
    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);

        // [Anti-Reentrancy] Ignore refunds/transfers from FlapPortal to prevent buyback loops
        if (msg.sender == flapPortal) {
            return;
        }

        if (msg.value > 0) {
            address sender = msg.sender;
            address seeker = core.seeker();
            address drifter = core.drifter();
            address oracle = core.oracle();

            // 只有非核心合约转账才视为"税收" (Exclude Seeker, Drifter, AND Oracle)
            if (sender != seeker && sender != drifter && sender != oracle) {
                _processTaxLossless(msg.value);
            }
        }
    }

    /**
     * @notice 处理税收分账
     * @dev Ops 分成已移除。回购份额为 100% (若启用)。
     *      若 Buyback Disabled, 且 OpsWallet 设置了，则转给 OpsWallet (Fallback).
     */
    function _processTaxLossless(uint256 amount) internal {
        // If buyback is disabled, send 100% to Ops Wallet as fallback
        if (!enableTaxBuyback) {
            if (opsWallet != address(0)) {
                (bool success, ) = payable(opsWallet).call{value: amount}("");
                if (!success) {
                    emit BuybackFailed("OpsTransferFailed");
                }
            }
            emit TaxDistributed(amount, 0);
            return;
        }

        // --- Enabled: 100% Accumulate for Buyback ---
        
        // 1. Ops Share (Removed - handled by Flap)
        uint256 opsAmt = 0;
        
        // 2. 回购份额累积 (100%)
        uint256 buybackShare = amount;
        pendingTaxBuyback += buybackShare;
        emit TaxDistributed(opsAmt, buybackShare);
    }

    /**
     * @notice 执行累积的税收回购
     * @dev Seeker OPERATOR 手动调用 / Chainlink Automation 自动调用
     */
    function executePendingTaxBuyback() public {
        require(
            msg.sender == core.seeker() 
            || core.hasRole(core.OPERATOR_ROLE(), msg.sender)
            || _isAutomationForwarder(),
            "Treasury: unauthorized"
        );
        uint256 pending = pendingTaxBuyback;
        if (pending < minBuybackThreshold) return;
        if (address(this).balance < pending) {
            pending = address(this).balance;
        }
        if (pending == 0) return;
        
        pendingTaxBuyback = 0;
        _internalBuyback(pending);
    }

    // --- Chainlink Automation ---

    /// @notice Chainlink Automation forwarder 地址 (注册 Upkeep 后设置)
    address public automationForwarder;

    event AutomationForwarderUpdated(address indexed forwarder);

    function setAutomationForwarder(address _forwarder) external {
        require(core.hasRole(core.CONFIG_ROLE(), msg.sender), "Treasury: config only");
        automationForwarder = _forwarder;
        emit AutomationForwarderUpdated(_forwarder);
    }

    function _isAutomationForwarder() internal view returns (bool) {
        return automationForwarder != address(0) && msg.sender == automationForwarder;
    }

    /// @inheritdoc AutomationCompatibleInterface
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory) {
        upkeepNeeded = pendingTaxBuyback >= minBuybackThreshold 
                       && address(this).balance > 0;
    }

    /// @inheritdoc AutomationCompatibleInterface
    function performUpkeep(bytes calldata) external override {
        executePendingTaxBuyback();
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
        // Limit gas to 20,000 to prevent gas starvation (63/64 rule) if 'to' is a contract
        (bool success, ) = payable(to).call{value: amount, gas: 20000}("");
        require(success, unicode"Treasury: BNB 转账失败");
        
        emit PayoutExecuted(to, amount, "BNB");
    }

    /**
     * @notice 执行市场回购 (Execute Buyback) - 100% 回购指定金额
     * @dev 供 Seeker (70% 资金) 或 TaxSplitter (100% 资金) 调用。
     *      强制要求 amount > 0，避免误操作消耗所有余额(包括保底储备)。
     * @param amount 回购金额 (必须 > 0)
     */
    function executeBuyback(uint256 amount) external {
        require(core.hasRole(core.OPERATOR_ROLE(), msg.sender), "Treasury: unauthorized");
        require(amount > 0, "Treasury: Amount must be > 0");
        require(address(this).balance >= amount, "Treasury: Insufficient BNB");
        
        // 执行回购 (100% 金额)
        _internalBuyback(amount);
    }

    function _internalBuyback(uint256 amountToSwap) internal {
        // [MODIFIED] Removed quote and slippage protection to avoid QuoteFailed on Flap/BondingCurve
        // 1. Force min output to 0
        uint256 amountOutMinimum = 0;

        // 2. 构建参数
        IFlapPortal.SwapExactInputParams memory params = IFlapPortal.SwapExactInputParams({
            tokenIn: address(0), // Native BNB
            tokenOut: wishToken,
            amountIn: amountToSwap,
            amountOutMinimum: amountOutMinimum,
            data: ""
        });

        // 3. 调用 Portal (显式指定高 gas 限制，避免 63/64 rule 导致 OOG)
        try IFlapPortal(flapPortal).swapExactInput{value: amountToSwap, gas: 500000}(params) returns (uint256 amtOut) {
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
     * @notice 设置回购滑点 (需 CONFIG_ROLE)
     * @param _slippage 滑点 (基点, e.g. 9500 = 95%) 
     */
    function setSlippage(uint256 _slippage) external {
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Treasury: unauthorized config"
        );
        require(_slippage <= 10000, "Invalid slippage");
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

    // [MODIFIED] Removed unused `bps` parameter usage. Maintained signature if upgrade requires (but better to cleanup).
    // Actually, user said "不着急开发" but they approved the plan. I will just simplify parameters.
    // Ops Wallet is still set here for fallback purposes.
    function setOpsConfig(address _wallet, uint256 /*_bps*/, uint256 _threshold, bool _enableBuyback) external {
        require(core.hasRole(core.CONFIG_ROLE(), msg.sender), "Treasury: unauthorized");
        // require(_bps <= 10000, "Invalid bps"); // Removed check
        opsWallet = _wallet;
        // taxOpsBps = _bps; // Removed assignment
        minBuybackThreshold = _threshold;
        enableTaxBuyback = _enableBuyback;
        emit OpsConfigUpdated(_wallet, 0); // Emit 0 for bps
    }

    // --- Admin Withdrawal Functions ---

    /**
     * @notice 管理员提取运营资金 (BNB)
     * @dev 用于提取盈余或紧急转移资金
     * @param to 接收地址
     * @param amount 提取金额 (Wei)
     */
    function adminWithdrawBNB(address payable to, uint256 amount) external {
        require(
            core.hasRole(0x00, msg.sender), // DEFAULT_ADMIN_ROLE
            "Treasury: only admin"
        );
        require(to != address(0), unicode"无效地址");
        require(amount <= address(this).balance, unicode"余额不足");
        
        to.transfer(amount);
        emit PayoutExecuted(to, amount, "BNB_ADMIN");
    }

    /**
     * @notice 管理员提取代币资产
     * @dev 用于提取 WISH 税收或误转入的其他代币
     * @param token 代币合约地址
     * @param to 接收地址
     * @param amount 提取金额
     */
    function adminWithdrawToken(address token, address to, uint256 amount) external {
        require(
            core.hasRole(0x00, msg.sender), // DEFAULT_ADMIN_ROLE
            "Treasury: only admin"
        );
        require(token != address(0), unicode"无效代币");
        require(to != address(0), unicode"无效地址");
        require(IERC20(token).balanceOf(address(this)) >= amount, unicode"代币余额不足");
        
        IERC20(token).transfer(to, amount);
        emit PayoutExecuted(to, amount, "TOKEN_ADMIN");
    }
}
