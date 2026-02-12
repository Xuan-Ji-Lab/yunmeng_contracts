const hre = require("hardhat");

async function main() {
    const txHash = "0xbefac41725e5f09a0d596b5111a4923855eb36b4e6e22c8a3c5715328e3c268a";
    console.log(`Analyzing transaction: ${txHash}`);

    const provider = hre.ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("❌ Transaction receipt not found.");
        return;
    }

    console.log(`Status: ${receipt.status === 1 ? "✅ Success" : "❌ Reverted"}`);

    // Print Raw Logs
    console.log("\n--- Raw Logs ---");
    receipt.logs.forEach((log, i) => {
        console.log(`Log #${i} Address: ${log.address}`);
        console.log(`Topics: ${log.topics}`);
        console.log(`Data: ${log.data}`);
    });
}

main().catch(console.error);
