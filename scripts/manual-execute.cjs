const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const coreAddr = deployInfo.contracts.CloudDreamCore;
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const core = await hre.ethers.getContractAt("ICloudDreamCore", coreAddr);
    const [deployer] = await hre.ethers.getSigners();

    console.log("Checking Roles for:", deployer.address);
    const OPERATOR_ROLE = await core.OPERATOR_ROLE();
    const hasRole = await core.hasRole(OPERATOR_ROLE, deployer.address);
    console.log("Has OPERATOR_ROLE:", hasRole);

    if (!hasRole) {
        console.log("Granting OPERATOR_ROLE...");
        const DEFAULT_ADMIN = await core.DEFAULT_ADMIN_ROLE();
        // Assume deployer is admin
        await (await core.grantRole(OPERATOR_ROLE, deployer.address)).wait();
        console.log("Granted!");
    }

    console.log("Executing executePendingTaxBuyback() manually...");
    try {
        // Estimate gas first
        const gas = await treasury.executePendingTaxBuyback.estimateGas();
        console.log("Estimated Gas:", gas.toString());

        const tx = await treasury.executePendingTaxBuyback({ gasLimit: 500000 });
        console.log("Tx Hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Manual Execution Successful!");
        console.log("Gas Used:", receipt.gasUsed.toString());

        // Check logs
        const parsedLogs = receipt.logs.map(log => {
            try { return treasury.interface.parseLog(log); } catch { return null; }
        }).filter(l => l);

        for (const log of parsedLogs) {
            console.log(`Event: ${log.name}`, log.args);
        }
    } catch (e) {
        console.error("❌ Execution Failed!");
        console.error(e);
    }
}

main().catch(console.error);
