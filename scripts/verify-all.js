const { ethers, run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log(`Starting verification on ${network.name}...`);

    // Load deployment info
    const deploymentPath = path.join(__dirname, "../../ethereal-realm/src/deployment-modular.json");
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment info not found at:", deploymentPath);
        return;
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    // Helper to get implementation address from proxy
    // EIP-1967 Implementation Slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

    async function getImplementationAddress(proxyAddress) {
        try {
            const implHex = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
            // Convert bytes32 to address (strip padding)
            return "0x" + implHex.slice(-40);
        } catch (e) {
            console.error(`Failed to get implementation for ${proxyAddress}`, e);
            return null;
        }
    }

    async function verifyContract(name, address, isProxy = true) {
        let targetAddress = address;

        if (isProxy) {
            console.log(`\n[${name}] Resolving Implementation for Proxy: ${address}`);
            const impl = await getImplementationAddress(address);
            if (!impl || impl === ethers.ZeroAddress) {
                console.warn(`[${name}] Could not resolve implementation. Skipping.`);
                return;
            }
            console.log(`[${name}] Implementation Address: ${impl}`);
            targetAddress = impl;
        } else {
            console.log(`\n[${name}] Verifying Direct Contract: ${address}`);
        }

        try {
            await run("verify:verify", {
                address: targetAddress,
                constructorArguments: [],
            });
            console.log(`[${name}] ✅ Verified!`);
        } catch (e) {
            if (e.message.includes("Already Verified")) {
                console.log(`[${name}] ⚠️ Already Verified.`);
            } else {
                console.error(`[${name}] ❌ Verification Failed:`, e.message);
            }
        }
    }

    // --- Execution ---

    // 1. Core
    await verifyContract("CloudDreamCore", contracts.CloudDreamCore);

    // 2. Token
    await verifyContract("WishPowerToken", contracts.WishPowerToken);

    // 3. Treasury
    await verifyContract("DreamTreasury", contracts.DreamTreasury);

    // 4. Drifter
    await verifyContract("DreamDrifter", contracts.DreamDrifter);

    // 5. Oracle
    await verifyContract("DreamOracle", contracts.DreamOracle);

    // 6. Seeker
    await verifyContract("DreamSeeker", contracts.DreamSeeker);

    // 7. BatchReader (Usually not a proxy, but let's check. Assuming NOT proxy for now based on typical deployment)
    // If BatchReader was deployed as upgradeable, treat as proxy. If standard, treat as normal.
    // Based on `deployment-modular.json` structure, usually all are upgradeable in this project?
    // Let's assume Upgradeable for safety, getImplementation will return 0 if not proxy (or random slot).
    // Actually, BatchReader is often just a helper. Let's try verify directly if it's not a proxy.
    // Logic: Try verify as implementation first?
    // Let's just assume Proxy for now as the user said "all contracts are UUPS".
    await verifyContract("CloudDreamBatchReader", contracts.CloudDreamBatchReader);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
