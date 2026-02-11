const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    const threshold = await treasury.minBuybackThreshold();
    console.log("Min Buyback Threshold:", hre.ethers.formatEther(threshold), "BNB");

    const pending = await treasury.pendingTaxBuyback();
    console.log("Pending:", hre.ethers.formatEther(pending));

    const balance = await hre.ethers.provider.getBalance(treasuryAddress);
    console.log("Balance:", hre.ethers.formatEther(balance));

    // checkUpkeep is view
    const [upkeepNeeded, performData] = await treasury.checkUpkeep("0x");
    console.log("Upkeep Needed:", upkeepNeeded);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
