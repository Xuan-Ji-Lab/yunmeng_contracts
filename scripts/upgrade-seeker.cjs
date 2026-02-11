const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Upgrading DreamSeeker...");

    // Load deployment info
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("❌ deployment-modular.json not found");
    }
    const deployInfo = JSON.parse(fs.readFileSync(deployPath));
    const seekerProxyAddress = deployInfo.contracts.DreamSeeker;

    if (!seekerProxyAddress) {
        throw new Error("❌ DreamSeeker address not found in deployment file");
    }

    console.log("Seeker Proxy:", seekerProxyAddress);

    // Upgrade
    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    // force: true if we changed storage layout unexpectedly, but here we just removed a function call.
    // However, logic change doesn't require storage layout check unless we changed state variables.
    // We added NOTHING to storage. Just logic.
    // So validate: true is fine.

    const upgraded = await hre.upgrades.upgradeProxy(seekerProxyAddress, DreamSeeker, { kind: 'uups' });
    await upgraded.waitForDeployment();

    console.log("✅ DreamSeeker Upgraded Successfully!");

    // Get Implementation Address
    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(seekerProxyAddress);
    console.log("New Implementation:", implAddress);

    // Update deployment file with new ABI? 
    // Usually ABI doesn't change unless external functions changed.
    // We only changed internal logic of existing functions.
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
