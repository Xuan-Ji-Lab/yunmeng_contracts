const hre = require("hardhat");

async function main() {
    const txHash = "0x10974467a6981512ad0fe5b7494732184c05b38e655e519bcfb4901af8fc1165";
    console.log(`Checking tx: ${txHash} on ${hre.network.name}...`);

    const provider = hre.ethers.provider;
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
        console.log("❌ Transaction not found in mempool or block.");
        return;
    }

    console.log("Tx found!");
    console.log("Block:", tx.blockNumber);
    console.log("From:", tx.from);
    console.log("To:", tx.to);
    console.log("Value:", hre.ethers.formatEther(tx.value), "BNB");

    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("⏳ Transaction pending...");
        return;
    }

    console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ REVERTED");
    console.log("Gas Used:", receipt.gasUsed.toString());

    if (receipt.status === 1) {
        console.log("\n--- Logs ---");
        // Try to decode logs if possible, but raw logs help too
        for (const log of receipt.logs) {
            console.log(`Log Address: ${log.address}`);
            console.log(`Topics: ${log.topics}`);
            // Check for SeekRequestSent (topic[0]) signature if we had it handy
            // For now just dump topics
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
