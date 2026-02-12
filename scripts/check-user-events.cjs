const hre = require("hardhat");

async function main() {
    const userAddress = "0x193575b640ccd6c079ce01aebc75190f13c6b22c";
    const startBlock = 46580000; // Approximate block, usually fetch from tx
    // Let's get the exact block of the request first
    const txHash = "0x10974467a6981512ad0fe5b7494732184c05b38e655e519bcfb4901af8fc1165";
    const provider = hre.ethers.provider;
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
        console.log("Tx not found");
        return;
    }

    console.log(`Checking events for user ${userAddress} from block ${tx.blockNumber}...`);

    const deployPath = "deploy/deployment-modular.json";
    const fs = require("fs");
    const deployInfo = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = deployInfo.contracts.DreamSeeker;
    const DreamSeeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddress);

    // Filter SeekResult
    // event SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText);
    const filter = DreamSeeker.filters.SeekResult(userAddress);
    const logs = await DreamSeeker.queryFilter(filter, tx.blockNumber, "latest");

    console.log(`Found ${logs.length} SeekResult events.`);

    for (const log of logs) {
        console.log(`Block: ${log.blockNumber} | Tx: ${log.transactionHash}`);
        console.log(`  Tier: ${log.args[1]}`);
        console.log(`  Reward: ${hre.ethers.formatEther(log.args[2])} BNB`);
        console.log(`  Wish: ${log.args[3]}`);
    }

    // Filter PayoutFailed
    // event PayoutFailed(address indexed user, uint256 amount, string reason);
    const failFilter = DreamSeeker.filters.PayoutFailed(userAddress);
    const failLogs = await DreamSeeker.queryFilter(failFilter, tx.blockNumber, "latest");

    console.log(`Found ${failLogs.length} PayoutFailed events.`);
    for (const log of failLogs) {
        console.log(`Block: ${log.blockNumber} | Tx: ${log.transactionHash}`);
        console.log(`  Reason: ${log.args[2]}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
