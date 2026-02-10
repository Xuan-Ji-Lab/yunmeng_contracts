const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const [signer] = await hre.ethers.getSigners();

    const treasuryAddress = deploymentInfo.contracts.DreamTreasury;
    const tokenAddress = deploymentInfo.contracts.WishPowerToken;
    const seekerAddress = deploymentInfo.contracts.DreamSeeker;

    const token = new hre.ethers.Contract(tokenAddress, [
        "function balanceOf(address) view returns (uint256)"
    ], signer);

    const seeker = new hre.ethers.Contract(seekerAddress, [
        "function seekTruth(string) payable",
        "function seekCost() view returns (uint256)",
        "event SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText)",
        "event AbyssTriggered(address indexed user, bool isGrandFinale, uint256 tribulationCount)",
        "event DividendDistributed(address indexed holder, uint256 amount, uint256 shares, uint256 round, uint256 pool)"
    ], signer);

    const seekCost = await seeker.seekCost();
    console.log("=== 祈愿前后奖池对比测试 ===");
    console.log("Signer:", signer.address);
    console.log("Seek Cost:", hre.ethers.formatEther(seekCost), "BNB");

    const ROUNDS = 5; // 祈愿次数

    for (let i = 0; i < ROUNDS; i++) {
        // 祈愿前 查余额
        const balBefore = await token.balanceOf(treasuryAddress);
        const beforeStr = parseFloat(hre.ethers.formatEther(balBefore)).toLocaleString();

        console.log(`\n--- 第 ${i + 1} 次祈愿 ---`);
        console.log(`  [前] 奖池: ${beforeStr} WISH`);

        // 祈愿
        try {
            const tx = await seeker.seekTruth("测试奖池变化", { value: seekCost });
            const receipt = await tx.wait();

            // 检查事件
            for (const log of receipt.logs) {
                try {
                    const parsed = seeker.interface.parseLog(log);
                    if (parsed && parsed.name === 'SeekResult') {
                        const tier = Number(parsed.args[1]);
                        const reward = hre.ethers.formatEther(parsed.args[2]);
                        const tierNames = ['归墟⚡', '传说', '史诗', '稀有', '普通'];
                        console.log(`  [结果] ${tierNames[tier] || tier}, 奖励: ${reward} WISH`);
                    }
                    if (parsed && parsed.name === 'AbyssTriggered') {
                        console.log(`  ⚡⚡⚡ 归墟触发! 第 ${parsed.args[2]} 期 ⚡⚡⚡`);
                    }
                    if (parsed && parsed.name === 'DividendDistributed') {
                        console.log(`  💰 分红: ${hre.ethers.formatEther(parsed.args[1])} WISH → ${parsed.args[0].slice(0, 10)}...`);
                    }
                } catch (e) { }
            }
        } catch (e) {
            console.log(`  ❌ 祈愿失败:`, e.message?.slice(0, 100));
        }

        // 祈愿后 查余额
        const balAfter = await token.balanceOf(treasuryAddress);
        const afterStr = parseFloat(hre.ethers.formatEther(balAfter)).toLocaleString();
        const diff = balAfter - balBefore;
        const diffStr = parseFloat(hre.ethers.formatEther(diff >= 0n ? diff : -diff)).toLocaleString();

        console.log(`  [后] 奖池: ${afterStr} WISH`);
        console.log(`  [变化] ${diff >= 0n ? '+' : '-'}${diffStr} WISH`);
    }

    console.log("\n=== 完成 ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
