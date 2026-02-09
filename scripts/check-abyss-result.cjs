const hre = require("hardhat");
const fs = require("fs");

/**
 * 查询归墟回调结果
 * 运行: npx hardhat run scripts/check-abyss-result.cjs --network bscTestnet
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("查询账户:", deployer.address);

    const deploymentPath = "./deploy/deployment-modular.json";
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const seekerAddr = deploymentInfo.contracts.DreamSeeker;
    const treasuryAddr = deploymentInfo.contracts.DreamTreasury;
    const wishTokenAddr = deploymentInfo.contracts.WishPowerToken;

    const seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddr, deployer);
    const wishToken = await hre.ethers.getContractAt("IERC20", wishTokenAddr, deployer);

    // 1. 查询余额
    console.log("\n=== 当前余额 ===");
    const myBalance = await wishToken.balanceOf(deployer.address);
    console.log("我的 WISH 余额:", hre.ethers.formatEther(myBalance));

    const treasuryBalance = await wishToken.balanceOf(treasuryAddr);
    console.log("Treasury WISH 余额:", hre.ethers.formatEther(treasuryBalance));

    // 2. 查询归墟状态
    console.log("\n=== 归墟系统状态 ===");
    const totalAbyssHolders = await seeker.totalAbyssHolders();
    console.log("归墟持有者总数:", totalAbyssHolders.toString());

    const totalAbyssTribulations = await seeker.totalAbyssTribulations();
    console.log("归墟总劫数:", totalAbyssTribulations.toString());

    const isHolder = await seeker.isAbyssHolder(deployer.address);
    console.log("我是否为归墟持有者:", isHolder);

    // 3. 查询分红信息
    console.log("\n=== 分红系统状态 ===");
    const dividendPerShare = await seeker.dividendPerShareToken();
    console.log("每份分红累计:", hre.ethers.formatEther(dividendPerShare));

    const totalAllocated = await seeker.totalDividendsAllocated();
    console.log("已分配分红总额:", hre.ethers.formatEther(totalAllocated));

    const totalClaimed = await seeker.totalDividendsClaimed();
    console.log("已领取分红总额:", hre.ethers.formatEther(totalClaimed));

    // 4. 查询最近的 SeekResult 事件
    console.log("\n=== 最近 SeekResult 事件 (最近 100 区块) ===");
    const currentBlock = await hre.ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 100;

    const filter = seeker.filters.SeekResult();
    const events = await seeker.queryFilter(filter, fromBlock, currentBlock);

    if (events.length === 0) {
        console.log("无最近事件");
    } else {
        for (const event of events.slice(-5)) { // 最近 5 条
            console.log(`\n区块 ${event.blockNumber}:`);
            console.log(`  用户: ${event.args[0]}`);
            console.log(`  Tier: ${event.args[1]}`);
            console.log(`  奖励: ${hre.ethers.formatEther(event.args[2])} WISH`);
            console.log(`  愿望: ${event.args[3]}`);
        }
    }

    // 5. 查询 AbyssTriggered 事件
    console.log("\n=== 最近 AbyssTriggered 事件 ===");
    const abyssFilter = seeker.filters.AbyssTriggered();
    const abyssEvents = await seeker.queryFilter(abyssFilter, fromBlock, currentBlock);

    if (abyssEvents.length === 0) {
        console.log("无归墟触发事件 (可能 VRF 回调还未到达)");
    } else {
        for (const event of abyssEvents.slice(-5)) {
            console.log(`\n区块 ${event.blockNumber}:`);
            console.log(`  用户: ${event.args[0]}`);
            console.log(`  是否终局: ${event.args[1]}`);
            console.log(`  劫数: ${event.args[2]}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
