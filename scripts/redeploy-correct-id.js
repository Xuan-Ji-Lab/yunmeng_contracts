
const fs = require('fs');
const path = require('path');
const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Redeploying with account:", deployer.address);

    // Load existing config
    const deploymentPath = path.resolve(__dirname, '../../ethereal-realm/src/deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    // Configuration
    const SUBSCRIPTION_ID = "3565"; // The correct V2 ID
    const COORDINATOR = "0x6A2AAd07396B36Fe02a22b33cf443582f682c82f"; // VRF v2 Coordinator (BSC Testnet)
    const KEY_HASH = "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314"; // 200 gwei Key Hash
    const TREASURY = deployer.address; // Use deployer as treasury for now

    console.log(`Deploying CloudDreamProtocol with SubID: ${SUBSCRIPTION_ID}...`);

    const Protocol = await ethers.getContractFactory("CloudDreamProtocol");
    const protocol = await Protocol.deploy(
        TREASURY,
        SUBSCRIPTION_ID, // Passing string, ethers handles uint64 conversion if small enough
        COORDINATOR,
        KEY_HASH
    );

    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();

    console.log(`✅ New Protocol Deployed at: ${protocolAddress}`);

    // Update Config
    deploymentInfo.address = protocolAddress;
    deploymentInfo.subscriptionId = SUBSCRIPTION_ID;
    deploymentInfo.deployedAt = new Date().toISOString();

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("Updated deployment-info.json");

    // Set Wish Token (Important!)
    const wishTokenAddress = deploymentInfo.wishToken;
    if (wishTokenAddress) {
        console.log(`Setting Wish Token to ${wishTokenAddress}...`);
        const tx = await protocol.setBuybackConfig(false, 7000, wishTokenAddress, deploymentInfo.wbnb);
        await tx.wait();
        console.log("Wish Token Configured.");
    }

    // --- Auto Add Consumer (Disabled by user request) ---
    /*
    console.log("🤖 Auto-adding consumer to VRF Subscription...");
    const api = [
        "function addConsumer(uint64 subId, address consumer) external",
        "function getSubscription(uint64 subId) external view returns (uint96 balance, uint64 reqCount, address owner, address[] memory consumers)"
    ];
    const coordinatorContract = await ethers.getContractAt(api, COORDINATOR, deployer);

    try {
        const txAdd = await coordinatorContract.addConsumer(SUBSCRIPTION_ID, protocolAddress);
        console.log(`Adding Consumer Tx: ${txAdd.hash}`);
        await txAdd.wait();
        console.log("✅ Consumer added automatically!");

        deploymentInfo.consumerAddTx = txAdd.hash;
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    } catch (e) {
        console.error("❌ Failed to auto-add consumer:", e.message);
    }
    */
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
