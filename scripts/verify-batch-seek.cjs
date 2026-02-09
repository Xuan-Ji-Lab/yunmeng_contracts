const hre = require("hardhat");
const fs = require("fs");

/**
 * 验证 seekTruthBatch 功能的脚本
 * 
 * 用法:
 * npx hardhat run scripts/verify-batch-seek.cjs --network bscTestnet
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("=".repeat(60));
    console.log("🧪 验证 seekTruthBatch 功能");
    console.log("执行账户:", deployer.address);

    // 1. 加载部署信息
    const deploymentPath = "./deploy/deployment-modular.json";
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("找不到 deployment-modular.json");
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    const DreamSeeker = await hre.ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);

    // 2. 调用 seekTruthBatch
    const wishText = "Test Batch Seek";
    const batchCount = 3;
    console.log(`\n正在调用 seekTruthBatch("${wishText}", ${batchCount})...`);

    // 获取当前 seekCost
    const seekCost = await DreamSeeker.seekCost();
    const totalCost = seekCost * BigInt(batchCount);
    console.log(`Seek Cost: ${hre.ethers.formatEther(seekCost)} BNB`);
    console.log(`Total Cost: ${hre.ethers.formatEther(totalCost)} BNB`);

    // Send 1 wei to trigger "Paid Mode" logic (bypass Karma check), since seekCost is 0
    const tx = await DreamSeeker.seekTruthBatch(wishText, batchCount, { value: 1n });
    console.log(`交易已发送: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log("交易已确认 ✅");

    // 3. 检查事件
    // SeekRequestSent 事件应该被触发
    const event = receipt.logs.find(log => {
        try {
            const parsed = DreamSeeker.interface.parseLog(log);
            return parsed.name === "SeekRequestSent";
        } catch (e) {
            return false;
        }
    });

    if (event) {
        console.log("✅ 捕获到 SeekRequestSent 事件");
        const parsed = DreamSeeker.interface.parseLog(event);
        console.log(`   - Request ID: ${parsed.args.requestId}`);
        console.log(`   - User: ${parsed.args.user}`);
    } else {
        console.error("❌ 未捕获到 SeekRequestSent 事件");
    }

    console.log(`\n验证完成！请等待 Chainlink VRF 回调以生成 ${batchCount} 个结果。`);
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
