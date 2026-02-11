const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Operating with account:", deployer.address);

    // Read deployment info
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("❌ Deployment file not found: " + deployPath);
    }
    const deployInfo = JSON.parse(fs.readFileSync(deployPath));
    const coreAddress = deployInfo.contracts.CloudDreamCore;

    if (!coreAddress) {
        throw new Error("❌ CloudDreamCore address not found in deployment file");
    }

    console.log("CloudDreamCore Address:", coreAddress);

    // Connect to Core
    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    // Get Role
    const OPERATOR_ROLE = await core.OPERATOR_ROLE();
    console.log("OPERATOR_ROLE Hash:", OPERATOR_ROLE);

    // Check if deployer has role
    const hasRole = await core.hasRole(OPERATOR_ROLE, deployer.address);
    console.log(`Deployer (${deployer.address}) has OPERATOR_ROLE:`, hasRole);

    if (!hasRole) {
        console.log("Granting OPERATOR_ROLE to deployer...");
        const tx = await core.grantRole(OPERATOR_ROLE, deployer.address);
        await tx.wait();
        console.log("✅ Main deployer granted OPERATOR_ROLE");
    } else {
        console.log("ℹ️ Deployer already has the role.");
    }

    // You can add other addresses here if needed
    // const specificUser = "0x...";
    // await core.grantRole(OPERATOR_ROLE, specificUser);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
