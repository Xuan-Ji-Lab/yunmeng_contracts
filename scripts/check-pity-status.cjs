const hre = require("hardhat");
const deployment = require("../deploy/deployment-modular.json");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Checking with account:", signer.address);

    // Get Core contract
    const core = await hre.ethers.getContractAt(
        deployment.abis.Core,
        deployment.contracts.CloudDreamCore
    );

    // 1. Check if Seeker is registered as module
    console.log("\n[1] Checking Seeker module registration...");
    const isModule = await core.isModule(deployment.contracts.DreamSeeker);
    console.log("DreamSeeker is registered as module:", isModule);

    // 2. Check Pity records count
    console.log("\n[2] Checking Pity records...");
    try {
        // Try to read first pity record (index 0)
        const pityRecord = await core.allPityRecords(0);
        console.log("Pity Record #0:", {
            user: pityRecord.user,
            amount: hre.ethers.formatEther(pityRecord.amount),
            timestamp: new Date(Number(pityRecord.timestamp) * 1000).toISOString()
        });
    } catch (e) {
        console.log("No Pity records found (array is empty)");
    }

    // 3. Check user's tribulation count
    console.log("\n[3] Checking your tribulation count...");
    const tribCount = await core.getTribulationCount(signer.address);
    console.log("Your current tribulation count:", Number(tribCount));

    // 4. Check Seeker's PITY_THRESHOLD
    console.log("\n[4] Checking Seeker configuration...");
    const seeker = await hre.ethers.getContractAt(
        deployment.abis.Seeker,
        deployment.contracts.DreamSeeker
    );
    const threshold = await seeker.PITY_THRESHOLD();
    const baseUnit = await seeker.PITY_BASE_UNIT();
    console.log("PITY_THRESHOLD:", Number(threshold));
    console.log("PITY_BASE_UNIT:", hre.ethers.formatEther(baseUnit), "BNB");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
