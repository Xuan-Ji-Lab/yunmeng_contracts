const hre = require("hardhat");
const fs = require("fs");

/**
 * 专门检查议题"10分钟后ETH会涨吗2"的详细信息
 * 模拟前端的数据加载流程
 */
async function main() {
    const deploymentPath = "deploy/deployment-modular.json";
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const oracleAddr = deployment.contracts.DreamOracle;

    console.log("=".repeat(60));
    console.log("检查议题数据结构 (模拟前端加载)");
    console.log("=".repeat(60));

    const oracle = await hre.ethers.getContractAt("DreamOracle", oracleAddr);
    const [signer] = await hre.ethers.getSigners();
    const myAddress = signer.address;

    // 获取最新议题
    const topicCount = await oracle.getTopicCount();
    const total = Number(topicCount);
    const topicId = await oracle.allTopicIds(total - 1); // 最新的一个

    console.log(`\n议题 ID: ${topicId}`);

    // 使用 getTopicDetails (模拟前端调用)
    const t = await oracle.getTopicDetails(topicId);

    console.log("\n[原始合约数据]");
    console.log("  title:", t.title);
    console.log("  optionLabels[0]:", t.optionLabels[0]);
    console.log("  optionLabels[1]:", t.optionLabels[1]);
    console.log("  endTime:", t.endTime.toString());
    console.log("  settled:", t.settled);
    console.log("  totalPool:", hre.ethers.formatEther(t.totalPool));
    console.log("  optionPools[0]:", hre.ethers.formatEther(t.optionPools[0]));
    console.log("  optionPools[1]:", hre.ethers.formatEther(t.optionPools[1]));

    // 模拟前端数据转换 (web3.tsx getTopic 函数)
    const frontendData = {
        id: topicId,
        totalPool: hre.ethers.formatEther(t.totalPool),
        optionPools: [
            hre.ethers.formatEther(t.optionPools[0]),
            hre.ethers.formatEther(t.optionPools[1])
        ],
        settled: t.settled,
        outcome: Number(t.outcome),
        endTime: Number(t.endTime),
        title: t.title,
        options: [t.optionLabels[0], t.optionLabels[1]]
    };

    console.log("\n[前端转换后的数据]");
    console.log(JSON.stringify(frontendData, null, 2));

    // 模拟用户点击"会"
    console.log("\n=".repeat(60));
    console.log("模拟用户点击选项");
    console.log("=".repeat(60));

    const clickedOption = "会"; // 用户点击的选项
    console.log(`\n用户点击: "${clickedOption}"`);
    console.log(`topic.options 数组:`, frontendData.options);

    // App.tsx 的 indexOf 逻辑
    const optionIndex = frontendData.options.indexOf(clickedOption);
    console.log(`\ntopic.options.indexOf("${clickedOption}") = ${optionIndex}`);

    if (optionIndex === -1) {
        console.log("\n❌ 问题发现!");
        console.log("   indexOf 返回 -1,说明选项文字不匹配!");
        console.log("\n可能原因:");
        console.log("  1. 选项文字包含空格或特殊字符");
        console.log("  2. 大小写不匹配");
        console.log("  3. 编码问题");

        console.log("\n详细比对:");
        frontendData.options.forEach((opt, idx) => {
            console.log(`  options[${idx}]: "${opt}"`);
            console.log(`    长度: ${opt.length}`);
            console.log(`    字符码:`, Array.from(opt).map(c => c.charCodeAt(0)));
            console.log(`    与 "${clickedOption}" 相等?`, opt === clickedOption);
        });
    } else {
        console.log(`\n✅ 匹配成功! optionIndex = ${optionIndex}`);
        console.log(`   将调用: placeBet("${topicId}", ${optionIndex}, amount)`);

        // 模拟合约调用
        console.log("\n尝试实际投注 0.01 BNB...");
        try {
            const tx = await oracle.placeBet(topicId, optionIndex, {
                value: hre.ethers.parseEther("0.01")
            });
            console.log("交易已发送:", tx.hash);
            const receipt = await tx.wait();
            console.log("✅ 投注成功! 区块:", receipt.blockNumber);
        } catch (error) {
            console.log("❌ 投注失败!");
            console.log("错误信息:", error.message);
            if (error.reason) console.log("失败原因:", error.reason);
        }
    }

    console.log("\n" + "=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ 执行出错:");
        console.error(error);
        process.exit(1);
    });
