const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🎲 Testing Live VRF Integration (Standard Probabilities)...");

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

    // 3. Initiate Seek Request
    // We need to pay 'seekCost' (0.005 BNB default)
    const seekCost = await Seeker.seekCost();
    console.log(`Seek Cost: ${ethers.formatEther(seekCost)} BNB`);

    console.log("\n--- Sending 'seekTruth' Transaction ---");
    const tx = await Seeker.seekTruth("Live VRF Test Wish", { value: seekCost });
    const rc = await tx.wait();

    // 4. Parse Request ID
    const requestEvent = rc.logs.find(x => x.fragment && x.fragment.name === 'SeekRequestSent');
    if (!requestEvent) {
        console.error("❌ No SeekRequestSent event found. Transaction failed?");
        return;
    }
    const requestId = requestEvent.args[0];
    console.log(`✅ Request Sent! Request ID: ${requestId}`);

    // 5. Wait for Fulfillment
    console.log("\n⏳ Waiting for Chainlink VRF Callback (this may take 1-5 mins)...");

    // We will poll for the `SeekResult` event for this user
    // Filter: SeekResult(address indexed user, uint8 tier, uint256 reward, string wishText)
    const filter = Seeker.filters.SeekResult(deployer.address);

    let found = false;
    const maxRetries = 60; // 60 * 3s = 3 mins
    for (let i = 0; i < maxRetries; i++) {
        process.stdout.write(".");
        const events = await Seeker.queryFilter(filter, rc.blockNumber); // Query from request block

        if (events.length > 0) {
            // Find the one that matches our wish text or most recent
            const event = events.find(e => e.args[3] === "Live VRF Test Wish");
            if (event) {
                console.log("\n\n🎉 VRF Fulfilled!");
                const tier = event.args[1];
                const reward = event.args[2];
                console.log(`Result Tier: ${tier} (0=Guixu, 1=Divine, 2=Ethereal, 3=Rare, 4=Common)`);
                console.log(`Reward: ${ethers.formatEther(reward)} tokens/BNB`);
                found = true;
                break;
            }
        }
        await new Promise(r => setTimeout(r, 3000));
    }

    if (!found) {
        console.log("\n⚠️ Timeout waiting for VRF. Check Chainlink subscription balance or BscScan.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
