const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🎲 Testing Live VRF Probabilities (100 Runs)...");

    // 1. Load Deployment
    const deploymentPath = path.join(__dirname, "../../ethereal-realm/src/deployment-modular.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    // 2. Contracts
    const Seeker = await ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);
    // Needed to listen for Chainlink callback events if we want strict verification, 
    // but Seeker emits `SeekRequestSent` and `SeekResult`.

    const [deployer] = await ethers.getSigners();
    console.log(`Tester: ${deployer.address}`);

    // 3. Initiate Seek Request (Batch 10 * 10 times)
    const BATCH_SIZE = 10;
    const TX_COUNT = 10;
    const TOTAL_WISHES = BATCH_SIZE * TX_COUNT;

    // Check Config
    const seekCost = await Seeker.seekCost();
    // Batch cost = seekCost * batchSize
    const batchCost = seekCost * BigInt(BATCH_SIZE);

    console.log(`Seek Cost Per Wish: ${ethers.formatEther(seekCost)} BNB`);
    console.log(`Batch Cost (10): ${ethers.formatEther(batchCost)} BNB`);
    console.log(`Total Wishes: ${TOTAL_WISHES}`);

    // Store Request IDs to track
    const requestIds = [];

    console.log("\n--- sending Transactions ---");

    for (let i = 0; i < TX_COUNT; i++) {
        process.stdout.write(`Sending Batch ${i + 1}/${TX_COUNT}... `);
        try {
            const tx = await Seeker.seekTruthBatch(`VRF Test Batch ${i + 1}`, BATCH_SIZE, { value: batchCost });
            const rc = await tx.wait();

            const event = rc.logs.find(x => x.fragment && x.fragment.name === 'SeekRequestSent');
            if (event) {
                const reqId = event.args[0];
                requestIds.push(reqId);
                console.log(`✅ ReqID: ${reqId}`);
            } else {
                console.log(`❌ No Event`);
            }
        } catch (e) {
            console.log(`❌ Failed: ${e.message}`);
        }
    }

    console.log(`\n✅ Sent ${requestIds.length} Requests. Waiting for results...`);

    // 4. Listen for Results
    // We will collect results until we have (Requests * BatchSize) results or timeout
    const results = {
        tier0: 0, // Guixu (0.1%)
        tier1: 0, // Divine (1%)
        tier2: 0, // Ethereal (3%)
        tier3: 0, // Rare (10%)
        tier4: 0, // Common (85.9%)
    };

    let receivedCount = 0;
    // Filter all SeekResult events from now? Or from block of first tx? (Simpler to just listen)
    // Actually, we can just queryLogs since the first block of this run

    console.log("⏳ Polling for results (Max 5 mins)...");

    const startBlock = await ethers.provider.getBlockNumber() - 50; // Look back a bit

    const startTime = Date.now();
    while (Date.now() - startTime < 300000) { // 5 mins
        // Query Logs
        const filter = Seeker.filters.SeekResult(deployer.address);
        const logs = await Seeker.queryFilter(filter, startBlock);

        // Filter logs that match our Batch Text pattern or just count recent ones
        const relevantLogs = logs.filter(l => l.args[3].startsWith("VRF Test Batch"));

        // Reset counts and recount (in case of overlap or updates)
        results.tier0 = 0;
        results.tier1 = 0;
        results.tier2 = 0;
        results.tier3 = 0;
        results.tier4 = 0;
        receivedCount = relevantLogs.length;

        for (const log of relevantLogs) {
            const tier = Number(log.args[1]);
            if (tier === 0) results.tier0++;
            else if (tier === 1) results.tier1++;
            else if (tier === 2) results.tier2++;
            else if (tier === 3) results.tier3++;
            else results.tier4++;
        }

        process.stdout.write(`\rReceived: ${receivedCount}/${TOTAL_WISHES} | T0:${results.tier0} T1:${results.tier1} T2:${results.tier2} T3:${results.tier3} T4:${results.tier4}`);

        if (receivedCount >= TOTAL_WISHES) {
            console.log("\n\n✅ All results received!");
            break;
        }

        await new Promise(r => setTimeout(r, 5000));
    }

    // 5. Final Report
    console.log("\n--- 📊 Probability Report (100 Runs) ---");
    console.log(`Total Runs: ${receivedCount}`);
    console.log(`Tier 0 (Guixu - 0.1%):   ${results.tier0} (${(results.tier0 / receivedCount * 100).toFixed(1)}%)`);
    console.log(`Tier 1 (Divine - 1.0%):  ${results.tier1} (${(results.tier1 / receivedCount * 100).toFixed(1)}%)`);
    console.log(`Tier 2 (Ether - 3.0%):   ${results.tier2} (${(results.tier2 / receivedCount * 100).toFixed(1)}%)`);
    console.log(`Tier 3 (Rare - 10.0%):   ${results.tier3} (${(results.tier3 / receivedCount * 100).toFixed(1)}%)`);
    console.log(`Tier 4 (Common - 85.9%): ${results.tier4} (${(results.tier4 / receivedCount * 100).toFixed(1)}%)`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
