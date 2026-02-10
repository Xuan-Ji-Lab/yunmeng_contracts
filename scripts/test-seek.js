/**
 * 测试脚本：发起一次祈愿 (seekTruth)
 * 
 * 用法: npx hardhat run scripts/test-seek.js --network bscTestnet
 */

const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("🔧 Using account:", signer.address);

    const DreamSeeker = await hre.ethers.getContractAt(
        "DreamSeeker",
        deploymentInfo.contracts.DreamSeeker
    );

    const seekCost = await DreamSeeker.seekCost();
    console.log("💰 寻真费用:", hre.ethers.formatEther(seekCost), "BNB");

    console.log("\n🙏 发起祈愿...");
    const tx = await DreamSeeker.seekTruth("测试归墟", { value: seekCost });
    console.log("   交易哈希:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ 交易确认! Gas:", receipt.gasUsed.toString());

    // 解析事件
    for (const log of receipt.logs) {
        try {
            const parsed = DreamSeeker.interface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "SeekResult") {
                console.log("\n🎯 SeekResult 事件:");
                console.log("   用户:", parsed.args.user);
                console.log("   等级 (Tier):", parsed.args.tier.toString());
                console.log("   奖励:", hre.ethers.formatEther(parsed.args.prizeAmount), "BNB");

                const tierNames = ["神品·归墟", "传说·叠嶂", "史诗·怒涛", "稀有·惊鸿", "凡品·微澜"];
                console.log("   品级:", tierNames[Number(parsed.args.tier)] || "未知");
            }
        } catch (e) {
            // 跳过无法解析的事件
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
