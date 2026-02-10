/**
 * 分析归墟奖励分配详情
 */
const hre = require("hardhat");
const d = require('../deploy/deployment-modular.json');

async function main() {
    const seeker = await hre.ethers.getContractAt("DreamSeeker", d.contracts.DreamSeeker);
    const treasury = await hre.ethers.getContractAt("DreamTreasury", d.contracts.DreamTreasury);
    const token = await hre.ethers.getContractAt("WishPowerToken", d.contracts.WishPowerToken);

    // 1. 国库 WISH 余额
    const treasuryWish = await token.balanceOf(d.contracts.DreamTreasury);
    console.log("=== 当前状态 ===");
    console.log("国库 WISH 余额:", hre.ethers.formatEther(treasuryWish));

    // 2. 分红相关
    const totalAllocated = await seeker.totalDividendsAllocated();
    const totalClaimed = await seeker.totalDividendsClaimed();
    const unclaimed = totalAllocated - totalClaimed;
    console.log("已分配分红 (Allocated):", hre.ethers.formatEther(totalAllocated));
    console.log("已领取分红 (Claimed):", hre.ethers.formatEther(totalClaimed));
    console.log("未领取分红 (Unclaimed):", hre.ethers.formatEther(unclaimed));

    // 3. netPool 计算
    const netPool = treasuryWish > unclaimed ? treasuryWish - unclaimed : 0n;
    console.log("\nnetPool (国库-未领取):", hre.ethers.formatEther(netPool));
    console.log("  → 50% Winner:", hre.ethers.formatEther(netPool * 50n / 100n));
    console.log("  → 30% Dividend:", hre.ethers.formatEther(netPool * 30n / 100n));
    console.log("  → 20% 滚存:", hre.ethers.formatEther(netPool * 20n / 100n));

    // 4. 归墟持有者
    const holders = await seeker.totalAbyssHolders();
    const totalAbyss = await seeker.totalAbyssTribulations();
    console.log("\n归墟持有者:", holders.toString());
    console.log("归墟总次数:", totalAbyss.toString());

    // 5. 配置参数
    const winnerRatio = await seeker.abyssWinnerRatio();
    const dividendRatio = await seeker.abyssDividendRatio();
    console.log("\n分配比例: Winner", winnerRatio.toString() + "%, Dividend", dividendRatio.toString() + "%");

    // 6. 查最近归墟事件的 reward
    const filter = seeker.filters.SeekResult();
    const events = await seeker.queryFilter(filter, -5000);
    const abyssEvents = events.filter(e => Number(e.args[1]) === 0); // tier=0
    console.log("\n=== 归墟事件记录 ===");
    for (const e of abyssEvents) {
        console.log(`  文本: ${e.args[3]} | Reward (50% winner): ${hre.ethers.formatEther(e.args[2])} WISH`);
    }

    // 7. 用户可领取分红
    const user = "0xB7Ac35615C4B82b430B98fAdC91e257980A21d77";
    const dividendPerShare = await seeker.dividendPerShareToken();
    const xDividend = await seeker.xDividendPerShareToken(user);
    const userPending = (dividendPerShare - xDividend) / BigInt(1e18);
    console.log("\n=== 你的分红情况 ===");
    console.log("dividendPerShareToken:", hre.ethers.formatEther(dividendPerShare));
    console.log("你的 xDividendPerShareToken:", hre.ethers.formatEther(xDividend));
    console.log("你的待领分红:", userPending.toString(), "WISH");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
