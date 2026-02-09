const hre = require("hardhat");
const fs = require("fs");

/**
 * 将 DreamSeeker 的 seekCost 设置为 0 的脚本
 * 
 * 用法:
 * npx hardhat run scripts/set-seek-cost-zero.cjs --network bscTestnet
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("=".repeat(60));
    console.log("🛠  将寻真费用 (Seek Cost) 设置为 0");
    console.log("执行账户:", deployer.address);

    // 1. 加载部署信息
    const deploymentPath = "./deploy/deployment-modular.json";
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("找不到 deployment-modular.json，请先部署合约。");
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    // 2. 连接合约实例
    const DreamSeeker = await hre.ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);
    // CloudDreamCore 用于检查权限
    const CloudDreamCore = await hre.ethers.getContractAt("CloudDreamCore", contracts.CloudDreamCore);

    // 3. 检查权限 (必须拥有 CONFIG_ROLE)
    const CONFIG_ROLE = await CloudDreamCore.CONFIG_ROLE();
    if (!await CloudDreamCore.hasRole(CONFIG_ROLE, deployer.address)) {
        console.error("❌ 错误: 执行账户没有 CONFIG_ROLE 权限，无法修改参数。");
        return;
    }
    console.log("✅ 权限检查通过 (CONFIG_ROLE)");

    // 4. 获取当前参数
    console.log("🔄 正在读取当前参数...");
    const currentSeekCost = await DreamSeeker.seekCost();
    const currentKarmaCost = await DreamSeeker.karmaCost();
    const currentPityBase = await DreamSeeker.pityBase();
    const currentPityThreshold = await DreamSeeker.pityThreshold();

    console.log(`   - 当前 seekCost: ${hre.ethers.formatEther(currentSeekCost)} BNB`);
    console.log(`   - 当前 karmaCost: ${currentKarmaCost}`);

    if (currentSeekCost == 0) {
        console.log("⚠️ seekCost 已经是 0 了，无需修改。");
        return;
    }

    // 5. 设置 seekCost 为 0
    console.log("\n🔄 正在将 seekCost 设置为 0...");
    const tx = await DreamSeeker.setSeekConfig(
        0, // seekCost -> 0
        currentKarmaCost,
        currentPityBase,
        currentPityThreshold
    );
    console.log(`   - 交易已发送: ${tx.hash}`);
    await tx.wait();
    console.log("   - 交易已确认 ✅");

    // 6. 验证
    const newSeekCost = await DreamSeeker.seekCost();
    console.log(`\n🔍 验证结果: seekCost = ${hre.ethers.formatEther(newSeekCost)} BNB`);

    if (newSeekCost == 0) {
        console.log("🎉 成功！");
    } else {
        console.error("❌ 失败：seekCost 仍然不为 0");
    }
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
