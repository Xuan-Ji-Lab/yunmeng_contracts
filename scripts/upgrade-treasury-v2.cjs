const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("正在升级 DreamTreasury 合约 (Gas Safe V2)...");

    const network = hre.network.name;
    const deployInfoPath = `deploy/deployment-modular.json`;

    let deployInfo;
    if (fs.existsSync(`deploy/deployment-${network}.json`)) {
        deployInfo = JSON.parse(fs.readFileSync(`deploy/deployment-${network}.json`));
    } else if (fs.existsSync(deployInfoPath)) {
        deployInfo = JSON.parse(fs.readFileSync(deployInfoPath));
    }

    const proxyAddress = deployInfo.contracts.DreamTreasury;
    console.log("Treasury Proxy:", proxyAddress);

    // 1. Prepare Upgrade
    const NewTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    console.log("Preparing upgrade...");

    // Validate Upgrade
    await hre.upgrades.validateUpgrade(proxyAddress, NewTreasury);
    console.log("Upgrade validation successful.");

    // 2. Upgrade
    console.log("Upgrading...");
    const upgraded = await hre.upgrades.upgradeProxy(proxyAddress, NewTreasury);
    await upgraded.waitForDeployment();

    console.log("✅ DreamTreasury upgraded successfully!");
    console.log("Implementation Address:", await hre.upgrades.erc1967.getImplementationAddress(proxyAddress));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
