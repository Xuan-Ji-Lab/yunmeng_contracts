
const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Checking Subscription with account:", deployer.address);

    // Configuration
    const COORDINATOR_ADDRESS = "0x6A2AAd07396B36Fe02a22b33cf443582f682c82f"; // VRF v2 Coordinator
    const SUBSCRIPTION_ID = "3565";

    // Coordinator Interface
    const api = [
        "function getSubscription(uint64 subId) external view returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers)"
    ];
    const coordinator = await ethers.getContractAt(api, COORDINATOR_ADDRESS, deployer);

    try {
        const sub = await coordinator.getSubscription(SUBSCRIPTION_ID);
        console.log("✅ Subscription Details:");
        console.log(`- Balance: ${ethers.formatEther(sub.balance)} LINK`);
        console.log(`- Req Count: ${sub.reqCount}`);
        console.log(`- Owner: ${sub.owner}`);
        console.log(`- Consumers: ${sub.consumers}`);

        if (sub.balance < 100000000000000000n) { // Less than 0.1 LINK
            console.warn("⚠️ LOW BALANCE! Please fund the subscription.");
        }

    } catch (error) {
        console.error("Failed to get subscription details:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
