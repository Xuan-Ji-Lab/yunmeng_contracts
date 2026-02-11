const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const [sender] = await hre.ethers.getSigners();

    console.log("Simulating Tax Revenue...");
    console.log("Sending 0.05 BNB to Treasury:", treasuryAddr);

    const tx = await sender.sendTransaction({
        to: treasuryAddr,
        value: hre.ethers.parseEther("0.05")
    });
    console.log("Tx Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Tax simulated!");

    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const pending = await treasury.pendingTaxBuyback();
    console.log("Current Pending Tax Buyback:", hre.ethers.formatEther(pending), "BNB");
}

main().catch(console.error);
