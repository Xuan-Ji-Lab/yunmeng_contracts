const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Checking VRF Subscription Status...");

    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    const info = JSON.parse(fs.readFileSync(deployPath));
    const coordAddress = info.config.vrfCoordinator;
    const subId = info.config.subscriptionId;

    console.log(`Coordinator: ${coordAddress}`);
    console.log(`Subscription ID: ${subId}`);

    if (!coordAddress || !subId) {
        throw new Error("Missing VRF config in deployment file");
    }

    // 2. Attach Coordinator
    // VRFCoordinatorV2Interface ABI (minimal)
    const abi = [
        "function getSubscription(uint64 subId) external view returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers)"
    ];
    const coord = await hre.ethers.getContractAt(abi, coordAddress);

    // 3. Get Subscription
    try {
        const sub = await coord.getSubscription(subId);
        console.log(`Balance: ${hre.ethers.formatEther(sub.balance)} LINK`);
        console.log(`Req Count: ${sub.reqCount}`);
        console.log(`Owner: ${sub.owner}`);
        console.log(`Consumers: ${sub.consumers}`);

        // Check if CloudDreamCore is a consumer
        // Check if DreamSeeker is a consumer (Crucial!)
        const seekerAddress = info.contracts.DreamSeeker;
        const isSeekerConsumer = sub.consumers.map(c => c.toLowerCase()).includes(seekerAddress.toLowerCase());
        console.log(`Is DreamSeeker (${seekerAddress}) a consumer? ${isSeekerConsumer}`);

        // Check if CloudDreamCore is a consumer
        const coreAddress = info.contracts.CloudDreamCore;
        const isCoreConsumer = sub.consumers.map(c => c.toLowerCase()).includes(coreAddress.toLowerCase());
        console.log(`Is CloudDreamCore (${coreAddress}) a consumer? ${isCoreConsumer}`);

    } catch (error) {
        console.error("Error fetching subscription:", error.message);
    }
}

main().catch(console.error);
