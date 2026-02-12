const { ethers } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf"; // DreamSeeker Proxy
    const requestId = "0x6d63349d493355792298c46782dd421a96d3901c47b88def07b0d685ef01424b";

    // Correct User Address from Tx Logs (Topic 2 of SeekRequestSent)
    const userAddress = "0x4d1CD4c6f9c75Be993bCe42e254AD73fbb121D36";

    console.log(`Checking status on DreamSeeker: ${seekerAddress}`);
    console.log(`Request ID: ${requestId}`);
    console.log(`User Address: ${userAddress}`);

    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    // 1. Check Request Status
    try {
        const req = await seeker.s_requests(requestId);
        console.log("\n--- Request Status ---");
        console.log("Fulfilled:", req.fulfilled);
        console.log("Exists:", req.exists);
        console.log("Is Paid:", req.isPaid);
    } catch (e) {
        console.error("Error fetching s_requests:", e.message);
    }

    // 2. Check User State
    try {
        const tribCount = await seeker.tribulationCounts(userAddress);
        console.log("\n--- User State ---");
        console.log(`Tribulation Count (${userAddress}):`, tribCount.toString());

        // Check if Pity *should* have triggered
        const threshold = await seeker.pityThreshold();
        console.log("Pity Threshold:", threshold.toString());

        // Check Pity Records for this user (to see if it triggered silently?)
        const pityIds = await seeker.getUserPityIds(userAddress);
        console.log("Pity Record Count:", pityIds.length);
        if (pityIds.length > 0) {
            const lastPityId = pityIds[pityIds.length - 1];
            console.log("Last Pity ID:", lastPityId.toString());
        }

    } catch (e) {
        console.error("Error fetching user state:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
