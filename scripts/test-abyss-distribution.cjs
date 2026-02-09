const hre = require("hardhat");
const fs = require("fs");

/**
 * 测试归墟分配逻辑
 * 临时设置 100% 归墟概率，触发一次，然后恢复原配置
 * 运行: npx hardhat run scripts/test-abyss-distribution.cjs --network bscTestnet
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("测试账户:", deployer.address);
    console.log("余额:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB\n");

    const deploymentPath = "./deploy/deployment-modular.json";
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const seekerAddr = deploymentInfo.contracts.DreamSeeker;
    const treasuryAddr = deploymentInfo.contracts.DreamTreasury;
    const wishTokenAddr = deploymentInfo.contracts.WishPowerToken;

    const seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddr, deployer);
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr, deployer);
    const wishToken = await hre.ethers.getContractAt("IERC20", wishTokenAddr, deployer);

    // 1. 记录当前状态
    console.log("=== 当前状态 ===");
    const currentThresholds = await seeker.tierThresholds(0);
    console.log("当前 Tier0 阈值:", currentThresholds.toString());

    const seekCost = await seeker.seekCost();
    console.log("SeekCost:", hre.ethers.formatEther(seekCost), "BNB");

    const treasuryBalance = await wishToken.balanceOf(treasuryAddr);
    console.log("Treasury WISH 余额:", hre.ethers.formatEther(treasuryBalance));

    const treasuryBNB = await hre.ethers.provider.getBalance(treasuryAddr);
    console.log("Treasury BNB 余额:", hre.ethers.formatEther(treasuryBNB));

    const myBalance = await wishToken.balanceOf(deployer.address);
    console.log("我的 WISH 余额 (前):", hre.ethers.formatEther(myBalance));

    // 2. 临时设置 100% 归墟概率 [1000, 1000, 1000, 1000] 即 Tier0 = 100%
    console.log("\n=== 设置 100% 归墟概率 ===");
    const tx1 = await seeker.setTierThresholds([1000, 1000, 1000, 1000]);
    await tx1.wait();
    console.log("✅ 已设置 100% 归墟概率");

    // 3. 触发 seekTruth
    console.log("\n=== 触发 seekTruth ===");
    try {
        const tx2 = await seeker.seekTruth("测试归墟分配", { value: seekCost });
        console.log("Tx Hash:", tx2.hash);
        const receipt = await tx2.wait();
        console.log("✅ seekTruth 成功，Gas used:", receipt.gasUsed.toString());

        // 解析事件
        for (const log of receipt.logs) {
            try {
                const parsed = seeker.interface.parseLog(log);
                if (parsed) {
                    console.log(`\n事件 ${parsed.name}:`, parsed.args);
                }
            } catch (e) {
                // Skip unparseable logs
            }
        }
    } catch (e) {
        console.error("❌ seekTruth 失败:", e.message);
    }

    // 4. 检查结果
    console.log("\n=== 分配结果 ===");
    const myBalanceAfter = await wishToken.balanceOf(deployer.address);
    console.log("我的 WISH 余额 (后):", hre.ethers.formatEther(myBalanceAfter));
    console.log("收到 WISH:", hre.ethers.formatEther(myBalanceAfter - myBalance));

    const treasuryBalanceAfter = await wishToken.balanceOf(treasuryAddr);
    console.log("Treasury WISH 余额 (后):", hre.ethers.formatEther(treasuryBalanceAfter));

    // 5. 注意: 不要立即恢复配置！
    // VRF 回调是异步的，大约需要 1-3 分钟
    // 回调完成后，手动运行以下命令恢复配置:
    // npx hardhat console --network bscTestnet
    // > const seeker = await ethers.getContractAt("DreamSeeker", "0xAA0930e9AB7b0580b4e7F6A7082FFa101Ca62a14")
    // > await seeker.setTierThresholds([1, 11, 41, 141])
    console.log("\n⚠️  注意: 当前概率仍为 100% 归墟！");
    console.log("等待 VRF 回调完成后，请手动恢复配置:");
    console.log("npx hardhat run scripts/restore-tier-config.cjs --network bscTestnet");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
