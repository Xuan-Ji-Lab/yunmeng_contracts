const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const userAddress = "0xB7Ac35615C4B82b430B98fAdC91e257980A21d77"; // User from logs
    console.log("🔍 Checking data for user:", userAddress);

    // Load DreamSeeker
    const DreamSeeker = await hre.ethers.getContractAt(
        "DreamSeeker",
        deploymentInfo.contracts.DreamSeeker
    );
    console.log("📍 DreamSeeker Address:", await DreamSeeker.getAddress());

    // 1. Check Wish Count (if function exists) or try index 0
    // DreamSeeker has `userWishIds` array
    try {
        const firstWishId = await DreamSeeker.userWishIds(userAddress, 0);
        console.log("✅ User HAS Wish Data. First Wish ID:", firstWishId.toString());

        // Check allWishes
        try {
            const wish = await DreamSeeker.allWishes(firstWishId);
            console.log("   allWishes(0) success. WishText:", wish.wishText || wish[2]); // Try named or index
            console.log("   Full Wish Record:", wish);
        } catch (e) {
            console.log("❌ allWishes(0) FAILED:", e.message);
        }

        // Count? Loop until fail
        let count = 1;
        while (true) {
            try {
                await DreamSeeker.userWishIds(userAddress, count);
                count++;
            } catch { break; }
        }
        console.log("   Total Wishes:", count);

    } catch (e) {
        console.log("❌ User has NO Wish Data (userWishIds[0] reverted).");
    }

    // 2. Check Pity IDs (via temp abi if needed, or if DreamSeeker has it)
    // DreamSeeker usually has `pityRecords`? Or `userPityIds`?
    // Let's try `userPityIds` if it exists.
    try {
        // Need ABI that has userPityIds if it's not in standard artifact?
        // It should be in standard artifact if I deployed it.
        const firstPityId = await DreamSeeker.userPityIds(userAddress, 0);
        console.log("✅ User HAS Pity Data. First Pity ID:", firstPityId.toString());
    } catch (e) {
        // Maybe function doesn't exist or empty?
        // Try checking directly if function exists?
        console.log("❌ User has NO Pity Data (or function missing). Error:", e.message);
    }

    // 3. Check Dividend Events (Limit block range)
    const currentBlock = await hre.ethers.provider.getBlockNumber();
    const range = 5000;
    const fromBlock = currentBlock - range > 0 ? currentBlock - range : 0;
    const filter = DreamSeeker.filters.DividendDistributed(userAddress);
    const events = await DreamSeeker.queryFilter(filter, fromBlock);
    console.log(`💰 Dividend Events found (last ${range} blocks): ${events.length}`);
    if (events.length > 0) {
        console.log("   Last Dividend:", events[events.length - 1].args);
    }

    // 4. Check Token Balance
    const Token = await hre.ethers.getContractAt(
        "WishPowerToken",
        deploymentInfo.contracts.WishPowerToken
    );
    const balance = await Token.balanceOf(userAddress);
    console.log("🪙  Token Balance:", hre.ethers.formatEther(balance));

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
