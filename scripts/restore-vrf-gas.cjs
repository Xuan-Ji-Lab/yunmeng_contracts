const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Restoring VRF Callback Gas Limit to 2,500,000...");

    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const coreAddress = info.contracts.CloudDreamCore;

    if (!coreAddress) {
        throw new Error("CloudDreamCore address not found.");
    }

    // 2. Attach Core contract
    console.log(`Core Address: ${coreAddress}`);
    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    // 3. Read Current Config
    const currentSubId = await core.vrfSubscriptionId();
    const currentKeyHash = await core.vrfKeyHash();
    const currentGas = await core.vrfCallbackGasLimit();
    const currentConfs = await core.vrfRequestConfirmations();

    console.log(`Current Gas Limit: ${currentGas.toString()}`);

    // Check if we need to update
    const TARGET_GAS = 2500000;
    if (currentGas.toString() === TARGET_GAS.toString()) {
        console.log("Gas Limit is already 2,500,000. No action needed.");
        return;
    }

    // 4. Update Config
    console.log(`Setting Gas Limit to: ${TARGET_GAS}...`);

    // setVRFConfig(bytes32 _keyHash, uint64 _subId, uint32 _gasLimit, uint16 _confirmations)
    const tx = await core.setVRFConfig(
        currentKeyHash,
        currentSubId,
        TARGET_GAS,
        currentConfs
    );
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ VRF Config Restored Successfully!");

    // 5. Verify
    const newGas = await core.vrfCallbackGasLimit();
    console.log(`New Gas Limit: ${newGas.toString()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
