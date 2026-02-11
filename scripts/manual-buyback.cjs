const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    console.log("Executing pending buyback...");

    // Deployer has OPERATOR_ROLE so can call this
    const tx = await treasury.executePendingTaxBuyback();
    console.log("Tx sent:", tx.hash);

    await tx.wait();
    console.log("Tx confirmed!");

    const pending = await treasury.pendingTaxBuyback();
    console.log("New Pending:", hre.ethers.formatEther(pending));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
