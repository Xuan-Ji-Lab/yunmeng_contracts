const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting DreamTreasury upgrade...");

    const deploymentPath = path.join(__dirname, "../deploy/deployment-modular.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("Deployment file not found");
    }
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath));
    const treasuryProxyAddress = deploymentData.contracts.DreamTreasury;

    if (!treasuryProxyAddress) {
        throw new Error("DreamTreasury address not found in deployment data");
    }

    console.log(`Upgrading DreamTreasury at proxy: ${treasuryProxyAddress}`);

    const DreamTreasury = await ethers.getContractFactory("DreamTreasury");

    // Validate storage layout might fail if I didn't restore the variable exacty right, 
    // but OpenZeppelin plugin usually handles checks.
    // Since I restored 'taxOpsBps', it should be fine.

    const upgraded = await upgrades.upgradeProxy(treasuryProxyAddress, DreamTreasury);
    await upgraded.waitForDeployment();

    console.log("DreamTreasury upgraded successfully");
    console.log("Implementation address:", await upgrades.erc1967.getImplementationAddress(treasuryProxyAddress));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
