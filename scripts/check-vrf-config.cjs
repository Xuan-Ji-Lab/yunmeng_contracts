const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("正在检查 CloudDreamCore 的 VRF 配置...");

    const network = hre.network.name;
    const deployInfoPath = `deploy/deployment-modular.json`;

    let deployInfo;
    if (fs.existsSync(`deploy/deployment-${network}.json`)) {
        deployInfo = JSON.parse(fs.readFileSync(`deploy/deployment-${network}.json`));
    } else if (fs.existsSync(deployInfoPath)) {
        deployInfo = JSON.parse(fs.readFileSync(deployInfoPath));
    } else {
        throw new Error("Deployment info not found");
    }

    const coreAddr = deployInfo.contracts.CloudDreamCore;
    const core = await hre.ethers.getContractAt("ICloudDreamCore", coreAddr);

    console.log("Core Address:", coreAddr);

    try {
        const limit = await core.vrfCallbackGasLimit();
        console.log("Current VRF Callback Gas Limit:", limit.toString());

        const subId = await core.vrfSubscriptionId();
        console.log("VRF Subscription ID:", subId.toString());

        const requestConfirmations = await core.vrfRequestConfirmations();
        console.log("Request Confirmations:", requestConfirmations.toString());

        const keyHash = await core.vrfKeyHash();
        console.log("Key Hash:", keyHash);

    } catch (e) {
        console.error("Failed to read VRF config:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
