const hre = require("hardhat");
const fs = require("fs");

/**
 * DreamSeeker 升级脚本 (添加 seekTruthBatch)
 * 
 * 用法:
 * npx hardhat run scripts/upgrade-seeker-batch.cjs --network bscTestnet
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("=".repeat(60));
    console.log("🆙  升级 DreamSeeker (Batch Seek Support)");
    console.log("执行账户:", deployer.address);

    // 1. 加载部署信息
    const deploymentPath = "./deploy/deployment-modular.json";
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("找不到 deployment-modular.json，请先部署合约。");
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const seekerProxyAddress = deploymentInfo.contracts.DreamSeeker;
    const coreAddress = deploymentInfo.contracts.CloudDreamCore;

    if (!seekerProxyAddress) {
        throw new Error("DreamSeeker 代理地址未找到");
    }

    // 2. 检查权限 (必须拥有 UPGRADER_ROLE)
    const CloudDreamCore = await hre.ethers.getContractAt("CloudDreamCore", coreAddress);
    const UPGRADER_ROLE = await CloudDreamCore.UPGRADER_ROLE();
    if (!await CloudDreamCore.hasRole(UPGRADER_ROLE, deployer.address)) {
        console.error("❌ 错误: 执行账户没有 UPGRADER_ROLE 权限，无法升级合约。");
        return;
    }
    console.log("✅ 权限检查通过 (UPGRADER_ROLE)");

    // 3. 准备新版本合约
    console.log(`\n正在准备升级 DreamSeeker...`);
    console.log(`Proxy Address: ${seekerProxyAddress}`);

    // 使用 openzeppelin upgrades 插件进行升级
    const DreamSeekerNew = await hre.ethers.getContractFactory("DreamSeeker");

    // 验证是否兼容 (可选，但推荐)
    console.log("正在验证合约升级兼容性...");
    await hre.upgrades.validateUpgrade(seekerProxyAddress, DreamSeekerNew);
    console.log("✅ 兼容性验证通过");

    // 4. 执行升级
    console.log("🚀 开始升级交易...");
    const upgraded = await hre.upgrades.upgradeProxy(seekerProxyAddress, DreamSeekerNew);
    await upgraded.waitForDeployment();

    console.log(`🎉 升级成功! DreamSeeker 已更新。`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
