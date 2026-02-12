const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Switching VRF Key Hash to 200 gwei lane...");

    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const coreAddress = info.contracts.CloudDreamCore;

    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    // Current Config (Preserve these)
    const currentSubId = await core.vrfSubscriptionId();
    const currentGasLimit = await core.vrfCallbackGasLimit();
    const currentConfirmations = await core.vrfRequestConfirmations();

    console.log(`Current Config:`);
    console.log(`- Sub ID: ${currentSubId}`);
    console.log(`- Gas Limit: ${currentGasLimit}`);
    console.log(`- Confirmations: ${currentConfirmations}`);

    // New Key Hash (BSC Mainnet 200 gwei)
    // https://docs.chain.link/vrf/v2/subscription/supported-networks#bnb-chain-mainnet
    const NEW_KEY_HASH = "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314";

    console.log(`\nNew Key Hash: ${NEW_KEY_HASH} (200 gwei)`);

    if ((await core.vrfKeyHash()) === NEW_KEY_HASH) {
        console.log("Already using 200 gwei lane. No changes needed.");
        return;
    }

    console.log("Updating VRF Config...");
    const tx = await core.setVRFConfig(
        NEW_KEY_HASH,
        currentSubId,
        currentGasLimit,
        currentConfirmations
    );

    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ VRF Lane Switched Successfully!");

    const updatedHash = await core.vrfKeyHash();
    console.log(`Verified New Hash: ${updatedHash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
