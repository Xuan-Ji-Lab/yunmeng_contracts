// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title CloudDreamCore (云梦核心 - 权限与配置中心)
 * @dev 系统的中央注册表，负责管理全新的 Proxy 架构下的：
 *      1. 访问控制 (AccessControl): 定义管理员、升级者、配置员等角色。
 *      2. 系统配置 (Configuration): 存储费率、VRF 参数、合约地址索引。
 *      注意：该合约不再持有用户资金或业务数据，仅作为配置源。
 */
contract CloudDreamCore is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    
    // --- 角色定义 (Roles) ---

    /// @notice 升级者角色：拥有升级代理合约逻辑实现的权限
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice 配置员角色：拥有修改系统参数（如费率、VRF）的权限
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");

    /// @notice 操作员角色：预留给自动化脚本或 Keeper 的权限
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // --- 系统配置状态变量 (Configuration State) ---
    
    // 1. 协议费率配置
    /// @notice 协议费率 (基点)，例如 500 表示 5%
    uint256 public protocolFeeRate; 
    
    /// @notice 协议费接收地址 (通常是 DreamTreasury)
    address public protocolFeeRecipient; 
    
    // 2. Chainlink VRF 配置
    /// @notice VRF Key Hash (Gas Lane)
    bytes32 public vrfKeyHash;
    
    /// @notice VRF Subscription ID
    uint64 public vrfSubscriptionId;
    
    /// @notice VRF 回调 Gas 限制
    uint32 public vrfCallbackGasLimit;
    
    /// @notice VRF 最小确认块数
    uint16 public vrfRequestConfirmations;
    
    // 3. 模块合约注册表 (用于互相发现)
    /// @notice 国库合约地址
    address public treasury;
    
    /// @notice 寻真(业务)合约地址
    address public seeker;
    
    /// @notice 听澜(共鸣)合约地址
    address public drifter;
    
    /// @notice 问天(预测)合约地址
    address public oracle;
    
    // --- 事件定义 (Events) ---
    event ConfigUpdated(string key, uint256 newValue);
    event AddressConfigUpdated(string key, address newAddress);
    event VRFConfigUpdated(bytes32 keyHash, uint64 subId, uint32 gasLimit, uint16 confirmations);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice 初始化函数 (替代构造函数)
     * @param _admin 初始管理员地址
     */
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        // 授予初始角色
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        _grantRole(CONFIG_ROLE, _admin);
        
        // 设置默认配置
        protocolFeeRate = 500; // 5%
        vrfCallbackGasLimit = 500000;
        vrfRequestConfirmations = 3;
    }

    /**
     * @notice UUPS 升级授权检查
     * @dev 仅拥有 UPGRADER_ROLE 的地址可以执行升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // --- 配置设置函数 (需 CONFIG_ROLE) ---

    /**
     * @notice 设置协议费率
     * @param _rate 新费率 (基点, max 10000)
     * @param _recipient 接收地址
     */
    function setProtocolFee(uint256 _rate, address _recipient) external onlyRole(CONFIG_ROLE) {
        require(_rate <= 10000, "Rate too high"); // Max 100%
        protocolFeeRate = _rate;
        protocolFeeRecipient = _recipient;
        emit ConfigUpdated("protocolFeeRate", _rate);
        emit AddressConfigUpdated("protocolFeeRecipient", _recipient);
    }

    /**
     * @notice 设置 Chainlink VRF 参数
     */
    function setVRFConfig(
        bytes32 _keyHash,
        uint64 _subId,
        uint32 _gasLimit,
        uint16 _confirmations
    ) external onlyRole(CONFIG_ROLE) {
        vrfKeyHash = _keyHash;
        vrfSubscriptionId = _subId;
        vrfCallbackGasLimit = _gasLimit;
        vrfRequestConfirmations = _confirmations;
        emit VRFConfigUpdated(_keyHash, _subId, _gasLimit, _confirmations);
    }

    /**
     * @notice 注册/更新模块合约地址
     * @dev 主要用于合约间互相查询地址，以及前端查询最新合约地址
     */
    function setContractAddresses(
        address _treasury,
        address _seeker,
        address _drifter,
        address _oracle
    ) external onlyRole(CONFIG_ROLE) {
        treasury = _treasury;
        seeker = _seeker;
        drifter = _drifter;
        oracle = _oracle;
        
        emit AddressConfigUpdated("treasury", _treasury);
        emit AddressConfigUpdated("seeker", _seeker);
        emit AddressConfigUpdated("drifter", _drifter);
        emit AddressConfigUpdated("oracle", _oracle);
    }

    // --- 视图函数 (通过 public 变量自动生成) ---
}
