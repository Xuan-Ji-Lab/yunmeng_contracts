/**
 * 临时脚本：将归墟概率设置为 100% (测试用)
 * 
 * 用法: npx hardhat run scripts/set-abyss-100.js --network bscTestnet
 * 
 * 原始概率: [1, 11, 41, 141] (归墟 0.1%)
 * 测试概率: [1000, 1000, 1000, 1000] (归墟 100%)
 */

const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("🔧 Using account:", signer.address);

    // 加载 DreamSeeker 合约
    const DreamSeeker = await hre.ethers.getContractAt(
        "DreamSeeker",
        deploymentInfo.contracts.DreamSeeker
    );

    console.log("📍 DreamSeeker Address:", await DreamSeeker.getAddress());

    // 设置为 100% 归墟
    // tierThresholds 逻辑: rng % 1000, 如果 rng < tierThresholds[0] 则触发 Tier 0 (归墟)
    // 所以设置 [1000, 1000, 1000, 1000] 意味着所有随机数都会 < 1000，100% 触发归墟
    const testThresholds = [1000, 1000, 1000, 1000];

    console.log("\n⚙️  设置测试概率...");
    console.log("   原概率: [1, 11, 41, 141] (归墟 0.1%)");
    console.log("   新概率:", testThresholds, "(归墟 100%)");

    const tx = await DreamSeeker.setTierThresholds(testThresholds);
    console.log("   交易哈希:", tx.hash);

    await tx.wait();
    console.log("✅ 设置成功！");

    // 验证
    const currentThresholds = await DreamSeeker.tierThresholds(0);
    console.log("\n📊 当前配置确认:");
    console.log("   tierThresholds[0] (归墟):", currentThresholds.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
