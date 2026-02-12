const { ethers } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf";
    console.log(`--- Systematic Debugging: Phase 1 (Data Gathering) ---`);

    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    // 1. Verify Core Connection & Authorization
    const coreAddress = await seeker.core();
    const CloudDreamCore = await ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    console.log(`Core Address: ${coreAddress}`);

    // Check if Seeker is correctly registered in Core (for modifiers)
    const registeredSeeker = await core.seeker();
    console.log(`Core.seeker(): ${registeredSeeker}`);
    console.log(`Match? ${registeredSeeker === seekerAddress ? "YES" : "NO"}`);

    if (registeredSeeker !== seekerAddress) {
        console.error("CRITICAL: Seeker address mismatch! Seeker cannot call admin functions.");
    }

    // 2. Verify Treasury State
    const treasuryAddress = await seeker.treasury();
    console.log(`Treasury Address: ${treasuryAddress}`);

    const treasuryBal = await ethers.provider.getBalance(treasuryAddress);
    console.log(`Treasury Balance: ${ethers.formatEther(treasuryBal)} BNB`);

    // 3. Verify VRF Config Again (Just in case)
    const subId = await core.vrfSubscriptionId();
    console.log(`VRF Subscription ID: ${subId}`);

    // 4. Check Pity Config
    const pityThreshold = await seeker.pityThreshold();
    const pityBase = await seeker.pityBase();
    console.log(`Pity Config: Threshold=${pityThreshold}, Base=${ethers.formatEther(pityBase)} BNB`);

    // 5. User Specific State (The failing user)
    const user = "0x4d1CD4c6f9c75Be993bCe42e254AD73fbb121D36";
    const tribCount = await seeker.tribulationCounts(user);
    const weight = await seeker.userTribulationWeight(user);
    console.log(`User Tribulation: ${tribCount}, Weight: ${weight}`);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
