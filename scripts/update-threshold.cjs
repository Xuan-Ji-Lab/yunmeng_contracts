const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const [deployer] = await hre.ethers.getSigners();

    const newThreshold = hre.ethers.parseEther("0.005");

    console.log("Updating minBuybackThreshold...");
    console.log("Old Threshold:", hre.ethers.formatEther(await treasury.minBuybackThreshold()), "BNB");

    // Check Config Role
    const coreAddr = deployInfo.contracts.CloudDreamCore;
    const core = await hre.ethers.getContractAt("ICloudDreamCore", coreAddr);
    const CONFIG_ROLE = await core.CONFIG_ROLE();

    if (!await core.hasRole(CONFIG_ROLE, deployer.address)) {
        console.log("Granting CONFIG_ROLE to deployer...");
        const DEFAULT_ADMIN = await core.DEFAULT_ADMIN_ROLE();
        await (await core.grantRole(CONFIG_ROLE, deployer.address)).wait();
    }

    // Update Ops Config (keep other params same)
    const opsWallet = await treasury.opsWallet();
    const taxOpsBps = await treasury.taxOpsBps();
    const enableTaxBuyback = await treasury.enableTaxBuyback();

    const tx = await treasury.setOpsConfig(opsWallet, taxOpsBps, newThreshold, enableTaxBuyback);
    await tx.wait();

    console.log("✅ New Threshold Set:", hre.ethers.formatEther(await treasury.minBuybackThreshold()), "BNB");

    // Check if pending is now triggerable
    const pending = await treasury.pendingTaxBuyback();
    console.log("Current Pending:", hre.ethers.formatEther(pending), "BNB");
    if (pending >= newThreshold) {
        console.log("🚀 Pending amount is now ABOVE threshold! Chainlink should trigger soon.");
    } else {
        console.log("⏳ Pending amount still below threshold.");
    }
}

main().catch(console.error);
