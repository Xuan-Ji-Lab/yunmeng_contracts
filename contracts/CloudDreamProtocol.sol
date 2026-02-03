// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPancakeRouter02.sol";

interface IWishToken {
    function protocolMint(address to, uint256 amount) external;
}

contract CloudDreamProtocol is VRFConsumerBaseV2, ReentrancyGuard, Ownable {
    // --- Enums & Structs ---
    enum Tier {
        ABYSS,          // 0: 归墟 (0.1%)
        RAGING_WAVES,   // 1: 怒涛 (1.0%)
        LAYERED_PEAKS,  // 2: 叠嶂 (3.0%)
        STARTLED_SWAN,  // 3: 惊鸿 (10.0%)
        RIPPLE          // 4: 微澜 (85.9%)
    }

    struct WishRecord {
        uint256 id;
        address user;
        string wishText;
        uint256 timestamp;
        uint256 round;
        Tier tier;
        uint256 reward;
    }

    struct PityRecord {
        uint256 id;
        address user;
        uint256 bonusAmount;
        uint256 timestamp;
        uint256 round;
    }

    struct ResonanceRecord {
        uint256 id;
        address sourceUser;
        address targetUser;
        string message;
        uint256 timestamp;
        uint256 amount;
    }

    // --- State Variables (状态变量) ---
    
    // 基础费用
    uint256 public constant SEEK_COST = 0.005 ether;
    uint256 public constant WATER_MONEY_RATE = 500; // 5% (基数 10000)
    
    // 概率阈值 (基数 1000)
    uint16[4] public TIER_THRESHOLDS = [1, 11, 41, 141]; 
    
    // 归墟分配比例 (百分比)
    uint256 public constant ABYSS_WINNER_SHARE = 50;
    uint256 public constant ABYSS_DIVIDEND_SHARE = 30;
    uint256 public constant ABYSS_POOL_RESERVE_SHARE = 20;

    // 资金池余额
    uint256 public wishPowerPool;
    address public treasury;

    // 用户数据
    mapping(address => uint256) public userTribulationCount;
    mapping(address => uint256) public userTribulationWeight; // 累积劫数权重
    uint256 public constant PITY_BASE_UNIT = 0.0015 ether; // 每个权重单位对应的 BNB 奖励
    
    // 全服保底重置机制
    uint256 public lastAbyssTimestamp; // 上次归墟发生的时间戳
    mapping(address => uint256) public lastActivityTimestamp; // 用户最后活动时间
    
    // 听澜与福报系统
    mapping(address => uint256) public karmaBalance;
    mapping(address => uint256) public resonanceCount;
    mapping(address => mapping(address => bool)) public hasResonatedWith;
    mapping(address => uint256) public dailyResonanceDate; // 记录日期（天数）
    mapping(address => uint256) public dailyResonanceCount; // 当日使用次数
    uint256 public constant DAILY_RESONANCE_LIMIT = 3; // 每日3次限制
    uint256 public constant KARMA_PER_LISTEN = 1;
    uint256 public constant KARMA_FOR_FREE_SEEK = 10;

    // --- New Storage for Optimization ---
    WishRecord[] public allWishes;
    mapping(address => uint256[]) public userWishIds;
    
    PityRecord[] public allPityRecords;
    mapping(address => uint256[]) public userPityIds;
    
    ResonanceRecord[] public allResonances;
    mapping(address => uint256[]) public userInboundResonanceIds;  // Me <- Others
    mapping(address => uint256[]) public userOutboundResonanceIds; // Me -> Others

    // 问天数据
    struct Topic {
        uint256 totalPool;
        uint256[2] optionPools; // 0: 否 (Option A), 1: 是 (Option B)
        bool settled;
        uint8 outcome;
        uint256 endTime;
        string title;           // 新增: 链上显示的标题
        string[2] optionLabels; // 新增: 链上显示的选项标签
    }

    mapping(bytes32 => Topic) public topics;
    mapping(address => bytes32[]) public userParticipatedTopicIds;
    bytes32[] public topicIds; // 新增: 可迭代的 Topic ID 列表
    mapping(bytes32 => mapping(address => uint256[2])) public userBets; // topicId -> 用户 -> 选项 -> 金额
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;
    mapping(bytes32 => mapping(address => bool)) public hasParticipatedInTopic; // 追踪用户是否参与过该议题
    bool public isGrandFinale;

    // Buy Wish Power Logic
    uint256 public accumulatedWishSold; // Tracks total WISH sold via buyWishPower
    event WishPowerPurchased(address indexed buyer, uint256 bnbAmount, uint256 wishAmount);
    uint256 public totalAbyssHolders;   // 当前归墟之主数量
    uint256 public totalAbyssTribulations; // 当前总劫数
    mapping(address => bool) public isAbyssHolder;
    uint256 public dividendPerShare;
    mapping(address => uint256) public xDividendPerShare; // 用户分红追踪点
    
    // 愿力代币分红
    uint256 public dividendPerShareToken;
    mapping(address => uint256) public xDividendPerShareToken;

    // Chainlink VRF 配置
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    bytes32 keyHash;
    uint32 callbackGasLimit = 500000; // Increased for complex callback logic
    uint16 requestConfirmations = 3;
    uint32 numWords = 1;

    // 映射 requestId -> 用户地址
    mapping(uint256 => address) public s_requests;
    // 映射 requestId -> 愿望文本
    mapping(uint256 => string) public s_wishTexts;
    // 映射 requestId -> 请求时间戳（用于超时退款）
    mapping(uint256 => uint256) public requestTimestamp;

    // --- 权限管理 (Access Control) ---
    mapping(address => bool) public authorizedTopicCreators;

    // --- 回购系统 (Buyback System) ---
    IPancakeRouter02 public swapRouter;
    address public wishToken;           // 愿力代币地址
    address public WBNB;                // Wrapped BNB 地址
    bool public buybackEnabled = false; // 回购开关（默认关闭）
    uint256 public buybackPercent = 7000; // 70% (基数 10000)
    uint256 public wishTokenPool;       // 合约持有的愿力代币奖池

    // --- Events (事件) ---
    event SeekResult(address indexed user, Tier tier, uint256 reward, string wishText);
    event PityTriggered(address indexed user, uint256 bonusAmount);
    event GlobalPityReset(uint256 timestamp); // 全服保底重置事件
    event KarmaEarned(address indexed user, uint256 amount);
    event FreeSeekRedeemed(address indexed user);
    event ReferrerBound(address indexed user, address indexed referrer, string message);
    event SeekRequestSent(uint256 indexed requestId, address indexed roller);
    event TopicCreated(bytes32 indexed topicId, uint256 endTime, string title);
    event BetPlaced(bytes32 indexed topicId, address indexed user, uint8 option, uint256 amount);
    event TopicSettled(bytes32 indexed topicId, uint8 outcome, uint256 totalPool);
    event WinningsClaimed(bytes32 indexed topicId, address indexed user, uint256 amount);
    event BuybackExecuted(uint256 bnbAmount, uint256 tokensReceived);
    event RefundIssued(uint256 indexed requestId, address indexed user, uint256 amount);

    // --- Constructor (构造函数) ---
    constructor(
        address _treasury,
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(vrfCoordinator) Ownable(msg.sender) {
        treasury = _treasury;
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;
        keyHash = _keyHash;
    }

    // --- Core Functions (核心方法) ---

    /**
     * @notice 寻真 · 祈愿
     * @dev 主入口，支持 BNB 支付和福报兑换。
     * @param wishText 用户输入的愿望文本
     */
    function seekTruth(string memory wishText) external payable nonReentrant {
        // 检查并重置保底（如归墟发生）
        _autoResetIfNeeded(msg.sender);
        
        // 逻辑分支: 付费 vs 免费
        if (msg.value >= SEEK_COST) {
            // --- 付费模式 ---
            // 1. 资金分配 (70% 回购, 30% 国库)
            uint256 toSwap = (msg.value * buybackPercent) / 10000;
            uint256 toTreasury = msg.value - toSwap;
            

            // 执行回购 (70%)
            if (buybackEnabled && address(swapRouter) != address(0) && wishToken != address(0)) {
                _executeSwapBuyback(toSwap);
            } 
            
            // 剩余 30% (toTreasury) 保留在合约余额中，用于支付保底奖励和运营
            // 取消自动转账: payable(treasury).transfer(toTreasury);
        } else {
            // --- 免费模式 (福报兑换) ---
            require(msg.value == 0, "Do not send partial BNB"); // 禁止部分支付
            require(karmaBalance[msg.sender] >= KARMA_FOR_FREE_SEEK, "Insufficient Karma"); // 福报不足
            
            // 扣除福报
            karmaBalance[msg.sender] -= KARMA_FOR_FREE_SEEK;
            emit FreeSeekRedeemed(msg.sender);
            
            // 注: 免费模式不增加奖池资金
        }

        // 2. 请求 Chainlink VRF 真随机数 (v2)
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        
        s_requests[requestId] = msg.sender;
        s_wishTexts[requestId] = wishText;
        requestTimestamp[requestId] = block.timestamp; // 记录时间戳用于超时退款
        
        emit SeekRequestSent(requestId, msg.sender);
    }

    /**
     * @notice VRF 回调函数 - 处理真随机数结果
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        address user = s_requests[requestId];
        string memory wishText = s_wishTexts[requestId];
        require(user != address(0), "Invalid request");
        
        uint256 randomNum = randomWords[0];
        uint256 resultInfo = randomNum % 1000;

        if (resultInfo < TIER_THRESHOLDS[0]) {
            // 归墟大奖
            _handleAbyssWin(user);
            
            // Record Abyss Win
            uint256 newId = allWishes.length;
            allWishes.push(WishRecord({
                id: newId,
                user: user,
                wishText: wishText,
                timestamp: block.timestamp,
                round: 0,
                tier: Tier.ABYSS,
                reward: 0
            }));
            userWishIds[user].push(newId);
        } else {
            Tier tier;
            uint256 weightAdded = 0;
            
            if (resultInfo < TIER_THRESHOLDS[1]) { 
                tier = Tier.RAGING_WAVES; weightAdded = 10; 
            } else if (resultInfo < TIER_THRESHOLDS[2]) { 
                tier = Tier.LAYERED_PEAKS; weightAdded = 5; 
            } else if (resultInfo < TIER_THRESHOLDS[3]) { 
                tier = Tier.STARTLED_SWAN; weightAdded = 2; 
            } else { 
                tier = Tier.RIPPLE; weightAdded = 1; 
            }

            userTribulationCount[user]++;
            userTribulationWeight[user] += weightAdded;
            
            emit SeekResult(user, tier, 0, wishText);

            // 检查保底
            if (userTribulationCount[user] % 9 == 0) {
                _triggerSmallPity(user);
            }
            
            // Record Wish
            uint256 newId = allWishes.length;
            allWishes.push(WishRecord({
                id: newId,
                user: user,
                wishText: wishText,
                timestamp: block.timestamp,
                round: userTribulationCount[user],
                tier: tier,
                reward: 0
            }));
            userWishIds[user].push(newId);
        }
        
        // 清理请求记录
        delete s_requests[requestId];
        delete s_wishTexts[requestId];
    }

    /**
     * @notice 听澜 · 响应 (Respond to Echo / Bind Referrer)
     * @dev 响应他人的分享，建立关联，邀请人获得福报。
     * @param referrer 邀请人/分享者地址
     */
    function respondToEcho(address referrer, string memory message) external {
        require(referrer != address(0), "Invalid Referrer");
        require(referrer != msg.sender, "Cannot refer self");
        require(!hasResonatedWith[msg.sender][referrer], "Already resonated with this user");
        
        // 每日3次限制检查
        uint256 today = block.timestamp / 1 days; // 当前日期（天数）
        if (dailyResonanceDate[msg.sender] != today) {
            // 新的一天，重置计数
            dailyResonanceDate[msg.sender] = today;
            dailyResonanceCount[msg.sender] = 0;
        }
        require(dailyResonanceCount[msg.sender] < DAILY_RESONANCE_LIMIT, "Daily limit reached (3)");
        
        // 记录绑定
        hasResonatedWith[msg.sender][referrer] = true;
        resonanceCount[msg.sender]++;
        dailyResonanceCount[msg.sender]++; // 增加当日计数
        
        // 发放奖励给邀请人
        karmaBalance[referrer] += KARMA_PER_LISTEN;
        
        emit ReferrerBound(msg.sender, referrer, message);
        emit KarmaEarned(referrer, KARMA_PER_LISTEN);

        // --- Record Resonance On-Chain ---
        uint256 newId = allResonances.length;
        allResonances.push(ResonanceRecord({
            id: newId,
            sourceUser: msg.sender,
            targetUser: referrer,
            message: message,
            timestamp: block.timestamp,
            amount: KARMA_PER_LISTEN
        }));
        userInboundResonanceIds[referrer].push(newId);
        userOutboundResonanceIds[msg.sender].push(newId);
    }

    // 归墟分红与身份系统
    
    /**
     * @dev 全服保底重置检查（懒更新机制）
     * @notice 如果用户上次活动早于最近一次归墟，自动重置其保底计数
     */
    function _autoResetIfNeeded(address user) internal {
        if (lastActivityTimestamp[user] < lastAbyssTimestamp) {
            // 该用户在归墟后首次活动，重置保底
            userTribulationCount[user] = 0;
            userTribulationWeight[user] = 0;
        }
        // 更新用户最后活动时间
        lastActivityTimestamp[user] = block.timestamp;
    }
    
    /**
     * @dev 处理归墟大奖逻辑 (50/30/20 分配 或 终局机制)。
     */
    function _handleAbyssWin(address user) internal {
        // 记录归墟时间戳（触发全服保底重置）
        lastAbyssTimestamp = block.timestamp;
        emit GlobalPityReset(block.timestamp);
        
        // 重置保底与权重
        userTribulationCount[user] = 0;
        userTribulationWeight[user] = 0;
        lastActivityTimestamp[user] = block.timestamp;
        
        // Always increment global tribulation count
        uint256 currentTribulations = totalAbyssTribulations;
        
        if (currentTribulations + 1 >= 81) {
            // --- 终局机制 (GRAND FINALE) ---
            // If user is not a holder yet, add them for the final split? 
            // Logic: The 81st winner participates in the grand split.
            if (!isAbyssHolder[user]) {
                isAbyssHolder[user] = true;
                totalAbyssHolders++;
            }

            totalAbyssTribulations = 81;
            
            uint256 totalPool = wishPowerPool;
            wishPowerPool = 0;
            
            // 终局时必有持有者（防御性编程）
            assert(totalAbyssHolders > 0);
            dividendPerShare += (totalPool * 1e18) / totalAbyssHolders;
            
            emit SeekResult(user, Tier.ABYSS, totalPool / (totalAbyssHolders > 0 ? totalAbyssHolders : 1), "GRAND FINALE");
            
        } else {
            // --- 标准归墟机制 (50/30/20) - 仅发放愿力代币 ---
            totalAbyssTribulations++;

            uint256 currentHolders = totalAbyssHolders;

            // 1. BNB 分配 (已移除，归墟大奖仅产生代币奖励)
            // 剩余的 BNB 保留在 wishPowerPool 中，可通过管理函数 manualBuyback 转换为代币
            
            // 2. 愿力代币分配
            if (wishToken != address(0)) {
                uint256 totalTokenPool = wishTokenPool;
                uint256 winnerTokenReward = 0;
                
                if (totalTokenPool > 0) {
                    winnerTokenReward = (totalTokenPool * ABYSS_WINNER_SHARE) / 100;
                    uint256 dividendTokenAmt = (totalTokenPool * ABYSS_DIVIDEND_SHARE) / 100;

                    // P0修复: 检查池余额
                    require(wishTokenPool >= winnerTokenReward, "Insufficient token pool");
                    require(
                        IERC20Minimal(wishToken).balanceOf(address(this)) >= winnerTokenReward,
                        "Insufficient token balance"
                    );
                    
                    wishTokenPool -= winnerTokenReward;
                    // Transfer tokens to winner immediately
                    require(
                        IERC20Minimal(wishToken).transfer(user, winnerTokenReward),
                        "Token transfer failed"
                    );

                    if (currentHolders > 0) {
                        require(wishTokenPool >= dividendTokenAmt, "Insufficient pool for dividends");
                        wishTokenPool -= dividendTokenAmt;
                        dividendPerShareToken += (dividendTokenAmt * 1e18) / currentHolders;
                    }
                }
                
                emit SeekResult(user, Tier.ABYSS, winnerTokenReward, "WISH TOKEN PRIZE");
            } else {
                // Fallback: 如果未配置代币，发放 BNB (避免奖励丢失)
                uint256 totalPool = wishPowerPool;
                if (totalPool > 0) {
                    uint256 winnerReward = (totalPool * ABYSS_WINNER_SHARE) / 100;
                    wishPowerPool -= winnerReward;
                    payable(user).transfer(winnerReward);
                    emit SeekResult(user, Tier.ABYSS, winnerReward, "BNB FALLBACK");
                }
            }
            
            if (!isAbyssHolder[user]) {
                isAbyssHolder[user] = true;
                totalAbyssHolders++;
                // xDividendPerShare[user] = dividendPerShare; // BNB 分红点 (不再更新)
                xDividendPerShareToken[user] = dividendPerShareToken;
            }

            // --- Record Abyss Win ---
             uint256 newId = allWishes.length;
             allWishes.push(WishRecord({
                id: newId,
                user: user,
                wishText: "ABYSS", // Special marker
                timestamp: block.timestamp,
                round: 0, 
                tier: Tier.ABYSS,
                reward: 0 // Simplification: actual reward logic is complex above, but for history list it's okay
            }));
            userWishIds[user].push(newId);
        }
    }

    /**
     * @dev 触发 "天道回响" 小保底。
     * @notice Modified to reward Wish Tokens instead of BNB
     */
    function _triggerSmallPity(address user) internal {
        uint256 currentWeight = userTribulationWeight[user];
        uint256 pityReward = currentWeight * PITY_BASE_UNIT;

        // 重置权重
        userTribulationCount[user] = 0;
        userTribulationWeight[user] = 0;

        // 简化逻辑：直接检查并发放 BNB (从合约余额支出)
        if (pityReward > 0) {
            // 检查合约余额 (包含 30% 的运营留存)
            require(address(this).balance >= pityReward, "Insufficient contract balance for pity");
             // 注意:不再扣除 wishPowerPool，因为该变量现在仅用于追踪 fallback 资金
            
            // 发放 BNB
            (bool success, ) = payable(user).call{value: pityReward, gas: 2300}("");
            require(success, "Pity transfer failed");
        }
        
        // 记录保底
        uint256 pId = allPityRecords.length;
        allPityRecords.push(PityRecord({
            id: pId,
            user: user,
            bonusAmount: pityReward,
            timestamp: block.timestamp,
            round: 9
        }));
        userPityIds[user].push(pId);

        emit PityTriggered(user, pityReward);
    }

    /**
     * @notice 设置 Topic 创建权限
     * @param creator 地址
     * @param authorized 是否授权
     */
    function setTopicCreator(address creator, bool authorized) external onlyOwner {
        authorizedTopicCreators[creator] = authorized;
    }

    /**
     * @notice 创建新的问天议题
     * @dev 仅限 Owner 或授权地址
     * @param _topicIdStr 字符串ID (例如 "btc_100k")
     * @param _duration 持续时间 (秒)
     * @param _title 显示标题
     * @param _optionA 选项A标签
     * @param _optionB 选项B标签
     */
    function createTopic(
        string memory _topicIdStr, 
        uint256 _duration, 
        string memory _title, 
        string memory _optionA, 
        string memory _optionB
    ) external {
        require(
            msg.sender == owner() || authorizedTopicCreators[msg.sender],
            "Not authorized"
        );
        bytes32 topicId = keccak256(abi.encodePacked(_topicIdStr));
        require(topics[topicId].endTime == 0, "Topic already exists"); // 议题已存在
        
        uint256 endTime = block.timestamp + _duration;
        
        Topic storage t = topics[topicId];
        t.endTime = endTime;
        t.title = _title;
        t.optionLabels[0] = _optionA;
        t.optionLabels[1] = _optionB;

        topicIds.push(topicId);
        
        emit TopicCreated(topicId, endTime, _title);
    }

    /**
     * @notice 问天 · 落子 (下注)
     */
    function placeBet(bytes32 topicId, uint8 option) external payable nonReentrant {
        Topic storage topic = topics[topicId];
        
        require(topic.endTime > 0, "Topic does not exist"); // 议题不存在
        require(block.timestamp < topic.endTime, "Betting closed"); // 投注已截止
        require(!topic.settled, "Topic already settled"); // 议题已结算
        require(option < 2, "Invalid Option"); // 选项无效
        require(msg.value > 0, "Stake required"); // 需要本金

        // 1. 水钱 (5%)
        uint256 fee = (msg.value * WATER_MONEY_RATE) / 10000;
        uint256 effectiveStake = msg.value - fee;
        
        payable(treasury).transfer(fee);

        // 2. 注入奖池
        topic.totalPool += effectiveStake;
        topic.optionPools[option] += effectiveStake;
        
        // 3. 记录注单
        userBets[topicId][msg.sender][option] += effectiveStake;

        // 4. 记录用户参与（仅首次）
        if (!hasParticipatedInTopic[topicId][msg.sender]) {
            userParticipatedTopicIds[msg.sender].push(topicId);
            hasParticipatedInTopic[topicId][msg.sender] = true;
        }

        emit BetPlaced(topicId, msg.sender, option, effectiveStake);
    }

    /**
     * @notice 管理员结算议题
     */
    function settleTopic(bytes32 topicId, uint8 outcome) external onlyOwner {
        Topic storage topic = topics[topicId];
        require(topic.endTime > 0, "Topic does not exist");
        require(!topic.settled, "Already settled");
        require(outcome < 2, "Invalid Outcome");

        topic.settled = true;
        topic.outcome = outcome;

        emit TopicSettled(topicId, outcome, topic.totalPool);
    }

    /**
     * @notice 用户领取胜出奖励
     */
    function claimWinnings(bytes32 topicId) external nonReentrant {
        Topic storage topic = topics[topicId];
        require(topic.settled, "Topic not settled"); // 未结算
        require(!hasClaimed[topicId][msg.sender], "Already claimed"); // 已领取

        uint8 outcome = topic.outcome;
        uint256 userBet = userBets[topicId][msg.sender][outcome];
        require(userBet > 0, "No winning bet"); // 未中奖

        uint256 totalWinningPool = topic.optionPools[outcome];
        uint256 totalPool = topic.totalPool;

        // 计算份额: (用户注单 / 胜方总池) * 总奖池
        // 使用高精度计算防止精度损失
        uint256 winnings = (userBet * 1e18 * totalPool) / totalWinningPool / 1e18;

        hasClaimed[topicId][msg.sender] = true;
        payable(msg.sender).transfer(winnings);

        emit WinningsClaimed(topicId, msg.sender, winnings);
    }

    /**
     * @notice 领取归墟分红 (BNB 和 Wish Token)
     * @dev 应用 CEI 模式防止重入攻击
     */
    function claimAbyssDividends() external nonReentrant {
        require(isAbyssHolder[msg.sender], "Not a holder");
        
        // 1. Checks: 计算应得分红
        uint256 bnbShare = dividendPerShare - xDividendPerShare[msg.sender];
        uint256 tokenShare = dividendPerShareToken - xDividendPerShareToken[msg.sender];
        
        // 2. Effects: 先更新状态
        if (bnbShare > 0) {
            xDividendPerShare[msg.sender] = dividendPerShare;
        }
        
        if (tokenShare > 0) {
            xDividendPerShareToken[msg.sender] = dividendPerShareToken;
        }

        // 3. Interactions: 最后进行外部调用
        if (bnbShare > 0) {
            (bool success, ) = payable(msg.sender).call{value: bnbShare, gas: 2300}("");
            require(success, "BNB transfer failed");
        }

        if (tokenShare > 0 && wishToken != address(0)) {
            require(
                IERC20Minimal(wishToken).transfer(msg.sender, tokenShare),
                "Token transfer failed"
            );
        }
    }

    // 接收 BNB 的函数
    receive() external payable {
        // 默认将直接发送的 BNB 计入愿力池
        wishPowerPool += msg.value;
    }

    /**
     * @notice 获取所有议题 ID
     */
    function getTopicIds() external view returns (bytes32[] memory) {
        return topicIds;
    }

    /**
     * @notice 获取议题完整详情 (包含元数据)
     */
    function getTopicDetails(bytes32 topicId) external view returns (
        uint256 totalPool,
        uint256[2] memory optionPools,
        bool settled,
        uint8 outcome,
        uint256 endTime,
        string memory title,
        string[2] memory optionLabels
    ) {
        Topic memory t = topics[topicId];
        return (t.totalPool, t.optionPools, t.settled, t.outcome, t.endTime, t.title, t.optionLabels);
    }
    /**
     * @notice 执行自动回购 (Swap BNB -> Wish Token)
     */
    function _executeSwapBuyback(uint256 bnbAmount) internal {
        address[] memory path = new address[](2);
        path[0] = WBNB;
        path[1] = wishToken;

        // 捕获初始代币余额
        uint256 initialBalance = IERC20Minimal(wishToken).balanceOf(address(this));

        // 添加滑点保护 (5%)
        uint256[] memory expectedAmounts = swapRouter.getAmountsOut(bnbAmount, path);
        uint256 minAmount = (expectedAmounts[1] * 95) / 100; // 5% 滑点容忍

        // 执行 Swap
        try swapRouter.swapExactETHForTokens{value: bnbAmount}(
            minAmount, // ✅ 最小输出保护
            path,
            address(this),
            block.timestamp + 300
        ) {
            uint256 finalBalance = IERC20Minimal(wishToken).balanceOf(address(this));
            uint256 received = finalBalance - initialBalance;
            
            wishTokenPool += received;
            emit BuybackExecuted(bnbAmount, received);
        } catch {
            // 如果 Swap 失败（滑点过大或流动性不足），回退到普通奖池
            wishPowerPool += bnbAmount;
        }
    }

    // --- Admin Functions for Buyback ---

    function setBuybackConfig(bool _enabled, uint256 _percent, address _token, address _wbnb) external onlyOwner {
        require(_percent <= 10000, "Invalid percent");
        buybackEnabled = _enabled;
        buybackPercent = _percent;
        wishToken = _token;
        WBNB = _wbnb;
    }

    function setSwapRouter(address _router) external onlyOwner {
        swapRouter = IPancakeRouter02(_router);
    }

    /**
     * @notice 管理员手动回购 (处理 wishPowerPool 中的 BNB)
     * @param amount 要回购的 BNB 数量
     */
    function manualBuyback(uint256 amount) external onlyOwner {
        require(amount <= wishPowerPool, "Insufficient balance");
        wishPowerPool -= amount;
        _executeSwapBuyback(amount);
    }
    
    /**
     * @notice VRF 超时退款机制
     * @dev 如果 VRF 服务中断超过 1 小时，用户可申请退款
     * @param requestId VRF 请求 ID
     */
    function refundStaleRequest(uint256 requestId) external {
        require(s_requests[requestId] == msg.sender, "Not your request");
        require(requestTimestamp[requestId] > 0, "Invalid request");
        require(
            block.timestamp - requestTimestamp[requestId] > 1 hours,
            "Refund available after 1 hour"
        );
        
        // 清理状态
        delete s_requests[requestId];
        delete s_wishTexts[requestId];
        delete requestTimestamp[requestId];
        
        // 退款
        payable(msg.sender).transfer(SEEK_COST);
        
        emit RefundIssued(requestId, msg.sender, SEEK_COST);
    }
    
    /**
     * @notice 管理员提取运营资金 (BNB)
     * @dev 从 30% 留存中提取盈余
     */
    function withdrawOperationalFunds(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(treasury).transfer(amount);
    }

    /**
     * @notice 管理员提取代币资产
     * @dev 用于提取 WISH 税收奖励或其他误转入的代币
     */
    function withdrawGovernanceTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        // 如果是 WISH 代币，需要扣除 wishTokenPool 计数 (如果提取的是奖池资金)
        // 但此处假设提取的是"额外的"税收，暂不强行关联 pool 逻辑，依靠管理员自行判断
        IERC20Minimal(token).transfer(treasury, amount);
    }

    /**
     * @notice 管理员注入愿力代币到奖池
     */
    function depositRewardTokens(uint256 amount) external onlyOwner {
        require(wishToken != address(0), "Token not set");
        require(amount > 0, "Amount must be positive");
        
        // 验证转账前后余额变化
        uint256 balanceBefore = IERC20Minimal(wishToken).balanceOf(address(this));
        IERC20Minimal(wishToken).transferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = IERC20Minimal(wishToken).balanceOf(address(this));
        
        require(balanceAfter - balanceBefore == amount, "Transfer amount mismatch");
        wishTokenPool += amount;
    }

    // 允许合约接收 BNB (用于从 Router 接收或其他途径)

    // --- View Functions for Batching ---

    function getUserWishIds(address user) external view returns (uint256[] memory) {
        return userWishIds[user];
    }

    function getUserPityIds(address user) external view returns (uint256[] memory) {
        return userPityIds[user];
    }
    
    function getUserParticipatedTopicIds(address user) external view returns (bytes32[] memory) {
        return userParticipatedTopicIds[user];
    }
    
    /**
     * @notice 查询用户今日剩余回响次数
     * @param user 用户地址
     * @return 剩余次数 (0-3)
     */
    function getRemainingResonanceToday(address user) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        if (dailyResonanceDate[user] != today) {
            return DAILY_RESONANCE_LIMIT; // 新的一天，返回满额
        }
        uint256 used = dailyResonanceCount[user];
        return used >= DAILY_RESONANCE_LIMIT ? 0 : DAILY_RESONANCE_LIMIT - used;
    }
    
    function getBatchWishes(uint256[] calldata ids) external view returns (WishRecord[] memory) {
        WishRecord[] memory results = new WishRecord[](ids.length);
        for(uint i=0; i<ids.length; i++) {
             // Check bounds
            if (ids[i] < allWishes.length) {
                results[i] = allWishes[ids[i]];
            }
        }
        return results;
    }

    function getBatchPityRecords(uint256[] calldata ids) external view returns (PityRecord[] memory) {
        PityRecord[] memory results = new PityRecord[](ids.length);
        for(uint i=0; i<ids.length; i++) {
            if (ids[i] < allPityRecords.length) {
                results[i] = allPityRecords[ids[i]];
            }
        }
        return results;
    }
    
    function getInboundResonanceIds(address user) external view returns (uint256[] memory) {
        return userInboundResonanceIds[user];
    }
    
    function getOutboundResonanceIds(address user) external view returns (uint256[] memory) {
        return userOutboundResonanceIds[user];
    }

    function getBatchResonances(uint256[] calldata ids) external view returns (ResonanceRecord[] memory) {
        ResonanceRecord[] memory results = new ResonanceRecord[](ids.length);
        for(uint i=0; i<ids.length; i++) {
            if (ids[i] < allResonances.length) {
                results[i] = allResonances[ids[i]];
            }
        }
        return results;
    }

    function getGlobalWishes(uint256 start, uint256 end) external view returns (WishRecord[] memory) {
        uint256 total = allWishes.length;
        if (end > total) end = total;
        if (start >= end) return new WishRecord[](0);
        
        WishRecord[] memory results = new WishRecord[](end - start);
        for(uint i=0; i < end - start; i++) {
            results[i] = allWishes[start + i];
        }
        return results;
    }

    function getGlobalResonances(uint256 start, uint256 end) external view returns (ResonanceRecord[] memory) {
        uint256 total = allResonances.length;
        if (end > total) end = total;
        if (start >= end) return new ResonanceRecord[](0);
        
        ResonanceRecord[] memory results = new ResonanceRecord[](end - start);
        for(uint i=0; i < end - start; i++) {
            results[i] = allResonances[start + i];
        }
        return results;
    }

    function getGlobalWishCount() external view returns (uint256) {
        return allWishes.length;
    }
    
    function getGlobalResonanceCount() external view returns (uint256) {
        return allResonances.length;
    }


}
