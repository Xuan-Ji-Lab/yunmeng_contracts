const hre = require("hardhat");
const fs = require("fs");

/**
 * 恢复概率配置
 * 运行: npx hardhat run scripts/restore-tier-config.cjs --network bscTestnet
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("操作账户:", deployer.address);

    const deploymentPath = "./deploy/deployment-modular.json";
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const seekerAddr = deploymentInfo.contracts.DreamSeeker;

    const seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddr, deployer);

    console.log("\n恢复原概率配置 [1, 11, 41, 141]...");
    const tx = await seeker.setTierThresholds([1, 11, 41, 141]);
    await tx.wait();
    console.log("✅ 已恢复原概率配置！");

    // 验证
    const t0 = await seeker.tierThresholds(0);
    const t1 = await seeker.tierThresholds(1);
    const t2 = await seeker.tierThresholds(2);
    const t3 = await seeker.tierThresholds(3);
    console.log(`当前阈值: [${t0}, ${t1}, ${t2}, ${t3}]`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
