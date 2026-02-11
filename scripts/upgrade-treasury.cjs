const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Upgrading DreamTreasury...");

    // Load deployment info
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("❌ deployment-modular.json not found");
    }
    const deployInfo = JSON.parse(fs.readFileSync(deployPath));
    const treasuryProxyAddress = deployInfo.contracts.DreamTreasury;

    if (!treasuryProxyAddress) {
        throw new Error("❌ DreamTreasury address not found in deployment file");
    }

    console.log("Treasury Proxy:", treasuryProxyAddress);

    // Upgrade
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const upgraded = await hre.upgrades.upgradeProxy(treasuryProxyAddress, DreamTreasury, { kind: 'uups' });
    await upgraded.waitForDeployment();

    console.log("✅ DreamTreasury Upgraded Successfully!");

    // Get Implementation Address
    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(treasuryProxyAddress);
    console.log("New Implementation:", implAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
