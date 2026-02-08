const hre = require("hardhat");
const fs = require("fs");

/**
 * 调试脚本:检查 Oracle 议题状态和用户投注记录
 * 用于排查投注失败的原因
 */
async function main() {
    const deploymentPath = "deploy/deployment-modular.json";
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const oracleAddr = deployment.contracts.DreamOracle;

    console.log("=".repeat(60));
    console.log("Oracle 议题状态调试");
    console.log("=".repeat(60));
    console.log("Oracle 合约地址:", oracleAddr);
    console.log();

    const oracle = await hre.ethers.getContractAt("DreamOracle", oracleAddr);
    const [signer] = await hre.ethers.getSigners();
    const myAddress = signer.address;

    console.log("当前账户:", myAddress);
    console.log();

    // 1. 获取所有议题
    const topicCount = await oracle.getTopicCount();
    console.log(`总议题数: ${topicCount}`);
    console.log();

    if (topicCount === 0n) {
        console.log("❌ 没有任何议题,无法投注");
        return;
    }

    // 2. 遍历最近的议题
    const total = Number(topicCount);
    const start = Math.max(0, total - 5); // 最近5个

    console.log(`检查最近 ${total - start} 个议题:`);
    console.log("-".repeat(60));

    for (let i = start; i < total; i++) {
        const topicId = await oracle.allTopicIds(i);
        const topic = await oracle.getTopicDetails(topicId);

        console.log(`\n[${i + 1}/${total}] 议题 ID: ${topicId}`);
        console.log(`  标题: ${topic.title}`);
        console.log(`  选项A: ${topic.optionLabels[0]}`);
        console.log(`  选项B: ${topic.optionLabels[1]}`);

        // 检查时间状态
        const now = Math.floor(Date.now() / 1000);
        const endTime = Number(topic.endTime);

        console.log(`  截止时间: ${endTime} (${new Date(endTime * 1000).toLocaleString('zh-CN')})`);
        console.log(`  当前时间: ${now} (${new Date(now * 1000).toLocaleString('zh-CN')})`);

        if (endTime === 0) {
            console.log(`  ⚠️  状态: 未设置截止时间!`);
        } else if (now >= endTime) {
            console.log(`  ⚠️  状态: 已截止 (${Math.floor((now - endTime) / 60)}分钟前)`);
        } else {
            const remainSec = endTime - now;
            console.log(`  ✅ 状态: 进行中 (剩余 ${Math.floor(remainSec / 60)}分${remainSec % 60}秒)`);
        }

        console.log(`  已结算: ${topic.settled}`);
        console.log(`  总池: ${hre.ethers.formatEther(topic.totalPool)} BNB`);
        console.log(`  选项A池: ${hre.ethers.formatEther(topic.optionPools[0])} BNB`);
        console.log(`  选项B池: ${hre.ethers.formatEther(topic.optionPools[1])} BNB`);

        // 检查用户是否已投注
        const userBetA = await oracle.userBets(topicId, myAddress, 0);
        const userBetB = await oracle.userBets(topicId, myAddress, 1);

        console.log(`  你的投注A: ${hre.ethers.formatEther(userBetA)} BNB`);
        console.log(`  你的投注B: ${hre.ethers.formatEther(userBetB)} BNB`);

        if (userBetA > 0n || userBetB > 0n) {
            console.log(`  ⚠️  你已经在此议题投注过!`);
        } else {
            console.log(`  ✅ 你尚未参与此议题`);
        }

        // 模拟投注检查
        console.log(`\n  📝 投注检查:`);
        if (endTime === 0) {
            console.log(`     ❌ 无法投注: 议题未设置截止时间`);
        } else if (now >= endTime) {
            console.log(`     ❌ 无法投注: 投注已截止`);
        } else if (userBetA > 0n || userBetB > 0n) {
            console.log(`     ❌ 无法投注: 已参与该议题`);
        } else {
            console.log(`     ✅ 可以投注`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("调试完成");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ 执行出错:");
        console.error(error);
        process.exit(1);
    });
