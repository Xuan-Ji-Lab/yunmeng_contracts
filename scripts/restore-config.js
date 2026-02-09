const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔧 Restoring DreamSeeker Configuration...");

    // 1. Load Deployment
    const deploymentPath = path.join(__dirname, "../../ethereal-realm/src/deployment-modular.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    const Seeker = await ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);
    const [deployer] = await ethers.getSigners();

    // 2. Restore Default Values
    // valid defaults from DreamSeeker.sol
    const seekCost = ethers.parseEther("0.005");
    const karmaCost = 10;
    const pityBase = ethers.parseEther("0.001");
    const pityThreshold = 9;

    console.log(`Setting Seek Cost back to: ${ethers.formatEther(seekCost)} BNB`);

    const tx = await Seeker.setSeekConfig(
        seekCost,
        karmaCost,
        pityBase,
        pityThreshold
    );
    await tx.wait();

    console.log("✅ Configuration Restored Successfully.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
