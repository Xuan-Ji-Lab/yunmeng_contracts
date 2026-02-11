const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const [sender] = await hre.ethers.getSigners();

    console.log("Simulating Tax Revenue...");
    console.log("Sending 0.02 BNB to Treasury:", treasuryAddr);

    const tx = await sender.sendTransaction({
        to: treasuryAddr,
        value: hre.ethers.parseEther("0.02")
    });
    console.log("Tx Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Tax simulated!");

    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const pending = await treasury.pendingTaxBuyback();
    const threshold = await treasury.minBuybackThreshold();

    console.log("Status:");
    console.log("- Pending Tax Buyback:", hre.ethers.formatEther(pending), "BNB");
    console.log("- Threshold:", hre.ethers.formatEther(threshold), "BNB");

    if (pending >= threshold) {
        console.log("🚀 Pending > Threshold. Ready for Chainlink trigger.");
    }
}

main().catch(console.error);
