const { ethers, upgrades } = require("hardhat");

async function main() {
    const proxyAddress = "0x4BA7ACf83AF75657c0Cdaa66310499CAf2775d8F"; // From previous verification logs step 549/552: "Treasury Address: 0x4BA..."
    console.log(`Upgrading DreamTreasury at: ${proxyAddress}`);

    // 1. Get Factory
    const DreamTreasury = await ethers.getContractFactory("DreamTreasury");

    // 2. Validate Upgrade (Optional but good)
    // await upgrades.forceImport(proxyAddress, DreamTreasury); // If needed

    // 3. Upgrade
    console.log("Proposing upgrade...");
    const upgraded = await upgrades.upgradeProxy(proxyAddress, DreamTreasury, {
        unsafeAllow: ['constructor']
    });

    console.log("Upgrade transaction sent. Waiting...");
    await upgraded.waitForDeployment();

    console.log("DreamTreasury upgraded successfully!");
    console.log("Implementation Address:", await upgrades.erc1967.getImplementationAddress(proxyAddress));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
