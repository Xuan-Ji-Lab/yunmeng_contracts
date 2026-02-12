const hre = require("hardhat");
const fs = require("fs");

async function main() {
    const networkName = hre.network.name;
    const isMainnet = networkName.includes("Mainnet");
    console.log(`Disabling tax buyback on ${networkName}...`);

    // 1. Load deployment info to get Treasury address
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const treasuryAddress = info.contracts.DreamTreasury;

    if (!treasuryAddress) {
        throw new Error("DreamTreasury address not found in deployment file.");
    }

    console.log(`Treasury Address: ${treasuryAddress}`);

    // 2. Attach to Treasury contract
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    // 3. Check current state and fetch other params needed for setOpsConfig
    const currentStatus = await treasury.enableTaxBuyback();
    const currentOpsWallet = await treasury.opsWallet();
    const currentThreshold = await treasury.minBuybackThreshold();
    const currentBps = 0; // The bps param is ignored in the contract implementation

    console.log(`Current enableTaxBuyback: ${currentStatus}`);
    console.log(`Current opsWallet: ${currentOpsWallet}`);
    console.log(`Current minBuybackThreshold: ${currentThreshold}`);

    if (!currentStatus) {
        console.log("enableTaxBuyback is already false. No action needed.");
        return;
    }

    // 4. Disable it using setOpsConfig
    // function setOpsConfig(address _wallet, uint256 /*_bps*/, uint256 _threshold, bool _enableBuyback)
    console.log("Setting enableTaxBuyback to false via setOpsConfig...");
    const tx = await treasury.setOpsConfig(
        currentOpsWallet,
        currentBps,
        currentThreshold,
        false // _enableBuyback
    );
    console.log(`Transaction sent: ${tx.hash}`);

    await tx.wait();
    console.log("✅ Successfully disabled tax buyback.");

    // 5. Verify
    const newStatus = await treasury.enableTaxBuyback();
    console.log(`New enableTaxBuyback status: ${newStatus}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
