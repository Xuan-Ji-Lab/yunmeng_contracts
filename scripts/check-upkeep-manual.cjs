const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);

    const checkData = "0x";

    try {
        console.log("Calling checkUpkeep(0x)...");
        const [upkeepNeeded, performData] = await treasury.checkUpkeep(checkData);
        console.log("Result:");
        console.log("- upkeepNeeded:", upkeepNeeded);
        console.log("- performData:", performData);

        if (upkeepNeeded) {
            console.log("✅ checkUpkeep 模拟成功！合约逻辑没问题。Wait for Chainlink to process.");
        } else {
            console.log("❌ checkUpkeep 返回 FALSE！需要调试条件。");
            const pending = await treasury.pendingTaxBuyback();
            const threshold = await treasury.minBuybackThreshold();
            const balance = await hre.ethers.provider.getBalance(treasuryAddr);
            console.log("  Pending:", hre.ethers.formatEther(pending));
            console.log("  Threshold:", hre.ethers.formatEther(threshold));
            console.log("  Balance:", hre.ethers.formatEther(balance));
        }
    } catch (e) {
        console.error("Call failed:", e);
    }
}

main().catch(console.error);
