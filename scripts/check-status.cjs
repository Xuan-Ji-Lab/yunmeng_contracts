const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Reading VRF Config & System Status...");

    // 1. Get Deployments
    const deployPath = "deploy/deployment-modular.json";
    const info = JSON.parse(fs.readFileSync(deployPath));
    const contracts = info.contracts;

    // 2. Contracts
    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(contracts.CloudDreamCore);

    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(contracts.DreamTreasury);

    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(contracts.DreamSeeker);

    // 3. Read VRF Params from Core
    console.log(`\n--- VRF Configuration (Core) ---`);
    console.log(`Core Address: ${contracts.CloudDreamCore}`);

    // Explicitly call the getters
    const keyHash = await core.vrfKeyHash();
    const subId = await core.vrfSubscriptionId();
    const gasLimit = await core.vrfCallbackGasLimit();
    const confs = await core.vrfRequestConfirmations();

    console.log(`Key Hash: ${keyHash}`);
    console.log(`Subscription ID: ${subId.toString()} (Should be 1067)`);
    console.log(`Callback Gas Limit: ${gasLimit.toString()}`);
    console.log(`Request Confirmations: ${confs.toString()}`);

    // 4. Read Treasury Status
    console.log(`\n--- Treasury Status ---`);
    console.log(`Treasury Address: ${contracts.DreamTreasury}`);
    const bnbBal = await hre.ethers.provider.getBalance(contracts.DreamTreasury);
    console.log(`BNB Balance: ${hre.ethers.formatEther(bnbBal)} BNB`);

    // Check WISH balance
    const wishToken = contracts.WishPowerToken; // Or read from treasury.wishToken()
    if (wishToken) {
        const ERC20 = await hre.ethers.getContractFactory("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20");
        const token = ERC20.attach(wishToken);
        const wishBal = await token.balanceOf(contracts.DreamTreasury);
        console.log(`WISH Balance: ${hre.ethers.formatEther(wishBal)} WISH`);
    }

    console.log(`Check Seeker Address for Consumer verification: ${contracts.DreamSeeker}`);

}

main().catch(console.error);
