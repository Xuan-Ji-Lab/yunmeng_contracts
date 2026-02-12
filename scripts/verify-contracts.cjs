const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const networkName = hre.network.name;
    console.log(`Starting verification on ${networkName}...`);

    // Load deployment info
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const contracts = info.contracts;

    console.log("Loaded deployment info:", contracts);

    // Helper to verify a contract
    // For proxies, we usually verify the implementation. 
    // Hardhat-upgrades plugin helps with this, but standard 'verify' task 
    // often needs the implementation address if the proxy is already verified as a proxy.
    // HOWEVER, for UUPS/Transparent proxies deployed with hardhat-upgrades,
    // we should try verifying the Proxy address first. Hardhat often detects it.

    // Core (Proxy)
    await verify(contracts.CloudDreamCore, []);

    // Treasury (Proxy)
    await verify(contracts.DreamTreasury, []);

    // Drifter (Proxy)
    await verify(contracts.DreamDrifter, []);

    // Oracle (Proxy)
    await verify(contracts.DreamOracle, []);

    // Seeker (Proxy) ? 
    // Note: Seeker might have constructor args for initialize? No, it's UUPS.
    await verify(contracts.DreamSeeker, []);

    // BatchReader (Normal Contract)
    // Constructor args: [seekerAddress, oracleAddress]
    await verify(contracts.CloudDreamBatchReader, [
        contracts.DreamSeeker,
        contracts.DreamOracle
    ]);

    console.log("Verification sequence complete!");
}

async function verify(address, args) {
    if (!address) return;
    try {
        console.log(`\nVerifying ${address} ...`);
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: args,
        });
    } catch (e) {
        console.log(`❌ Failed to verify ${address}: ${e.message}`);
        // Often fails if already verified, which is fine.
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
