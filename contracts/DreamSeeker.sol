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
    /// @notice 是否为归墟持有者 (才有资格分红)
    mapping(address => bool) public isAbyssHolder;
    
    /// @notice 是否为付费用户 (Anti-Sybil)
    mapping(address => bool) public hasPaid;
    
    // 分红系统 (Dividend System)
    /// @notice 每 Token 全局累积收益 (放大 1e18 倍)
    uint256 public dividendPerShareToken;
    
    /// @notice 用户已结算的每 Token 收益游标
    mapping(address => uint256) public xDividendPerShareToken;
    
    /// @notice 总已分配分红
    uint256 public totalDividendsAllocated;
    
    /// @notice 总已领取分红
    uint256 public totalDividendsClaimed;

    // --- 历史记录存储 (还原逻辑) ---
    
    struct WishRecord {
        uint256 id;
        address user;
        string wishText;
        uint256 timestamp;
        uint256 round;
        uint8 tier;
        uint256 reward;
        uint256 holdersAtTime; // 归墟触发时的持有者数量
    }
    
    struct PityRecord {
        uint256 id;
        address user;
        uint256 amount;
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
    // 剩余部分自动留存 Treasury

    // --- 事件 ---
    event SeekRequestSent(uint256 indexed requestId, address indexed user);
    event SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText);
    event AbyssTriggered(address indexed user, bool isGrandFinale, uint256 tribulationCount);
    event PityTriggered(address indexed user, uint256 amount, uint256 weight);
    event DividendClaimed(address indexed user, uint256 amount);
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
        abyssDividendRatio = 30; // 30%
        

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
            hasPaid[msg.sender] = true;
            
            // 付费模式: 资金转发给 Treasury (使用 call 避免 2300 gas 限制)
            (bool success, ) = payable(address(treasury)).call{value: msg.value}("");
            require(success, unicode"Treasury转账失败");
            
            // 尝试触发 Treasury 的回购逻辑 (静默失败，不影响主流程)
            try treasury.executeBuyback(msg.value) {} catch {}
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
            
            try treasury.executeBuyback(msg.value) {} catch {}
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
     * @dev 内部结果处理逻辑 (抽离以便测试复用)
     */
    function _processResult(address user, string memory wishText, uint256 randomness) internal {
        uint256 rng = randomness % 1000;
        uint8 tier;
        uint256 reward = 0;
        uint256 tribCount = tribulationCounts[user];

        if (rng < tierThresholds[0]) {
            // === 触发归墟 (Abyss) ===
            tier = 0;
            tribCount = 0;
            userTribulationWeight[user] = 0; // 重置保底权重
            
            // 1. 更新归墟持有者状态
            if (!isAbyssHolder[user]) {
                isAbyssHolder[user] = true;
                totalAbyssHolders++;
                // 新人如入场，设置当期分红起点 (不能领以前的)
                xDividendPerShareToken[user] = dividendPerShareToken;
            }
            
            // 2. 更新归墟总进度 (81次为终局)
            bool isGrandFinale = (totalAbyssTribulations + 1 >= 81);
            if (isGrandFinale) totalAbyssTribulations = 81;
            else totalAbyssTribulations++;
            
            emit AbyssTriggered(user, isGrandFinale, totalAbyssTribulations);
            
            // 3. 资金分配 (50/30/20)
            // 计算净奖池 = 国库余额 - 应付未付分红
            uint256 treasuryBal = IERC20(treasury.wishToken()).balanceOf(address(treasury));
            uint256 unclaimed = totalDividendsAllocated - totalDividendsClaimed;
            // 确保不发生下溢
            uint256 netPool = (treasuryBal > unclaimed) ? (treasuryBal - unclaimed) : 0;
            
            if (netPool > 0) {
                 if (isGrandFinale) {
                     // 终局: 100% 分红给所有人
                     // 1. 计算分红
                     if (totalAbyssHolders > 0) {
                         uint256 sharePerToken = (netPool * 1e18) / totalAbyssHolders;
                         dividendPerShareToken += sharePerToken;
                         
                         // 计算实际分配出去的总额 (排除精度余数)
                         // 实际分配 = (sharePerToken * totalAbyssHolders) / 1e18
                         // 注意：这里为了保持精度一致性，我们直接更新 allocated
                         uint256 actualDistributed = (sharePerToken * totalAbyssHolders) / 1e18;
                         totalDividendsAllocated += actualDistributed; // 实际可领取的总额
                         
                         // 2. 余数 (Dust) 补给最后的中奖者
                         uint256 dust = netPool - actualDistributed;
                         if (dust > 0) {
                              try treasury.payoutToken(user, dust) {
                                  reward += dust;
                              } catch {
                                  emit PayoutFailed(user, dust, "DUST_PAYOUT");
                              }
                          }
                     }
                 } else {
                     // 常规: X% Winner, Y% Dividends, Remain Treasury
                     uint256 winnerAmt = (netPool * abyssWinnerRatio) / 100;
                     uint256 dividendAmt = (netPool * abyssDividendRatio) / 100;
                     // 剩下的 % + Dust 自动留在池子滚存
                     
                     // 1. 支付中奖者 (Winner)
                      if (winnerAmt > 0) {
                          try treasury.payoutToken(user, winnerAmt) {
                              reward = winnerAmt;
                          } catch {
                              emit PayoutFailed(user, winnerAmt, "WINNER_PAYOUT");
                          }
                      }
                     
                     // 2. 注入分红池 (Dividend)
                     if (dividendAmt > 0 && totalAbyssHolders > 0) {
                         uint256 sharePerToken = (dividendAmt * 1e18) / totalAbyssHolders;
                         dividendPerShareToken += sharePerToken;
                         
                         uint256 actualDistributed = (sharePerToken * totalAbyssHolders) / 1e18;
                         totalDividendsAllocated += actualDistributed;
                     }
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
                    // 支付成功
                } catch {
                    emit PayoutFailed(user, pityReward, "PITY_BNB");
                }
                _addPityRecord(user, pityReward, weightToEmit);
                
                // 重置状态
                tribCount = 0;
                userTribulationWeight[user] = 0;
            }
        }
        
        tribulationCounts[user] = tribCount;
        
        // 记录祈愿历史 (归墟使用劫数作为期号，并记录当时持有者数)
        uint256 roundNum = (tier == 0) ? totalAbyssTribulations : 0;
        uint256 holders = (tier == 0) ? totalAbyssHolders : 0;
        _addWishRecord(user, wishText, tier, reward, roundNum, holders);
        
        emit SeekResult(user, tier, reward, wishText);
    }
    
    // --- 内部存储辅助函数 ---

    function _addWishRecord(address user, string memory text, uint8 tier, uint256 reward, uint256 round, uint256 holders) internal {
        uint256 newId = allWishes.length;
        allWishes.push(WishRecord({
            id: newId,
            user: user,
            wishText: text,
            timestamp: block.timestamp,
            round: round,
            tier: tier,
            reward: reward,
            holdersAtTime: holders
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

    // --- 分红领取逻辑 ---

    /**
     * @notice 查询待领取分红
     */
    function getUnclaimedDividend(address user) public view returns (uint256) {
        if (!isAbyssHolder[user]) return 0;
        // 个人份额 = (全局累积 - 用户上次游标)
        uint256 share = dividendPerShareToken - xDividendPerShareToken[user];
        // 平分逻辑：这里 share 已经是 "每人应得数额 * 1e18" ? 
        // 修正逻辑: 
        // dividendPerShareToken += amount * 1e18 / totalHolders;
        // User Amount = (new - old) * 1 (因为每人持有1份归墟资格) / 1e18;
        return share / 1e18;
    }

    /**
     * @notice 领取分红
     */
    function claimDividend() external nonReentrant {
        uint256 pending = getUnclaimedDividend(msg.sender);
        require(pending > 0, unicode"无可用分红");
        
        // 更新游标
        xDividendPerShareToken[msg.sender] = dividendPerShareToken;
        totalDividendsClaimed += pending;
        
        // 支付
        treasury.payoutToken(msg.sender, pending);
        emit DividendClaimed(msg.sender, pending);
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
        tierThresholds = _thresholds;
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
