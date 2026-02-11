// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICloudDreamCore.sol";
import "./interfaces/IDreamTreasury.sol";
import "./interfaces/IDreamDrifter.sol";

/**
 * @title DreamSeeker (寻真 - 核心业务逻辑 Proxy)
 * @dev 负责处理核心游戏逻辑：寻真(抽奖) 和 归墟(分红)。
 *      
 *      核心机制：
 *      1. **寻真**: 用户付费或消耗福报进行抽奖，结果由 Chainlink VRF 决定。
 *      2. **归墟 (Abyss)**: 
 *         - 触发归墟 (Tier 0) 时，进行 50/30/20 资金分配。
 *         - 50% 奖励中奖者。
 *         - 30% 分红给所有归墟持有者。
 *         - 20% 留存国库。
 *      3. **天道回响 (Pity)**: 连续 9 次未中归墟，第 10 次必得 BNB 保底奖励。
 *      
 *      数据持久化：
 *      - 用户的祈愿历史 (WishRecord) 和保底记录 (PityRecord) 完整存储在链上，保证前端查询兼容性。
 */
contract DreamSeeker is 
    Initializable, 
    UUPSUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    // --- 外部合约引用 ---
    ICloudDreamCore public core;
    IDreamTreasury public treasury;
    IDreamDrifter public drifter;
    VRFCoordinatorV2Interface public vrfCoordinator;
    address private wishToken;
    
    // --- 状态变量 (业务数据) ---
    
    // 劫数系统 (Pity System)
    /// @notice 用户当前的劫数 (连续未中归墟次数)
    mapping(address => uint256) public tribulationCounts; 
    
    /// @notice 用户的累积权重 (用于计算保底奖励金额)
    mapping(address => uint256) public userTribulationWeight; 
    
    // 归墟系统 (Abyss System)
    /// @notice 归墟持有者总人数
    uint256 public totalAbyssHolders;
    
    /// @notice 归墟总劫数 (用于判定第 81 次终局)
    uint256 public totalAbyssTribulations; 
    
    /// @notice 是否为归墟持有者 (才有资格分红)
    mapping(address => bool) public isAbyssHolder;
    
    /// @notice 是否为付费用户 (Anti-Sybil)
    mapping(address => bool) public hasPaid;
    
    // 分红系统 (Dividend System) - V2: 自动发放
    /// @notice 每个用户的归墟份额 (每次触发归墟 +1)
    mapping(address => uint256) public userAbyssShares;
    
    /// @notice 全局总归墟份额
    uint256 public totalAbyssShares;
    
    /// @notice 归墟持有者地址列表 (用于遍历自动发放)
    address[] public abyssHolderList;
    
    /// @notice 累计已发放分红总额
    uint256 public totalDividendsDistributed;

    // --- 历史记录存储 (还原逻辑) ---
    
    struct WishRecord {
        uint256 id;
        address user;
        string wishText;
        uint256 timestamp;
        uint256 round;
        uint8 tier;
        uint256 reward;
        uint256 holdersAtTime;   // 归墟触发时的持有者数量
        uint256 poolAtTime;      // 归墟触发时的奖池总额
        uint256 dividendAtTime;  // 本次发放的分红总额
    }
    
    struct PityRecord {
        uint256 id;
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    struct DividendRecord {
        uint256 id;
        address user;
        uint256 amount;
        uint256 shares;
        uint256 round;
        uint256 pool;
        uint256 timestamp;
    }

    /// @notice 全局祈愿历史记录
    WishRecord[] public allWishes;
    
    /// @notice 全局保底历史记录
    PityRecord[] public allPityRecords;
    
    /// @notice 用户祈愿 ID 索引
    mapping(address => uint256[]) public userWishIds;
    
    /// @notice 用户保底 ID 索引
    mapping(address => uint256[]) public userPityIds;

    // --- VRF 请求状态 ---
    struct RequestStatus {
        bool fulfilled;
        bool exists;
        address sender;
        string wishText;
        bool isPaid;
        uint256 batchSize; // New: Number of wishes in this request
        uint256 timestamp; // VRF 超时退款: 请求时间戳
    }
    mapping(uint256 => RequestStatus) public s_requests;

    mapping(address => bool) private testers;


    // --- 核心常量 ---
    // --- 配置参数 (Configurable State Variables) ---
    uint256 public seekCost;           // 付费寻真价格
    uint256 public karmaCost;          // 免费寻真消耗福报
    uint256 public pityBase;           // 保底奖励基准 (BNB)
    uint256 public pityThreshold;      // 保底触发阈值
    uint16[4] public tierThresholds;   // [1, 11, 41, 141] 概率分布
    
    // 归墟分配比例 (基点, Sum <= 100)
    uint256 public abyssWinnerRatio;   // 赢家比例 (e.g. 50)
    uint256 public abyssDividendRatio; // 分红比例 (e.g. 30)

    // --- New Storage Variables for Upgrade (Must be appended) ---
    /// @notice 全局分红历史记录
    DividendRecord[] public allDividendRecords;

    /// @notice 用户分红 ID 索引
    mapping(address => uint256[]) public userDividendIds;

    /// @notice 祈愿记录区块号索引
    mapping(uint256 => uint256) public wishBlockNumbers;

    /// @notice 保底记录区块号索引
    mapping(uint256 => uint256) public pityBlockNumbers;

    /// @notice 分红记录区块号索引
    mapping(uint256 => uint256) public dividendBlockNumbers;

    /// @notice 回购比例 (基点)，例如 7000 表示 70% 的资金用于回购
    uint256 public buybackPercent; 

    /// @notice 是否开启回购功能
    bool public buybackEnabled;

    // 剩余部分自动留存 Treasury
    
    // --- 事件 ---
    event SeekRequestSent(uint256 indexed requestId, address indexed user);
    event SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText);
    event AbyssTriggered(address indexed user, bool isGrandFinale, uint256 tribulationCount);
    event PityTriggered(address indexed user, uint256 amount, uint256 weight);
    event DividendDistributed(address indexed holder, uint256 amount, uint256 shares, uint256 round, uint256 pool);
    event FundsForwarded(address indexed sender, uint256 amount);
    event PayoutFailed(address indexed user, uint256 amount, string reason); // VRF 安全: 支付失败时记录
    event RefundIssued(uint256 indexed requestId, address indexed user, uint256 amount); // VRF 超时退款

    /// @notice 仅由 VRF Coordinator 调用的错误
    error OnlyCoordinatorCanFulfill(address have, address want);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _core,
        address _treasury,
        address _drifter,
        address _vrfCoordinator,
        address _wishToken
    ) public initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        core = ICloudDreamCore(_core);
        treasury = IDreamTreasury(_treasury);
        drifter = IDreamDrifter(_drifter);
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        wishToken = _wishToken;
        
        wishToken = _wishToken;
        
        // 默认配置初始化
        seekCost = 0.005 ether;
        karmaCost = 10;
        pityBase = 0.001 ether;
        pityThreshold = 9;
        tierThresholds = [1, 11, 41, 141]; // 0.1%, 1%, 3%, 10%
        
        abyssWinnerRatio = 50;   // 50%
        abyssWinnerRatio = 50;   // 50%
        abyssDividendRatio = 30; // 30%
        buybackPercent = 7000;   // 70%
        buybackEnabled = true;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(
            core.hasRole(core.UPGRADER_ROLE(), msg.sender),
            "Seeker: unauthorized upgrade"
        );
    }
    


    // --- 寻真核心业务逻辑 (Seek Truth) ---

    /**
     * @notice 发起寻真 (Seek Truth)
     * @dev 用户入口。支付 BNB 或消耗福报，发起 VRF 随机数请求。
     * @param wishText 祈愿文本
     */
    function seekTruth(string memory wishText) external payable nonReentrant {
        if (msg.value >= seekCost) {
            // 付费模式
            hasPaid[msg.sender] = true;
            
            // 付费模式: 资金转发给 Treasury (使用 call 避免 2300 gas 限制)
            (bool success, ) = payable(address(treasury)).call{value: msg.value}("");
            require(success, unicode"Treasury转账失败");
            
            // 触发 Treasury 回购逻辑 (按配置比例)
            if (buybackEnabled) {
                // 计算回购金额: msg.value * buybackPercent / 10000
                uint256 buybackAmt = (msg.value * buybackPercent) / 10000;
                
                if (buybackAmt > 0) {
                    try treasury.executeBuyback{gas: 300000}(buybackAmt) {} catch {}
                }
            }
            emit FundsForwarded(msg.sender, msg.value);
        } else {
            // 免费模式: 必须消耗福报 (跨合约调用 Drifter)
            require(msg.value == 0, unicode"金额不足");
            // 调用 Drifter 扣除福报 (如余额不足 Drifter 会 Revert)
            drifter.burnKarma(msg.sender, karmaCost);
        }

        requestRandomWords(wishText, msg.value > 0, 1);
    }

    /**
     * @notice 批量寻真 (Batch Seek Truth)
     * @param wishText 祈愿文本 (所有次数共享同一文本)
     * @param count 祈愿次数 (1-10)
     */
    function seekTruthBatch(string memory wishText, uint256 count) external payable nonReentrant {
        require(count > 0 && count <= 10, "Invalid count");
        
        if (msg.value > 0) {
            // 付费模式
            uint256 totalCost = seekCost * count;
            require(msg.value >= totalCost, unicode"金额不足");
            
            hasPaid[msg.sender] = true;
            (bool success, ) = payable(address(treasury)).call{value: msg.value}("");
            require(success, unicode"Treasury转账失败");
            
            // 触发 Treasury 回购逻辑 (按配置比例)
            if (buybackEnabled) {
                uint256 buybackAmt = (msg.value * buybackPercent) / 10000;
                if (buybackAmt > 0) {
                    try treasury.executeBuyback{gas: 300000}(buybackAmt) {} catch {}
                }
            }
            emit FundsForwarded(msg.sender, msg.value);
        } else {
            // 免费模式
            require(msg.value == 0, unicode"金额不足");
            drifter.burnKarma(msg.sender, karmaCost * count);
        }

        requestRandomWords(wishText, msg.value > 0, uint32(count));
    }

    function requestRandomWords(string memory wishText, bool isPaid, uint32 numWords) internal {
        // 发起 Chainlink VRF 请求
        uint256 requestId = vrfCoordinator.requestRandomWords(
            core.vrfKeyHash(),
            core.vrfSubscriptionId(),
            core.vrfRequestConfirmations(),
            core.vrfCallbackGasLimit(),
            numWords // 请求 randomWords 数量
        );

        // 记录请求上下文
        s_requests[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            sender: msg.sender,
            wishText: wishText,
            isPaid: isPaid,
            batchSize: numWords,
            timestamp: block.timestamp
        });

        emit SeekRequestSent(requestId, msg.sender);
    }



    // --- VRF 回调逻辑 ---

    /**
     * @notice VRF 回调入口 (raw)
     * @dev 验证调用者是否为 VRF Coordinator
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        if (msg.sender != address(vrfCoordinator)) {
            revert OnlyCoordinatorCanFulfill(msg.sender, address(vrfCoordinator));
        }
        fulfillRandomWords(requestId, randomWords);
    }

    /**
     * @notice 处理随机数并生成结果
     * @dev 核心业务逻辑实现：判定中奖等级、计算分红、处理保底。
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal {
        RequestStatus memory request = s_requests[requestId];
        if (!request.exists) return; 
        
        // 循环处理每一个随机数
        for (uint256 i = 0; i < randomWords.length; i++) {
            _processResult(request.sender, request.wishText, randomWords[i]);
        }
        
        delete s_requests[requestId];
    }
    
    /**
     * @dev 内部结果处理逻辑
     */
    function _processResult(address user, string memory wishText, uint256 randomness) internal {
        uint256 rng = randomness % 1000;
        uint8 tier;
        uint256 reward = 0;
        uint256 tribCount = tribulationCounts[user];
        uint256 poolSnapshot = 0;     // 本次奖池快照
        uint256 dividendSnapshot = 0; // 本次分红快照

        if (rng < tierThresholds[0]) {
            // === 触发归墟 (Abyss) ===
            tier = 0;
            tribCount = 0;
            userTribulationWeight[user] = 0; // 重置保底权重
            
            // 1. 更新归墟持有者状态
            if (!isAbyssHolder[user]) {
                isAbyssHolder[user] = true;
                totalAbyssHolders++;
                abyssHolderList.push(user); // 记录地址用于遍历
            }
            userAbyssShares[user]++;  // 归墟份额 +1
            totalAbyssShares++;       // 全局份额 +1
            
            // 2. 更新归墟总进度 (81次为终局)
            bool isGrandFinale = (totalAbyssTribulations + 1 >= 81);
            if (isGrandFinale) totalAbyssTribulations = 81;
            else totalAbyssTribulations++;
            
            emit AbyssTriggered(user, isGrandFinale, totalAbyssTribulations);
            
            // 3. 资金分配 — V2: 直接奖池余额, 自动发放
            uint256 netPool = IERC20(wishToken).balanceOf(address(treasury));
            poolSnapshot = netPool;
            
            if (netPool > 0) {
                 if (isGrandFinale) {
                     // 终局: 100% 奖池全部按份额分发给所有人
                     dividendSnapshot = netPool;
                     _distributeDividends(netPool, totalAbyssTribulations, poolSnapshot);
                 } else {
                     // 常规: X% Winner, Y% Dividends, 20% 留存
                     uint256 winnerAmt = (netPool * abyssWinnerRatio) / 100;
                     uint256 dividendAmt = (netPool * abyssDividendRatio) / 100;
                     dividendSnapshot = dividendAmt;
                     
                     // 1. 支付中奖者 (50%)
                     if (winnerAmt > 0) {
                         try treasury.payoutToken(user, winnerAmt) {
                             reward = winnerAmt;
                         } catch {
                             emit PayoutFailed(user, winnerAmt, "WINNER");
                         }
                     }
                     
                     // 2. 自动分发分红 (30%) 给所有归墟持有者
                     if (dividendAmt > 0 && totalAbyssShares > 0) {
                         _distributeDividends(dividendAmt, totalAbyssTribulations, poolSnapshot);
                     }
                     // 20% 自动留在国库
                 }
            }
        } else {
            // === 未中归墟 (Normal) ===
            tribCount++; // 增加劫数
            uint256 weightAdded = 0;
            
            // 判定等级
             if (rng < tierThresholds[1]) { tier = 1; weightAdded = 10; }
            else if (rng < tierThresholds[2]) { tier = 2; weightAdded = 5; }
            else if (rng < tierThresholds[3]) { tier = 3; weightAdded = 2; }
            else { tier = 4; weightAdded = 1; }
            
            userTribulationWeight[user] += weightAdded;
            
            // 保底判定 (Pity Check)
            if (tribCount >= pityThreshold) {
                // 触发保底: 发放 BNB 奖励
                uint256 pityReward = userTribulationWeight[user] * pityBase;
                uint256 weightToEmit = userTribulationWeight[user]; // 保存权重用于事件
                
                // VRF 安全: 使用 try-catch 防止支付失败导致回调 revert
                try treasury.payoutBNB(user, pityReward) {
                } catch {
                    emit PayoutFailed(user, pityReward, "PITY_BNB");
                }
                _addPityRecord(user, pityReward, weightToEmit);
                
                tribCount = 0;
                userTribulationWeight[user] = 0;
            }
        }
        
        tribulationCounts[user] = tribCount;
        
        // 记录祈愿历史 (归墟使用劫数作为期号，并记录当时持有者数)
        uint256 roundNum = (tier == 0) ? totalAbyssTribulations : 0;
        uint256 holders = (tier == 0) ? totalAbyssHolders : 0;
        _addWishRecord(user, wishText, tier, reward, roundNum, holders, poolSnapshot, dividendSnapshot);
        
        emit SeekResult(user, tier, reward, wishText);
    }
    
    /**
     * @notice 自动分发分红给所有归墟持有者 (按份额比例)
     * @dev 归墟最多 81 次，holder 数量有限，gas 可控
     */
    function _distributeDividends(uint256 totalAmount, uint256 round, uint256 pool) internal {
        for (uint i = 0; i < abyssHolderList.length; i++) {
            address holder = abyssHolderList[i];
            uint256 shares = userAbyssShares[holder];
            if (shares == 0) continue;
            
            uint256 payout = (totalAmount * shares) / totalAbyssShares;
            if (payout > 0) {
                try treasury.payoutToken(holder, payout) {
                    totalDividendsDistributed += payout;
                    _addDividendRecord(holder, payout, shares, round, pool);
                    emit DividendDistributed(holder, payout, shares, round, pool);
                } catch {
                    emit PayoutFailed(holder, payout, "DIVIDEND");
                }
            }
        }
    }
    
    // --- 内部存储辅助函数 ---

    function _addWishRecord(address user, string memory text, uint8 tier, uint256 reward, uint256 round, uint256 holders, uint256 pool, uint256 dividend) internal {
        uint256 newId = allWishes.length;
        allWishes.push(WishRecord({
            id: newId,
            user: user,
            wishText: text,
            timestamp: block.timestamp,
            round: round,
            tier: tier,
            reward: reward,
            holdersAtTime: holders,
            poolAtTime: pool,
            dividendAtTime: dividend
        }));
        userWishIds[user].push(newId);
    }
    
    function _addPityRecord(address user, uint256 amount, uint256 weight) internal {
        uint256 newId = allPityRecords.length;
        allPityRecords.push(PityRecord({
            id: newId,
            user: user,
            amount: amount,
            timestamp: block.timestamp
        }));
        userPityIds[user].push(newId);
        emit PityTriggered(user, amount, weight);
    }

    function _addDividendRecord(address user, uint256 amount, uint256 shares, uint256 round, uint256 pool) internal {
        uint256 newId = allDividendRecords.length;
        allDividendRecords.push(DividendRecord({
            id: newId,
            user: user,
            amount: amount,
            shares: shares,
            round: round,
            pool: pool,
            timestamp: block.timestamp
        }));
        userDividendIds[user].push(newId);
    }
    
    // --- 归墟系统查询 (V2) ---

    /**
     * @notice 获取归墟系统统计信息 (前端查询)
     */
    function getAbyssStats() external view returns (
        uint256 poolBalance,          // 当前奖池 (国库 WISH 余额)
        uint256 dividendsDistributed, // 累计已发放分红
        uint256 holderCount,          // 参与分红人数
        uint256 shares,               // 总归墟份额
        uint256 abyssCount,           // 归墟已触发次数
        uint256 winnerRatio,          // 中奖者比例
        uint256 dividendRatio         // 分红比例
    ) {
        poolBalance = IERC20(wishToken).balanceOf(address(treasury));
        dividendsDistributed = totalDividendsDistributed;
        holderCount = totalAbyssHolders;
        shares = totalAbyssShares;
        abyssCount = totalAbyssTribulations;
        winnerRatio = abyssWinnerRatio;
        dividendRatio = abyssDividendRatio;
    }

    /**
     * @notice 获取指定归墟持有者信息
     */
    function getAbyssHolderInfo(address user) external view returns (
        bool isHolder,
        uint256 userShares,
        uint256 sharePercent  // 份额占比 (basis points, 10000 = 100%)
    ) {
        isHolder = isAbyssHolder[user];
        userShares = userAbyssShares[user];
        sharePercent = totalAbyssShares > 0
            ? (userAbyssShares[user] * 10000) / totalAbyssShares
            : 0;
    }

    /**
     * @notice 获取所有归墟持有者列表
     */
    function getAbyssHolders() external view returns (address[] memory) {
        return abyssHolderList;
    }


    
    // --- 视图辅助 (Batch Query) ---
    /**
     * @notice 获取指定用户的祈愿总次数
     * @param user 用户地址
     */
    function getUserWishCount(address user) external view returns (uint256) {
        return userWishIds[user].length;
    }

    /**
     * @notice 获取全局祈愿总次数
     */
    function getGlobalWishCount() external view returns (uint256) {
        return allWishes.length;
    }
    
    /**
     * @notice 批量获取用户祈愿 ID (分页查询)
     * @param user 用户地址
     * @param start 起始索引
     * @param count 查询数量
     */
    function getUserWishIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] storage ids = userWishIds[user];
        uint256 total = ids.length;
        if (start >= total) return new uint256[](0);
        uint256 end = start + count;
        if (end > total) end = total;
        uint256 resultLength = end - start;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i=0; i<resultLength; i++) result[i] = ids[start+i];
        return result;
    }

    /**
     * @notice 获取用户所有保底 ID (用于 BatchReader 计数和遍历)
     * @param user 用户地址
     */
    function getUserPityIds(address user) external view returns (uint256[] memory) {
        return userPityIds[user];
    }

    /**
     * @notice 获取用户所有分红 ID (用于 BatchReader 遍历)
     * @param user 用户地址
     */
    function getUserDividendIds(address user) external view returns (uint256[] memory) {
        return userDividendIds[user];
    }

    /**
     * @notice 批量获取用户分红 ID (分页查询)
     * @param user 用户地址
     * @param start 起始索引
     * @param count 查询数量
     */
    function getUserDividendIdsBatch(address user, uint256 start, uint256 count) external view returns (uint256[] memory) {
        uint256[] storage ids = userDividendIds[user];
        uint256 total = ids.length;
        if (start >= total) return new uint256[](0);
        uint256 end = start + count;
        if (end > total) end = total;
        uint256 resultLength = end - start;
        uint256[] memory result = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) result[i] = ids[start + i];
        return result;
    }

    /**
     * @notice 批量获取祈愿详情
     * @param ids 祈愿 ID 列表
     */
    function getWishRecordsBatch(uint256[] calldata ids) external view returns (WishRecord[] memory) {
        uint256 len = ids.length;
        WishRecord[] memory result = new WishRecord[](len);
        for (uint256 i=0; i<len; i++) result[i] = allWishes[ids[i]];
        return result;
    }
    
    // --- 系统配置 ---
    function setConfig(address _core, address _treasury, address _drifter) external {
        require(
            core.hasRole(core.CONFIG_ROLE(), msg.sender),
            "Seeker: unauthorized config"
        );
        core = ICloudDreamCore(_core);
        treasury = IDreamTreasury(_treasury);
        drifter = IDreamDrifter(_drifter);
    }
    
    // --- 高级设置 (Parameter Setters) ---
    /**
     * @notice 设置寻真基础参数 (需 CONFIG_ROLE)
     * @param _seekCost 寻真价格 (BNB)
     * @param _karmaCost 消耗福报 (Karma)
     * @param _pityBase 保底基数 (BNB)
     * @param _pityThreshold 保底阈值 (次数)
     */
    function setSeekConfig(
        uint256 _seekCost,
        uint256 _karmaCost,
        uint256 _pityBase,
        uint256 _pityThreshold
    ) external {
        require(core.hasRole(core.CONFIG_ROLE(), msg.sender), "Seeker: unauthorized");
        seekCost = _seekCost;
        karmaCost = _karmaCost;
        pityBase = _pityBase;
        pityThreshold = _pityThreshold;
    }

    /**
     * @notice 设置归墟分配比例 (需 CONFIG_ROLE)
     * @param _winner 赢家获得比例 (基点, e.g. 50)
     * @param _dividend 分红池获得比例 (基点, e.g. 30)
     * @dev 两者之和必须 <= 100，剩余部分归国库
     */
    function setAbyssRatios(uint256 _winner, uint256 _dividend) external {
        require(core.hasRole(core.CONFIG_ROLE(), msg.sender), "Seeker: unauthorized");
        require(_winner + _dividend <= 100, "Invalid ratio sum");
        abyssWinnerRatio = _winner;
        abyssDividendRatio = _dividend;
    }

    /**
     * @notice 设置概率分布阈值 (需 CONFIG_ROLE)
     * @param _thresholds 阈值数组 [Tier0, Tier1, Tier2, Tier3]
     * @dev 值表示 < N 时命中该等级 (基数 1000)
     */
    function setTierThresholds(uint16[4] calldata _thresholds) external {
        require(core.hasRole(core.CONFIG_ROLE(), msg.sender), "Seeker: unauthorized");
        // Simple Update
        // Simple Update
        tierThresholds = _thresholds;
    }

    /**
     * @notice 设置回购比例 (需 CONFIG_ROLE)
     * @param _enabled 是否开启
     * @param _percent 回购比例 (基点, e.g. 7000 = 70%)
     */
    function setBuybackConfig(bool _enabled, uint256 _percent, uint256 _slippage) external {
        require(core.hasRole(core.CONFIG_ROLE(), msg.sender), "Seeker: unauthorized");
        require(_percent <= 10000, "Invalid percent");
        buybackEnabled = _enabled;
        buybackPercent = _percent;
    }

    // --- VRF 超时退款 (Stale Request Refund) ---

    /**
     * @notice VRF 超时退款机制
     * @dev 如果 VRF 服务中断超过 1 小时，用户可申请退款
     * @param requestId VRF 请求 ID
     */
    function refundStaleRequest(uint256 requestId) external nonReentrant {
        RequestStatus storage req = s_requests[requestId];
        
        require(req.exists, unicode"无效请求");
        require(req.sender == msg.sender, unicode"非请求发起人");
        require(!req.fulfilled, unicode"请求已完成");
        require(
            block.timestamp - req.timestamp > 1 hours,
            unicode"超时1小时后可退款"
        );
        
        // 计算退款金额 (batch 支持)
        uint256 refundAmount = req.isPaid ? (seekCost * req.batchSize) : 0;
        
        // 清理状态
        delete s_requests[requestId];
        
        // 退款 (BNB)
        if (refundAmount > 0) {
            (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
            require(success, unicode"退款失败");
        }
        
        emit RefundIssued(requestId, msg.sender, refundAmount);
    }
}
