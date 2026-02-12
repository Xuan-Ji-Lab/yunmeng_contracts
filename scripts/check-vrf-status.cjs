const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const requestId = "0x799fc4ca645436fe0bf62540a1ba44b5220fd1ec80d679083850f0d82d0c04b0";
    console.log(`Checking VRF Request: ${requestId} on ${hre.network.name}...`);

    const deployPath = "deploy/deployment-modular.json";
    const deployInfo = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = deployInfo.contracts.DreamSeeker;

    const DreamSeeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddress);

    const req = await DreamSeeker.s_requests(requestId);
    console.log("Request Exists:", req.exists);
    console.log("Fulfilled:", req.fulfilled);
    console.log("Is Paid:", req.isPaid);
    console.log("Sender:", req.sender);

    // Check Subscription Balance if possible? (Would need Core address and VRF Coord)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
