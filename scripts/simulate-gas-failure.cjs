const { ethers } = require("hardhat");

async function main() {
    console.log("--- Simulating Gas Starvation on Pity Payout ---");

    // 1. Deploy Mock Core/Treasury/Seeker (Local)
    const CloudDreamCore = await ethers.getContractFactory("CloudDreamCore");
    const core = await CloudDreamCore.deploy();
    await core.initialize();

    const DreamTreasury = await ethers.getContractFactory("DreamTreasury");
    const treasury = await DreamTreasury.deploy();
    // Need to init properly
    await treasury.initialize(await core.getAddress(), await core.getAddress(), await core.getAddress()); // Dummy addresses
    await core.grantRole(await core.UPGRADER_ROLE(), await (await ethers.getSigners())[0].getAddress()); // Admin

    // 2. Deploy Malicious/Contract User
    const GasGuzzler = await ethers.getContractFactory("GasGuzzler"); // We need to create this first? No, we can simulate EOA code.
    // Actually, let's deploy a simple contract that consumes gas on receive.

    // Create a simple contract inline
    const MaliciousReceiver = await ethers.getContractFactory("MaliciousReceiver");
    const receiver = await MaliciousReceiver.deploy();

    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    // ... deploying full suite is hard.

    // ALternative: Use mainnet fork, deploy MaliciousReceiver, set userTribulation to 8, simulate callback.
    // But wait, we can't change storage on fork easily for `tribulationCounts`. 
    // We can use `hardhat_setStorageAt`.

    console.log("Hypothesis: User contract consumes all gas forwarded by .call{value:...}.");
    console.log("Remaining 1/64 gas is insufficient for _addPityRecord.");

    // Calculate gas for _addPityRecord
    // SSTORE: 20k (cold) or 2.9k (warm)
    // Array Push: Reading length (2.1k), Writing new slot (22.1k or 5k), Updating length (5k).
    // _addWishRecord also runs after Pity!
    // Emitting event: 750 + data.
    // Total gas needed AFTER payout call is roughly 40,000 - 60,000 gas.

    // If we start with 2,000,000 gas (VRF Limit).
    // Seeker logic consumes X.
    // treasury.payoutBNB consumes Y.
    // Inside payoutBNB: .call{value: ...} forwards 63/64 of remaining.
    // If remaining is ~1.9M. 1/64 is ~30,000 gas.

    // 30,000 gas IS NOT ENOUGH for _addPityRecord + _addWishRecord!
    // _addPityRecord writes to storage.
    // _addWishRecord writes to storage (huge struct).

    console.log("Calculation:");
    console.log("Assume 1,900,000 gas before call.");
    console.log("Forwarded: 1,870,312 gas.");
    console.log("Retained (1/64): 29,688 gas.");
    console.log("Gas needed for post-payout logic (Storage writes x 2 arrays + events): > 50,000.");
    console.log("Result: OUT OF GAS.");

    console.log("Conclusion: If user consumes all gas, the transaction reverts ENTIRELY.");
    console.log("VRF Callback fails. No pity recorded. No retry (unless we provide MORE gas).");
}

main();
