const hre = require("hardhat");

const COORD_V2 = "0x6A2AAd07396B36Fe02a22b33cf443582f682c82f";
const ABI = [
    "function createSubscription() external returns (uint64 subId)",
    "event SubscriptionCreated(uint64 indexed subId, address owner)"
];

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Creating v2 Subscription as ${deployer.address}...`);

    const coordinator = new hre.ethers.Contract(COORD_V2, ABI, deployer);

    // Create Subscription
    const tx = await coordinator.createSubscription();
    console.log("Tx Sent:", tx.hash);

    const receipt = await tx.wait();

    // Parse Event
    const event = receipt.logs
        .map(log => {
            try { return coordinator.interface.parseLog(log); }
            catch { return null; }
        })
        .find(parsed => parsed && parsed.name === 'SubscriptionCreated');

    if (event) {
        console.log("✅ Subscription Created!");
        const subId = event.args.subId.toString();
        console.log("Subscription ID:", subId);

        // Auto-update deployment-info.json
        const fs = require('fs');
        const path = require('path');
        const deploymentPath = path.resolve(__dirname, '../../ethereal-realm/src/deployment-info.json');

        let deploymentInfo = {};
        if (fs.existsSync(deploymentPath)) {
            deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        }

        deploymentInfo.subscriptionId = subId;
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log(`💾 Saved Subscription ID ${subId} to deployment-info.json`);

    } else {
        console.error("❌ Could not find SubscriptionCreated event.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
