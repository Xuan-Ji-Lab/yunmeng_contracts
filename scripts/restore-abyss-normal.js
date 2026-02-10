/**
 * 恢复脚本：将归墟概率恢复为正常值 0.1%
 * 
 * 用法: npx hardhat run scripts/restore-abyss-normal.js --network bscTestnet
 * 
 * 恢复为: [1, 11, 41, 141] (归墟 0.1%)
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

    // 恢复为原始概率
    const normalThresholds = [1, 11, 41, 141]; // 归墟 0.1%, 稀有 1%, 史诗 3%, 传说 10%

    console.log("\n⚙️  恢复正常概率...");
    console.log("   恢复为:", normalThresholds, "(归墟 0.1%)");

    const tx = await DreamSeeker.setTierThresholds(normalThresholds);
    console.log("   交易哈希:", tx.hash);

    await tx.wait();
    console.log("✅ 恢复成功！");

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
