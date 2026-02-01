
const hre = require("hardhat");
const ethers = hre.ethers;
const fs = require('fs');
const path = require('path');

async function main() {
    const deploymentPath = path.resolve(__dirname, '../../ethereal-realm/src/deployment-info.json');
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

    const PROTOCOL_ADDRESS = deploymentInfo.address;
    console.log("Checking Contract at:", PROTOCOL_ADDRESS);

    // Get Contract
    const CloudDreamProtocol = await ethers.getContractFactory("CloudDreamProtocol");
    const protocol = CloudDreamProtocol.attach(PROTOCOL_ADDRESS);

    // 1. Check Wish Token Config
    const wishTokenAddr = await protocol.wishToken();
    console.log("Wish Token Configured:", wishTokenAddr);
    console.log("Expected Token:", deploymentInfo.wishToken);

    if (wishTokenAddr !== deploymentInfo.wishToken) {
        console.error("❌ Mismatch! Contract is using wrong token address.");
    }

    // 2. Check Pool Variables
    const pool = await protocol.wishTokenPool();
    console.log("Internal Pool Val (wishTokenPool):", ethers.formatEther(pool));

    // 3. Check Real Balance
    const WishToken = await ethers.getContractAt("WishPowerToken", wishTokenAddr);
    const realBalance = await WishToken.balanceOf(PROTOCOL_ADDRESS);
    console.log("Real Token Balance (balanceOf):   ", ethers.formatEther(realBalance));

    // 4. Check Buyback Config
    const enabled = await protocol.buybackEnabled();
    const percent = await protocol.buybackPercent();
    console.log(`Buyback Enabled: ${enabled}, Percent: ${percent}`);

    // Analysis
    if (realBalance < pool) {
        console.error("❌ CRITICAL: Real balance is LESS than internal pool tracking. Reverts likely.");
    } else {
        console.log("✅ Balance checks passed. Contract has enough funds.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
