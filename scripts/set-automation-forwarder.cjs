/**
 * Usage: npx hardhat run scripts/set-automation-forwarder.cjs --network bscTestnet -- --forwarder <ADDRESS>
 */
const hre = require("hardhat");
const fs = require("fs");

async function main() {
    // 1. Parse arguments or env
    let forwarderAddress = process.env.FORWARDER;
    const args = process.argv.slice(2);
    const forwarderIndex = args.indexOf("--forwarder");
    if (forwarderIndex !== -1 && forwarderIndex < args.length - 1) {
        forwarderAddress = args[forwarderIndex + 1];
    }

    if (!forwarderAddress) {
        console.error("Usage: --forwarder <ADDRESS> or FORWARDER=<ADDRESS>");
        process.exit(1);
    }

    if (!hre.ethers.isAddress(forwarderAddress)) {
        console.error("Invalid forwarder address:", forwarderAddress);
        process.exit(1);
    }

    console.log("Setting Automation Forwarder to:", forwarderAddress);

    // 2. Load deployment info
    const deployInfo = JSON.parse(fs.readFileSync("deploy/deployment-modular.json"));
    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const coreAddr = deployInfo.contracts.CloudDreamCore;

    // 3. Get contracts
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const core = await hre.ethers.getContractAt("ICloudDreamCore", coreAddr);
    const [deployer] = await hre.ethers.getSigners();

    console.log("Treasury:", treasuryAddr);
    console.log("Core:", coreAddr);
    console.log("Operator:", deployer.address);

    // 4. Check role
    const CONFIG_ROLE = await core.CONFIG_ROLE();
    const hasRole = await core.hasRole(CONFIG_ROLE, deployer.address);
    if (!hasRole) {
        console.log("Deployer missing CONFIG_ROLE. Attempting to grant...");
        // Check if deployer is DEFAULT_ADMIN
        const DEFAULT_ADMIN = await core.DEFAULT_ADMIN_ROLE();
        if (await core.hasRole(DEFAULT_ADMIN, deployer.address)) {
            const tx = await core.grantRole(CONFIG_ROLE, deployer.address);
            await tx.wait();
            console.log("Granted CONFIG_ROLE to deployer");
        } else {
            console.error("Deployer lacks permission to grant CONFIG_ROLE");
            process.exit(1);
        }
    }

    // 5. Set forwarder
    console.log("Sending tx...");
    const tx = await treasury.setAutomationForwarder(forwarderAddress);
    console.log("Tx Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Automation Forwarder set successfully!");

    // Verify
    const current = await treasury.automationForwarder();
    console.log("Verified on-chain forwarder:", current);
}

main().catch(console.error);
