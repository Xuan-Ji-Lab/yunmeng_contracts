const hre = require("hardhat");
const fs = require("fs");

async function main() {
    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    const info = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = info.contracts.DreamSeeker;

    // 2. Attach Seeker
    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    // 3. Get Stats
    console.log("Checking Abyss Stats...");
    // getAbyssStats returns (poolBalance, dividendsDistributed, holderCount, shares, abyssCount, winnerRatio, dividendRatio)
    const stats = await seeker.getAbyssStats();

    console.log(`Pool Balance: ${hre.ethers.formatEther(stats.poolBalance)} WISH`);
    console.log(`Holder Count: ${stats.holderCount}`);
    console.log(`Abyss Count: ${stats.abyssCount}`);

    // Check list length explicitly to be sure
    const holders = await seeker.getAbyssHolders();
    console.log(`Holder List Length: ${holders.length}`);
}

main().catch(console.error);
