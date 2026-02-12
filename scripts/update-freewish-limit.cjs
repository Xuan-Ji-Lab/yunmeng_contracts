const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Setting Free Wish Limit...");

    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("❌ deployment-modular.json not found");
    }
    const deployInfo = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = deployInfo.contracts.DreamSeeker;

    if (!seekerAddress) {
        throw new Error("❌ DreamSeeker address not found");
    }

    const DreamSeeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddress);

    // Set limit to 3 (default)
    const limit = 3;
    console.log(`Setting limit to ${limit} for ${seekerAddress}`);

    const tx = await DreamSeeker.setFreeWishConfig(limit);
    console.log("Tx sent:", tx.hash);
    await tx.wait();

    console.log(`✅ Limit set to ${limit}`);

    // Verify
    const newLimit = await DreamSeeker.freeWishDailyLimit();
    console.log("Current Limit:", newLimit.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
