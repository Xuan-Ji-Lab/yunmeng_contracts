const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    const pending = await treasury.pendingTaxBuyback();
    console.log("Pending Tax Buyback:", hre.ethers.formatEther(pending), "BNB");

    const balance = await hre.ethers.provider.getBalance(treasuryAddress);
    console.log("Treasury Balance:", hre.ethers.formatEther(balance), "BNB");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
