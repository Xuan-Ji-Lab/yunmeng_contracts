const { ethers } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf";
    console.log(`Checking VRF Config via Seeker: ${seekerAddress}`);

    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    const coreAddress = await seeker.core();
    console.log("Core Address:", coreAddress);

    const vrfCoordinator = await seeker.vrfCoordinator();
    console.log("Seeker -> VRF Coordinator:", vrfCoordinator);

    const CloudDreamCore = await ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    const subId = await core.vrfSubscriptionId();
    const keyHash = await core.vrfKeyHash();
    const gasLimit = await core.vrfCallbackGasLimit();

    console.log("\n--- On-Chain Configuration ---");
    console.log("Subscription ID:", subId.toString());
    console.log("Key Hash:", keyHash);
    console.log("Callback Gas Limit:", gasLimit.toString());

    // Also check if Seeker is a valid consumer (if we could, but that's on VRF contract)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
