
const hre = require("hardhat");
const ethers = hre.ethers;
const fs = require('fs');
const path = require('path');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Operating with account:", deployer.address);

    // Configuration
    const COORDINATOR_ADDRESS = "0x6A2AAd07396B36Fe02a22b33cf443582f682c82f"; // VRF v2 Coordinator
    const SUBSCRIPTION_ID = "3565";

    // Use public RPC if needed for stability
    // Handled by hardhat.config.js usually, but good to know being explicit helps debugging

    // Read new protocol address
    const deploymentPath = path.resolve(__dirname, '../../ethereal-realm/src/deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const CONSUMER_ADDRESS = deploymentInfo.address;

    console.log(`Adding Consumer: ${CONSUMER_ADDRESS}`);
    console.log(`To Subscription: ${SUBSCRIPTION_ID}`);

    // Coordinator Interface
    const api = [
        "function addConsumer(uint64 subId, address consumer) external",
        "function getSubscription(uint64 subId) external view returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers)"
    ];
    const coordinator = await ethers.getContractAt(api, COORDINATOR_ADDRESS, deployer);

    // Check if already added
    /* const sub = await coordinator.getSubscription(SUBSCRIPTION_ID);
    if (sub.consumers.includes(CONSUMER_ADDRESS)) {
        console.log("✅ Already a consumer.");
        return;
    } */
    // Skipping check to save RPC calls/gas, just calling addConsumer which reverts if already added but that's fine

    try {
        const tx = await coordinator.addConsumer(SUBSCRIPTION_ID, CONSUMER_ADDRESS);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Consumer added successfully!");

        // Update deployment-info.json with the transaction hash
        deploymentInfo.consumerAddTx = tx.hash;
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log("Saved Consumer Add Tx Hash to deployment-info.json");
    } catch (error) {
        console.error("Failed to add consumer:", error);
        // Likely error: InvalidSubscription, Unauthorized (user is not owner), or LimitExceeded
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
