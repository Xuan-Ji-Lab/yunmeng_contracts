const { ethers, network } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf";
    const vrfCoordinatorAddress = "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE";
    const treasuryAddress = "0x4386703277717804470a1e05a109855521b764c6"; // Found from previous deployment or check
    const requestId = "0x6d63349d493355792298c46782dd421a96d3901c47b88def07b0d685ef01424b";

    console.log("--- Simulating VRF Callback on Mainnet Fork (Low Level) ---");

    // 1. Impersonate VRF Coordinator (Low Level)
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [vrfCoordinatorAddress],
    });
    const coordinatorSigner = await ethers.getSigner(vrfCoordinatorAddress);

    // Fund the coordinator
    await network.provider.send("hardhat_setBalance", [
        vrfCoordinatorAddress,
        "0x8AC7230489E80000", // 10 ETH
    ]);

    // 2. Fund Treasury (Just in case Pity payout fails due to low balance, though it should be caught)
    // Let's check Treasury Balance first
    const treasuryBal = await ethers.provider.getBalance(treasuryAddress);
    console.log(`Treasury Balance: ${ethers.formatEther(treasuryBal)} BNB`);

    // 3. Attach Seeker
    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress).connect(coordinatorSigner);

    // 4. Prepare Dummy Random Words to trigger Pity (Normal Tier)
    // Tier 4 (Normal) triggers Pity increment.
    // 200 % 1000 = 200 > 141 => Tier 4.
    const randomWords = [200];

    console.log("Calling rawFulfillRandomWords...");

    try {
        const tx = await seeker.rawFulfillRandomWords(requestId, randomWords, {
            gasLimit: 2000000 // Match config
        });
        console.log("Transaction sent. Hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("Transaction Success! status:", receipt.status);
        console.log("Gas Used:", receipt.gasUsed.toString());

        // Check logs to see if PityTriggered or PayoutFailed
        for (const log of receipt.logs) {
            try {
                // Simple check if it's our event
                const parsed = seeker.interface.parseLog(log);
                console.log(`Event: ${parsed.name}`);
                if (parsed.name === 'PityTriggered') {
                    console.log(">> PITY TRIGGERED SUCCESS <<");
                    console.log("Amount:", ethers.formatEther(parsed.args.amount));
                }
                if (parsed.name === 'PayoutFailed') {
                    console.log(">> PAYOUT FAILED <<");
                    console.log("Reason:", parsed.args.reason);
                }
            } catch (e) { }
        }

    } catch (e) {
        console.error("\n!!! TRANSACTION REVERTED !!!");

        if (e.data) {
            console.error("Revert Data:", e.data);
            // Try to decode PayoutFailed/Error
            try {
                const decoded = seeker.interface.parseError(e.data);
                console.error("Decoded Error:", decoded);
            } catch (decErr) {
                console.error("Could not decode error");
            }
        } else {
            console.error("Error Message:", e.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
