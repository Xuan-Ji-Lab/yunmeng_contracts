// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ICloudDreamCore.sol";
import "./interfaces/IDreamTreasury.sol";

contract DreamSeeker is VRFConsumerBaseV2, Ownable, ReentrancyGuard {
    ICloudDreamCore public core;
    IDreamTreasury public treasury;
    
    // 配置
    
    // 配置
    uint256 public constant SEEK_COST = 0.005 ether; // 寻真费用
    uint256 public constant KARMA_FOR_FREE_SEEK = 10; // 免费寻真所需福报
    uint256 public constant PITY_BASE_UNIT = 0.001 ether; // 天道回响基准单位
    uint256 public constant PITY_THRESHOLD = 9; // 保底阈值
    
    // 概率阈值 (基数 1000)
    // 0.1% (归墟) -> < 1
    // 1% (传说/惊鸿) -> < 11
    // 3% (史诗/怒涛) -> < 41
    // 10% (稀有/叠嶂) -> < 141
    // 剩余: 凡品/微澜
    uint16[4] public TIER_THRESHOLDS = [1, 11, 41, 141]; 
    
    // VRF 配置
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    bytes32 keyHash;
    uint32 callbackGasLimit = 500000;
    uint16 requestConfirmations = 3;
    uint32 numWords = 1;

    // 请求记录
    mapping(uint256 => address) public s_requests;
    mapping(uint256 => string) public s_wishTexts;
    mapping(uint256 => bool) public s_isPaid;
    
    // 动态权重 (参考 CloudDreamProtocol)
    mapping(address => uint256) public userTribulationWeight; // 累积劫数权重
    
    // 测试白名单
    mapping(address => bool) public testers;

    // 事件
    event SeekRequestSent(uint256 indexed requestId, address indexed user);
    event SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText);
    event PityTriggered(address indexed user, uint256 amount); // 天道回响事件

    constructor(
        address _core, 
        address _vrfCoordinator, 
        bytes32 _keyHash, 
        uint64 _subscriptionId
    ) VRFConsumerBaseV2(_vrfCoordinator) Ownable(msg.sender) {
        core = ICloudDreamCore(_core);
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        keyHash = _keyHash;
        s_subscriptionId = _subscriptionId;
        
        // 初始化测试白名单
        testers[msg.sender] = true; // Owner
        testers[0x7463F2618e362a8D957f319E8d8374b3ad307242] = true;
        testers[0x332a1e2b704811556Ec642CE204ED659327A0c46] = true;
    }
    
    // 测试者修饰符
    modifier onlyTester() {
        require(testers[msg.sender] || msg.sender == owner(), unicode"仅限测试者");
        _;
    }

    // --- 寻真逻辑 ---

    function seekTruth(string memory wishText) external payable nonReentrant {
        bool isPaid = false;
        if (msg.value >= SEEK_COST) {
            // 付费寻真
            isPaid = true;
            core.incrementPaidSeeks(msg.sender);
            
            // 尝试触发回购 (70%)
            uint256 buybackAmt = (msg.value * 7000) / 10000;
            uint256 coreAmt = msg.value - buybackAmt;
            bool buybackSuccess = false;

            if (address(treasury) != address(0)) {
                try treasury.executeBuyback{value: buybackAmt}() {
                    buybackSuccess = true;
                } catch {}
            }

            if (buybackSuccess) {
                // 回归成功，剩余资金转 Core
                (bool success, ) = address(core).call{value: coreAmt}("");
                require(success, unicode"转账给 Core 失败");
            } else {
                // 回购失败（未开启或未设置），全额转 Core
                (bool success, ) = address(core).call{value: msg.value}("");
                require(success, unicode"转账给 Core 失败");
            }
        } else {
            // 免费寻真 (福报兑换)
            require(msg.value == 0, unicode"请勿发送部分 BNB");
            // 销毁福报
            core.burnKarma(msg.sender, KARMA_FOR_FREE_SEEK);
        }

        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );

        s_requests[requestId] = msg.sender;
        s_wishTexts[requestId] = wishText;
        s_isPaid[requestId] = isPaid;

        emit SeekRequestSent(requestId, msg.sender);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address user = s_requests[requestId];
        string memory text = s_wishTexts[requestId];
        // bool isPaid = s_isPaid[requestId]; 

        if (user == address(0)) return;

        uint256 rng = randomWords[0] % 1000;
        uint8 tier;
        uint256 reward = 0;

        // 获取当前保底计数
        uint256 tribCount = core.getTribulationCount(user);

        // 判定结果与劫数逻辑
        if (rng < TIER_THRESHOLDS[0]) {
            tier = 0; // 归墟 (Abyss)
            // 归墟出现，劫数和权重全部重置
            tribCount = 0;
            userTribulationWeight[user] = 0;
            // 触发大保底/奖励逻辑 (此处简化，复杂分红逻辑由 Core/Treasury 配合触发)
        } else {
            // 非归墟，劫数+1
            tribCount++;
            uint256 weightAdded = 0;
            
            if (rng < TIER_THRESHOLDS[1]) {
                tier = 1; // 传说 (Legendary)
                weightAdded = 10;
            } else if (rng < TIER_THRESHOLDS[2]) {
                tier = 2; // 史诗 (Epic)
                weightAdded = 5;
            } else if (rng < TIER_THRESHOLDS[3]) {
                tier = 3; // 稀有 (Rare)
                weightAdded = 2;
            } else {
                tier = 4; // 凡品 (Common)
                weightAdded = 1;
            }
            
            // 累积权重
            userTribulationWeight[user] += weightAdded;
            
            // 判定是否达到保底阈值
            if (tribCount >= PITY_THRESHOLD) {
                // 触发天道回响 - 动态权重计算
                uint256 pityReward = userTribulationWeight[user] * PITY_BASE_UNIT;
                
                // Trigger Pity Record in Core
                core.addPityRecord(user, pityReward);
                
                // 重置劫数和权重
                tribCount = 0;
                userTribulationWeight[user] = 0;
            }
        }

        // 更新Core中的保底计数
        core.setTribulationCount(user, tribCount);

        // 记录到 Core
        core.addWishRecord(user, text, 0, tier, reward);

        emit SeekResult(user, tier, reward, text);

        delete s_requests[requestId];
        delete s_wishTexts[requestId];
    }
    
    // --- 管理员 ---
    function setCore(address _core) external onlyOwner {
        core = ICloudDreamCore(_core);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        treasury = IDreamTreasury(_treasury);
    }
    
    /**
     * @notice 测试后门: 强制触发归墟 (仅限测试者)
     * @dev 绕过 VRF，直接触发归墟结果，用于测试
     */
    function testForceAbyss(string memory wishText) external payable onlyTester nonReentrant {
        address user = msg.sender;
        uint8 tier = 0; // 归墟
        uint256 reward = 0;
        
        // 重置劫数和权重
        core.setTribulationCount(user, 0);
        userTribulationWeight[user] = 0;
        
        // 记录到 Core
        core.addWishRecord(user, wishText, 0, tier, reward);
        
        emit SeekResult(user, tier, reward, wishText);
    }
    
    /**
     * @notice 测试后门: 强制触发天道回响 (仅限测试者)
     * @dev 绕过正常流程，直接触发天道回响
     */
    function testForcePity(uint256 weight) external onlyTester nonReentrant {
        address user = msg.sender;
        uint256 pityReward = weight * PITY_BASE_UNIT;
        
        // 触发天道回响
        core.addPityRecord(user, pityReward);
        
        emit PityTriggered(user, pityReward);
    }
    
    /**
     * @notice 管理测试者白名单
     */
    function setTester(address _tester, bool _allowed) external onlyOwner {
        testers[_tester] = _allowed;
    }
}
