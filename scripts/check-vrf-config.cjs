const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Checking VRF Configuration...");

    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    const info = JSON.parse(fs.readFileSync(deployPath));
    const coreAddress = info.contracts.CloudDreamCore;

    // 2. Attach Core
    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    // 3. Get Config
    const keyHash = await core.vrfKeyHash();
    const subId = await core.vrfSubscriptionId();
    const gasLimit = await core.vrfCallbackGasLimit();
    const confs = await core.vrfRequestConfirmations();

    console.log(`Key Hash: ${keyHash}`);
    console.log(`Subscription ID: ${subId}`);
    console.log(`Callback Gas Limit: ${gasLimit}`);
    console.log(`Confirmations: ${confs}`);

    // Known BSC Mainnet Hash (200 gwei)
    // https://docs.chain.link/vrf/v2/subscription/supported-networks#bnb-chain-mainnet
    const KNOWN_HASH = "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314"; // 200 gwei (standard)
    // 0xba9e7e78e1215c0e12798f98a3c5a363... is also a hash? No, let's verify.
}

main().catch(console.error);
