// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TaxSplitter (税收分配器)
 * @notice 接收 Flap 平台的 WISH 代币交易税收，按比例分配给奖池和运营钱包。
 * @dev 设计为 Flap 代币的税收接收地址。
 *      - 50% 税收 → DreamTreasury (奖池，用于回购或直接充值)
 *      - 50% 税收 → 运营钱包 (团队运营资金)
 *      比例可由 owner 调整。
 *      
 *      开关逻辑:
 *      - splitEnabled = true: 按比例分配 (默认)
 *      - splitEnabled = false: 100% 转入 DreamTreasury (暂停分流)
 *
 *      任何人均可调用 distribute() 触发分配。
 */
contract TaxSplitter is Ownable {

    // --- 核心地址 ---
    /// @notice 奖池合约地址 (DreamTreasury)
    address public treasury;
    
    /// @notice 运营钱包地址
    address public opsWallet;
    
    /// @notice WISH 代币地址
    address public wishToken;

    // --- 配置参数 ---
    /// @notice 奖池分配比例 (基点, 10000 = 100%)
    /// @dev 默认 5000 = 50%
    uint256 public treasuryBps;

    // --- 最小分配阈值 ---
    /// @notice 最小 WISH 分配量 (防止 gas 浪费)
    uint256 public minTokenDistribute;
    
    /// @notice 最小 BNB 分配量
    uint256 public minBnbDistribute;

    // --- 事件 ---
    event TokenDistributed(uint256 toTreasury, uint256 toOps, uint256 total);
    event BnbDistributed(uint256 toTreasury, uint256 toOps, uint256 total);
    event ConfigUpdated(uint256 treasuryBps);
    event AddressUpdated(string key, address addr);

    constructor(
        address _treasury,
        address _opsWallet,
        address _wishToken,
        uint256 _treasuryBps
    ) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_opsWallet != address(0), "Invalid ops wallet");
        require(_wishToken != address(0), "Invalid token");
        require(_treasuryBps <= 10000, "Bps too high");

        treasury = _treasury;
        opsWallet = _opsWallet;
        wishToken = _wishToken;
        treasuryBps = _treasuryBps;

        // 默认最小分配量 (0 为不限制)
        minTokenDistribute = 0;
        minBnbDistribute = 0;
    }
    
    // --- 快照变量 (用于计算增量) ---
    uint256 public lastTokenBalance;
    uint256 public lastBnbBalance;
    
    // --- 开关变量 ---
    /// @notice 是否开启分流 (true=按比例, false=全额进国库)
    bool public splitEnabled = true;

    event SplitEnabledUpdated(bool enabled);

    /// @notice 接收 BNB (税收可能以 BNB 形式到达)
    receive() external payable {}

    // --- 核心分配函数 ---

    /**
     * @notice 分配累积的 WISH 代币税收
     * @dev 任何人均可调用。将合约中的 WISH 按比例分配给 Treasury 和运营钱包。
     */
    function distributeToken() external {
        uint256 currentBalance = IERC20(wishToken).balanceOf(address(this));
        
        // 计算自上次分配以来的增量
        if (currentBalance <= lastTokenBalance) return;
        uint256 amountToDistribute = currentBalance - lastTokenBalance;
        
        if (amountToDistribute < minTokenDistribute) return; // Silent return

        if (splitEnabled) {
            // 正常模式: 按比例分配
            uint256 toTreasury = (amountToDistribute * treasuryBps) / 10000;
            uint256 toOps = amountToDistribute - toTreasury;

            if (toTreasury > 0) IERC20(wishToken).transfer(treasury, toTreasury);
            if (toOps > 0) IERC20(wishToken).transfer(opsWallet, toOps);
            
            emit TokenDistributed(toTreasury, toOps, amountToDistribute);
        } else {
            // 关闭分流: 100% 进国库
            IERC20(wishToken).transfer(treasury, amountToDistribute);
            emit TokenDistributed(amountToDistribute, 0, amountToDistribute);
        }
        
        // 更新快照为当前实际余额 (分配后余额)
        lastTokenBalance = IERC20(wishToken).balanceOf(address(this));
    }

    /**
     * @notice 分配累积的 BNB 税收
     * @dev 任何人均可调用。将合约中的 BNB 按比例分配给 Treasury 和运营钱包。
     *      转入 Treasury 的 BNB 可后续通过 Treasury.executeBuyback() 回购 WISH。
     */
    function distributeBNB() external {
        uint256 currentBalance = address(this).balance;
        
        if (currentBalance <= lastBnbBalance) return;
        uint256 amountToDistribute = currentBalance - lastBnbBalance;
        
        if (amountToDistribute < minBnbDistribute) return; // Silent return

        if (splitEnabled) {
            // 正常模式: 按比例分配
            uint256 toTreasury = (amountToDistribute * treasuryBps) / 10000;
            uint256 toOps = amountToDistribute - toTreasury;

            if (toTreasury > 0) {
                (bool s1, ) = payable(treasury).call{value: toTreasury}("");
                require(s1, unicode"Treasury 转账失败");
            }
            if (toOps > 0) {
                (bool s2, ) = payable(opsWallet).call{value: toOps}("");
                require(s2, unicode"运营钱包转账失败");
            }
            emit BnbDistributed(toTreasury, toOps, amountToDistribute);
        } else {
            // 关闭分流: 100% 进国库
            (bool s, ) = payable(treasury).call{value: amountToDistribute}("");
            require(s, unicode"Treasury 转账失败");
            emit BnbDistributed(amountToDistribute, 0, amountToDistribute);
        }
        
        // 更新快照
        lastBnbBalance = address(this).balance;
    }

    // --- 开关控制 ---
    
    /// @notice 设置分流开关 (true=自适应, false=全额回购)
    function setSplitEnabled(bool _enabled) external onlyOwner {
        splitEnabled = _enabled;
        emit SplitEnabledUpdated(_enabled);
    }

    // --- 查询函数 ---

    /// @notice 查询待分配的 WISH 余额
    function pendingToken() external view returns (uint256) {
        return IERC20(wishToken).balanceOf(address(this));
    }

    /// @notice 查询待分配的 BNB 余额
    function pendingBNB() external view returns (uint256) {
        return address(this).balance;
    }

    // --- 管理员配置 ---

    /// @notice 设置分配比例 (仅 Owner)
    function setTreasuryBps(uint256 _bps) external onlyOwner {
        require(_bps <= 10000, "Bps too high");
        treasuryBps = _bps;
        emit ConfigUpdated(_bps);
    }

    /// @notice 设置 Treasury 地址
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
        emit AddressUpdated("treasury", _treasury);
    }

    /// @notice 设置运营钱包地址
    function setOpsWallet(address _ops) external onlyOwner {
        require(_ops != address(0), "Invalid address");
        opsWallet = _ops;
        emit AddressUpdated("opsWallet", _ops);
    }

    /// @notice 设置最小分配阈值
    function setMinDistribute(uint256 _minToken, uint256 _minBnb) external onlyOwner {
        minTokenDistribute = _minToken;
        minBnbDistribute = _minBnb;
    }

    /// @notice 紧急提取 (仅 Owner，用于合约迁移)
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        if (token == address(0)) {
            // 提取 BNB
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "BNB transfer failed");
        } else {
            // 提取 ERC20
            IERC20(token).transfer(to, amount);
        }
    }
}
