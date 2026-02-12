const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Updating VRF Key Hash with account:", deployer.address);

    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("❌ Deployment file not found: " + deployPath);
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const coreAddress = info.contracts.CloudDreamCore;

    if (!coreAddress) {
        throw new Error("❌ CloudDreamCore address not found in deployment file.");
    }
    console.log("CloudDreamCore Address:", coreAddress);

    // 2. Attach Core contract
    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    // 3. Get Current Config (to preserve other values)
    console.log("Fetching current configuration...");
    const currentSubId = await core.vrfSubscriptionId();
    const currentGasLimit = await core.vrfCallbackGasLimit();
    const currentConfirmations = await core.vrfRequestConfirmations();
    const currentKeyHash = await core.vrfKeyHash();

    console.log(`Current Key Hash: ${currentKeyHash}`);
    console.log(`Current Subscription ID: ${currentSubId}`);
    console.log(`Current Callback Gas Limit: ${currentGasLimit}`);
    console.log(`Current Confirmations: ${currentConfirmations}`);

    // 4. Update Key Hash
    const NEW_KEY_HASH = "0x114f3da0a805b6a67d6e9cd2ec746f7028f1b7376365af575cfea3550dd1aa04";

    if (currentKeyHash.toLowerCase() === NEW_KEY_HASH.toLowerCase()) {
        console.log("✅ Key Hash is already set to the correct value. No update needed.");
        return;
    }

    console.log(`\nSetting NEW Key Hash: ${NEW_KEY_HASH}`);

    try {
        const tx = await core.setVRFConfig(
            NEW_KEY_HASH,
            currentSubId,
            currentGasLimit,
            currentConfirmations
        );
        console.log("Transaction sent:", tx.hash);

        console.log("Waiting for confirmation...");
        await tx.wait();

        console.log("✅ VRF Configuration Updated Successfully!");

        // Verify
        const updatedKeyHash = await core.vrfKeyHash();
        console.log("Verified New Key Hash:", updatedKeyHash);

    } catch (error) {
        console.error("❌ Error updating VRF Config:", error.message);
        if (error.message.includes("AccessControl")) {
            console.error("Reason: Caller is missing CONFIG_ROLE");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
