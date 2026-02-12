const { ethers } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf";
    console.log(`Checking config on DreamSeeker: ${seekerAddress}`);

    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    const cost = await seeker.seekCost();
    console.log("Seek Cost:", ethers.formatEther(cost), "BNB");

    const subId = await seeker.core().then(coreAddr => {
        // Need core interface or just assum core has vrfSubscriptionId()
        return ethers.getContractAt("CloudDreamCore", coreAddr).then(c => c.vrfSubscriptionId());
    });
    console.log("VRF Subscription ID:", subId.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
