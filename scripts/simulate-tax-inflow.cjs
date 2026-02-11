const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    // 1. Check status
    let pending = await treasury.pendingTaxBuyback();
    console.log("Current Pending:", hre.ethers.formatEther(pending));

    if (pending < hre.ethers.parseEther("0.05")) {
        console.log("Sending BNB to simulate tax...");
        const [deployer] = await hre.ethers.getSigners();

        // Send 0.1 BNB to treasury (will be split 30/70 based on config)
        // We need enough to push pending > 0.05
        // If 70% goes to buyback, sending 0.1 BNB -> 0.07 BNB to buyback > 0.05

        const tx = await deployer.sendTransaction({
            to: treasuryAddress,
            value: hre.ethers.parseEther("0.1")
        });
        await tx.wait();
        console.log("Sent 0.1 BNB tax simulation.");
    }

    // 2. Re-check
    pending = await treasury.pendingTaxBuyback();
    console.log("New Pending:", hre.ethers.formatEther(pending));

    // 3. Check Upkeep
    const [upkeepNeeded,] = await treasury.checkUpkeep("0x");
    console.log("Upkeep Needed:", upkeepNeeded);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
