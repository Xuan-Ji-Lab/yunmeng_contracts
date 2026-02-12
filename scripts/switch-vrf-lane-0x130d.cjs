const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Switching VRF Key Hash to 0x130d... (Matching User UI)...");

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

    // New Key Hash from User Screenshot (200 gwei lane)
    const NEW_KEY_HASH = "0x130dcfd3d4b68aeabe942a0468307db43c1fc606b52c03bb8006d042ba36c01e";

    if (currentKeyHash === NEW_KEY_HASH) {
        console.log("Key Hash is already correct. No changes needed.");
        return;
    }

    console.log(`Updating Key Hash to ${NEW_KEY_HASH}...`);
    const tx = await core.setVRFConfig(
        NEW_KEY_HASH,
        currentSubId,
        currentGasLimit,
        currentConfirmations
    );

    console.log(`Tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Tx mined in block ${receipt.blockNumber}`);
    console.log("✅ VRF Key Hash Updated Successfully!");

    const updatedHash = await core.vrfKeyHash();
    console.log(`Verified New Hash: ${updatedHash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
