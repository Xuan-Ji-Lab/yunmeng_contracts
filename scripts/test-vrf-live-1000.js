const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🎲 Testing Live VRF Probabilities (1000 Runs)...");
    console.log("⚠️  Warning: This will take significant time (10-15 mins) and send 100 transactions.");

    // 1. Load Deployment
    const deploymentPath = path.join(__dirname, "../../ethereal-realm/src/deployment-modular.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    const Seeker = await ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);
    const [deployer] = await ethers.getSigners();
    console.log(`Tester: ${deployer.address}`);

    // 2. Save Original Config & Set Cost to 0
    console.log("\n--- Configuring for Test ---");
    const originalSeekCost = await Seeker.seekCost();
    const originalKarmaCost = await Seeker.karmaCost();
    const originalPityBase = await Seeker.pityBase();
    const originalPityThreshold = await Seeker.pityThreshold();

    console.log(`Original Cost: ${ethers.formatEther(originalSeekCost)} BNB`);

    if (originalSeekCost > 0n) {
        console.log("Setting Seek Cost to 0 for bulk testing...");
        const txConfig = await Seeker.setSeekConfig(
            0,
            originalKarmaCost,
            originalPityBase,
            originalPityThreshold
        );
        await txConfig.wait();
        console.log("✅ Config Updated: Cost = 0");
    }

    // 3. Initiate Seek Request (Batch 10 * 100 times)
    const BATCH_SIZE = 10;
    const CALL_COUNT = 100; // 100 calls * 10 = 1000 total
    const TOTAL_WISHES = BATCH_SIZE * CALL_COUNT;

    // We send 1 wei to force "Paid Mode" (msg.value > 0) in seekTruthBatch
    // because totalCost is 0.
    const TEST_VALUE = 1n;

    console.log(`\n--- Sending ${CALL_COUNT} Transactions (Total ${TOTAL_WISHES} Wishes) ---`);

    // Track counts
    let sentCount = 0;

    for (let i = 0; i < CALL_COUNT; i++) {
        try {
            // Add slight delay to avoid nonce issues or rate limits
            if (i % 10 === 0 && i > 0) process.stdout.write(`\nSent ${i}... `);

            // Send Batch
            const tx = await Seeker.seekTruthBatch(
                `VRF_1000_${i}`,
                BATCH_SIZE,
                { value: TEST_VALUE }
            );
            // We don't await wait() for every single one to speed up submission? 
            // No, nonce management requires us to wait or manage nonces manually. 
            // Awaiting is safer for nonce.
            await tx.wait();
            process.stdout.write(".");
            sentCount++;
        } catch (e) {
            console.log(`\n❌ Tx ${i} Failed: ${e.message}`);
            // Retry once?
            try {
                await new Promise(r => setTimeout(r, 2000));
                const tx = await Seeker.seekTruthBatch(`VRF_1000_${i}_RETRY`, BATCH_SIZE, { value: TEST_VALUE });
                await tx.wait();
                process.stdout.write("r");
                sentCount++;
            } catch (retryE) {
                console.log("Retry Failed.");
            }
        }
    }

    console.log(`\n✅ Sent ${sentCount} Transactions.`);

    // 4. Poll Results
    console.log("\n⏳ Collecting Results (Polling 2000 blocks)...");

    const results = { tier0: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0 };

    // Look back 2000 blocks (~3 hours) just to be safe, or just since we started.
    // Ideally we track the block number where we started.
    const startBlock = await ethers.provider.getBlockNumber() - (sentCount * 2);

    // We'll just do one big query at the end after waiting a bit
    console.log("Waiting 2 minutes for VRF to catch up...");
    await new Promise(r => setTimeout(r, 120000));

    const filter = Seeker.filters.SeekResult(deployer.address);
    const logs = await Seeker.queryFilter(filter, startBlock);

    // Filter for our test signature
    const testLogs = logs.filter(l => l.args[3].startsWith("VRF_1000_"));

    for (const log of testLogs) {
        const tier = Number(log.args[1]);
        if (tier === 0) results.tier0++;
        else if (tier === 1) results.tier1++;
        else if (tier === 2) results.tier2++;
        else if (tier === 3) results.tier3++;
        else results.tier4++;
    }

    const totalReceived = testLogs.length;

    // 5. Restore Config
    console.log("\n--- Restoring Config ---");
    if (originalSeekCost > 0n) {
        await Seeker.setSeekConfig(
            originalSeekCost,
            originalKarmaCost,
            originalPityBase,
            originalPityThreshold
        );
        console.log("✅ Config Restored.");
    }

    // 6. Report
    console.log("\n--- 📊 Probability Report (1000 Runs Target) ---");
    console.log(`Total Wishes Processed: ${totalReceived}`);
    if (totalReceived > 0) {
        console.log(`Tier 0 (Guixu - 0.1%):   ${results.tier0} (${(results.tier0 / totalReceived * 100).toFixed(2)}%)`);
        console.log(`Tier 1 (Divine - 1.0%):  ${results.tier1} (${(results.tier1 / totalReceived * 100).toFixed(2)}%)`);
        console.log(`Tier 2 (Ether - 3.0%):   ${results.tier2} (${(results.tier2 / totalReceived * 100).toFixed(2)}%)`);
        console.log(`Tier 3 (Rare - 10.0%):   ${results.tier3} (${(results.tier3 / totalReceived * 100).toFixed(2)}%)`);
        console.log(`Tier 4 (Common - 85.9%): ${results.tier4} (${(results.tier4 / totalReceived * 100).toFixed(2)}%)`);
    } else {
        console.log("No results received yet. VRF might be delayed.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
