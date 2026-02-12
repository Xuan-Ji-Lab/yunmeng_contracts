const { ethers, network } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf";
    const vrfCoordinatorAddress = "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE";
    const requestId = "0x6d63349d493355792298c46782dd421a96d3901c47b88def07b0d685ef01424b";

    console.log("--- Systematic Debugging: Phase 3 (Simulation) ---");

    // 1. Impersonate VRF Coordinator
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [vrfCoordinatorAddress],
    });

    // 2. Fund Coordinator (10 BNB)
    await network.provider.send("hardhat_setBalance", [
        vrfCoordinatorAddress,
        "0x8AC7230489E80000",
    ]);

    const coordinatorSigner = await ethers.getSigner(vrfCoordinatorAddress);
    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress).connect(coordinatorSigner);

    // 3. Prepare Dummy Random Words (Force Pity)
    // Current user tribCount is 8.
    // Next draw needs to handle 1 random word.
    // If result is Tier 4 (Not Win), tribCount -> 9 -> Trigger Pity.
    // Tier thresholds: [1, 11, 41, 141]. 
    // Random 200 => 200 % 1000 = 200 > 141 => Tier 4.
    const randomWords = [200];

    console.log("Simulating rawFulfillRandomWords...");

    try {
        // Force higher gas limit to avoid OOG masking the real error
        const tx = await seeker.rawFulfillRandomWords(requestId, randomWords, {
            gasLimit: 3000000
        });
        console.log("Transaction processed. Hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILURE");

        // Look for events
        const logs = receipt.logs.map(log => {
            try { return seeker.interface.parseLog(log); } catch (e) { return null; }
        }).filter(l => l !== null);

        const pityEvent = logs.find(l => l.name === 'PityTriggered');
        const payoutFailed = logs.find(l => l.name === 'PayoutFailed');

        if (pityEvent) {
            console.log(`[SUCCESS] Pity Triggered! Amount: ${ethers.formatEther(pityEvent.args.amount)} BNB`);
        } else if (payoutFailed) {
            console.log(`[PARTIAL] Payout Failed! Reason: ${payoutFailed.args.reason}`);
        } else {
            console.log("[INFO] No Pity triggered (maybe tribCount was wrong?)");
        }

    } catch (e) {
        console.error("\n!!! REVERT CAUGHT !!!");
        console.error(e);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
