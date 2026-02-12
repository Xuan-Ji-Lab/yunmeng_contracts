const { ethers } = require("hardhat");

async function main() {
    const seekerAddress = "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf"; // DreamSeeker Proxy
    console.log(`Checking VRF Gas Limit via DreamSeeker -> Core`);

    const DreamSeeker = await ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    const coreAddress = await seeker.core();
    console.log("Core Address:", coreAddress);

    const CloudDreamCore = await ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    const limit = await core.vrfCallbackGasLimit();
    console.log("VRF Callback Gas Limit:", limit.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
