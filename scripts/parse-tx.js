/**
 * 解析指定交易的所有事件
 */
const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const tx = "0x5cef00cbcb851a982846d62cabe55316bc6afd428c942fc93e7631041e28c5d2";
    const receipt = await hre.ethers.provider.getTransactionReceipt(tx);

    const DreamSeeker = await hre.ethers.getContractAt("DreamSeeker", deploymentInfo.contracts.DreamSeeker);

    console.log(`交易状态: ${receipt.status === 1 ? '✅ 成功' : '❌ 失败'}`);
    console.log(`日志数: ${receipt.logs.length}\n`);

    const seekerAddr = (await DreamSeeker.getAddress()).toLowerCase();

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === seekerAddr) {
            try {
                const parsed = DreamSeeker.interface.parseLog({ topics: log.topics, data: log.data });
                if (parsed) {
                    console.log(`📌 DreamSeeker 事件: ${parsed.name}`);
                    if (parsed.name === "SeekResult") {
                        const tierNames = ["神品·归墟", "传说·叠嶂", "史诗·怒涛", "稀有·惊鸿", "凡品·微澜"];
                        console.log(`   用户: ${parsed.args[0]}`);
                        console.log(`   等级: Tier ${parsed.args[3]} (${tierNames[Number(parsed.args[3])] || '?'})`);
                        console.log(`   奖励: ${hre.ethers.formatEther(parsed.args[4])} BNB`);
                    } else {
                        console.log(`   Args:`, parsed.args.map(a => a.toString()));
                    }
                }
            } catch (e) {
                console.log(`⚠️  DreamSeeker 未知事件: topic0=${log.topics[0].slice(0, 18)}...`);
            }
        }
    }

    // 检查最近的祈愿记录
    console.log("\n📜 查询链上最新祈愿记录...");
    const wishCount = await DreamSeeker.wishRecordCount();
    console.log(`   总记录数: ${wishCount}`);

    if (wishCount > 0n) {
        const latest = await DreamSeeker.wishRecords(wishCount - 1n);
        const tierNames = ["神品·归墟", "传说·叠嶂", "史诗·怒涛", "稀有·惊鸿", "凡品·微澜"];
        console.log(`   最新记录:`);
        console.log(`     ID: ${latest.id}`);
        console.log(`     用户: ${latest.user}`);
        console.log(`     文本: ${latest.wishText}`);
        console.log(`     等级: Tier ${latest.tier} (${tierNames[Number(latest.tier)] || '?'})`);
        console.log(`     奖励: ${hre.ethers.formatEther(latest.prizeAmount)} BNB`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
