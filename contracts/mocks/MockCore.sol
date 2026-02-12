// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../contracts/interfaces/ICloudDreamCore.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockCore is AccessControl {
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant SEEKER_ROLE = keccak256("SEEKER_ROLE");

    address public seeker;
    address public treasury;
    
    uint256 public vrfSubscriptionId = 1067;
    bytes32 public vrfKeyHash = bytes32(0);
    uint32 public vrfCallbackGasLimit = 2000000;
    uint16 public vrfRequestConfirmations = 3;

    function initialize() external {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CONFIG_ROLE, msg.sender);
    }

    function setSeeker(address _seeker) external { seeker = _seeker; }
    function setTreasury(address _treasury) external { treasury = _treasury; }
    
    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return super.hasRole(role, account);
    }

    function drifter() external view returns (address) { return address(0); }
    function oracle() external view returns (address) { return address(0); }
}
