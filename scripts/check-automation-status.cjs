const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const forwarder = await treasury.automationForwarder();

    console.log("Check Chainlink Status:");
    console.log("- Treasury:", treasuryAddr);
    console.log("- Forwarder:", forwarder);

    // Check pending
    const pending = await treasury.pendingTaxBuyback();
    const threshold = await treasury.minBuybackThreshold();
    const balance = await hre.ethers.provider.getBalance(treasuryAddr);

    console.log("- Treasury Balance:", hre.ethers.formatEther(balance), "BNB");
    console.log("- Pending Tax Buyback:", hre.ethers.formatEther(pending), "BNB");
    console.log("- Threshold:", hre.ethers.formatEther(threshold), "BNB");

    // Check recent logs
    console.log("\nRecent Buyback Executions (Last 100 blocks):");
    const logs = await hre.ethers.provider.getLogs({
        address: treasuryAddr,
        fromBlock: -100,
        topics: [treasury.interface.getEvent("BuybackExecuted").topicHash]
    });

    if (logs.length === 0) {
        console.log("  (No recent buybacks found)");
    }

    for (const log of logs) {
        const tx = await hre.ethers.provider.getTransaction(log.transactionHash);
        const parsed = treasury.interface.parseLog(log);

        let callerType = "UNKNOWN";
        if (tx.from.toLowerCase() === forwarder.toLowerCase()) {
            callerType = "✅ CHAINLINK AUTOMATION";
        } else if (tx.from.toLowerCase() === deployInfo.contracts.DreamSeeker.toLowerCase()) {
            // DreamSeeker 只是中转，真正的 from 是用户
            callerType = "👤 USER (PIGGYBACK)";
        } else {
            // 看是不是通过 Seeker 调用的（通常 Seeker 调用的 tx.to 是 Seeker）
            if (tx.to && tx.to.toLowerCase() === deployInfo.contracts.DreamSeeker.toLowerCase()) {
                callerType = "👤 USER (PIGGYBACK)";
            } else {
                callerType = "👤 USER / OPERATOR";
            }
        }

        console.log(`  [Block ${log.blockNumber}] Hash: ${log.transactionHash.slice(0, 10)}...`);
        console.log(`    Caller: ${tx.from} (${callerType})`);
        console.log(`    Spent: ${hre.ethers.formatEther(parsed.args[0])} BNB`);
        console.log(`    Got:   ${hre.ethers.formatEther(parsed.args[1])} WISH`);
    }
}
main().catch(console.error);
