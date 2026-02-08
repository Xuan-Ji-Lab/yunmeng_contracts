const hre = require("hardhat");

async function main() {
    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9"; // Portal
    console.log("Checking Proxy:", FLAP_PORTAL);

    // EIP-1967 Implementation Slot
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

    const impl = await hre.ethers.provider.getStorage(FLAP_PORTAL, IMPLEMENTATION_SLOT);

    // Convert to address
    const address = hre.ethers.stripZerosLeft(impl);

    console.log("Implementation Slot:", impl);
    console.log("Implementation Address:", address);

    // Also check Admin Slot
    const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    const admin = await hre.ethers.provider.getStorage(FLAP_PORTAL, ADMIN_SLOT);
    console.log("Admin Address:", hre.ethers.stripZerosLeft(admin));
}

main().catch(console.error);
