const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    console.log("--- Treasury Config Check ---");
    console.log("Treasury Address:", treasuryAddress);

    const flapPortal = await treasury.flapPortal();
    console.log("Flap Portal:", flapPortal);

    const wishToken = await treasury.wishToken();
    console.log("Wish Token:", wishToken);

    const automationForwarder = await treasury.automationForwarder();
    console.log("Automation Forwarder:", automationForwarder);

    const minBuybackThreshold = await treasury.minBuybackThreshold();
    console.log("Min Buyback Threshold:", hre.ethers.formatEther(minBuybackThreshold));

    const pendingTaxBuyback = await treasury.pendingTaxBuyback();
    console.log("Pending Tax Buyback:", hre.ethers.formatEther(pendingTaxBuyback));

    const balance = await hre.ethers.provider.getBalance(treasuryAddress);
    console.log("BNB Balance:", hre.ethers.formatEther(balance));

    // Check if Upkeep is needed
    try {
        const [upkeepNeeded,] = await treasury.checkUpkeep("0x");
        console.log("checkUpkeep Result:", upkeepNeeded);
    } catch (e) {
        console.error("checkUpkeep Failed:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
