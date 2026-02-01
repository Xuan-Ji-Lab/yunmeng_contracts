// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WishPowerToken (愿力代币)
 * @notice 云梦寄愿协议的治理与奖励代币
 * @dev 支持铸造和销毁功能，由协议合约管理
 */
contract WishPowerToken is ERC20, ERC20Burnable, Ownable {
    
    // 最大供应量：10亿枚
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    // 协议合约地址（可铸造代币）
    address public protocolContract;
    
    // 事件
    event ProtocolContractUpdated(address indexed oldContract, address indexed newContract);
    
    constructor() ERC20("WishPower Token", "WISH") Ownable(msg.sender) {
        // 初始铸造：50% 给部署者用于添加流动性和生态建设
        _mint(msg.sender, (MAX_SUPPLY * 50) / 100);
    }
    
    /**
     * @notice 设置协议合约地址
     * @param _protocolContract 云梦寄愿协议合约地址
     */
    function setProtocolContract(address _protocolContract) external onlyOwner {
        require(_protocolContract != address(0), "Invalid address");
        address oldContract = protocolContract;
        protocolContract = _protocolContract;
        emit ProtocolContractUpdated(oldContract, _protocolContract);
    }
    
    /**
     * @notice 协议铸造代币（仅限协议合约）
     * @dev 用于特殊奖励场景
     */
    function protocolMint(address to, uint256 amount) external {
        require(msg.sender == protocolContract, "Only protocol can mint");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
    
    /**
     * @notice 覆盖 decimals
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
