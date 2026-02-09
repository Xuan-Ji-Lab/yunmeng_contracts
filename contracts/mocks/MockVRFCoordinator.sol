// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

contract MockVRFCoordinator is VRFCoordinatorV2Interface {
    
    uint256 private currentRequestId;
    mapping(uint256 => address) public requestToConsumer;
    
    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 preSeed,
        uint64 indexed subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address indexed sender
    );

    event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint96 payment, bool success);

    function getRequestConfig() external view returns (uint16, uint32, bytes32[] memory) {
        return (3, 2000000, new bytes32[](0));
    }

    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external override returns (uint256 requestId) {
        currentRequestId++;
        requestId = currentRequestId;
        requestToConsumer[requestId] = msg.sender;

        emit RandomWordsRequested(
            keyHash,
            requestId,
            0, // preSeed
            subId,
            minimumRequestConfirmations,
            callbackGasLimit,
            numWords,
            msg.sender
        );

        return requestId;
    }

    function createSubscription() external override returns (uint64 subId) {
        return 1;
    }

    function getSubscription(uint64 subId) external view override returns (
        uint96 balance,
        uint64 reqCount,
        address owner,
        address[] memory consumers
    ) {
        return (0, 0, address(0), new address[](0));
    }

    function requestSubscriptionOwnerTransfer(uint64 subId, address newOwner) external override {}

    function acceptSubscriptionOwnerTransfer(uint64 subId) external override {}

    function addConsumer(uint64 subId, address consumer) external override {}

    function removeConsumer(uint64 subId, address consumer) external override {}

    function cancelSubscription(uint64 subId, address to) external override {}

    function pendingRequestExists(uint64 subId) external view override returns (bool) {
        return false;
    }

    /**
     * @dev Imitates the VRF Coordinator fulfilling a request.
     * Note: VRFConsumerBaseV2 expects `rawFulfillRandomWords` to be called by the coordinator.
     */
    function fulfillRandomWordsWithType(uint256 requestId, uint256[] memory randomWords) external {
        address consumer = requestToConsumer[requestId];
        require(consumer != address(0), "Request ID not found");

        // Call rawFulfillRandomWords on the consumer
        VRFConsumerBaseV2(consumer).rawFulfillRandomWords(requestId, randomWords);
    }
}
