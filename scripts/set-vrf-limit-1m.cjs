const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Optimizing VRF Gas Limit to 1,000,000...");

    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const coreAddress = info.contracts.CloudDreamCore;

    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    // Current Config
    const currentKeyHash = await core.vrfKeyHash();
    const currentSubId = await core.vrfSubscriptionId();
    const currentGasLimit = await core.vrfCallbackGasLimit();
    const currentConfirmations = await core.vrfRequestConfirmations();

    console.log(`Current Config:`);
    console.log(`- Key Hash: ${currentKeyHash}`);
    console.log(`- Sub ID: ${currentSubId}`);
    console.log(`- Gas Limit: ${currentGasLimit}`);

    const NEW_GAS_LIMIT = 1000000; // 1 Million

    if (currentGasLimit.toString() === NEW_GAS_LIMIT.toString()) {
        console.log("Gas Limit is already 1,000,000. No changes needed.");
        return;
    }

    console.log(`updating Gas Limit to ${NEW_GAS_LIMIT}...`);
    const tx = await core.setVRFConfig(
        currentKeyHash,
        currentSubId,
        NEW_GAS_LIMIT,
        currentConfirmations
    );

    console.log(`Tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Tx mined in block ${receipt.blockNumber}`);
    console.log("✅ VRF Gas Limit Updated Successfully!");

    // Wait a bit for node indexer if needed (rare on direct read but good for safety)
    await new Promise(r => setTimeout(r, 2000));

    const updatedLimit = await core.vrfCallbackGasLimit();
    console.log(`Verified New Limit: ${updatedLimit}`);

    if (updatedLimit.toString() !== NEW_GAS_LIMIT.toString()) {
        console.error("❌ ERROR: Gas Limit mismatch! Update failed.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
