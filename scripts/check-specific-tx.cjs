const hre = require("hardhat");

async function main() {
    const txHash = "0xbc32218d640a09f0238de59aca866c8c265d4353e59aa5dfb4eb62aa46f4a239";
    console.log("Analyzing TX:", txHash);

    const provider = hre.ethers.provider;
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
        console.log("Transaction not found. (Might be pending or wrong network)");
        return;
    }

    console.log("Block Number:", tx.blockNumber);

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
        console.log("Receipt not found.");
        return;
    }

    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Reverted");

    if (receipt.status !== 1) return;

    // Load Contracts to parse logs
    const deployInfo = require("../deploy/deployment-modular.json");
    const seeker = await hre.ethers.getContractAt("DreamSeeker", deployInfo.contracts.DreamSeeker);
    const vrf = await hre.ethers.getContractAt("VRFCoordinatorV2Interface", deployInfo.config.vrfCoordinator);
    const treasury = await hre.ethers.getContractAt("DreamTreasury", deployInfo.contracts.DreamTreasury);

    // Parse Logs
    let requestId = null;

    console.log("\n--- Logs ---");
    for (const log of receipt.logs) {
        try {
            // Try identifying log source
            let parsed = null;
            let source = "Unknown";

            if (log.address.toLowerCase() === seeker.target.toLowerCase()) {
                parsed = seeker.interface.parseLog(log);
                source = "DreamSeeker";
            } else if (log.address.toLowerCase() === vrf.target.toLowerCase()) {
                // VRF Coordinator logs... might be complex interface
                source = "VRFCoordinator";
            } else if (log.address.toLowerCase() === treasury.target.toLowerCase()) {
                parsed = treasury.interface.parseLog(log);
                source = "DreamTreasury";
            }

            if (parsed) {
                console.log(`[${source}] ${parsed.name}:`, parsed.args);
                if (parsed.name === "SeekRequestSent") {
                    requestId = parsed.args.requestId;
                    console.log("🆔 Found RequestID:", requestId.toString());
                }
                if (parsed.name === "AbyssTriggered") {
                    console.log("🌌 Abyss Triggered! (In this TX? Is this a callback or a test call?)");
                }
            }
        } catch (e) {
            // ignore parse error
        }
    }

    // If we found a RequestID, we need to check if it was fulfilled.
    if (requestId) {
        console.log("\n--- Checking VRF Status ---");
        const status = await seeker.s_requests(requestId);
        console.log("Fulfilled:", status.fulfilled);
        console.log("Exists:", status.exists);

        if (status.fulfilled) {
            console.log("✅ VRF Request Fulfilled!");
            // We can't easily find the fulfillment TX without Event Indexing or scanning blocks.
            // But we can check the result on-chain if we know the user.
            // Let's check the user's latest wish.
            const user = tx.from;
            const wishCount = await seeker.getUserWishCount(user);
            if (wishCount > 0) {
                const lastWishId = (await seeker.getUserWishIdsBatch(user, wishCount - 1, 1))[0];
                const wish = (await seeker.getWishRecordsBatch([lastWishId]))[0];
                console.log("Checking User's Last Wish (ID: " + wish.id + "):");
                console.log("  Tier:", wish.tier.toString() === "0" ? "🌌 Abyss (Tier 0)" : wish.tier.toString());
                console.log("  Round:", wish.round.toString());
                console.log("  Reward:", hre.ethers.formatEther(wish.reward), "WISH");
                console.log("  Dividend Pool:", hre.ethers.formatEther(wish.poolAtTime));
            }

        } else {
            console.log("⏳ Waiting for VRF Fulfillment... (Check 'RandomWordsFulfilled' on VRF Coordinator)");
        }
    } else {
        // Maybe this IS the fulfillment TX? (unlikely if 'from' is user)
        // If 'to' is VRF Coordinator and method is fulfillRandomWords...
    }
}

main().catch(console.error);
