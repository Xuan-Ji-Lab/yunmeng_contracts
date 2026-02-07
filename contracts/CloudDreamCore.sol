// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICloudDreamCore.sol";

contract CloudDreamCore is ICloudDreamCore, Ownable, ReentrancyGuard {
    // --- 结构体定义 ---
    // --- 结构体定义 ---
    // (Inherited from ICloudDreamCore)
    
    // --- 状态变量 ---
    
    // 模块注册表: 模块名称 -> 地址
    mapping(string => address) public modules;
    mapping(address => bool) public isModule;

    // 福报系统 (Karma)
    mapping(address => uint256) public karmaBalance;
    mapping(address => uint256) public userTotalPaidSeeks; // Tracking paid seeks

    // 祈愿数据
    WishRecord[] public allWishes;
    PityRecord[] public allPityRecords; // Pity Record Storage
    mapping(address => uint256[]) public userWishIds;
    mapping(address => uint256[]) public userPityIds;

    // 资产
    address public wishToken;
    
    // --- 修饰符 ---
    modifier onlyModule() {
        require(isModule[msg.sender], unicode"Core: 调用者非授权模块");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // --- 管理员: 模块管理 ---
    function registerModule(string calldata key, address moduleAddress) external onlyOwner {
        require(moduleAddress != address(0), unicode"无效地址");
        // 如果已存在则覆盖，并移除旧地址权限
        if (modules[key] != address(0)) {
            isModule[modules[key]] = false;
        }
        modules[key] = moduleAddress;
        isModule[moduleAddress] = true;
    }

    function setWishToken(address _token) external onlyOwner {
        wishToken = _token;
    }

    // --- 接口实现 ---

    function incrementPaidSeeks(address user) external override onlyModule {
        userTotalPaidSeeks[user]++;
    }

    function getUserTotalPaidSeeks(address user) external view override returns (uint256) {
        return userTotalPaidSeeks[user];
    }

    function mintKarma(address user, uint256 amount) external override onlyModule {
        karmaBalance[user] += amount;
        emit KarmaChanged(user, amount, true);
    }

    function burnKarma(address user, uint256 amount) external override onlyModule {
        require(karmaBalance[user] >= amount, unicode"Core: 福报余额不足");
        karmaBalance[user] -= amount;
        emit KarmaChanged(user, amount, false);
    }

    function addWishRecord(
        address user, 
        string calldata wishText, 
        uint256 round, 
        uint8 tier, 
        uint256 reward
    ) external override onlyModule returns (uint256) {
        uint256 newId = allWishes.length;
        allWishes.push(WishRecord({
            id: newId,
            user: user,
            wishText: wishText,
            timestamp: block.timestamp,
            round: round,
            tier: tier,
            reward: reward
        }));
        userWishIds[user].push(newId);
        return newId;
    }

    function addPityRecord(address user, uint256 amount) external override onlyModule {
        uint256 newId = allPityRecords.length;
        allPityRecords.push(PityRecord({
            id: newId,
            user: user,
            amount: amount,
            timestamp: block.timestamp
        }));
        userPityIds[user].push(newId);
        emit PityTriggered(user, amount); // Emit event for log indexers too
    }

    function getUserPityIds(address user) external view override returns (uint256[] memory) {
        return userPityIds[user];
    }

    function distributeReward(address user, uint256 amount) external override onlyModule nonReentrant {
        require(address(this).balance >= amount, unicode"Core: BNB 余额不足");
        (bool success, ) = payable(user).call{value: amount}("");
        require(success, unicode"Core: BNB 转账失败");
        emit RewardDistributed(user, amount, "BNB");
    }

    function distributeTokenReward(address user, uint256 amount) external override onlyModule nonReentrant {
        require(wishToken != address(0), unicode"Core: 代币地址未设置");
        require(IERC20(wishToken).balanceOf(address(this)) >= amount, unicode"Core: 代币余额不足");
        IERC20(wishToken).transfer(user, amount);
        emit RewardDistributed(user, amount, "WISH");
    }

    // --- 天道回响 (Pity) 实现 ---
    mapping(address => uint256) public tribulationCounts;

    function setTribulationCount(address user, uint256 count) external override onlyModule {
        tribulationCounts[user] = count;
        // 如果需要，可以在这里抛出 Core 级别的事件，但 Interface 里定义的 PityTriggered 也可以由 Seeker 抛出或这里抛出
        // 为了一致性，我们在 Core 中不强制抛出 PityTriggered，除非分配奖励时。
        // 但 Interface 定义了 Event，最好在 Seeker 触发时 emit，或者 Core 的 distribute 附带。
        // 这里仅作为状态存储。
    }

    function getTribulationCount(address user) external view override returns (uint256) {
        return tribulationCounts[user];
    }

    // --- 视图函数 ---
    function getUserKarma(address user) external view override returns (uint256) {
        return karmaBalance[user];
    }

    function getWishPowerPool() external view override returns (uint256) {
        return address(this).balance;
    }
    
    // 支持旧的视图逻辑
    function getGlobalWishCount() external view returns (uint256) {
        return allWishes.length;
    }

    // === 批量查询优化 (减少 RPC 调用) ===

    /// @notice 获取用户祈愿记录数量
    function getUserWishCount(address user) external view returns (uint256) {
        return userWishIds[user].length;
    }

    /// @notice 批量获取用户祈愿 ID（分页）
    /// @param user 用户地址
    /// @param start 起始索引
    /// @param count 获取数量
    function getUserWishIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] storage ids = userWishIds[user];
        uint256 total = ids.length;
        
        if (start >= total) {
            return new uint256[](0);
        }
        
        uint256 end = start + count;
        if (end > total) {
            end = total;
        }
        
        uint256 resultLength = end - start;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = ids[start + i];
        }
        return result;
    }

    /// @notice 获取用户天道回响记录数量
    function getUserPityCount(address user) external view returns (uint256) {
        return userPityIds[user].length;
    }

    /// @notice 批量获取用户天道回响 ID（分页）
    function getUserPityIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] storage ids = userPityIds[user];
        uint256 total = ids.length;
        
        if (start >= total) {
            return new uint256[](0);
        }
        
        uint256 end = start + count;
        if (end > total) {
            end = total;
        }
        
        uint256 resultLength = end - start;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = ids[start + i];
        }
        return result;
    }

    /// @notice 批量获取祈愿记录详情
    function getWishRecordsBatch(uint256[] calldata ids) external view returns (WishRecord[] memory) {
        uint256 len = ids.length;
        WishRecord[] memory result = new WishRecord[](len);
        for (uint256 i = 0; i < len; i++) {
            require(ids[i] < allWishes.length, unicode"无效ID");
            result[i] = allWishes[ids[i]];
        }
        return result;
    }

    /// @notice 批量获取天道回响记录详情
    function getPityRecordsBatch(uint256[] calldata ids) external view returns (PityRecord[] memory) {
        uint256 len = ids.length;
        PityRecord[] memory result = new PityRecord[](len);
        for (uint256 i = 0; i < len; i++) {
            require(ids[i] < allPityRecords.length, unicode"无效ID");
            result[i] = allPityRecords[ids[i]];
        }
        return result;
    }

    // 允许接收 BNB (国库/寻真充值)
    receive() external payable {}
}
