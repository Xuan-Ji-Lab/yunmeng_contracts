// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCore {
    bytes32 public vrfKeyHash;
    uint64 public vrfSubscriptionId;
    uint32 public vrfCallbackGasLimit = 500000;
    uint16 public vrfRequestConfirmations = 3;
    
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return true; 
    }
    
    function setVRFConfig(bytes32 _keyHash, uint64 _subId, uint32 _gasLimit, uint16 _confirmations) external {
        vrfKeyHash = _keyHash;
        vrfSubscriptionId = _subId;
        vrfCallbackGasLimit = _gasLimit;
        vrfRequestConfirmations = _confirmations;
    }
}

contract MockTreasury {
    function payoutToken(address to, uint256 amount) external {}
    function payoutBNB(address to, uint256 amount) external {}
    function executeBuyback(uint256 amount) external {}
    receive() external payable {}
}

contract MockDrifter {
    function burnKarma(address user, uint256 amount) external {}
}

contract MockVRFCoordinator is VRFCoordinatorV2Interface {
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external override returns (uint256 requestId) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
    }
    
    function getRequestConfig() external view override returns (uint16, uint32, bytes32[] memory) {
        return (0, 0, new bytes32[](0));
    }
    function createSubscription() external override returns (uint64 subId) { return 0; }
    function getSubscription(uint64 subId) external view override returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers) {
        return (0, 0, address(0), new address[](0));
    }
    function requestSubscriptionOwnerTransfer(uint64 subId, address newOwner) external override {}
    function acceptSubscriptionOwnerTransfer(uint64 subId) external override {}
    function addConsumer(uint64 subId, address consumer) external override {}
    function removeConsumer(uint64 subId, address consumer) external override {}
    function cancelSubscription(uint64 subId, address to) external override {}
    function pendingRequestExists(uint64 subId) external view override returns (bool) { return false; }
}

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
