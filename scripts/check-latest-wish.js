const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const seekerAddress = deploymentInfo.contracts.DreamSeeker;
    const batchReaderAddress = deploymentInfo.contracts.CloudDreamBatchReader;

    console.log("Using DreamSeeker at:", seekerAddress);
    console.log("Using BatchReader at:", batchReaderAddress);

    const Seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddress);
    const BatchReader = await hre.ethers.getContractAt("CloudDreamBatchReader", batchReaderAddress);

    // Get total wishes
    const count = await Seeker.getGlobalWishCount();
    console.log("Total Wishes:", count.toString());

    if (count == 0) {
        console.log("No wishes found.");
        return;
    }

    const lastId = count - 1n;
    console.log("Checking Wish ID:", lastId.toString());

    // 1. Check direct storage mapping if getter exists
    try {
        const bn = await Seeker.wishBlockNumbers(lastId);
        console.log("Direct Seeker.wishBlockNumbers(id):", bn.toString());
    } catch (e) {
        console.log("Error calling wishBlockNumbers:", e.message);
    }

    // 2. Check via BatchReader
    try {
        const records = await BatchReader.getWishRecordsBatch([lastId]);
        console.log("BatchReader Record:", records[0]);
        console.log("BatchReader BlockNumber:", records[0].blockNumber.toString());
    } catch (e) {
        console.log("Error calling BatchReader:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
