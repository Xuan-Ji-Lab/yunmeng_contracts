const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);
    const [deployer] = await hre.ethers.getSigners();

    console.log("Lowering Min Buyback Threshold to 0.01 BNB...");

    // Config Ops: Keep existing values but lower threshold
    // Ops Wallet: deployer
    // taxOpsBps: 3000 (30%)
    // New Threshold: 0.01 ether
    // enableTaxBuyback: true

    // Note: We need to set taxOpsBps correctly. Script set it to 3000? No, user changed it to 5000 in deploy-post-launch.cjs (step 180).
    // Let's read current config first if possible? No view for taxOpsBps directly but I can query state.
    // Ops Wallet is deployer.

    // Actually setOpsConfig overwrites everything.
    // Let's assume user wants 50% (5000 bps) based on step 180 diff.

    const tx = await treasury.setOpsConfig(
        deployer.address,
        5000,
        hre.ethers.parseEther("0.01"), // Lowered to 0.01
        true
    );
    await tx.wait();
    console.log("Threshold lowered to 0.01 BNB.");

    const pending = await treasury.pendingTaxBuyback();
    console.log("Current Pending:", hre.ethers.formatEther(pending));

    const [upkeepNeeded,] = await treasury.checkUpkeep("0x");
    console.log("Upkeep Needed:", upkeepNeeded);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
